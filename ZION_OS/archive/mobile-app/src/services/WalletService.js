import AsyncStorage from '@react-native-async-storage/async-storage';
import KeychainService from './KeychainService';
import CryptoService from './CryptoService';
import MultiChainCryptoService from './MultiChainCryptoService';
import {CONFIG} from '../constants/config';
import {CHAIN_IDS} from '../constants/chains';
import {validateAddress} from '../utils/addressValidation';
import {TrezorWallet, LedgerWallet} from 'zion-wallet-sdk';

/**
 * Wallet Service v3.0.0
 * Správa ZION wallet (generování, import, export, signing)
 *
 * SECURITY UPDATES:
 * v3.0.0 - Ed25519 signing, PBKDF2+AES encryption, V3 mainnet ready
 * v2.9.2 - Migrated to Keychain/Keystore, transaction confirmation UI
 *
 * Features:
 * - Real BIP39 mnemonic (12/24 words) ✅
 * - Ed25519 signing (post-quantum ready) ✅
 * - Custom Bech32 address encoding (zion1...) ✅
 * - Keychain/Keystore secure storage ✅
 * - Biometric authentication ✅
 * - Transaction validation ✅
 */

const WALLET_STORAGE_KEY = '@zion_wallets'; // Legacy AsyncStorage key
const ACTIVE_WALLET_KEY = '@zion_active_wallet';
const MIN_PASSWORD_LENGTH = 8;
const PASSWORD_STRENGTH_REGEX = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/;
const MIGRATION_FLAG_KEY = '@zion_keychain_migrated';

class WalletService {
  constructor() {
    this.wallets = [];
    this.activeWallet = null;
    this.useKeychain = true;
  }

  /**
   * Inicializace - načtení uložených wallets z Keychain
   * Automaticky migruje z AsyncStorage (v2.9.2+)
   */
  async initialize() {
    try {
      // Check if already migrated to Keychain
      const migrated = await AsyncStorage.getItem(MIGRATION_FLAG_KEY);
      
      if (!migrated) {
        await this.migrateToKeychain();
      }
      
      // Load wallets from Keychain
      const walletIds = await KeychainService.listWallets();
      
      for (const walletId of walletIds) {
        try {
          const wallet = await KeychainService.loadWallet(walletId);
          if (wallet) {
            this.wallets.push(wallet);
          }
        } catch (error) {
          console.error(`Failed to load wallet ${walletId}:`, error);
        }
      }

      // Load active wallet ID
      const activeWalletId = await AsyncStorage.getItem(ACTIVE_WALLET_KEY);
      if (activeWalletId) {
        this.activeWallet = this.wallets.find(w => w.id === activeWalletId);
      }
      
      console.log(`✅ WalletService initialized: ${this.wallets.length} wallets loaded`);
    } catch (error) {
      console.error('Failed to initialize wallet service:', error);
    }
  }
  
  /**
   * Migrace z AsyncStorage na Keychain (one-time)
   */
  async migrateToKeychain() {
    try {
      console.log('🔄 Starting AsyncStorage → Keychain migration...');
      
      const walletsJson = await AsyncStorage.getItem(WALLET_STORAGE_KEY);
      
      if (!walletsJson) {
        console.log('ℹ️ No wallets to migrate');
        await AsyncStorage.setItem(MIGRATION_FLAG_KEY, 'true');
        return;
      }
      
      const oldWallets = JSON.parse(walletsJson);
      const result = await KeychainService.migrateFromAsyncStorage(oldWallets);
      
      console.log(`✅ Migration complete: ${result.success} success, ${result.failed} failed`);
      await AsyncStorage.setItem(MIGRATION_FLAG_KEY, 'true');
    } catch (error) {
      console.error('❌ Migration failed:', error);
    }
  }

  /**
   * Generování nové wallet (v2.9.3 - s reálnými knihovnami)
   * @param {string} name - Název walletu
   * @param {string} password - Heslo (min 8 znaků, uppercase, lowercase, digit)
   * @returns {Promise<Object>} Wallet object
   */
  async generateWallet(name = 'Wallet', password, chainId = CHAIN_IDS.ZION) {
    this.validatePassword(password);
    
    try {
      const resolvedChainId = chainId || CHAIN_IDS.ZION;
      const walletData = await MultiChainCryptoService.generateWallet(resolvedChainId, password);

      const wallet = {
        id: Date.now().toString(),
        name: name || `${resolvedChainId} Wallet`,
        chainId: resolvedChainId,
        walletType: 'internal',
        address: walletData.address,
        publicKey: walletData.publicKey,
        privateKey: walletData.privateKey, // Encrypted
        mnemonic: walletData.mnemonic, // Encrypted
        path: walletData.path,
        keyType: walletData.keyType,
        created: new Date().toISOString(),
        balance: 0,
        consciousness: {
          level: 'PHYSICAL',
          xp: 0,
        },
      };

      this.wallets.push(wallet);
      await this.saveWallets();

      // Set as active if first wallet
      if (this.wallets.length === 1) {
        await this.setActiveWallet(wallet.id);
      }

      return wallet;
    } catch (error) {
      console.error('Failed to generate wallet:', error);
      throw error;
    }
  }

