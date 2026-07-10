import React, {useEffect, useRef} from 'react';
import {NavigationContainer} from '@react-navigation/native';
import {createBottomTabNavigator} from '@react-navigation/bottom-tabs';
import {createStackNavigator} from '@react-navigation/stack';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import {Linking, StatusBar} from 'react-native';

import {parseZionUri} from './src/utils/zionUri';
import GalacticBackground from './src/components/common/GalacticBackground';
import OnboardingScreen from './src/screens/OnboardingScreen';
import WalletScreen from './src/screens/WalletScreen';
import SendScreen from './src/screens/SendScreen';
import TransactionHistoryScreen from './src/screens/TransactionHistoryScreen';
import DashboardScreen from './src/screens/DashboardScreen';
import MiningScreen from './src/screens/MiningScreen';
import NetworkScreen from './src/screens/NetworkScreen';
import BridgeScreen from './src/screens/BridgeScreen';
import DAOScreen from './src/screens/DAOScreen';
import AIScreen from './src/screens/AIScreen';
import SettingsScreen from './src/screens/SettingsScreen';
import PaywallScreen from './src/screens/PaywallScreen';
import {WalletProvider} from './src/context/WalletContext';
import {MiningProvider} from './src/context/MiningContext';
import {IAPProvider} from './src/context/IAPContext';
import {colors} from './src/constants/theme';

const Tab = createBottomTabNavigator();
const WalletStack = createStackNavigator();
const RootStack = createStackNavigator();

/** Stack navigator for Wallet tab — Wallet → Send, Transactions */
const WalletNavigator = () => (
  <WalletStack.Navigator
    screenOptions={{
      headerStyle: {
        backgroundColor: 'rgba(10, 12, 28, 0.95)',
        elevation: 0,
        shadowOpacity: 0,
        borderBottomWidth: 0,
      },
      headerTintColor: colors.text.primary,
      headerTitleStyle: {fontWeight: 'bold', fontSize: 20},
      cardStyle: {backgroundColor: 'transparent'},
    }}>
    <WalletStack.Screen
      name="WalletMain"
      component={WalletScreen}
      options={{headerShown: false}}
    />
    <WalletStack.Screen
      name="Send"
      component={SendScreen}
      options={{headerShown: false}}
    />
    <WalletStack.Screen
      name="Transactions"
      component={TransactionHistoryScreen}
      options={{headerShown: false}}
    />
  </WalletStack.Navigator>
);

/** NavigationContainer theme */
const navTheme = {
  dark: true,
  colors: {
    primary: colors.primary.gold,
    background: 'transparent',
    card: 'rgba(12, 14, 30, 0.85)',
    text: colors.text.primary,
    border: 'rgba(255,255,255,0.08)',
    notification: colors.primary.gold,
  },
};

/** Main tab navigator */
const MainTabs = () => (
  <Tab.Navigator
    screenOptions={({route}) => ({
      tabBarIcon: ({focused, color, size}) => {
        let iconName;
        switch (route.name) {
          case 'Wallet':
            iconName = 'wallet';
            break;
          case 'Dashboard':
            iconName = 'view-dashboard';
            break;
          case 'Mining':
            iconName = 'pickaxe';
            break;
          case 'Network':
            iconName = 'lan';
            break;
          case 'Bridge':
            iconName = 'swap-horizontal';
            break;
          case 'DAO':
            iconName = 'vote-outline';
            break;
          case 'AI':
            iconName = 'brain';
            break;
          case 'Settings':
            iconName = 'cog';
            break;
          default:
            iconName = 'circle';
        }
        return <Icon name={iconName} size={size} color={color} />;
      },
      tabBarActiveTintColor: colors.primary.gold,
      tabBarInactiveTintColor: colors.text.muted,
      tabBarStyle: {
        backgroundColor: 'rgba(12, 14, 30, 0.85)',
        borderTopColor: 'rgba(255,255,255,0.08)',
        borderTopWidth: 1,
        height: 65,
        paddingBottom: 8,
        paddingTop: 8,
      },
      tabBarLabelStyle: {
        fontSize: 11,
        fontWeight: '600',
      },
      headerStyle: {
        backgroundColor: 'rgba(10, 12, 28, 0.6)',
        elevation: 0,
        shadowOpacity: 0,
        borderBottomWidth: 0,
      },
      headerTintColor: colors.text.primary,
      headerTitleStyle: {
        fontWeight: 'bold',
        fontSize: 20,
      },
    })}>
    <Tab.Screen
      name="Wallet"
      component={WalletNavigator}
      options={{title: 'ZION Wallet', headerShown: false}}
    />
    <Tab.Screen
      name="Dashboard"
      component={DashboardScreen}
      options={{title: 'Dashboard'}}
    />
    <Tab.Screen
      name="Mining"
      component={MiningScreen}
      options={{title: 'Mining'}}
    />
    <Tab.Screen
      name="Network"
      component={NetworkScreen}
      options={{title: 'Network'}}
    />
    <Tab.Screen
      name="Bridge"
      component={BridgeScreen}
      options={{title: 'wZION Bridge'}}
    />
    <Tab.Screen
      name="DAO"
      component={DAOScreen}
      options={{title: 'DAO'}}
    />
    <Tab.Screen
      name="AI"
      component={AIScreen}
      options={{title: 'Hiran AI'}}
    />
    <Tab.Screen
      name="Settings"
      component={SettingsScreen}
      options={{title: 'Settings'}}
    />
  </Tab.Navigator>
);

