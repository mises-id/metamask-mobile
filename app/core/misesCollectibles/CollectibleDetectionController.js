import {
  CollectibleDetectionController,
  NetworksChainId,
} from '@metamask/controllers';
import {
  findMisesAccount,
  getBaseApi,
  request,
} from '../misesController/misesNetwork.util';

export default class MisesCollectibleDetectionController extends CollectibleDetectionController {
  offset = '';

  requestLock = false;

  constructor(options, config, state) {
    super(options, config, state);
    this.isMainnet = () =>
      ![NetworksChainId.mises].includes(this.config.chainId);
    options.onNetworkStateChange(async ({ provider }) => {
      if (
        ![NetworksChainId.mises].includes(provider.chainId) &&
        options.isUnlocked() &&
        !this.requestLock
      ) {
        this.requestLock = true;
        this.startPolling();
        console.log('startPolling');
        setTimeout(() => {
          this.requestLock = false;
        }, 100);
      }
    });
    this.getNetwork = options.getNetwork;
    this.getMisesAccount = options.getMisesAccount;
  }

  getOwnerCollectiblesApi(address, offset) {
    // const a = '0xb47e3cd837ddf8e4c57f05d70ab865de6e193bbb';
    return `${getBaseApi(
      'assets',
    )}?owner=${address}&cursor=${offset}&limit=50&network=${this.getNetwork()}`;
  }

  startPolling() {
    return this.detectCollectibles();
  }

  async getOwnerCollectibles(address) {
    const misesAccount = findMisesAccount(this.getMisesAccount(), address);
    if (!misesAccount?.token) {
      return Promise.resolve([]);
    }
    try {
      // const openSeaApiKey = this.getOpenSeaApiKey();
      const api = this.getOwnerCollectiblesApi(address, this.offset);
      const { assets, next } = await request({
        url: api,
        method: 'GET',
        headers: {
          // 'X-API-KEY': openSeaApiKey,
          Authorization: `Bearer ${misesAccount.token}`,
        },
        isCustom: true,
      });
      this.offset = next || '';
      return assets || [];
    } catch (error) {
      return [];
    }
  }
}
