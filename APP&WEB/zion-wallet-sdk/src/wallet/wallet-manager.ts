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
import { buildUtxoTransaction, buildAccountTransaction, transactionToRpcPayload, ACCOUNT_DEFAULT_FEE_FLOWERS } from '../core/transaction.js';
import { ZionRPC } from '../rpc/zion-rpc.js';
import type { RpcConfig } from '../rpc/zion-rpc.js';
import { TrezorWallet } from '../hardware/trezor-wallet.js';
import { LedgerWallet } from '../hardware/ledger-wallet.js';
import { GenericHIDWallet } from '../hardware/generic-hid-wallet.js';

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
    const mnemonic = generateMnemonic(options.strength ?? 256);
    const { privateKey, publicKey } = await deriveKeypairFromMnemonic(mnemonic);

    const address = publicKeyToAddress(publicKey);
    const encryptedPrivateKey = await encrypt(Buffer.from(privateKey).toString('hex'), options.password);
    const encryptedMnemonic = await encrypt(mnemonic, options.password);

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

  // ─── Hardware Wallet (Trezor) ───────────────────────────────────────

  async importFromTrezor(options: {
    name?: string;
    path?: string;
    trezorWallet?: TrezorWallet;
  }): Promise<WalletPublicView> {
    const trezor = options.trezorWallet ?? new TrezorWallet();
    await trezor.connect();

    try {
      const { address, publicKey, path } = await trezor.getAddress(
        options.path,
        true // verify on device
      );

      const wallet: Wallet = {
        id: this.generateId(),
        name: options.name ?? 'Trezor Wallet',
        address,
        publicKey,
        privateKey: '', // hardware wallet — key never leaves device
        mnemonic: null,
        keyType: 'trezor',
        path: path ?? options.path ?? null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      await this.saveWallet(wallet);
      if (!this.activeWalletId) {
        await this.setActiveWallet(wallet.id);
      }

      return toPublicView(wallet);
    } finally {
      trezor.disconnect();
    }
  }

  // ─── Hardware Wallet (Ledger) ───────────────────────────────────────

  async importFromLedger(options: {
    name?: string;
    path?: string;
    ledgerWallet?: LedgerWallet;
  }): Promise<WalletPublicView> {
    const ledger = options.ledgerWallet ?? new LedgerWallet();
    await ledger.connect();

    try {
      const { address, publicKey, path } = await ledger.getAddress(
        options.path,
        true // verify on device
      );

      const wallet: Wallet = {
        id: this.generateId(),
        name: options.name ?? 'Ledger Wallet',
        address,
        publicKey,
        privateKey: '', // hardware wallet — key never leaves device
        mnemonic: null,
        keyType: 'ledger',
        path: path ?? options.path ?? null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      await this.saveWallet(wallet);
      if (!this.activeWalletId) {
        await this.setActiveWallet(wallet.id);
      }

      return toPublicView(wallet);
    } finally {
      ledger.disconnect();
    }
  }

  // ─── Hardware Wallet (Generic HID) ──────────────────────────────────

  async importFromGenericHID(options: {
    name?: string;
    device: GenericHIDWallet;
  }): Promise<WalletPublicView> {
    const hid = options.device;
    await hid.connect();

    try {
      const { address, publicKey, path } = await hid.getAddress(undefined, true);

      const wallet: Wallet = {
        id: this.generateId(),
        name: options.name ?? 'Hardware Wallet',
        address,
        publicKey,
        privateKey: '',
        mnemonic: null,
        keyType: 'hid',
        path: path ?? null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      await this.saveWallet(wallet);
      if (!this.activeWalletId) {
        await this.setActiveWallet(wallet.id);
      }

      return toPublicView(wallet);
    } finally {
      hid.disconnect();
    }
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
    if (['trezor', 'ledger', 'hid'].includes(wallet.keyType)) throw new Error('Hardware wallet mnemonic never leaves the device');
    if (!wallet.mnemonic) throw new Error('No mnemonic available for this wallet');

    const payload = JSON.parse(wallet.mnemonic);
    return decrypt(payload, password);
  }

  async exportPrivateKey(walletId: string, password: string): Promise<string> {
    const wallet = this.wallets.get(walletId);
    if (!wallet) throw new Error('Wallet not found');
    if (['trezor', 'ledger', 'hid'].includes(wallet.keyType)) throw new Error('Hardware wallet private key never leaves the device');

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

    if (['trezor', 'ledger', 'hid'].includes(wallet.keyType)) {
      throw new Error(
        'Transaction signing for hardware wallets is not yet supported. ' +
        'Trezor/Ledger firmware lacks generic Ed25519 signing for custom coins. ' +
        'Please use a software wallet for spending, or wait for official firmware support.'
      );
    }

    if (!isValidAddress(options.toAddress)) {
      throw new Error('Invalid recipient address');
    }

    const privateKeyHex = await this.exportPrivateKey(options.walletId, options.password);
    const privateKey = Buffer.from(privateKeyHex, 'hex');

    // ── Try UTXO model first ──
    const utxos = await this.rpc.getUtxos(wallet.address);
    if (utxos.length > 0) {
      try {
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
      } catch (err) {
        // UTXO build failed (e.g. insufficient UTXO balance) — fall through to account model
      }
    }

    // ── Account model fallback (for premine/hybrid wallets) ──
    const breakdown = await this.rpc.getBalanceBreakdown(wallet.address).catch(() => null);
    const accountFlowers = breakdown ? BigInt(breakdown.account_flowers) : 0n;
    const amountFlowers = BigInt(Math.floor(options.amountZion * 1e12));
    const feeFlowers = ACCOUNT_DEFAULT_FEE_FLOWERS;
    const totalNeeded = amountFlowers + feeFlowers;

    if (accountFlowers < totalNeeded) {
      const haveZion = (Number(accountFlowers) / 1e12).toFixed(6);
      throw new Error(
        `Insufficient balance: need ${options.amountZion} + fee ZION, have ${haveZion} ZION ` +
        `(account: ${breakdown?.account_zion.toFixed(6) ?? '0'} ZION, utxo: ${breakdown?.utxo_zion.toFixed(6) ?? '0'} ZION)`
      );
    }

    const accountTx = await buildAccountTransaction({
      fromAddress: wallet.address,
      toAddress: options.toAddress,
      amountZion: options.amountZion,
      privateKey,
    });

    return this.rpc.broadcastAccountTransaction(accountTx as unknown as Record<string, unknown>);
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
