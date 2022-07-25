import {
  BaseController,
  BaseState,
  BN,
  KeyringConfig,
  PreferencesController,
  PreferencesState,
} from '@metamask/controllers';
import BigNumber from 'bignumber.js';
import { DeliverTxResponse, IndexedTx } from '@cosmjs/stargate';
import MisesSdk from 'mises-js-sdk/dist/lib/mises-js-sdk';
import { MAppMgr } from 'mises-js-sdk/dist/types/mapp';
import {
  MisesCoin,
  MisesConfig,
  MsgReader,
} from 'mises-js-sdk/dist/types/mises';
import { MUser, MUserMgr } from 'mises-js-sdk/dist/types/muser';
import {
  getBaseApi,
  misesAPi,
  MISES_TRUNCATED_ADDRESS_START_CHARS,
  request,
  shortenAddress,
} from './misesNetwork.util';
import AnalyticsV2 from '../../util/analyticsV2';
import Analytics from '../Analytics/Analytics';
import { uuid } from '@walletconnect/utils';

import { NativeModules } from 'react-native';
import { BNToHex, toHex } from '@metamask/controllers/dist/util';
const { MisesModule } = NativeModules;
export const MISES_POINT = 'http://127.0.0.1:26657';
export interface misesBalance {
  amount: string;
  denom: string;
}
export interface misesAccount {
  address: string;
  misesBalance: misesBalance;
  misesId: string;
  token?: string;
  userInfo?: {
    name: string;
    avatarUrl: string | undefined;
  };
  timestamp?: number;
  auth?: string;
  transactions?: indexed[];
  height?: number;
}
interface accounts {
  [key: string]: misesAccount;
}
interface misesState extends BaseState {
  accountList: accounts;
  transformFlag: 'loading' | 'error' | 'success';
}
interface misesGasfee {
  gasWanted: string | undefined;
}
interface indexed extends IndexedTx {
  raw: any[];
}
class MisesController extends BaseController<KeyringConfig, misesState> {
  getKeyringAccounts: () => Promise<string[]>;
  updateIdentities: PreferencesController['updateIdentities'];
  exportAccount: (address: string) => Promise<string>;
  #config: MisesConfig;
  #coinDefine: MisesCoin;
  #msgReader: MsgReader;
  #misesSdk: MisesSdk;
  #misesAppMgr: MAppMgr;
  #misesUser: MUserMgr;
  #misesGasfee: misesGasfee;
  constructor(
    {
      getKeyringAccounts,
      updateIdentities,
      onPreferencesStateChange,
      exportAccount,
    }: {
      getKeyringAccounts(): Promise<string[]>;
      updateIdentities: PreferencesController['updateIdentities'];
      onPreferencesStateChange: (
        listener: (preferencesState: PreferencesState) => void,
      ) => void;
      exportAccount: (address: string) => Promise<string>;
    },
    config?: Partial<KeyringConfig>,
    state?: Partial<misesState>,
  ) {
    super(config, state);
    this.name = 'MisesController';
    this.getKeyringAccounts = getKeyringAccounts;
    this.updateIdentities = updateIdentities;
    // init Mises sdk
    this.#config = MisesSdk.newConfig();
    this.exportAccount = exportAccount;
    this.#misesSdk = MisesSdk.newSdk(this.#config);
    this.#coinDefine = MisesSdk.newCoinDefine();
    this.#msgReader = MisesSdk.newMsgReader();
    this.#coinDefine.load();
    this.#config.setLCDEndpoint(MISES_POINT);
    this.#misesUser = this.#misesSdk.userMgr();
    this.#misesAppMgr = this.#misesSdk.appMgr();
    this.#misesGasfee = {
      gasWanted: undefined,
    };
    this.defaultState = {
      accountList: {},
      transformFlag: 'loading',
    };
    onPreferencesStateChange(async (preferencesState) => {
      try {
        const key = await exportAccount(preferencesState.selectedAddress); // get priKeyHex
        await this.activate(key); // set activity user
        const userInfo = await this.getMisesUserInfo(
          preferencesState.selectedAddress,
        ); // get activity user
        const misesAccount = await this.getMisesBalance(
          preferencesState.selectedAddress,
        ); // get mises balance
        const accountList = this.getAccountList();
        if (!accountList[preferencesState.selectedAddress]) {
          this.update({
            accountList: {
              ...accountList,
              [preferencesState.selectedAddress]: misesAccount,
            },
          });
        }
        userInfo && (await this.setToMisesPrivate(userInfo));
      } catch (error) {
        console.warn(error, preferencesState.selectedAddress);
      }
    });
    this.initialize();
  }
  /**
   * @returns mises Account list
   */
  getAccountList(): accounts {
    const { accountList } = this.state;
    return accountList;
  }
  /**
   * 1. Get all accounts
   * 2.Get mises balance by account number
   */
  async getAccountMisesBalance(): Promise<void> {
    try {
      const keyringList = await this.getKeyringAccounts();
      const accounts = {} as accounts;
      const promiseAccount = keyringList.map((val) =>
        this.getMisesBalance(val),
      );
      const res = await Promise.all(promiseAccount);
      res.forEach((val) => (accounts[val.address] = val));
      this.update({
        accountList: accounts,
      });
    } catch (error) {
      Analytics.trackEventWithParameters('getAccountMisesBalanceError', {
        getAccountMisesBalanceError: error,
      });
      return Promise.reject(error);
    }
  }
  async getMisesBalance(address: string): Promise<misesAccount> {
    try {
      const accountList = this.getAccountList();
      const misesBalance: misesBalance = await this.getUserBalance(address);
      const user = await this.getMisesUser(address);
      const cacheObj = accountList[address] || {};
      return {
        ...cacheObj,
        address,
        misesBalance,
        misesId: user.address(),
      };
    } catch (error) {
      return Promise.reject(error);
    }
  }

  /**
   * @parmas address - 0x
   * @returns mises user
   */
  async getMisesUser(address: string): Promise<MUser> {
    try {
      const key = await this.exportAccount(address); // get priKeyHex
      const user = await this.#misesUser.getUser(key);
      return user;
    } catch (error) {
      return Promise.reject(error);
    }
  }

  /**
   * @parmas address - 0x
   * @returns mises balance
   */
  async getUserBalance(address: string): Promise<misesBalance> {
    // console.log();
    const defaultCoin: misesBalance = {
      amount: '0',
      denom: 'MIS',
    };
    try {
      const user = await this.getMisesUser(address);
      const balanceLong = await user.getBalanceUMIS();
      if (user && balanceLong) {
        const balanceObj = this.#coinDefine.toCoinMIS(balanceLong);
        return {
          ...balanceObj,
          denom: balanceObj.denom.toUpperCase(),
        };
      }
      return Promise.resolve(defaultCoin);
    } catch (error) {
      // console.log(error);
      return Promise.resolve(defaultCoin);
    }
  }
  /**
   * @parmas priKeyHex
   * @returns {object} MUser
   */
  async activate(priKeyHex: string) {
    return this.#misesUser.activateUser(priKeyHex);
  }
  /**
   * @returns {object} MUser
   */
  getServerToken(query: {
    provider: string;
    user_authz: {
      auth: string;
    };
    referrer: string;
  }): Promise<{ token: string }> {
    return request({
      url: getBaseApi(misesAPi.signin),
      method: 'post',
      body: query,
    });
  }
  /*
   * get mises network gesfee
   */
  async getGasPrices(): Promise<{
    propose_gasprice: string | number;
  }> {
    try {
      const res = await request({
        url: getBaseApi(misesAPi.gasprices),
      });
      return res;
    } catch (error) {
      return Promise.resolve({
        propose_gasprice: 0,
      });
    }
  }
  /* get active user */
  getActive() {
    return this.#misesUser.activeUser();
  }
  async generateAuth(
    nonce: string,
    key?: string,
  ): Promise<{
    auth: string;
    misesId: string;
  }> {
    try {
      const activeUser = key ? await this.activate(key) : this.getActive();
      const auth = (await activeUser?.generateAuth(nonce)) || '';
      return {
        auth,
        misesId: activeUser?.address() || '',
      };
    } catch (error) {
      // return error;
      return Promise.reject(error);
    }
  }

  /*
   * get browser install referrer
   */
  getinstallreferrer(): Promise<string> {
    return new Promise((resolve) => {
      // if (chrome.misesPrivate?.getInstallReferrer) {
      //   chrome.misesPrivate.getInstallReferrer((res: string) => {
      //     resolve(res);
      //   });
      //   return;
      // }
      resolve('');
    });
  }
  addressFindItem(address: string) {
    const accountList = this.getAccountList();
    const account = accountList[address];
    return account;
  }
  /**
   * @type address
   * @property {string} address - The account's ethereum address, in lower case.
   * @type token
   * @property {string} token - The token to be used for the transaction.
   * @returns {object} MUser
   * set store token
   */
  async misesUserInfo(address: string): Promise<misesAccount> {
    const activeUser = this.getActive();
    const misesId = activeUser ? activeUser.address() : '';
    const account = this.addressFindItem(address);
    const nowTimeStamp = new Date().getTime();
    if (account) return account;
    try {
      const { auth } = await this.generateAuth(`${nowTimeStamp}`);
      const misesBalance = await this.getUserBalance(address);
      return {
        address,
        misesId,
        misesBalance,
        auth,
      };
    } catch (error) {
      return Promise.reject(error);
    }
  }

  async setMisesUserInfo(account: misesAccount) {
    const accountList = this.getAccountList();
    if (!account.auth) {
      return account;
    }
    try {
      const referrer = await this.getinstallreferrer();
      const { token } = await this.getServerToken({
        provider: 'mises',
        user_authz: { auth: account.auth },
        referrer,
      });
      // console.warn(referrer, 'referrer');
      account.token = token; // token;
      account.timestamp = new Date().getTime();
      const activeUser = this.getActive();
      const misesId = activeUser ? activeUser.address() : '';
      const isRegistered = await activeUser?.isRegistered();
      if (isRegistered) {
        // console.log(isRegistered, 'not found userinfo cache');
        const userInfo = await activeUser?.info();
        account.userInfo = {
          name:
            userInfo?.name ||
            shortenAddress(misesId, MISES_TRUNCATED_ADDRESS_START_CHARS),
          avatarUrl: userInfo?.avatarUrl,
        };
      }
      accountList[account?.address] = account;
      this.update({
        accountList,
      });
      return account;
    } catch (error) {
      console.warn(error, '===================');
      return account;
    }
  }
  /*
   *  return mises userInfo
   */
  async getMisesUserInfo(address: string) {
    try {
      const activeUser = this.getActive();
      const misesId = activeUser ? activeUser.address() : '';
      let account = await this.misesUserInfo(address);
      const nowTimeStamp = new Date().getTime();
      const expireTokenFlag =
        account.token &&
        account.timestamp &&
        nowTimeStamp - account.timestamp > 604800000; // 6 days
      if (account.auth && (!account.token || expireTokenFlag)) {
        account = await this.setMisesUserInfo(account);
      }
      const userinfo = {
        nickname: account.userInfo
          ? account.userInfo.name
          : shortenAddress(misesId, MISES_TRUNCATED_ADDRESS_START_CHARS),
        avatar: account.userInfo?.avatarUrl || '',
        misesId,
        token: account.token || '',
      };
      return userinfo;
    } catch (error) {
      console.warn('getMisesUserInfo:Error==================', error);
    }
  }
  /**
   * set mises userInfo to browser
   */
  async setToMisesPrivate(params: {
    misesId: string;
    nickname: string;
    avatar: string;
    token: string;
  }): Promise<void> {
    AnalyticsV2.trackEvent('Ready to call setmisesid', params);
    MisesModule?.setMisesUserInfo?.(JSON.stringify(params));
    // window.localStorage.setItem('setAccount', true);
    // return new Promise((resolve) => {
    //   /* global chrome */
    //   if (chrome.misesPrivate) {
    //     chrome.misesPrivate.setMisesId(JSON.stringify(params));
    //     return resolve();
    //   }
    //   console.warn('The missesprivate object does not exist');
    //   return resolve();
    //   // return reject(JSON.stringify(params));
    // });
  }
  misesIdFindEthAddress(misesId: string) {
    const accountList = this.getAccountList();
    let address = '';
    for (const key in accountList) {
      const item = accountList[key];
      if (item.misesId === misesId) {
        address = key;
      }
    }
    return address;
  }
  // Set up set mises userInfo
  async setUserInfo(data: any) {
    try {
      const activeUser = this.getActive();
      const userinfo = await activeUser?.info();
      const version = userinfo?.version.add(1);
      const info = await activeUser?.setInfo({
        ...data,
        version,
      });
      const accountList = this.getAccountList();
      const misesId = activeUser?.address() || '';
      const address = this.misesIdFindEthAddress(misesId);
      const account = accountList[address];
      if (account) {
        const { token } = accountList[address] || '';
        const updateUserInfo = {
          nickname:
            data.name ||
            shortenAddress(misesId, MISES_TRUNCATED_ADDRESS_START_CHARS),
          avatar: data.avatarUrl,
          token: token ?? '',
          misesId,
        };
        token && this.setToMisesPrivate(updateUserInfo); // set mises userInfo to browser
        // set mises to chrome extension
        accountList[address].userInfo = {
          name: updateUserInfo.nickname,
          avatarUrl: updateUserInfo.avatar,
        };
        // update accountList
        this.update({
          accountList,
        });
        AnalyticsV2.trackEvent('update userinfo cache ', accountList[address]);
      }
      AnalyticsV2.trackEvent('setinfo success ', { ...info });
      return info;
    } catch (error) {
      console.warn(error, 'error');
      return false;
    }
  }
  // Set up set mises unFollow
  setUnFollow(misesId: string) {
    console.warn('mises:setUnFollow');
    const activeUser = this.getActive();
    return activeUser?.unfollow(misesId);
  }
  // Set up set mises follow
  setFollow(misesId: string) {
    console.warn('mises:setFollow');
    const activeUser = this.getActive();
    return activeUser?.follow(misesId);
  }
  // Set up set mises chain
  async connect({
    domain,
    appid,
    userid,
    permissions,
  }: {
    domain: string;
    appid: string;
    userid: string;
    permissions: string[];
  }) {
    try {
      await this.#misesAppMgr.ensureApp(appid, domain);
      const connect = await this.#misesSdk.connect(
        domain,
        appid,
        userid,
        permissions,
      );
      return connect;
    } catch (error) {
      return false;
    }
  }
  disconnect({ appid, userid }: { appid: string; userid: string }) {
    return this.#misesSdk.disconnect(appid, userid);
  }

  async addressToMisesId(address: string) {
    const user = await this.getMisesUser(address);
    return user.address();
  }
  async gasPriceAndLimit() {
    try {
      const gasPrices = await this.getGasPrices();

      const proposeGasprice =
        gasPrices.propose_gasprice || this.#config.gasPrice();

      this.#config.setGasPriceAndLimit(Number(proposeGasprice), 200000);
      console.warn('gasPriceAndLimit', proposeGasprice);
      return proposeGasprice;
    } catch (error) {
      return Promise.resolve(this.#config.gasPrice());
    }
  }
  async setMisesBook(
    misesId: string,
    amount: string,
    simulate = false,
    memo = '',
  ) {
    const activeUser = this.getActive();
    const amountLong = this.#coinDefine.fromCoin({
      amount,
      denom: 'mis',
    });
    // console.warn(simulate, 'simulate');
    // console.warn(memo, 'getMemo');
    if (!simulate) {
      try {
        const res: DeliverTxResponse | undefined = await activeUser?.sendUMIS(
          misesId,
          amountLong,
          simulate,
          memo,
        );
        this.update({
          transformFlag: res?.code === 0 ? 'success' : 'error',
        });
        console.warn(res, memo, 'success-setMisesBook');
        return true;
      } catch (error) {
        this.update({
          transformFlag: 'error',
        });
        console.warn(error, 'err-setMisesBook');
        return false;
      }
    }

    try {
      if (this.#misesGasfee.gasWanted) {
        // console.warn('get cache misesGasfee');
        return this.#misesGasfee;
      }

      const res: DeliverTxResponse | undefined = await activeUser?.sendUMIS(
        misesId,
        amountLong,
        simulate,
        memo,
      );

      const proposeGasprice = await this.gasPriceAndLimit();
      const gasprice = new BigNumber(proposeGasprice)
        .times(new BigNumber(res?.gasWanted || 67751))
        .toString();

      // console.warn(proposeGasprice, res, 'propose_gasprice');
      const gasWanted = this.#coinDefine.fromCoin({
        amount: gasprice,
        denom: 'umis',
      });
      const toCoinMIS = await this.#coinDefine.toCoinMIS(gasWanted);
      this.#misesGasfee = {
        ...res,
        gasWanted: toCoinMIS.amount,
      };
      return this.#misesGasfee;
    } catch (error) {
      this.#misesGasfee = {
        gasWanted: '0.000067',
      };
      return Promise.resolve(this.#misesGasfee);
    }
  }

  resetTranstionFlag() {
    this.update({
      transformFlag: 'loading',
    });
  }

  parseAmountItem(item: { value: string }) {
    const amount = item.value.replace('umis', '|umis').split('|');
    const currency = this.#coinDefine.fromCoin({
      amount: amount[0],
      denom: amount[1],
    });
    const coin = this.#coinDefine.toCoinMIS(currency);
    return {
      amount: coin.amount,
      denom: coin.denom.toUpperCase(),
    };
  }
  transfer(event: any, activeUserAddr: string) {
    let amount = { amount: '', denom: '' };
    const amountItem = event.attributes?.find(
      (item: any) => item.key === 'amount',
    );
    if (amountItem) {
      amount = this.parseAmountItem(amountItem);
    }
    const recipient = event.attributes?.find(
      (item: any) => item.key === 'recipient',
    );
    const sender = event.attributes?.find((item: any) => item.key === 'sender');
    const category =
      recipient && recipient.value === activeUserAddr ? 'receive' : 'send';
    const transactionGroupType =
      recipient && recipient.value === activeUserAddr ? 'misesIn' : 'misesOut';
    return {
      recipient,
      sender,
      category,
      transactionGroupType,
      amount,
      title: 'transfer',
    };
  }
  withdrawRewards(event: any, activeUserAddr: string) {
    let amount = { amount: '', denom: '' };
    const amountItem = event.attributes?.find(
      (item: any) => item.key === 'amount',
    );
    if (amountItem) {
      amount = this.parseAmountItem(amountItem);
    }
    return {
      sender: event.attributes?.find((item: any) => item.key === 'validator'),
      recipient: { value: activeUserAddr },
      category: 'interaction',
      title: 'Withdraw Rewards',
      transactionGroupType: 'misesIn',
      amount,
    };
  }
  delegate(event: any, activeUserAddr: string) {
    let amount = { amount: '', denom: '' };
    const amountItem = event.attributes?.find(
      (item: any) => item.key === 'amount',
    );
    if (amountItem) {
      amount = this.parseAmountItem(amountItem);
    }
    return {
      sender: { value: activeUserAddr },
      recipient: event.attributes?.find(
        (item: any) => item.key === 'validator',
      ),
      category: 'interaction',
      title: 'Delegate',
      transactionGroupType: 'misesOut',
      amount,
    };
  }
  redelegate(event: any, activeUserAddr: string) {
    let amount = { amount: '', denom: '' };
    const amountItem = event.attributes?.find(
      (item: any) => item.key === 'amount',
    );
    if (amountItem) {
      amount = this.parseAmountItem(amountItem);
    }
    return {
      sender: { value: activeUserAddr },
      recipient: event.attributes?.find(
        (item: any) => item.key === 'destination_validator',
      ),
      category: 'interaction',
      title: 'Redelegate',
      transactionGroupType: 'misesOut',
      amount,
    };
  }
  unbond(event: any, activeUserAddr: string) {
    let amount = { amount: '', denom: '' };
    const amountItem = event.attributes?.find(
      (item: any) => item.key === 'amount',
    );
    if (amountItem) {
      amount = this.parseAmountItem(amountItem);
    }
    return {
      sender: event.attributes?.find((item: any) => item.key === 'validator'),
      recipient: { value: activeUserAddr },
      category: 'interaction',
      title: 'Undelegate',
      transactionGroupType: 'misesOut',
      amount,
    };
  }
  parseTxEvents(activeUserAddr: string | undefined, tx: indexed) {
    const events = tx.raw;
    return events.reduce((result, event) => {
      const subtitle = '';
      let formatEvent = {
        recipient: {
          value: '',
        },
        sender: {
          value: '',
        },
        category: '',
        transactionGroupType: '',
        amount: {
          amount: '',
          denom: '',
        },
        title: '',
      };
      if (!activeUserAddr) {
        return null;
      }
      switch (event.type) {
        case 'transfer': {
          formatEvent = this.transfer(event, activeUserAddr);
          break;
        }
        case 'withdraw_rewards': {
          formatEvent = this.withdrawRewards(event, activeUserAddr);
          break;
        }
        case 'delegate': {
          formatEvent = this.delegate(event, activeUserAddr);
          break;
        }
        case 'redelegate': {
          formatEvent = this.redelegate(event, activeUserAddr);
          break;
        }
        case 'unbond': {
          formatEvent = this.unbond(event, activeUserAddr);
          break;
        }
        default:
          return result;
      }
      // console.log(new BN('10'),'xxx')
      return result.concat({
        blockNumber: tx.height,
        chainId: '46',
        id: uuid(),
        insertImportTime: true,
        networkID: '46',
        status: 'confirmed',
        time: 1650959960000,
        date:
          result.length === 0
            ? `${tx.height}`
            : `${tx.height}:${result.length}`,
        toSmartContract: false,
        transaction: {
          data: '0x',
          from: formatEvent.sender.value,
          gas: '0x',
          gasPrice: '0x',
          gasUsed: '0x',
          nonce: '0x0',
          to: formatEvent.recipient.value,
          value: formatEvent.amount.amount,
        },
        transactionGroupType: formatEvent.transactionGroupType,
        transactionHash: tx.hash,
        verifiedOnBlockchain: true,
        title: formatEvent.title,
        ticker: formatEvent.amount?.denom,
      });
      // return result.concat({
      //   category: formatEvent.category,
      //   date:
      //     result.length === 0
      //       ? `${tx.height}`
      //       : `${tx.height}:${result.length}`,
      //   height: tx.height,
      //   displayedStatusKey: 'confirmed',
      //   isPending: false,
      //   transaction: {
      //     to: formatEvent.recipient.value,
      //     from: formatEvent.sender.value,
      //   },
      //   primaryCurrency: `${formatEvent.amount?.amount} ${formatEvent.amount?.denom}`,
      //   recipientAddress: formatEvent.recipient?.value ?? '',
      //   secondaryCurrency: `${formatEvent.amount?.amount} ${formatEvent.amount?.denom}`,
      //   senderAddress: formatEvent.sender?.value ?? '',
      //   subtitle,
      //   subtitleContainsOrigin: false,
      //   title: formatEvent.title,
      //   nonce: '0x0',
      //   transactionGroupType: formatEvent.transactionGroupType,
      //   hasCancelled: false,
      //   hasRetried: false,
      //   initialTransaction: { id: '0x0', hash: tx.hash },
      //   primaryTransaction: { err: {}, status: '', hash: tx.hash },
      // });
    }, []);
  }

  async recentTransactions(type: string, selectedAddress: string) {
    // const selectedAddress = this.getSelectedAddress();
    const accountList = this.getAccountList();
    const currentAddress = accountList[selectedAddress] || {};
    if (type === 'cache') {
      console.warn('get cache', currentAddress);
      return currentAddress.transactions || [];
    }
    // console.warn('get network');
    try {
      const activeUser = this.getActive();
      let list = (await activeUser?.recentTransactions(
        currentAddress.height,
      )) as indexed[];
      list = list
        ?.reduce((result, val) => {
          const item = { ...val };
          const rowLog = JSON.parse(val.rawLog) as any[];
          item.rawLog = rowLog as any;
          item.raw = [];
          rowLog.forEach((obj: any) => {
            item.raw = [...item.raw, ...obj.events];
          });
          return result.concat(this.parseTxEvents(activeUser?.address(), item));
        }, [])
        .filter((val) => val);

      for (const key in accountList) {
        if (accountList[key].misesId === activeUser?.address()) {
          accountList[key].transactions = list || [];
          this.update({
            accountList,
          });
        }
      }
      return list;
    } catch (error) {
      console.warn(error);
      return Promise.reject(error);
    }
  }
  getAccountFlag() {
    return true;
  }

  async setAccountTransactionsHeight(selectedAddress: string) {
    // const selectedAddress = this.getSelectedAddress();
    const accountList = this.getAccountList();
    const { transactions = [] } = accountList[selectedAddress];
    const last = transactions[0] || {};
    accountList[selectedAddress].height = last.height + 1;
    // console.log(last.height, accountList, 'setAccountTransactionsHeight');
    this.update({
      accountList,
    });
  }

  async postTx(params: any) {
    console.warn(params, 'postTx:getParmas===');
    const activeUser = this.getActive();
    const data = await activeUser?.postTx(
      params.msgs,
      '',
      params.gasFee,
      params.gasLimit,
    );
    if (data?.code !== 0) {
      return Promise.reject(data?.rawLog);
    }
    return data;
  }

  getReader(msg: any) {
    return this.#msgReader.summary(msg);
  }
}

export default MisesController;
