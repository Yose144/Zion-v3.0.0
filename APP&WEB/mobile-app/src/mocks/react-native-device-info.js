/**
 * Web mock for react-native-device-info
 */
export default {
  getVersion: () => '2.9.5',
  getBuildNumber: () => '5',
  getDeviceId: () => 'web-browser',
  getModel: () => 'Web Browser',
  getBrand: () => 'Browser',
  getSystemName: () => 'Web',
  getSystemVersion: () => navigator?.userAgent || 'unknown',
  isEmulator: () => Promise.resolve(true),
  getBatteryLevel: () => Promise.resolve(1.0),
  isBatteryCharging: () => Promise.resolve(true),
  getUniqueId: () => Promise.resolve('web-' + Date.now()),
};
