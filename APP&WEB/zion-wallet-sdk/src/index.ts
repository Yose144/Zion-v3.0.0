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
} from './core/address';

export {
  generateMnemonic,
  validateMnemonic,
  deriveKeypairFromMnemonic,
  deriveKeypairFromPrivateKey,
  signMessage,
  verifySignature,
} from './core/keypair';

export { encrypt, decrypt, hashPassword, constantTimeEqual } from './core/crypto';

export {
  buildUtxoTransaction,
  calculateTxHash,
  transactionToRpcPayload,
  FLOWERS_PER_ZION,
  MIN_FEE_FLOWERS,
} from './core/transaction';

export type {
  UTXO,
  TxInput,
  TxOutput,
  Transaction,
} from './core/transaction';

// RPC
export { ZionRPC } from './rpc/zion-rpc';
export type { RpcConfig } from './rpc/zion-rpc';

// Storage
export type { StorageInterface, WalletData } from './storage/storage-interface';
export { WebStorage } from './storage/web-storage';
export { ReactNativeStorage } from './storage/react-native-storage';
export { ElectronStorage } from './storage/electron-storage';

// Wallet
export type { Wallet, WalletPublicView } from './wallet/wallet';
export { toPublicView } from './wallet/wallet';
export {
  WalletManager,
  type CreateWalletOptions,
  type ImportMnemonicOptions,
  type ImportPrivateKeyOptions,
  type SendOptions,
} from './wallet/wallet-manager';

// Convenience class that wires everything together
import { WalletManager } from './wallet/wallet-manager';
import type { StorageInterface } from './storage/storage-interface';
import type { RpcConfig } from './rpc/zion-rpc';

export class ZionWalletSDK {
  manager: WalletManager;

  constructor(storage: StorageInterface, rpcConfig?: RpcConfig) {
    this.manager = new WalletManager(storage, rpcConfig);
  }

  async initialize(): Promise<void> {
    await this.manager.initialize();
  }
}
