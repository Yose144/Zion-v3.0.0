/**
 * Web mock for react-native-push-notification
 */
export default {
  configure: () => {},
  localNotification: () => {},
  cancelAllLocalNotifications: () => {},
  requestPermissions: () => Promise.resolve({alert: true}),
  checkPermissions: (cb) => cb({alert: true, badge: true, sound: true}),
  createChannel: () => {},
};