  /**
   * Import wallet z private key (v2.9.3)
   * @param {string} privateKeyHex - 32-byte private key (hex)
   * @param {string} name - Název walletu
   * @param {string} password - Heslo pro šifrování
   */
  async importFromPrivateKey(privateKeyHex, name = 'Imported Wallet', password, chainId = CHAIN_IDS.ZION) {
    this.validatePassword(password);
    
    try {
      const resolvedChainId = chainId || CHAIN_IDS.ZION;
      const walletData = await MultiChainCryptoService.importFromPrivateKey(
        resolvedChainId,
        privateKeyHex,
        password,
      );

      const wallet = {
        id: Date.now().toString(),
        name,
        chainId: resolvedChainId,
        walletType: 'internal',
        address: walletData.address,
        publicKey: walletData.publicKey,
        privateKey: walletData.privateKey, // Encrypted
        mnemonic: null,
        path: null,
        keyType: walletData.keyType,
        imported: true,
        created: new Date().toISOString(),
        balance: 0,
        consciousness: {
          level: 'PHYSICAL',
          xp: 0,
        },
      };

      this.wallets.push(wallet);
      await this.saveWallets();

      return wallet;
    } catch (error) {
      console.error('Failed to import wallet:', error);
      throw error;
    }
  }

  /**
   * Import wallet z mnemonic (v2.9.3 - real BIP39 validation)
   * @param {string} mnemonic - 12 nebo 24 slov
   * @param {string} name - Název walletu
   * @param {string} password - Heslo pro šifrování
   */
  async importFromMnemonic(mnemonic, name = 'Imported Wallet', password, chainId = CHAIN_IDS.ZION) {
    this.validatePassword(password);
    
    // Validate mnemonic (v2.9.3)
    if (!MultiChainCryptoService.validateMnemonic(mnemonic)) {
      throw new Error('Invalid mnemonic phrase');
    }
    
    try {
      const resolvedChainId = chainId || CHAIN_IDS.ZION;
      const walletData = await MultiChainCryptoService.importFromMnemonic(resolvedChainId, mnemonic, password);

      const wallet = {
        id: Date.now().toString(),
        name,
        chainId: resolvedChainId,
        walletType: 'internal',
        address: walletData.address,
        publicKey: walletData.publicKey,
        privateKey: walletData.privateKey, // Encrypted
        mnemonic: walletData.mnemonic, // Encrypted
        path: walletData.path,
        keyType: walletData.keyType,
        imported: true,
        created: new Date().toISOString(),
        balance: 0,
        consciousness: {
          level: 'PHYSICAL',
          xp: 0,
        },
      };

      this.wallets.push(wallet);
      await this.saveWallets();

      return wallet;
    } catch (error) {
      console.error('Failed to import wallet:', error);
      throw error;
    }
  }

  /**
   * Export wallet (decrypt private key and mnemonic)
   * @param {string} walletId
   * @param {string} password
   */
  async exportWallet(walletId, password) {
    const wallet = this.wallets.find(w => w.id === walletId);
    if (!wallet) {
      throw new Error('Wallet not found');
    }

    if (wallet.walletType === 'external') {
      return {
        address: wallet.address,
        chainId: wallet.chainId,
        walletType: wallet.walletType,
      };
    }

    if (wallet.walletType === 'trezor' || wallet.walletType === 'ledger') {
      return {
        address: wallet.address,
        publicKey: wallet.publicKey,
        path: wallet.path,
        walletType: wallet.walletType,
      };
    }

    try {
      const privateKey = MultiChainCryptoService.getPrivateKey(wallet.privateKey, password);
      const mnemonic = wallet.mnemonic
        ? MultiChainCryptoService.getMnemonic(wallet.mnemonic, password)
        : null;

      return {
        address: wallet.address,
        privateKey: privateKey.toString('hex'),
        mnemonic: mnemonic,
        publicKey: wallet.publicKey,
        path: wallet.path,
      };
    } catch (error) {
      throw new Error('Failed to decrypt wallet. Invalid password?');
    }
  }

