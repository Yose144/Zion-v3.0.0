/**
 * Web mocks for native-only modules
 * Used when running via Expo Web (react-native-web)
 */

// react-native-linear-gradient mock
export const LinearGradient = ({children, style}) => {
  const React = require('react');
  const {View} = require('react-native');
  return React.createElement(View, {style: [style, {backgroundColor: '#1a1a2e'}]}, children);
};
export default LinearGradient;
