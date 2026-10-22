const {getDefaultConfig, mergeConfig} = require('@react-native/metro-config');
const path = require('path');

/**
 * Metro configuration with web mocks for native-only modules
 */

const mocksDir = path.resolve(__dirname, 'src/mocks');

const config = {
  resolver: {
    resolveRequest: (context, moduleName, platform) => {
      if (platform === 'web') {
        const nativeMocks = {
          'react-native-linear-gradient': path.join(mocksDir, 'react-native-linear-gradient.js'),
          'react-native-vector-icons/MaterialCommunityIcons': path.join(mocksDir, 'react-native-vector-icons.js'),
          'react-native-keychain': path.join(mocksDir, 'react-native-keychain.js'),
          'react-native-biometrics': path.join(mocksDir, 'react-native-biometrics.js'),
          'react-native-device-info': path.join(mocksDir, 'react-native-device-info.js'),
          'react-native-camera': path.join(mocksDir, 'react-native-camera.js'),
          'react-native-qrcode-svg': path.join(mocksDir, 'react-native-qrcode-svg.js'),
          'react-native-permissions': path.join(mocksDir, 'react-native-permissions.js'),
          'react-native-push-notification': path.join(mocksDir, 'react-native-push-notification.js'),
          'react-native-background-fetch': path.join(mocksDir, 'react-native-background-fetch.js'),
          'crypto-js': path.join(mocksDir, 'react-native-crypto-js.js'),
          'stellar-base': path.join(mocksDir, 'stellar-base.js'),
          '@react-native-async-storage/async-storage': path.join(mocksDir, 'async-storage.js'),
          '@react-native-clipboard/clipboard': path.join(mocksDir, 'clipboard.js'),
        };
        if (nativeMocks[moduleName]) {
          return {type: 'sourceFile', filePath: nativeMocks[moduleName]};
        }
      }
      return context.resolveRequest(context, moduleName, platform);
    },
  },
};

module.exports = mergeConfig(getDefaultConfig(__dirname), config);
