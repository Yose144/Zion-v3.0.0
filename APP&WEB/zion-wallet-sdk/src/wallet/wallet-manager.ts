/**
 * ZION Wallet Manager
 * Handles wallet CRUD, encryption, and active wallet tracking.
 */

import {
  deriveKeypairFromMnemonic,
  deriveKeypairFromPrivateKey,
  generateMnemonic,
} from '../core/keypair.js';
import { publicKeyToAddress, isValidAddress } from '../core/address.js';
import { encrypt, decrypt } from '../core/crypto.js';
import type { StorageInterface } from '../storage/storage-interface.js';
import type { Wallet, WalletPublicView } from './wallet.js';
import { toPublicView } from './wallet.js';
import { buildUtxoTransaction, transactionToRpcPayload } from '../core/transaction.js';
import { ZionRPC } from '../rpc/zion-rpc.js';
import type { RpcConfig } from '../rpc/zion-rpc.js';

const STORAGE_KEY_WALLETS = 'zion_wallet_index';
const STORAGE_KEY_ACTIVE = 'zion_wallet_active';

export interface CreateWalletOptions {
  name?: string;
  password: string;
  strength?: 128 | 256;
}

export interface ImportMnemonicOptions {
  mnemonic: string;
  name?: string;
  password: string;
}

export interface ImportPrivateKeyOptions {
  privateKeyHex: string;
  name?: string;
  password: string;
}

export interface SendOptions {
  walletId: string;
  toAddress: string;
  amountZion: number;
  password: string;
  memo?: string;
}

export class WalletManager {
  private storage: StorageInterface;
  private wallets: Map<string, Wallet>;
  private activeWalletId: string | null;
  private rpc: ZionRPC;

  constructor(storage: StorageInterface, rpcConfig?: RpcConfig) {
    this.storage = storage;
    this.wallets = new Map();
    this.activeWalletId = null;
    this.rpc = new ZionRPC(rpcConfig);
  }

  // ─── Initialization ─────────────────────────────────────────────────

  async initialize(): Promise<void> {
    const indexJson = await this.storage.getItem(STORAGE_KEY_WALLETS);
    if (indexJson) {
      const ids: string[] = JSON.parse(indexJson);
      for (const id of ids) {
        const walletJson = await this.storage.getItem(`zion_wallet_${id}`);
        if (walletJson) {
          try {
            const wallet = JSON.parse(walletJson) as Wallet;
            this.wallets.set(wallet.id, wallet);
          } catch {
            // skip corrupted
          }
        }
      }
    }

    const activeId = await this.storage.getItem(STORAGE_KEY_ACTIVE);
    if (activeId && this.wallets.has(activeId)) {
      this.activeWalletId = activeId;
    }
  }

  // ─── Wallet Creation ────────────────────────────────────────────────

