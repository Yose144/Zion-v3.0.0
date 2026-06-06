/**
 * Biometric Authentication Utility
 * Podporuje Face ID (iOS) a Fingerprint (Android)
 * 
 * Usage:
 *   import {unlockWithBiometric, isBiometricAvailable} from './utils/biometric';
 *   
 *   const available = await isBiometricAvailable();
 *   if (available) {
 *     const success = await unlockWithBiometric();
 *     if (success) {
 *       // Proceed with wallet unlock
 *     }
 *   }
 */

import ReactNativeBiometrics from 'react-native-biometrics';
import {Platform, Alert} from 'react-native';

const rnBiometrics = new ReactNativeBiometrics();

/**
 * Zkontroluje dostupnost biometrické autentizace
 * @returns {Promise<{available: boolean, type: string}>}
 */
export const isBiometricAvailable = async () => {
  try {
    const {available, biometryType} = await rnBiometrics.isSensorAvailable();
    
    return {
      available,
      type: biometryType, // 'FaceID', 'TouchID', 'Fingerprint', nebo null
    };
  } catch (error) {
    console.error('Biometric check failed:', error);
    return {available: false, type: null};
  }
};

/**
 * Vytvoření biometrických klíčů (při prvním setupu walletu)
 * @param {string} walletId - ID walletu
 * @returns {Promise<string>} Public key
 */
export const createBiometricKeys = async (walletId) => {
  try {
    const {publicKey} = await rnBiometrics.createKeys();
    return publicKey;
  } catch (error) {
    console.error('Failed to create biometric keys:', error);
    throw new Error('Biometric setup failed');
  }
};

/**
 * Biometrická autentizace s signature
 * @param {string} walletId - ID walletu
 * @param {string} reason - Důvod autentizace (zobrazí se uživateli)
 * @returns {Promise<boolean>} true pokud úspěšné
 */
export const unlockWithBiometric = async (walletId, reason = 'Unlock ZION Wallet') => {
  try {
    const {available} = await isBiometricAvailable();
    
    if (!available) {
      Alert.alert(
        'Biometric Not Available',
        'Please use your password instead.',
        [{text: 'OK'}]
      );
      return false;
    }
    
    // Create signature payload
    const payload = JSON.stringify({
      walletId,
      timestamp: Date.now(),
      action: 'unlock',
    });
    
    // Request biometric authentication
    const {success, signature} = await rnBiometrics.createSignature({
      promptMessage: reason,
      payload,
      cancelButtonText: 'Cancel',
    });
    
    if (success) {
      console.log('Biometric authentication successful');
      return true;
    } else {
      console.log('Biometric authentication cancelled');
      return false;
    }
  } catch (error) {
    console.error('Biometric authentication failed:', error);
    
    // Show fallback to password
    Alert.alert(
      'Authentication Failed',
      'Please use your password instead.',
      [{text: 'OK'}]
    );
    
    return false;
  }
};

/**
 * Smazání biometrických klíčů (při odstranění walletu)
 * @returns {Promise<boolean>}
 */
export const deleteBiometricKeys = async () => {
  try {
    const {keysDeleted} = await rnBiometrics.deleteKeys();
    return keysDeleted;
  } catch (error) {
    console.error('Failed to delete biometric keys:', error);
    return false;
  }
};

/**
 * Získání názvu biometrické metody pro UI
 * @param {string} type - Typ z isBiometricAvailable()
 * @returns {string} User-friendly název
 */
export const getBiometricName = (type) => {
  switch (type) {
    case 'FaceID':
      return 'Face ID';
    case 'TouchID':
      return 'Touch ID';
    case 'Biometrics':
    case 'Fingerprint':
      return 'Fingerprint';
    default:
      return 'Biometric';
  }
};

/**
 * Zkontroluje, zda má wallet nastavenu biometrickou autentizaci
 * @param {string} walletId
 * @returns {Promise<boolean>}
 */
export const hasBiometricSetup = async (walletId) => {
  try {
    const {keysExist} = await rnBiometrics.biometricKeysExist();
    return keysExist;
  } catch (error) {
    return false;
  }
};

/**
 * Zobrazí dialog pro výběr autentizační metody
 * @param {Function} onBiometric - Callback pro biometric
 * @param {Function} onPassword - Callback pro password
 */
export const showAuthMethodDialog = (onBiometric, onPassword) => {
  Alert.alert(
    'Unlock Wallet',
    'Choose authentication method:',
    [
      {
        text: 'Use Biometric',
        onPress: onBiometric,
      },
      {
        text: 'Use Password',
        onPress: onPassword,
      },
      {
        text: 'Cancel',
        style: 'cancel',
      },
    ],
    {cancelable: true}
  );
};

export default {
  isBiometricAvailable,
  createBiometricKeys,
  unlockWithBiometric,
  deleteBiometricKeys,
  getBiometricName,
  hasBiometricSetup,
  showAuthMethodDialog,
};
