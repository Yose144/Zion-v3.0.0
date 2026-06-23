import React from 'react';
import {NavigationContainer} from '@react-navigation/native';
import {createBottomTabNavigator} from '@react-navigation/bottom-tabs';
import {createStackNavigator} from '@react-navigation/stack';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import {StatusBar} from 'react-native';

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
import {WalletProvider} from './src/context/WalletContext';
import {MiningProvider} from './src/context/MiningContext';
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

const App = () => {
  return (
    <WalletProvider>
      <MiningProvider>
        <GalacticBackground>
          <NavigationContainer theme={navTheme}>
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
            </RootStack.Navigator>
          </NavigationContainer>
        </GalacticBackground>
      </MiningProvider>
    </WalletProvider>
  );
};

export default App;
