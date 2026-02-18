import React from 'react';
import {NavigationContainer} from '@react-navigation/native';
import {createBottomTabNavigator} from '@react-navigation/bottom-tabs';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import {StatusBar, StyleSheet} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';

import WalletScreen from './src/screens/WalletScreen';
import DashboardScreen from './src/screens/DashboardScreen';
import MiningScreen from './src/screens/MiningScreen';
import SettingsScreen from './src/screens/SettingsScreen';
import {WalletProvider} from './src/context/WalletContext';
import {MiningProvider} from './src/context/MiningContext';
import {colors} from './src/constants/theme';

const Tab = createBottomTabNavigator();

const App = () => {
  return (
    <WalletProvider>
      <MiningProvider>
        <NavigationContainer>
          <StatusBar
            barStyle="light-content"
            backgroundColor={colors.background.dark}
          />
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
                backgroundColor: colors.background.card,
                borderTopColor: 'rgba(255,255,255,0.06)',
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
                backgroundColor: colors.background.dark,
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
              component={WalletScreen}
              options={{title: 'ZION Wallet'}}
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
              name="Settings"
              component={SettingsScreen}
              options={{title: 'Settings'}}
            />
          </Tab.Navigator>
        </NavigationContainer>
      </MiningProvider>
    </WalletProvider>
  );
};

export default App;
