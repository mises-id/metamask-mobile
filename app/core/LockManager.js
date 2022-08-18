import SecureKeychain from './SecureKeychain';
import BackgroundTimer from 'react-native-background-timer';
import Engine from './Engine';
import Logger from '../util/Logger';
import NativeBridge from './NativeBridge';

export default class LockManager {
  constructor(navigation, lockTime) {
    this.navigation = navigation;
    this.lockTime = lockTime;
    this.appState = 'active';
    NativeBridge.onAppStateChange(this.handleAppStateChange);
    NativeBridge.onWindowShow(this.handleWindowShow, false);
    NativeBridge.onWindowHide(this.handleWindowHide, false);
  }
  updateLockTime(lockTime) {
    this.lockTime = lockTime;
  }

  handleWindowShow = () => {
    this.handleAppStateChange('active');
  };
  handleWindowHide = () => {
    this.handleAppStateChange('inactive');
  };

  handleAppStateChange = async (nextAppState) => {
    // Don't auto-lock
    if (this.lockTime === -1) {
      return;
    }
    if (nextAppState === 'active' && !NativeBridge.isWindowVisible()) {
      return;
    }

    Logger.log('LockManager::handleAppStateChange', nextAppState);

    if (nextAppState !== 'active') {
      // Auto-lock immediately
      if (this.lockTime === 0) {
        this.lockApp();
      } else {
        if (this.lockTimer) {
          BackgroundTimer.clearTimeout(this.lockTimer);
          this.lockTimer = null;
        }
        // Autolock after some time
        this.lockTimer = BackgroundTimer.setTimeout(() => {
          if (this.lockTimer) {
            this.lockApp();
          }
        }, this.lockTime);
      }
    } else if (this.appState !== 'active' && nextAppState === 'active') {
      // Prevent locking since it didnt reach the time threshold
      if (this.lockTimer) {
        BackgroundTimer.clearTimeout(this.lockTimer);
        this.lockTimer = null;
      }
    }

    this.appState = nextAppState;
  };

  setLockedError = (error) => {
    Logger.log('Failed to lock KeyringController', error);
  };

  gotoLockScreen = () => {
    Logger.log('LockManager::gotoLockScreen');
    this.navigation.navigate('LockScreen', { backgroundMode: true });
    this.locked = true;
  };

  lockApp = async () => {
    Logger.log('LockManager::lockApp');
    if (!SecureKeychain.getInstance().isAuthenticating) {
      const { KeyringController } = Engine.context;
      try {
        // await SecureKeychain.resetGenericPassword();
        await KeyringController.setLocked();
        this.gotoLockScreen();
      } catch (e) {
        this.setLockedError(e);
      }
    } else if (this.lockTimer) {
      BackgroundTimer.clearTimeout(this.lockTimer);
      this.lockTimer = null;
    }
  };

  stopListening() {
    NativeBridge.removeOnAppStateChangeListener(this.handleAppStateChange);
    NativeBridge.removeWindowShowListener(this.handleWindowShow);
    NativeBridge.removeWindowHideListener(this.handleWindowHide);
  }
}
