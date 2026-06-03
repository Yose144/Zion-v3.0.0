/**
 * Web mock for react-native-keychain
 * Uses localStorage as fallback on web
 */

// Keychain constants (must match native module enums)
export const ACCESS_CONTROL = {
  USER_PRESENCE: 'UserPresence',
  BIOMETRY_ANY: 'BiometryAny',
  BIOMETRY_CURRENT_SET: 'BiometryCurrentSet',
  DEVICE_PASSCODE: 'DevicePasscode',
  APPLICATION_PASSWORD: 'ApplicationPassword',
  BIOMETRY_ANY_OR_DEVICE_PASSCODE: 'BiometryAnyOrDevicePasscode',
  BIOMETRY_CURRENT_SET_OR_DEVICE_PASSCODE: 'BiometryCurrentSetOrDevicePasscode',
};

export const ACCESSIBLE = {
  WHEN_UNLOCKED: 'AccessibleWhenUnlocked',
  AFTER_FIRST_UNLOCK: 'AccessibleAfterFirstUnlock',
  ALWAYS: 'AccessibleAlways',
  WHEN_PASSCODE_SET_THIS_DEVICE_ONLY: 'AccessibleWhenPasscodeSetThisDeviceOnly',
  WHEN_UNLOCKED_THIS_DEVICE_ONLY: 'AccessibleWhenUnlockedThisDeviceOnly',
  AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY: 'AccessibleAfterFirstUnlockThisDeviceOnly',
};

export const AUTHENTICATION_TYPE = {
  DEVICE_PASSCODE_OR_BIOMETRICS: 'AuthenticationWithBiometricsDevicePasscode',
  BIOMETRICS: 'AuthenticationWithBiometrics',
};

export const BIOMETRY_TYPE = {
  TOUCH_ID: 'TouchID',
  FACE_ID: 'FaceID',
  FINGERPRINT: 'Fingerprint',
  FACE: 'Face',
  IRIS: 'Iris',
};

export const SECURITY_LEVEL = {
  ANY: 'ANY',
  SECURE_SOFTWARE: 'SECURE_SOFTWARE',
  SECURE_HARDWARE: 'SECURE_HARDWARE',
};

export const STORAGE_TYPE = {
  FB: 'FacebookConceal',
  AES: 'KeystoreAESCBC',
  RSA: 'KeystoreRSAECB',
};

export const setGenericPassword = async (username, password, options) => {
  try {
    const key = options?.service || 'default';
    localStorage.setItem(`keychain_${key}`, JSON.stringify({username, password}));
    return true;
  } catch { return false; }
};

export const getGenericPassword = async (options) => {
  try {
    const key = options?.service || 'default';
    const data = localStorage.getItem(`keychain_${key}`);
    if (!data) return false;
    return JSON.parse(data);
  } catch { return false; }
};

export const resetGenericPassword = async (options) => {
  try {
    const key = options?.service || 'default';
    localStorage.removeItem(`keychain_${key}`);
    return true;
  } catch { return false; }
};

export const getSupportedBiometryType = async () => null;

export const getSecurityLevel = async () => SECURITY_LEVEL.SECURE_SOFTWARE;

export default {
  ACCESS_CONTROL,
  ACCESSIBLE,
  AUTHENTICATION_TYPE,
  BIOMETRY_TYPE,
  SECURITY_LEVEL,
  STORAGE_TYPE,
  setGenericPassword,
  getGenericPassword,
  resetGenericPassword,
  getSupportedBiometryType,
  getSecurityLevel,
};
