/**
 * Web mock for react-native-permissions
 */
export const PERMISSIONS = {ANDROID: {}, IOS: {}};
export const RESULTS = {UNAVAILABLE: 'unavailable', DENIED: 'denied', GRANTED: 'granted', BLOCKED: 'blocked'};

export const check = async () => RESULTS.GRANTED;
export const request = async () => RESULTS.GRANTED;
export const checkMultiple = async () => ({});
export const requestMultiple = async () => ({});

export default {PERMISSIONS, RESULTS, check, request, checkMultiple, requestMultiple};
