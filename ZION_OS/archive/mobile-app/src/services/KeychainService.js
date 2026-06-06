/**
 * Keychain Service - Secure Storage Wrapper
 * Nahrazuje AsyncStorage pro citlivá data (private keys, mnemonic)
 * 
 * Používá:
 * - iOS: Keychain (hardware-backed)
 * - Android: Keystore (hardware-backed on supported devices)
 * 
 * Security Features:
 * - Hardware encryption
 * - Biometric protection
 * - Isolated storage per app
 * - Auto-clear on app uninstall
 * 
 * Usage:
 *   import KeychainService from './services/KeychainService';
 *   
 *   // Save wallet
 *   await KeychainService.saveWallet(walletId, walletData);
 *   
 *   // Load wallet
 *   const wallet = await KeychainService.loadWallet(walletId);
 *   
 *   // Delete wallet
 *   await KeychainService.deleteWallet(walletId);
 */

import * as Keychain from 'react-native-keychain';
import {Platform} from 'react-native';

const SERVICE_NAME = 'zion.wallet';
const ACCESS_CONTROL = Keychain.ACCESS_CONTROL.BIOMETRY_ANY_OR_DEVICE_PASSCODE;

class KeychainService {
  /**
   * Uložení wallet do Keychain
   * @param {string} walletId - Unique wallet identifier
   * @param {object} walletData - Wallet data (address, privateKey, mnemonic, etc.)
   * @returns {Promise<boolean>}
   */
  async saveWallet(walletId, walletData) {
    try {
      const serialized = JSON.stringify(walletData);
      
      const options = {
        service: `${SERVICE_NAME}.${walletId}`,
        accessible: Keychain.ACCESSIBLE.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
      };
      
      // Add biometric protection if available
      if (Platform.OS === 'ios') {
        options.accessControl = ACCESS_CONTROL;
        options.authenticationType = Keychain.AUTHENTICATION_TYPE.BIOMETRICS;
      }
      
      await Keychain.setGenericPassword(
        walletId,        // username = walletId
        serialized,      // password = wallet data
        options
      );
      
      console.log(`✅ Wallet ${walletId} saved to Keychain`);
      return true;
    } catch (error) {
      console.error(`❌ Failed to save wallet ${walletId}:`, error);
      throw new Error(`Keychain save failed: ${error.message}`);
    }
  }

  /**
   * Načtení wallet z Keychain
   * @param {string} walletId
   * @returns {Promise<object|null>} Wallet data nebo null
   */
  async loadWallet(walletId) {
    try {
      const options = {
        service: `${SERVICE_NAME}.${walletId}`,
      };
      
      // iOS: může vyžadovat biometric auth
      if (Platform.OS === 'ios') {
        options.authenticationPrompt = {
          title: 'Unlock Wallet',
          subtitle: `Access wallet ${walletId}`,
          cancel: 'Cancel',
        };
      }
      
      const credentials = await Keychain.getGenericPassword(options);
      
      if (!credentials) {
        console.log(`⚠️ Wallet ${walletId} not found in Keychain`);
        return null;
      }
      
      const walletData = JSON.parse(credentials.password);
      console.log(`✅ Wallet ${walletId} loaded from Keychain`);
      
      return walletData;
    } catch (error) {
      console.error(`❌ Failed to load wallet ${walletId}:`, error);
      
      // User cancelled biometric
      if (error.message.includes('cancelled') || error.message.includes('User canceled')) {
        throw new Error('Authentication cancelled');
      }
      
      throw new Error(`Keychain load failed: ${error.message}`);
    }
  }

  /**
   * Smazání wallet z Keychain
   * @param {string} walletId
   * @returns {Promise<boolean>}
   */
  async deleteWallet(walletId) {
    try {
      const options = {
        service: `${SERVICE_NAME}.${walletId}`,
      };
      
      await Keychain.resetGenericPassword(options);
      console.log(`✅ Wallet ${walletId} deleted from Keychain`);
      
      return true;
    } catch (error) {
      console.error(`❌ Failed to delete wallet ${walletId}:`, error);
      return false;
    }
  }

