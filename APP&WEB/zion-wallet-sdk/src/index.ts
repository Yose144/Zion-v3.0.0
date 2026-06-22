/**
 * ZION Wallet SDK
 * Unified TypeScript library for ZION L1 wallet operations.
 */

// Core cryptography
export {
  publicKeyToAddress,
  isValidAddress,
  getAddressType,
  ZION_PREFIX,
  ZION_BASE32,
} from './core/address.js';

export {
  generateMnemonic,
  validateMnemonic,
  deriveKeypairFromMnemonic,
  deriveKeypairFromPrivateKey,
  signMessage,
  verifySignature,
} from './core/keypair.js';

export {
  encrypt,
  decrypt,
  upgradeEncryption,
  hashPassword,
  constantTimeEqual,
  LEGACY_PBKDF2_ITERATIONS,
  CURRENT_PBKDF2_ITERATIONS,
  type EncryptedPayload,
} from './core/crypto.js';

export {
  buildUtxoTransaction,
  buildAccountTransaction,
  generateAccountTxId,
  calculateTxHash,
  transactionToRpcPayload,
  FLOWERS_PER_ZION,
  MIN_FEE_FLOWERS,
  ACCOUNT_DEFAULT_FEE_FLOWERS,
} from './core/transaction.js';

export type {
  UTXO,
  TxInput,
  TxOutput,
  Transaction,
  AccountTransaction,
} from './core/transaction.js';

// RPC
export { ZionRPC } from './rpc/zion-rpc.js';
export type { RpcConfig } from './rpc/zion-rpc.js';

// Storage
export type { StorageInterface, WalletData } from './storage/storage-interface.js';
export { WebStorage } from './storage/web-storage.js';
export { ReactNativeStorage } from './storage/react-native-storage.js';
export { ElectronStorage } from './storage/electron-storage.js';

// Wallet
export type { Wallet, WalletPublicView } from './wallet/wallet.js';
export { toPublicView } from './wallet/wallet.js';
export {
  WalletManager,
  type CreateWalletOptions,
  type ImportMnemonicOptions,
  type ImportPrivateKeyOptions,
  type SendOptions,
} from './wallet/wallet-manager.js';

// Hardware wallets
export {
  TrezorWallet,
  DEFAULT_TREZOR_PATH,
  type TrezorAddressResult,
  type TrezorManifest,
} from './hardware/trezor-wallet.js';

export {
  LedgerWallet,
  DEFAULT_LEDGER_PATH,
  type LedgerAddressResult,
} from './hardware/ledger-wallet.js';

export {
  GenericHIDWallet,
  HIDWalletRegistry,
  type GenericAddressResult,
  type GenericHIDWalletOptions,
  type HIDDeviceInfo,
} from './hardware/generic-hid-wallet.js';

// Convenience class that wires everything together
import { WalletManager } from './wallet/wallet-manager.js';
import type { StorageInterface } from './storage/storage-interface.js';
import type { RpcConfig } from './rpc/zion-rpc.js';

export class ZionWalletSDK {
  manager: WalletManager;

  constructor(storage: StorageInterface, rpcConfig?: RpcConfig) {
    this.manager = new WalletManager(storage, rpcConfig);
  }

  async initialize(): Promise<void> {
    await this.manager.initialize();
  }
}
