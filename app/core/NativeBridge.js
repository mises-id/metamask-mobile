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
      const listener = (res) => {
        if (res.selectedAddress) {
          Logger.log('unlocked');
          PreferencesController.unsubscribe(listener);
          resolve('unlocked');
        }
      };
      PreferencesController.subscribe(listener);
      nativeBridge.onWindowHide(() => {
        Logger.log('dismissed');
        PreferencesController.unsubscribe(listener);
        reject('dismissed');
      });
    });
    await unlocked;

    Logger.log('continue after unlocked');
  }
};

class NativePort extends EventEmitter {
  constructor(webviewid, isMainFrame) {
    super();
    this._webviewid = webviewid;
    this._isMainFrame = isMainFrame;
  }

  postMessage = (msg, origin = '*') => {
    MisesModule.postMessageFromRN(JSON.stringify(msg), origin, this._webviewid);
  };
}

class NativeBridge extends EventEmitter {
  constructor(options) {
    super();
    this.backgroundBridges = [];
    this.pendingMessages = [];
    this.ready = false;
    this.windowVisible = false;
  }
  onEngineReady() {
    Logger.log('NativeBridge.onEngineReady', this.pendingMessages);
    this.ready = true;
    if (this.pendingMessages.length) {
      const messages = [...this.pendingMessages];
      messages.forEach((message) => {
        this.postMessageFromWeb(message.data, message.webviewid);
      });
      this.pendingMessages = [];
    }
  }
  postMessageFromWeb(data, webviewid) {
    try {
      data = typeof data === 'string' ? JSON.parse(data) : data;
      if (!data || !data.name) {
        return;
      }
      Logger.log('NativeBridge.postMessageFromWeb', data);
      if (data.name) {
        const { origin } = data && data.origin && new URL(data.origin);
        const found = this.activate({ webviewid, origin }, data);
        if (found) {
          found.onMessage(data);
          if (
            data &&
            data.data &&
            data.data.method !== 'metamask_getProviderState'
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

  activate(bridgeInfo, data) {
    Logger.log('NativeBridge.activate', bridgeInfo);
    const { origin, webviewid } = bridgeInfo;
    if (!this.ready) {
      this.pendingMessages = [
        { origin, webviewid, data },
        ...this.pendingMessages,
      ];
      return null;
    }
    const found = this.findBridge({ origin, webviewid });
    if (!found) {
      this.clearIdleBridge();
      return this.initializeBackgroundBridge({ origin, webviewid }, true);
    }
    return found;
  }
  findBridge(bridgeInfo) {
    const { origin, webviewid } = bridgeInfo;
    if (!origin || !webviewid) {
      return null;
    }

    const bridges = [...this.backgroundBridges];
    const found =
      bridges.find((bridge) => {
        if (bridge._webviewRef === webviewid && bridge.url === origin)
          return true;
        return false;
      }) || null;
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
      this.windowVisible = true;
      this.emit('window_show');
    } else if (params && params === 'hide') {
      this.windowVisible = false;
      this.emit('window_hide');
    }
  }
  onWindowHide(listener, once) {
    if (once) {
      return this.once('window_hide', listener);
    }
    return this.on('window_hide', listener);
  }

  onWindowShow(listener, once) {
    if (once) {
      return this.once('window_show', listener);
    }
    return this.on('window_show', listener);
  }
  isWindowVisible() {
    return this.windowVisible;
  }

  initializeBackgroundBridge(bridgeInfo, isMainFrame) {
    const { origin, webviewid } = bridgeInfo;
    Logger.log('NativeBridge.initializeBackgroundBridge', webviewid);
    const newBridge = new BackgroundBridge({
      webview: { current: webviewid },
      url: origin,
      getRpcMethodMiddleware: ({ hostname, getProviderState }) =>
        getRpcMethodMiddleware({
          hostname,
          getProviderState,
          navigation: null,
          getApprovedHosts,
          setApprovedHosts,
          approveHost,
          // Website info
          url: { current: origin },
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
      port: new NativePort(webviewid, isMainFrame),
    });
    this.backgroundBridges.push(newBridge);
    return newBridge;
  }
}

const nativeBridge = new NativeBridge();

const instance = {
  init() {
    const BatchedBridge = require('react-native/Libraries/BatchedBridge/BatchedBridge');
    BatchedBridge.registerCallableModule('NativeBridge', {
      postMessage(data, webviewid) {
        nativeBridge.postMessageFromWeb(data, webviewid);
      },

      windowStatusChanged(status) {
        nativeBridge.windowStatusChanged(status);
      },
    });
  },
  sendNotification(payload) {
    nativeBridge.sendNotification(payload);
  },
  onEngineReady() {
    nativeBridge.onEngineReady();
  },
  onWindowShow(listener, once) {
    nativeBridge.onWindowShow(listener, once);
  },
  onWindowHide(listener, once) {
    nativeBridge.onWindowHide(listener, once);
  },
  isWindowVisible() {
    return nativeBridge.isWindowVisible();
  },
};

export default instance;
