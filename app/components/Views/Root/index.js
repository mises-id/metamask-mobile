import React, { PureComponent } from 'react';
import PropTypes from 'prop-types';
import { Provider } from 'react-redux';
import { PersistGate } from 'redux-persist/lib/integration/react';
import { store, persistor } from '../../../store/';
import SplashScreen from 'react-native-splash-screen';
import App from '../../Nav/App';
import SecureKeychain from '../../../core/SecureKeychain';
import EntryScriptWeb3 from '../../../core/EntryScriptWeb3';
import Logger from '../../../util/Logger';
import ErrorBoundary from '../ErrorBoundary';
import { useAppTheme, ThemeContext } from '../../../util/theme';

import NativeBridge from '../../../core/NativeBridge';

/**
 * Top level of the component hierarchy
 * App component is wrapped by the provider from react-redux
 */
export default class Root extends PureComponent {
  static propTypes = {
    foxCode: PropTypes.string,
  };

  static defaultProps = {
    foxCode: 'null',
  };

  errorHandler = (error, stackTrace) => {
    Logger.error(error, stackTrace);
  };

  constructor(props) {
    super(props);
    if (props.foxCode === '') {
      Logger.error('WARN - foxCode is an empty string');
    }
    SecureKeychain.init(props.foxCode);
    // Init EntryScriptWeb3 asynchronously on the background
    EntryScriptWeb3.init();
    SplashScreen.hide();
    NativeBridge.init();
  }

  render = () => (
    <Provider store={store}>
      <PersistGate persistor={persistor}>
        <ConnectedRoot />
      </PersistGate>
    </Provider>
  );
}

const ConnectedRoot = () => {
  const theme = useAppTheme();

  return (
    <ThemeContext.Provider value={theme}>
      <ErrorBoundary onError={this.errorHandler} view="Root">
        <App />
      </ErrorBoundary>
    </ThemeContext.Provider>
  );
};
