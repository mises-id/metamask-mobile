import React, {
  useEffect,
  useRef,
  useState,
  useCallback,
  useContext,
} from 'react';
import {
  RefreshControl,
  ScrollView,
  InteractionManager,
  ActivityIndicator,
  StyleSheet,
  View,
} from 'react-native';
import { useSelector } from 'react-redux';
import ScrollableTabView from 'react-native-scrollable-tab-view';
import DefaultTabBar from 'react-native-scrollable-tab-view/DefaultTabBar';
import { fontStyles, baseStyles } from '../../../styles/common';
import AccountOverview from '../../UI/AccountOverview';
import Tokens from '../../UI/Tokens';
import { getWalletNavbarOptions } from '../../UI/Navbar';
import { strings } from '../../../../locales/i18n';
import { renderFromWei, weiToFiat, hexToBN } from '../../../util/number';
import Engine from '../../../core/Engine';
import CollectibleContracts from '../../UI/CollectibleContracts';
import Analytics from '../../../core/Analytics/Analytics';
import { ANALYTICS_EVENT_OPTS } from '../../../util/analytics';
import { getTicker } from '../../../util/transactions';
import OnboardingWizard from '../../UI/OnboardingWizard';
import ErrorBoundary from '../ErrorBoundary';
import { DrawerContext } from '../../Nav/Main/MainNavigator';
import {
  useAppThemeFromContext,
  mockTheme,
  useMisesNetwork,
} from '../../../util/theme';
import { shouldShowWhatsNewModal } from '../../../util/onboarding';
import Logger from '../../../util/Logger';
import Routes from '../../../constants/navigation/Routes';
import { findMisesAccount } from '../../../core/misesController/misesNetwork.util';
import { bridge } from '../../../core/NativeBridge';
let timer: any = null;
let lock = false;
const createStyles = (colors: any) =>
  StyleSheet.create({
    wrapper: {
      flex: 1,
      backgroundColor: colors.background.default,
    },
    tabUnderlineStyle: {
      height: 2,
      backgroundColor: colors.primary.default,
    },
    tabStyle: {
      paddingBottom: 0,
    },
    tabBar: {
      borderColor: colors.border.muted,
    },
    textStyle: {
      fontSize: 12,
      letterSpacing: 0.5,
      ...(fontStyles.bold as any),
    },
    loader: {
      backgroundColor: colors.background.default,
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
    },
  });

/**
 * Main view for the wallet
 */
