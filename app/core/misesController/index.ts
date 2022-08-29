import {
  BaseController,
  BaseState,
  KeyringConfig,
  PreferencesController,
  PreferencesState,
} from '@metamask/controllers';
import BigNumber from 'bignumber.js';
import { DeliverTxResponse, IndexedTx } from '@cosmjs/stargate';
import {
  MSdk,
  MAppMgr,
  MUserMgr,
  MUser,
  MisesCoin,
  MisesConfig,
  MsgReader,
} from 'mises-js-sdk';
import {
  getBaseApi,
  findMisesAccount,
  misesAPi,
  MISES_TRUNCATED_ADDRESS_START_CHARS,
  request,
  shortenAddress,
} from './misesNetwork.util';
import AnalyticsV2 from '../../util/analyticsV2';
import Analytics from '../Analytics/Analytics';
import { uuid } from '@walletconnect/utils';

import { NativeModules } from 'react-native';
import Logger from '../../util/Logger';
import { NetworksChainId } from '../misesNetworkController';
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
export interface accounts {
  [key: string]: misesAccount;
}
interface misesState extends BaseState {
  accountList: accounts;
}
interface misesGasfee {
  gasWanted: string | undefined;
}
interface indexed extends IndexedTx {
  raw: any[];
  blockNumber: number;
}
class MisesController extends BaseController<KeyringConfig, misesState> {
  getKeyringAccounts: () => Promise<string[]>;
  updateIdentities: PreferencesController['updateIdentities'];
  exportAccount: (address: string) => Promise<string>;
  setPreferencesSelectedAddress: (address: string) => Promise<void>;
  #config: MisesConfig;
  #coinDefine: MisesCoin;
  #msgReader: MsgReader;
  #misesSdk: MSdk;
  #misesAppMgr: MAppMgr;
  #misesUser: MUserMgr;
  #misesGasfee: misesGasfee;
  constructor(
    {
      getKeyringAccounts,
      updateIdentities,
      exportAccount,
      setPreferencesSelectedAddress,
    }: {
      getKeyringAccounts(): Promise<string[]>;
      updateIdentities: PreferencesController['updateIdentities'];
      onPreferencesStateChange: (
        listener: (preferencesState: PreferencesState) => void,
      ) => void;
      exportAccount: (address: string) => Promise<string>;
      setPreferencesSelectedAddress: (address: string) => Promise<void>;
    },
    config?: Partial<KeyringConfig>,
    state?: Partial<misesState>,
  ) {
    super(config, state);
    this.name = 'MisesController';
    this.getKeyringAccounts = getKeyringAccounts;
    this.updateIdentities = updateIdentities;
    // init Mises sdk
    this.#config = MSdk.newConfig();
    this.exportAccount = exportAccount;
    this.setPreferencesSelectedAddress = setPreferencesSelectedAddress;
    this.#misesSdk = MSdk.newSdk(this.#config);
    this.#coinDefine = MSdk.newCoinDefine();
    this.#msgReader = MSdk.newMsgReader();
    this.#coinDefine.load();
    this.#config.setLCDEndpoint(MISES_POINT);
    this.#misesUser = this.#misesSdk.userMgr();
    this.#misesAppMgr = this.#misesSdk.appMgr();
    this.#misesGasfee = {
      gasWanted: undefined,
    };
    this.defaultState = {
      accountList: {},
    };
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
      const promiseAccount = keyringList.map(async (val) => {
        const misesUser = await this.getMisesUser(val);
        return this.refreshMisesBalance(misesUser.address());
      });
      const res = await Promise.all(promiseAccount);
      const accounts = this.getAccountList();
      res.forEach((val) => {
        if (val.address in accounts) {
          accounts[val.address].misesBalance = val.misesBalance;
        } else {
          accounts[val.address] = val;
        }
      });
      this.update({
        accountList: {
          ...accounts,
        },
      });
    } catch (error) {
      Analytics.trackEventWithParameters('getAccountMisesBalanceError', {
        getAccountMisesBalanceError: error,
      });
      return Promise.reject(error);
    }
  }
  async refreshMisesBalance(misesId: string): Promise<misesAccount> {
    try {
      const accountList = this.getAccountList();
      const misesAccount = findMisesAccount(
        accountList,
        this.misesIdToEthAddress(misesId),
      );
      const misesBalance: misesBalance = await this.getUserBalance(misesId);
      // const user = await this.getMisesUser(misesAccount.address);
      const cacheObj = accountList[misesAccount.address] || {};
      const ret = {
        ...cacheObj,
        address: misesAccount.address,
        misesBalance,
        misesId,
      };
      return ret;
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
  async getUserBalance(misesId: string): Promise<misesBalance> {
    // console.log();
    const defaultCoin: misesBalance = {
      amount: '0',
      denom: 'MIS',
    };
    try {
      const user = this.#misesUser.findUser(`did:mises:${misesId}`);
      const balanceLong = await user?.getBalanceUMIS();
      if (user && balanceLong) {
        const balanceObj = this.#coinDefine.toCoinMIS(balanceLong);
        Logger.log(balanceObj);
        return {
          ...balanceObj,
          denom: balanceObj.denom.toUpperCase(),
        };
      }
      return Promise.resolve(defaultCoin);
    } catch (error) {
      console.warn(error, 'getUserBalanceError');
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
      console.warn('generateAuth', error);
      // return error;
      return Promise.reject(error);
    }
  }

  /*
   * get browser install referrer
   */
  getinstallreferrer(): Promise<string> {
    return new Promise((resolve) => {
      const ref = MisesModule.getInstallReferrer();
      Logger.log('getInstallReferrer', ref);
      resolve(ref);
    });
  }
  addressFindItem(address: string) {
    const lowerAddress = address.toLowerCase();
    const accountList = this.getAccountList();
    const account = accountList[lowerAddress];
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
  async misesUserInfo(misesId: string): Promise<misesAccount> {
    const findUser = this.#misesUser.findUser(`did:mises:${misesId}`);
    const ethAddress = this.misesIdToEthAddress(misesId);
    // const account = this.addressFindItem(ethAddress);
    const nowTimeStamp = new Date().getTime();
    // if (account?.auth) return account;
    try {
      const { auth } = await this.generateAuth(`${nowTimeStamp}`);
      const isRegistered = await findUser?.isRegistered();
      const userInfo = isRegistered ? await findUser?.info() : ({} as any);
      const misesBalance = await this.getUserBalance(misesId);
      return {
        address: ethAddress,
        misesId,
        misesBalance,
        auth,
        userInfo: {
          name:
            userInfo?.name ||
            shortenAddress(misesId, MISES_TRUNCATED_ADDRESS_START_CHARS),
          avatarUrl: userInfo?.avatarUrl,
        },
      };
    } catch (error) {
      console.warn('misesUserInfo', error);
      return Promise.reject(error);
    }
  }

  async reloadAccessTokenAndUserInfo(account: misesAccount) {
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
      account.token = token; // token;
      account.timestamp = new Date().getTime();
      const misesId = account.misesId;
      const findUser = this.#misesUser.findUser(`did:mises:${misesId}`);
      const isRegistered = await findUser?.isRegistered();
      if (isRegistered) {
        // console.log(isRegistered, 'not found userinfo cache');
        const userInfo = await findUser?.info();
        account.userInfo = {
          name:
            userInfo?.name ||
            shortenAddress(misesId, MISES_TRUNCATED_ADDRESS_START_CHARS),
          avatarUrl: userInfo?.avatarUrl,
        };
      }
      Logger.log(account, 'reloadAccessTokenAndUserInfo');
      this.update({
        accountList: {
          ...accountList,
          [account?.address]: account,
        },
      });
      return account;
    } catch (error) {
      console.warn(error, 'reloadAccessTokenAndUserInfo');
      return account;
    }
  }
  /*
   *  return mises userInfo
   */
  async ensureMisesAccessToken(misesId: string) {
    try {
      // const activeUser = this.getActive();
      // const misesId = activeUser ? activeUser.address() : '';
      let account = await this.misesUserInfo(misesId);
      const nowTimeStamp = new Date().getTime();
      const expireTokenFlag =
        account.token &&
        account.timestamp &&
        nowTimeStamp - account.timestamp > 604800000; // 6 days
      if (account.auth && (!account.token || expireTokenFlag)) {
        account = await this.reloadAccessTokenAndUserInfo(account);
      }
      const userinfo = {
        nickname: account.userInfo
          ? account.userInfo.name
          : shortenAddress(misesId, MISES_TRUNCATED_ADDRESS_START_CHARS),
        avatar: account.userInfo?.avatarUrl || '',
        misesId,
        token: account.token || '',
      };
      Logger.log('ensureMisesAccessToken', userinfo);
      return userinfo;
    } catch (error) {
      console.warn('ensureMisesAccessToken', error);
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
  }
  misesIdToEthAddress(misesId: string) {
    const accountList = this.getAccountList();
    let address = '';
    for (const key in accountList) {
      const item = accountList[key];
      if (item.misesId?.toLowerCase() === misesId.toLowerCase()) {
        address = key;
      }
    }
    return address.toLowerCase();
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
      const address = this.misesIdToEthAddress(misesId);
      const account = findMisesAccount(accountList, address);
      if (account) {
        const updateUserInfo = {
          nickname:
            data.name ||
            shortenAddress(misesId, MISES_TRUNCATED_ADDRESS_START_CHARS),
          avatar: data.avatarUrl,
          token: account.token ?? '',
          misesId,
        };
        account.token && this.setToMisesPrivate(updateUserInfo); // set mises userInfo to browser
        this.update({
          accountList: {
            ...accountList,
            [address]: {
              ...account,
              userInfo: {
                name:
                  data.name ||
                  shortenAddress(misesId, MISES_TRUNCATED_ADDRESS_START_CHARS),
                avatarUrl: data.avatarUrl,
              },
            },
          },
        });
        AnalyticsV2.trackEvent('update userinfo cache ', account);
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
    if (!simulate) {
      Logger.log('setMisesBook', {
        misesId,
        amountLong,
        simulate,
        memo,
      });
      try {
        const res: DeliverTxResponse | undefined = await activeUser?.sendUMIS(
          misesId,
          amountLong,
          simulate,
          memo,
        );
        console.warn(res, memo, 'success-setMisesBook');
        return res?.code === 1;
      } catch (error) {
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

  parseAmountItem(item: { value: string }) {
    if (item.value) {
      const amount = item.value?.replace('umis', '|umis').split('|');
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
    return {
      amount: '0',
      denom: 'MIS',
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
      return result.concat({
        blockNumber: tx.height,
        chainId: NetworksChainId.mises,
        id: uuid(),
        insertImportTime: true,
        networkID: NetworksChainId.mises,
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
    }, []);
  }

  async refreshTransactions() {
    Logger.log('refreshTransactions');
    this.recentTransactions();
  }

  async recentTransactions() {
    const accountList = this.getAccountList();
    try {
      const activeUser = this.getActive();
      const misesId = activeUser?.address();
      const lowerAddress = misesId && this.misesIdToEthAddress(misesId);
      const currentAddress =
        (lowerAddress && accountList[lowerAddress]) || null;
      if (!currentAddress) return;
      Logger.log(currentAddress.height, misesId);
      let list = (await activeUser?.recentTransactions(
        currentAddress.height,
      )) as indexed[];
      Logger.log('await list', list.length);
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
      Array.isArray(list) &&
        list?.sort((a, b) => b.blockNumber - a.blockNumber);
      for (const key in accountList) {
        if (accountList[key].misesId === activeUser?.address()) {
          accountList[key].transactions = list || [];
          this.update({
            accountList,
          });
        }
      }
      Logger.log(list.length, 'get recentTransactions');
      return list;
    } catch (error) {
      console.warn(error);
      return Promise.reject(error);
    }
  }
  findAccountLength() {
    const accountList = this.getAccountList();
    return Object.keys(accountList).length;
  }

  async setAccountTransactionsHeight(selectedAddress: string) {
    // const selectedAddress = this.getSelectedAddress();
    const accountList = this.getAccountList();
    const misesAccount = findMisesAccount(accountList, selectedAddress);
    const { transactions = [] } = misesAccount;
    const last = transactions[0] || {};
    accountList[misesAccount.address].height = last.blockNumber + 1;
    Logger.log(transactions[0], accountList, 'setAccountTransactionsHeight');
    this.update({
      accountList,
    });
  }

  async postTx(params: any) {
    console.warn(JSON.stringify(params), 'postTx:getParmas===');
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
  async setSelectedAddress(address: string) {
    Logger.log('mises:setSelectedAddress');
    this.setPreferencesSelectedAddress(address);
    try {
      if (!address) return;
      const lowerAddress = address.toLowerCase();
      const key = await this.exportAccount(lowerAddress); // get priKeyHex
      await this.activate(key); // set activity user
      const getAccount = this.getActive();
      const accountList = this.getAccountList();
      const misesId = getAccount?.address();
      if (misesId && !accountList[lowerAddress]) {
        accountList[lowerAddress] = {
          misesId,
          address: lowerAddress,
          misesBalance: {
            amount: '0',
            denom: 'MIS',
          },
        };
        this.update({
          accountList: {
            ...accountList,
          },
        });
      }
      if (misesId) {
        const userInfo = await this.ensureMisesAccessToken(misesId); // get activity user
        const misesAccount = await this.refreshMisesBalance(misesId); // get mises balance
        misesAccount.token = userInfo?.token;
        this.update({
          accountList: {
            ...accountList,
            [lowerAddress]: {
              ...accountList[lowerAddress],
              ...misesAccount,
            },
          },
        });
        userInfo && (await this.setToMisesPrivate(userInfo));
      }
    } catch (error) {
      console.warn(error, address, 'onPreferencesStateChange');
    }
  }
  lockAll() {
    Logger.log('lockall');
    this.#misesUser.lockAll();
  }
}

export default MisesController;