  /**
   * Podepsání transakce (v2.9.3 - real secp256k1 ECDSA)
   * @param {string} walletId
   * @param {object} transaction - {recipient, amount, fee, token, hash}
   * @param {string} password
   * 
   * SECURITY: Před podpisem MUSÍ být zobrazen TransactionConfirmModal
   */
  async signTransaction(walletId, transaction, password) {
    // 1. Validate transaction
    this.validateTransaction(transaction);
    
    // 2. Find wallet
    const wallet = this.wallets.find(w => w.id === walletId);
    if (!wallet) {
      throw new Error('Wallet not found');
    }

    if (wallet.walletType === 'external') {
      throw new Error('Cannot sign transactions with a watch-only payout profile');
    }

    if (wallet.walletType === 'trezor' || wallet.walletType === 'ledger') {
      throw new Error(
        'Hardware wallet transaction signing is not supported for ZION. ' +
        'Trezor/Ledger firmware lacks generic Ed25519 signing for custom coins. '
      );
    }

    try {
      // 3. Decrypt private key
      const privateKey = MultiChainCryptoService.getPrivateKey(wallet.privateKey, password);
      
      // 4. Create transaction hash if not provided
      const txHash = transaction.hash || this.createTransactionHash(transaction);
      
      // 5. Sign according to chain
      const chainId = wallet.chainId || CHAIN_IDS.ZION;

      let signature;
      if (chainId === CHAIN_IDS.ZION) {
        signature = await CryptoService.signTransaction(txHash, privateKey);
      } else {
        signature = await MultiChainCryptoService.signMessageHex(chainId, txHash, privateKey);
      }
      
      return {
        signature,
        txHash,
        transaction,
      };
    } catch (error) {
      throw new Error('Failed to sign transaction: ' + error.message);
    }
  }
  
  /**
   * Vytvoření transaction hash
   */
  createTransactionHash(transaction) {
    const CryptoJS = require('crypto-js');
    
    const data = JSON.stringify({
      recipient: transaction.recipient,
      amount: transaction.amount,
      fee: transaction.fee || 0,
      timestamp: Date.now(),
      nonce: Math.random().toString(36).substring(7),
    });
    
    return CryptoJS.SHA256(data).toString();
  }

  /**
   * Validace transakce před podpisem (v2.9.2+)
   */
  validateTransaction(transaction) {
    if (!transaction.recipient) {
      throw new Error('Recipient address is required');
    }
    
    if (!transaction.amount || transaction.amount <= 0) {
      throw new Error('Amount must be greater than 0');
    }
    
    // Validate recipient address format
    const chainId = transaction.chainId || this.getActiveWallet()?.chainId || CHAIN_IDS.ZION;
    const validation = validateAddress(chainId, transaction.recipient);
    if (!validation.ok) {
      throw new Error(validation.reason || 'Invalid recipient address format');
    }
    
    if (isNaN(transaction.amount)) {
      throw new Error('Amount must be a valid number');
    }
    
    // Check for self-transfer
    const wallet = this.getActiveWallet();
    if (wallet && transaction.recipient === wallet.address) {
      console.warn('Warning: Sending to your own address');
    }
    
    // Validate fee
    if (transaction.fee && (isNaN(transaction.fee) || transaction.fee < 0)) {
      throw new Error('Fee must be a valid positive number');
    }
    
    return true;
  }

  /**
   * Validace hesla (v2.9.1+)
   */
  validatePassword(password) {
    if (!password) {
      throw new Error('Password is required');
    }
    
    if (password.length < MIN_PASSWORD_LENGTH) {
      throw new Error(`Password must be at least ${MIN_PASSWORD_LENGTH} characters`);
    }
    
    if (!PASSWORD_STRENGTH_REGEX.test(password)) {
      throw new Error('Password must contain: uppercase, lowercase, and digit');
    }
    
    return true;
  }

  /**
   * Získat seznam všech wallets
   */
  getWallets() {
    return this.wallets.map(w => ({
      id: w.id,
      name: w.name,
      chainId: w.chainId || CHAIN_IDS.ZION,
      walletType: w.walletType || 'internal',
      address: w.address,
      balance: w.balance,
      consciousness: w.consciousness,
      isActive: this.activeWallet?.id === w.id,
    }));
  }

  /**
   * Získat aktivní wallet
   */
  getActiveWallet() {
    return this.activeWallet;
  }

  /**
   * Check if active wallet is a hardware wallet (watch-only, cannot sign TX).
   */
  isHardwareWallet() {
    return this.activeWallet && ['trezor', 'ledger'].includes(this.activeWallet.walletType);
  }

  /**
   * Nastavit aktivní wallet
   */
  async setActiveWallet(walletId) {
    const wallet = this.wallets.find(w => w.id === walletId);
    if (!wallet) {
      throw new Error('Wallet not found');
    }

    this.activeWallet = wallet;
    await AsyncStorage.setItem(ACTIVE_WALLET_KEY, walletId);
  }