const Wallet = ({ navigation }: any) => {
  const { drawerRef } = useContext(DrawerContext);
  const [refreshing, setRefreshing] = useState(false);
  const accountOverviewRef = useRef(null);
  const { colors } = useAppThemeFromContext() || mockTheme;
  const styles = createStyles(colors);
  /**
   * Map of accounts to information objects including balances
   */
  const accounts = useSelector(
    (state: any) =>
      state.engine.backgroundState.AccountTrackerController.accounts,
  );
  const misesAccounts = useSelector(
    (state: any) => state.engine.backgroundState.MisesController.accountList,
  );
  /**
   * ETH to current currency conversion rate
   */
  const conversionRate = useSelector(
    (state: any) =>
      state.engine.backgroundState.CurrencyRateController.conversionRate,
  );
  /**
   * Currency code of the currently-active currency
   */
  const currentCurrency = useSelector(
    (state: any) =>
      state.engine.backgroundState.CurrencyRateController.currentCurrency,
  );
  /**
   * An object containing each identity in the format address => account
   */
  const identities = useSelector(
    (state: any) =>
      state.engine.backgroundState.PreferencesController.identities,
  );
  /**
   * A string that represents the selected address
   */
  const selectedAddress = useSelector(
    (state: any) =>
      state.engine.backgroundState.PreferencesController.selectedAddress,
  );
  /**
   * An array that represents the user tokens
   */
  const tokens = useSelector(
    (state: any) => state.engine.backgroundState.TokensController.tokens,
  );
  /**
   * Current provider ticker
   */
  const ticker = useSelector(
    (state: any) =>
      state.engine.backgroundState.NetworkController.provider.ticker,
  );
  /**
   * Current onboarding wizard step
   */
  const wizardStep = useSelector((state: any) => state.wizard.step);

  const { colors: themeColors } = useAppThemeFromContext() || mockTheme;

  /**
   * Check to see if we need to show What's New modal
   */
  useEffect(() => {
    if (wizardStep > 0) {
      // Do not check since it will conflict with the onboarding wizard
      return;
    }
    const checkWhatsNewModal = async () => {
      try {
        const shouldShowWhatsNew = await shouldShowWhatsNewModal();
        if (shouldShowWhatsNew) {
          navigation.navigate(Routes.MODAL.ROOT_MODAL_FLOW, {
            screen: Routes.MODAL.WHATS_NEW,
          });
        }
      } catch (error) {
        Logger.log(error, "Error while checking What's New modal!");
      }
    };
    checkWhatsNewModal();
  }, [wizardStep, navigation]);

  useEffect(
    () => {
      requestAnimationFrame(async () => {
        const {
          TokenDetectionController,
          CollectibleDetectionController,
          AccountTrackerController,
        } = Engine.context as any;
        TokenDetectionController.detectTokens();
        CollectibleDetectionController.detectCollectibles();
        AccountTrackerController.refresh();
      });
    },
    /* eslint-disable-next-line */
    [navigation],
  );

  useEffect(() => {
    navigation.setOptions(
      getWalletNavbarOptions(
        'wallet.title',
        navigation,
        drawerRef,
        themeColors,
      ),
    );
    /* eslint-disable-next-line */
  }, [navigation, themeColors]);
  const onRefresh = useCallback(async () => {
    requestAnimationFrame(async () => {
      setRefreshing(true);
      const {
        TokenDetectionController,
        CollectibleDetectionController,
        AccountTrackerController,
        CurrencyRateController,
        TokenRatesController,
        MisesController,
      } = Engine.context as any;
      const actions = [
        TokenDetectionController.detectTokens(),
        CollectibleDetectionController.detectCollectibles(),
        AccountTrackerController.refresh(),
        CurrencyRateController.start(),
        TokenRatesController.poll(),
        MisesController.getAccountMisesBalance(),
      ];
      await Promise.all(actions);
      setRefreshing(false);
    });
  }, [setRefreshing]);

  const renderTabBar = useCallback(
    () => (
      <DefaultTabBar
        underlineStyle={styles.tabUnderlineStyle}
        activeTextColor={colors.primary.default}
        inactiveTextColor={colors.text.alternative}
        backgroundColor={colors.background.default}
        tabStyle={styles.tabStyle}
        textStyle={styles.textStyle}
        style={styles.tabBar}
      />
    ),
    [styles, colors],
  );

  const onChangeTab = useCallback((obj) => {
    InteractionManager.runAfterInteractions(() => {
      if (obj.ref.props.tabLabel === strings('wallet.tokens')) {
        Analytics.trackEvent(ANALYTICS_EVENT_OPTS.WALLET_TOKENS);
      } else {
        Analytics.trackEvent(ANALYTICS_EVENT_OPTS.WALLET_COLLECTIBLES);
      }
    });
  }, []);

  const onRef = useCallback((ref) => {
    accountOverviewRef.current = ref;
  }, []);
  const { MisesController } = Engine.context as any;
  const isMises = useMisesNetwork(Engine);
  // const [lock, setLock] = useState(false);
  const getMisesBalance = () => {
    if (isMises) {
      timer = setTimeout(() => {
        MisesController.getAccountMisesBalance();
        getMisesBalance();
        lock = false;
      }, 10000);
    }
  };
  bridge.onWindowShow(() => {
    if (lock) return;
    if (timer) {
      clearTimeout(timer);
    }
    lock = true;
    getMisesBalance();
  });
  bridge.onWindowHide(() => {
    if (timer) {
      clearTimeout(timer);
    }
  });
  // useEffect(() => {
  //   return () => {
  //     clearTimeout(timer);
  //   };
  //   // eslint-disable-next-line
  // }, []);
  const renderContent = useCallback(() => {
    let balance: any = 0;
    let assets = tokens;
    if (isMises) {
      const misesAccount = findMisesAccount(misesAccounts, selectedAddress);
      balance = misesAccount.misesBalance?.amount;
      assets = [
        {
          name: 'Mises',
          symbol: 'MIS',
          isETH: false,
          balance,
          balanceFiat: weiToFiat(
            hexToBN('0x0') as any,
            conversionRate,
            currentCurrency,
          ),
          logo: '../images/mises-token.jpg',
        },
        ...(tokens || []),
      ];
    } else if (accounts[selectedAddress]) {
      balance = renderFromWei(accounts[selectedAddress].balance);
      assets = [
        {
          name: 'Ether', // FIXME: use 'Ether' for mainnet only, what should it be for custom networks?
          symbol: getTicker(ticker),
          isETH: true,
          balance,
          balanceFiat: weiToFiat(
            hexToBN(accounts[selectedAddress]?.balance || '0x0') as any,
            conversionRate,
            currentCurrency,
          ),
          logo: '../images/eth-logo.png',
        },
        ...(tokens || []),
      ];
    } else {
      assets = tokens;
    }

    const misesAccount = findMisesAccount(misesAccounts, selectedAddress);
    const account = {
      ...identities[selectedAddress],
      ...accounts[selectedAddress],
      ...misesAccount,
    };
    return (
      <View style={styles.wrapper}>
        <AccountOverview
          account={account}
          navigation={navigation}
          onRef={onRef}
        />
        <ScrollableTabView
          renderTabBar={renderTabBar}
          // eslint-disable-next-line react/jsx-no-bind
          onChangeTab={onChangeTab}
        >
          <Tokens
            tabLabel={strings('wallet.tokens')}
            key={'tokens-tab'}
            navigation={navigation}
            tokens={assets}
          />
          <CollectibleContracts
            tabLabel={strings('wallet.collectibles')}
            key={'nfts-tab'}
            navigation={navigation}
          />
        </ScrollableTabView>
      </View>
    );
  }, [
    tokens,
    accounts,
    selectedAddress,
    ticker,
    conversionRate,
    currentCurrency,
    identities,
    misesAccounts,
    styles.wrapper,
    navigation,
    onRef,
    renderTabBar,
    onChangeTab,
  ]);

  const renderLoader = useCallback(
    () => (
      <View style={styles.loader}>
        <ActivityIndicator size="small" />
      </View>
    ),
    [styles],
  );

  /**
   * Return current step of onboarding wizard if not step 5 nor 0
   */
  const renderOnboardingWizard = useCallback(
    () =>
      [1, 2, 3, 4].includes(wizardStep) && (
        <OnboardingWizard
          navigation={navigation}
          coachmarkRef={accountOverviewRef.current}
        />
      ),
    [navigation, wizardStep],
  );

  return (
    <ErrorBoundary view="Wallet">
      <View style={baseStyles.flexGrow} testID={'wallet-screen'}>
        <ScrollView
          style={styles.wrapper}
          refreshControl={
            <RefreshControl
              colors={[colors.primary.default]}
              tintColor={colors.icon.default}
              refreshing={refreshing}
              onRefresh={onRefresh}
            />
          }
        >
          {selectedAddress ? renderContent() : renderLoader()}
        </ScrollView>
        {/* {renderOnboardingWizard()} */}
      </View>
    </ErrorBoundary>
  );
};

export default Wallet;
