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
  const { KeyringController } = Engine.context;
  if (!KeyringController.isUnlocked()) {
    MisesModule.popup();
    const unlocked = new Promise((resolve, reject) => {
      KeyringController.onUnlock(() => {
        console.log('unlocked');
        resolve('unlocked');
      });
      bridge.onWindowHide(() => {
        console.log('dismissed');
        reject('dismissed');
      });
    });
    await unlocked;
    console.log('continue after unlocked');
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
  }
  postMessage(data) {
    try {
      data = typeof data === 'string' ? JSON.parse(data) : data;
      if (!data || !data.name) {
        return;
      }
      console.log('NativeBridge.postMessage', data);
      if (data.name) {
        this.backgroundBridges.length &&
          this.backgroundBridges.forEach((bridge) => {
            if (bridge.isMainFrame) {
              const { origin } = data && data.origin && new URL(data.origin);
              bridge.url === origin && bridge.onMessage(data);
            } else {
              bridge.url === data.origin && bridge.onMessage(data);
            }
          });
        return;
      }
    } catch (e) {
      Logger.error(e, 'NativeBridge.postMessage fail', e);
    }
  }

  loadStarted(url) {
    console.log('NativeBridge.loadStarted', url);
    if (url === 'about://newtab/') {
      return;
    }
    this.backgroundBridges.length &&
      this.backgroundBridges.forEach((bridge) => bridge.onDisconnect());
    this.backgroundBridges = [];
    const origin = new URL(url).origin;
    this.initializeBackgroundBridge(origin, true);
  }

  windowStatusChanged(params) {
    console.log('metamask window status ', params);
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

const bridge = new NativeBridge();

const instance = {
  init() {
    const BatchedBridge = require('react-native/Libraries/BatchedBridge/BatchedBridge');
    BatchedBridge.registerCallableModule('NativeBridge', {
      postMessage(data) {
        bridge.postMessage(data);
      },
      loadStarted(data) {
        bridge.loadStarted(data);
      },
      windowStatusChanged(data) {
        bridge.windowStatusChanged(data);
      },
    });
  },
};

export default instance;
