/**
 * @format
 */

import {AppRegistry, Platform} from 'react-native';
import App from './App';
import {name as appName} from './package.json';

AppRegistry.registerComponent(appName, () => App);

// For Expo web: mount the app into the DOM
if (Platform.OS === 'web') {
  const rootTag = document.getElementById('root') || document.getElementById('main');
  if (rootTag) {
    AppRegistry.runApplication(appName, {rootTag});
  }
}