/**
 * Handle a ZION deep link URL.
 *
 * Supported URI types:
 *  - zion:<address>?amount=X&memo=Y   → Send screen with pre-filled amount/memo
 *  - zion://import?mnemonic=...        → Onboarding with import data
 *  - zion://wallet?address=...         → Wallet screen
 *
 * @param {string|null} url - The deep link URL to process.
 * @param {Object} navigationRef - React ref to the NavigationContainer.
 */
const handleDeepLink = (url, navigationRef) => {
  if (!url || typeof url !== 'string') return;
  const nav = navigationRef.current;
  if (!nav) {
    console.warn('[DeepLink] Navigation ref not ready yet, skipping:', url);
    return;
  }

  try {
    // ── zion:<address>?amount=X&memo=Y (single-colon payment URI) ──
    // parseZionUri handles zion://import and zion://wallet, but the
    // single-colon address form is parsed here to match SendScreen's QR logic.
    if (url.startsWith('zion:') && !url.startsWith('zion://')) {
      const stripped = url.replace('zion:', '');
      const [address, query] = stripped.split('?');
      let amount = null;
      let memo = null;
      if (query) {
        const params = new URLSearchParams(query);
        amount = params.get('amount');
        memo = params.get('memo');
      }
      nav.navigate('Main', {
        screen: 'Wallet',
        params: {
          screen: 'Send',
          params: { recipient: address, amount, memo },
        },
      });
      return;
    }

    const parsed = parseZionUri(url);

    switch (parsed.type) {
      case 'import':
      case 'mnemonic':
      case 'privateKey':
        // Navigate to Onboarding with import data so the user can complete import.
        nav.navigate('Onboarding', {
          importMnemonic: parsed.mnemonic || parsed.privateKey,
          network: parsed.network,
        });
        break;

      case 'wallet':
        // Navigate to the Wallet tab (optionally with a target address).
        nav.navigate('Main', {
          screen: 'Wallet',
          params: { address: parsed.address, tokens: parsed.tokens },
        });
        break;

      default:
        console.log('[DeepLink] Unrecognized ZION URI, ignoring:', url, parsed);
    }
  } catch (error) {
    console.error('[DeepLink] Failed to handle URL:', url, error);
  }
};

const App = () => {
  const navigationRef = useRef(null);

  // ── Deep linking: cold-start + warm-start ──────────────────────────
  useEffect(() => {
    // Cold-start: the app was launched via a deep link.
    Linking.getInitialURL()
      .then((url) => {
        if (url) handleDeepLink(url, navigationRef);
      })
      .catch((err) => console.warn('[DeepLink] getInitialURL failed:', err));

    // Warm-start: the app is already running and receives a new link.
    // RN 0.65+ exposes addEventListener with a subscription object; older
    // versions return the Linking module itself. Handle both shapes.
    const subscription = Linking.addEventListener('url', ({url}) => {
      handleDeepLink(url, navigationRef);
    });

    return () => {
      if (subscription && typeof subscription.remove === 'function') {
        subscription.remove();
      }
    };
  }, []);

  return (
    <IAPProvider>
      <WalletProvider>
        <MiningProvider>
          <GalacticBackground>
          <NavigationContainer ref={navigationRef} theme={navTheme}>
            <StatusBar
              barStyle="light-content"
              backgroundColor="transparent"
              translucent
            />
            <RootStack.Navigator
              screenOptions={{
                headerShown: false,
                cardStyle: {backgroundColor: 'transparent'},
              }}>
              <RootStack.Screen
                name="Onboarding"
                component={OnboardingScreen}
              />
              <RootStack.Screen
                name="Main"
                component={MainTabs}
              />
              <RootStack.Screen
                name="Paywall"
                component={PaywallScreen}
                options={{
                  headerShown: true,
                  headerTitle: 'Upgrade',
                  headerStyle: {
                    backgroundColor: 'rgba(10, 12, 28, 0.95)',
                    elevation: 0,
                    shadowOpacity: 0,
                    borderBottomWidth: 0,
                  },
                  headerTintColor: colors.text.primary,
                  cardStyle: {backgroundColor: 'transparent'},
                }}
              />
            </RootStack.Navigator>
          </NavigationContainer>
          </GalacticBackground>
        </MiningProvider>
      </WalletProvider>
    </IAPProvider>
  );
};

export default App;