  /**
   * Import wallet from Trezor hardware device (Ed25519 public key export).
   * @param {string} name - Wallet display name
   * @param {string} path - BIP-32 path (default: "m/44'/0'/0'")
   */
  async importFromTrezor(name = 'Trezor Wallet', path = "m/44'/0'/0'") {
    const trezor = new TrezorWallet();
    await trezor.connect();
    try {
      const {address, publicKey} = await trezor.getAddress(path, true);

      const wallet = {
        id: `trezor_${Date.now()}`,
        name,
        chainId: CHAIN_IDS.ZION,
        walletType: 'trezor',
        address,
        publicKey,
        privateKey: null,
        mnemonic: null,
        path,
        imported: true,
        created: new Date().toISOString(),
        balance: 0,
        consciousness: {
          level: 'PHYSICAL',
          xp: 0,
        },
      };

      this.wallets.push(wallet);
      await this.saveWallets();

      if (this.wallets.length === 1) {
        await this.setActiveWallet(wallet.id);
      }

      return wallet;
    } finally {
      trezor.disconnect();
    }
  }

  /**
   * Import wallet from Ledger hardware device (Ed25519 public key export).
   * @param {string} name - Wallet display name
   * @param {string} path - BIP-32 path (default: "m/1852'/1815'/0'/0/0")
   */
  async importFromLedger(name = 'Ledger Wallet', path = "m/1852'/1815'/0'/0/0") {
    const ledger = new LedgerWallet();
    await ledger.connect();
    try {
      const {address, publicKey} = await ledger.getAddress(path, true);

      const wallet = {
        id: `ledger_${Date.now()}`,
        name,
        chainId: CHAIN_IDS.ZION,
        walletType: 'ledger',
        address,
        publicKey,
        privateKey: null,
        mnemonic: null,
        path,
        imported: true,
        created: new Date().toISOString(),
        balance: 0,
        consciousness: {
          level: 'PHYSICAL',
          xp: 0,
        },
      };

      this.wallets.push(wallet);
      await this.saveWallets();

      if (this.wallets.length === 1) {
        await this.setActiveWallet(wallet.id);
      }

      return wallet;
    } finally {
      ledger.disconnect();
    }
  }

  /**
   * Add watch-only payout address for non-ZION chains.
   * @param {Object} params
   * @param {string} params.chainId
   * @param {string} params.address
   * @param {string} params.name
   */
  async addExternalWallet({chainId, address, name}) {
    const resolvedChainId = chainId || CHAIN_IDS.ZION;
    const validation = validateAddress(resolvedChainId, address);
    if (!validation.ok) {
      throw new Error(validation.reason || 'Invalid address');
    }

    const wallet = {
      id: Date.now().toString(),
      name: name || `${resolvedChainId} Payout`,
      chainId: resolvedChainId,
      walletType: 'external',
      address: address.trim(),
      publicKey: null,
      privateKey: null,
      mnemonic: null,
      path: null,
      imported: true,
      created: new Date().toISOString(),
      balance: 0,
      consciousness: {
        level: 'PHYSICAL',
        xp: 0,
      },
    };

    this.wallets.push(wallet);
    await this.saveWallets();

    // If this is the first wallet, set it active
    if (this.wallets.length === 1) {
      await this.setActiveWallet(wallet.id);
    }

    return wallet;
  }

  /**
   * Uložení wallets do Keychain (v2.9.2+)
   */
  async saveWallets() {
    try {
      for (const wallet of this.wallets) {
        await KeychainService.saveWallet(wallet.id, wallet);
        await KeychainService.addToIndex(wallet.id);
      }
      
      if (this.activeWallet) {
        await AsyncStorage.setItem(ACTIVE_WALLET_KEY, this.activeWallet.id);
      }
      
      console.log(`✅ ${this.wallets.length} wallets saved to Keychain`);
    } catch (error) {
      console.error('Failed to save wallets:', error);
      throw error;
    }
  }
  
  /**
   * Smazání walletu z Keychain (v2.9.2+)
   */
  async deleteWallet(walletId) {
    try {
      await KeychainService.deleteWallet(walletId);
      await KeychainService.removeFromIndex(walletId);
      
      this.wallets = this.wallets.filter(w => w.id !== walletId);
      
      if (this.activeWallet?.id === walletId) {
        this.activeWallet = this.wallets[0] || null;
        if (this.activeWallet) {
          await AsyncStorage.setItem(ACTIVE_WALLET_KEY, this.activeWallet.id);
        } else {
          await AsyncStorage.removeItem(ACTIVE_WALLET_KEY);
        }
      }
      
      console.log(`✅ Wallet ${walletId} deleted`);
      return true;
    } catch (error) {
      console.error(`Failed to delete wallet ${walletId}:`, error);
      return false;
    }
  }
}

export default new WalletService();
