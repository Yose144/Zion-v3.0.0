/**
 * Web mock for react-native-biometrics
 */
class ReactNativeBiometrics {
  async isSensorAvailable() {
    return { available: false, biometryType: null };
  }
  async simplePrompt() {
    return { success: true };
  }
  async createKeys() {
    return { publicKey: '' };
  }
}

export default ReactNativeBiometrics;
