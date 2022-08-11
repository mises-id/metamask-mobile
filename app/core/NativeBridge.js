import BackgroundBridge from './BackgroundBridge';
import getRpcMethodMiddleware from './RPCMethods/RPCMethodMiddleware';
import { NativeModules } from 'react-native';
import { EventEmitter } from 'events';
import Engine from './Engine';
import Logger from '../util/Logger';

const { MisesModule } = NativeModules;

let approvedHosts = {};

const getApprovedHosts = () => approvedHosts;
const setApprovedHosts = (hosts) => {
  approvedHosts = hosts;
};
const approveHost = () => null;

const isHomepage = () => false;
const fromHomepage = () => false;
const wizardScrollAdjusted = () => false;
const title = () => '';
const icon = () => '';

const tabId = () => 1;
const toggleUrlModal = () => null;
const injectHomePageScripts = async (bookmarks) => {};

const ensureUnlock = async () => {
  const { KeyringController, PreferencesController } = Engine.context;
  if (!KeyringController.isUnlocked()) {
    MisesModule.popup();
    const unlocked = new Promise((resolve, reject) => {
      PreferencesController.subscribe((res) => {
        if (res.selectedAddress) {
          Logger.log('unlocked');
          resolve('unlocked');
        }
      });
      // KeyringController.onUnlock(() => {

      // });
      nativeBridge.onWindowHide(() => {
        Logger.log('dismissed');
        reject('dismissed');
      });
    });
    await unlocked;

    Logger.log('continue after unlocked');
  }
};

class NativePort extends EventEmitter {
  constructor(url, isMainFrame) {
    super();
    this._url = window;
    this._isMainFrame = isMainFrame;
  }

  postMessage = (msg, origin = '*') => {
    MisesModule.postMessageFromRN(JSON.stringify(msg), origin);
  };
}

class NativeBridge extends EventEmitter {
  constructor(options) {
    super();
    this.backgroundBridges = [];
    this.pendingUrl = null;
    this.ready = false;
  }
  onEngineReady() {
    Logger.log('NativeBridge.onEngineReady');
    this.ready = true;
    if (this.pendingUrl) {
      const origin = new URL(this.pendingUrl).origin;
      this.initializeBackgroundBridge(origin, true);
      this.pendingUrl = null;
    }
  }
  postMessageFromWeb(data) {
    try {
      data = typeof data === 'string' ? JSON.parse(data) : data;
      if (!data || !data.name) {
        return;
      }
      Logger.log('NativeBridge.postMessageFromWeb', data, this);
      if (data.name) {
        const { origin } = data && data.origin && new URL(data.origin);
        const found = this.findBridge(origin);
        if (found) {
          found.onMessage(data);
          if (
            data &&
            data.data &&
            data.data.method != 'metamask_getProviderState'
          ) {
            found.lastActiveTime = new Date().getTime();
          }
        }
        return;
      }
    } catch (e) {
      Logger.error(e, 'NativeBridge.postMessageFromWeb fail', e);
    }
  }

  loadStarted(url) {
    Logger.log('NativeBridge.loadStarted', url);
    if (url === 'about://newtab/') {
      return;
    }
    if (!this.ready) {
      this.pendingUrl = url;
      return;
    }
    const origin = new URL(url).origin;
    const found = this.findBridge(origin);
    if (!found) {
      this.clearIdleBridge();
      this.initializeBackgroundBridge(origin, true);
    }
  }
  findBridge(origin) {
    if (!origin) {
      return null;
    }

    const bridges = this.backgroundBridges;
    const found = bridges.find((bridge) => bridge.url === origin) || null;

    return found;
  }

  clearIdleBridge() {
    const bridges = [...this.backgroundBridges];
    const now = new Date().getTime();
    this.backgroundBridges = bridges.filter((bridge) => {
      if (!bridge) {
        return false;
      }
      const lastActiveTime = bridge.lastActiveTime;
      if (!lastActiveTime || now - lastActiveTime > 3600 * 1000) {
        //disconnet when the bridge is idle for an hour
        Logger.log('NativeBridge.clearIdleBridge', bridge.url);
        bridge.onDisconnect();
        return false;
      }
      return true;
    });
  }
  sendNotification(payload) {
    this.clearIdleBridge();
    const bridges = [...this.backgroundBridges];
    bridges.forEach((bridge) => {
      if (approvedHosts[bridge.hostname]) {
        bridge.sendNotification(payload);
      }
    });
  }

  windowStatusChanged(params) {
    Logger.log('metamask window status', params);
    if (params && params === 'show') {
      this.emit('window_show');
    } else if (params && params === 'hide') {
      this.emit('window_hide');
    }
  }
  onWindowHide(listener) {
    return this.once('window_hide', listener);
  }

  onWindowShow(listener) {
    return this.once('window_show', listener);
  }

  initializeBackgroundBridge(urlBridge, isMainFrame) {
    Logger.log('NativeBridge.initializeBackgroundBridge', urlBridge);
    const newBridge = new BackgroundBridge({
      webview: null,
      url: urlBridge,
      getRpcMethodMiddleware: ({ hostname, getProviderState }) =>
        getRpcMethodMiddleware({
          hostname,
          getProviderState,
          navigation: null,
          getApprovedHosts,
          setApprovedHosts,
          approveHost,
          // Website info
          url: { current: urlBridge },
          title: { current: '' },
          icon: { current: '' },
          // Bookmarks
          isHomepage,
          // Show autocomplete
          fromHomepage,
          toggleUrlModal,
          // Wizard
          wizardScrollAdjusted,
          tabId,
          injectHomePageScripts,
          ensureUnlock,
        }),
      isMainFrame,
      port: new NativePort(urlBridge, isMainFrame),
    });
    this.backgroundBridges.push(newBridge);
  }
}

const nativeBridge = new NativeBridge();

const instance = {
  init() {
    const BatchedBridge = require('react-native/Libraries/BatchedBridge/BatchedBridge');
    BatchedBridge.registerCallableModule('NativeBridge', {
      postMessage(data) {
        nativeBridge.postMessageFromWeb(data);
      },
      loadStarted(data) {
        nativeBridge.loadStarted(data);
      },
      windowStatusChanged(data) {
        nativeBridge.windowStatusChanged(data);
      },
    });
  },
  sendNotification(payload) {
    nativeBridge.sendNotification(payload);
  },
  onEngineReady() {
    nativeBridge.onEngineReady();
  },
  onWindowShow(listener) {
    nativeBridge.onWindowShow(listener);
  },
  onWindowHide(listener) {
    nativeBridge.onWindowHide(listener);
  },
};

export default instance;