  /**
   * Seznam všech wallet IDs v Keychain
   * @returns {Promise<string[]>}
   */
  async listWallets() {
    try {
      // Keychain nemá built-in list funkci, takže musíme trackovat IDs separátně
      const options = {
        service: `${SERVICE_NAME}.index`,
      };
      
      const credentials = await Keychain.getGenericPassword(options);
      
      if (!credentials) {
        return [];
      }
      
      const walletIds = JSON.parse(credentials.password);
      return walletIds;
    } catch (error) {
      console.error('Failed to list wallets:', error);
      return [];
    }
  }

  /**
   * Přidání wallet ID do indexu
   * @param {string} walletId
   * @returns {Promise<void>}
   */
  async addToIndex(walletId) {
    try {
      const walletIds = await this.listWallets();
      
      if (!walletIds.includes(walletId)) {
        walletIds.push(walletId);
        
        const options = {
          service: `${SERVICE_NAME}.index`,
          accessible: Keychain.ACCESSIBLE.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
        };
        
        await Keychain.setGenericPassword(
          'index',
          JSON.stringify(walletIds),
          options
        );
      }
    } catch (error) {
      console.error('Failed to add to index:', error);
    }
  }

  /**
   * Odebrání wallet ID z indexu
   * @param {string} walletId
   * @returns {Promise<void>}
   */
  async removeFromIndex(walletId) {
    try {
      const walletIds = await this.listWallets();
      const filtered = walletIds.filter(id => id !== walletId);
      
      const options = {
        service: `${SERVICE_NAME}.index`,
        accessible: Keychain.ACCESSIBLE.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
      };
      
      await Keychain.setGenericPassword(
        'index',
        JSON.stringify(filtered),
        options
      );
    } catch (error) {
      console.error('Failed to remove from index:', error);
    }
  }

  /**
   * Kontrola, zda je Keychain dostupný
   * @returns {Promise<boolean>}
   */
  async isAvailable() {
    try {
      const supported = await Keychain.getSupportedBiometryType();
      return true; // Keychain is always available, biometry is optional
    } catch (error) {
      console.error('Keychain check failed:', error);
      return false;
    }
  }

  /**
   * Získání info o biometric podpoře
   * @returns {Promise<string|null>} 'FaceID', 'TouchID', 'Fingerprint', nebo null
   */
  async getBiometryType() {
    try {
      const type = await Keychain.getSupportedBiometryType();
      return type; // 'FaceID', 'TouchID', 'Fingerprint', nebo null
    } catch (error) {
      return null;
    }
  }

  /**
   * Smazání všech wallets (pro testing nebo factory reset)
   * @returns {Promise<void>}
   */
  async clearAll() {
    try {
      const walletIds = await this.listWallets();
      
      for (const walletId of walletIds) {
        await this.deleteWallet(walletId);
      }
      
      // Clear index
      const options = {
        service: `${SERVICE_NAME}.index`,
      };
      await Keychain.resetGenericPassword(options);
      
      console.log('✅ All wallets cleared from Keychain');
    } catch (error) {
      console.error('Failed to clear all wallets:', error);
      throw error;
    }
  }

  /**
   * Migrace z AsyncStorage na Keychain
   * @param {object[]} oldWallets - Wallets z AsyncStorage
   * @returns {Promise<{success: number, failed: number}>}
   */
  async migrateFromAsyncStorage(oldWallets) {
    let success = 0;
    let failed = 0;
    
    console.log(`🔄 Migrating ${oldWallets.length} wallets to Keychain...`);
    
    for (const wallet of oldWallets) {
      try {
        await this.saveWallet(wallet.id, wallet);
        await this.addToIndex(wallet.id);
        success++;
      } catch (error) {
        console.error(`Failed to migrate wallet ${wallet.id}:`, error);
        failed++;
      }
    }
    
    console.log(`✅ Migration complete: ${success} success, ${failed} failed`);
    
    return {success, failed};
  }
}

export default new KeychainService();
