/**
 * Web mock for react-native-background-fetch
 */
export default {
  configure: (config, callback, timeout) => Promise.resolve(0),
  scheduleTask: (task) => Promise.resolve(),
  stop: () => Promise.resolve(),
  start: () => Promise.resolve(),
  finish: (taskId) => {},
  STATUS_RESTRICTED: 0,
  STATUS_DENIED: 1,
  STATUS_AVAILABLE: 2,
  NETWORK_TYPE_NONE: 0,
  NETWORK_TYPE_ANY: 1,
};
