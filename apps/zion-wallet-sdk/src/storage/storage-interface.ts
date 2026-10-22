/**
 * Abstract storage interface for wallet data.
 * Implementations: WebStorage, ReactNativeStorage, ElectronStorage
 */

export interface WalletData {
  id: string;
  name: string;
  address: string;
  publicKey: string;
  privateKey: string; // encrypted
  mnemonic: string | null; // encrypted
  keyType: 'ed25519' | string;
  path: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface StorageInterface {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
  removeItem(key: string): Promise<void>;
}