  async createWallet(options: CreateWalletOptions): Promise<WalletPublicView> {
    const { privateKey, publicKey } = await deriveKeypairFromMnemonic(
      generateMnemonic(options.strength ?? 256)
    );

    const address = publicKeyToAddress(publicKey);
    const encryptedPrivateKey = await encrypt(Buffer.from(privateKey).toString('hex'), options.password);
    const encryptedMnemonic = await encrypt(generateMnemonic(options.strength ?? 256), options.password);

    const wallet: Wallet = {
      id: this.generateId(),
      name: options.name ?? 'ZION Wallet',
      address,
      publicKey: Buffer.from(publicKey).toString('hex'),
      privateKey: JSON.stringify(encryptedPrivateKey),
      mnemonic: JSON.stringify(encryptedMnemonic),
      keyType: 'ed25519',
      path: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    await this.saveWallet(wallet);
    if (!this.activeWalletId) {
      await this.setActiveWallet(wallet.id);
    }

    return toPublicView(wallet);
  }

  async importFromMnemonic(options: ImportMnemonicOptions): Promise<WalletPublicView> {
    const { privateKey, publicKey } = await deriveKeypairFromMnemonic(options.mnemonic);

    const address = publicKeyToAddress(publicKey);
    const encryptedPrivateKey = await encrypt(Buffer.from(privateKey).toString('hex'), options.password);
    const encryptedMnemonic = await encrypt(options.mnemonic, options.password);

    const wallet: Wallet = {
      id: this.generateId(),
      name: options.name ?? 'Imported Wallet',
      address,
      publicKey: Buffer.from(publicKey).toString('hex'),
      privateKey: JSON.stringify(encryptedPrivateKey),
      mnemonic: JSON.stringify(encryptedMnemonic),
      keyType: 'ed25519',
      path: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    await this.saveWallet(wallet);
    if (!this.activeWalletId) {
      await this.setActiveWallet(wallet.id);
    }

    return toPublicView(wallet);
  }

  async importFromPrivateKey(options: ImportPrivateKeyOptions): Promise<WalletPublicView> {
    const { privateKey, publicKey } = await deriveKeypairFromPrivateKey(options.privateKeyHex);

    const address = publicKeyToAddress(publicKey);
    const encryptedPrivateKey = await encrypt(Buffer.from(privateKey).toString('hex'), options.password);

    const wallet: Wallet = {
      id: this.generateId(),
      name: options.name ?? 'Imported Wallet',
      address,
      publicKey: Buffer.from(publicKey).toString('hex'),
      privateKey: JSON.stringify(encryptedPrivateKey),
      mnemonic: null,
      keyType: 'ed25519',
      path: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    await this.saveWallet(wallet);
    if (!this.activeWalletId) {
      await this.setActiveWallet(wallet.id);
    }

    return toPublicView(wallet);
  }

  // ─── Wallet Retrieval ───────────────────────────────────────────────

  listWallets(): WalletPublicView[] {
    return Array.from(this.wallets.values()).map(toPublicView);
  }

  getWallet(id: string): WalletPublicView | null {
    const wallet = this.wallets.get(id);
    return wallet ? toPublicView(wallet) : null;
  }

  getActiveWallet(): WalletPublicView | null {
    if (!this.activeWalletId) return null;
    return this.getWallet(this.activeWalletId);
  }

  async setActiveWallet(id: string): Promise<void> {
    if (!this.wallets.has(id)) {
      throw new Error('Wallet not found');
    }
    this.activeWalletId = id;
    await this.storage.setItem(STORAGE_KEY_ACTIVE, id);
  }

  // ─── Wallet Deletion ────────────────────────────────────────────────

  async deleteWallet(id: string): Promise<void> {
    if (!this.wallets.has(id)) {
      throw new Error('Wallet not found');
    }

    this.wallets.delete(id);
    await this.storage.removeItem(`zion_wallet_${id}`);
    await this.saveIndex();

    if (this.activeWalletId === id) {
      const remaining = Array.from(this.wallets.keys());
      this.activeWalletId = remaining.length > 0 ? remaining[0] : null;
      if (this.activeWalletId) {
        await this.storage.setItem(STORAGE_KEY_ACTIVE, this.activeWalletId);
      } else {
        await this.storage.removeItem(STORAGE_KEY_ACTIVE);
      }
    }
  }

  // ─── Export ─────────────────────────────────────────────────────────

  async exportMnemonic(walletId: string, password: string): Promise<string> {
    const wallet = this.wallets.get(walletId);
    if (!wallet) throw new Error('Wallet not found');
    if (!wallet.mnemonic) throw new Error('No mnemonic available for this wallet');

    const payload = JSON.parse(wallet.mnemonic);
    return decrypt(payload, password);
  }

  async exportPrivateKey(walletId: string, password: string): Promise<string> {
    const wallet = this.wallets.get(walletId);
    if (!wallet) throw new Error('Wallet not found');

    const payload = JSON.parse(wallet.privateKey);
    return decrypt(payload, password);
  }

  // ─── Balance & UTXO ─────────────────────────────────────────────────

  async getBalance(address: string): Promise<number> {
    return this.rpc.getBalance(address);
  }

  async getUtxos(address: string): Promise<Array<Record<string, unknown>>> {
    return this.rpc.getUtxos(address);
  }

  async getTransactionHistory(address: string, limit?: number): Promise<Array<Record<string, unknown>>> {
    return this.rpc.getTransactionHistory(address, limit);
  }

  // ─── Sending ────────────────────────────────────────────────────────

  async send(options: SendOptions): Promise<string> {
    const wallet = this.wallets.get(options.walletId);
    if (!wallet) throw new Error('Wallet not found');

    if (!isValidAddress(options.toAddress)) {
      throw new Error('Invalid recipient address');
    }

    const privateKeyHex = await this.exportPrivateKey(options.walletId, options.password);
    const privateKey = Buffer.from(privateKeyHex, 'hex');

    const utxos = await this.rpc.getUtxos(wallet.address);
    if (!utxos.length) {
      throw new Error('No spendable UTXOs available');
    }

    const tx = await buildUtxoTransaction({
      fromAddress: wallet.address,
      toAddress: options.toAddress,
      amountZion: options.amountZion,
      utxos: utxos.map((u) => ({
        tx_hash: String(u.tx_hash ?? u.txid ?? ''),
        output_index: Number(u.output_index ?? u.vout ?? 0),
        amount: String(u.amount ?? 0),
        address: String(u.address ?? ''),
      })),
      privateKey,
      memo: options.memo,
    });

    const payload = transactionToRpcPayload(tx);
    return this.rpc.broadcastTransaction(payload);
  }

  // ─── RPC Proxy ──────────────────────────────────────────────────────

  get rpcClient(): ZionRPC {
    return this.rpc;
  }

  // ─── Helpers ────────────────────────────────────────────────────────

  private generateId(): string {
    return `w_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  }

  private async saveWallet(wallet: Wallet): Promise<void> {
    this.wallets.set(wallet.id, wallet);
    await this.storage.setItem(`zion_wallet_${wallet.id}`, JSON.stringify(wallet));
    await this.saveIndex();
  }

  private async saveIndex(): Promise<void> {
    const ids = Array.from(this.wallets.keys());
    await this.storage.setItem(STORAGE_KEY_WALLETS, JSON.stringify(ids));
  }
}
