const fs = require('fs');
const path = require('path');
const { randomUUID } = require('crypto');
const { safeStorage } = require('electron');
const bip39 = require('bip39');
const { ethers } = require('ethers');

class WalletManager {
  constructor(app) {
    this.app = app;
    this.storePath = path.join(this.app.getPath('userData'), 'wallets.json');
    this.state = this.loadState();
  }

  loadState() {
    try {
      if (!fs.existsSync(this.storePath)) {
        return { wallets: [] };
      }
      return JSON.parse(fs.readFileSync(this.storePath, 'utf8'));
    } catch {
      return { wallets: [] };
    }
  }

  persist() {
    fs.mkdirSync(path.dirname(this.storePath), { recursive: true });
    fs.writeFileSync(this.storePath, JSON.stringify(this.state, null, 2));
  }

  encryptSecret(secretPayload) {
    const raw = JSON.stringify(secretPayload);
    if (safeStorage.isEncryptionAvailable()) {
      return {
        mode: 'safeStorage',
        value: safeStorage.encryptString(raw).toString('base64')
      };
    }
    return {
      mode: 'plaintext',
      value: raw
    };
  }

  sanitizeWallet(wallet) {
    return {
      id: wallet.id,
      name: wallet.name,
      role: wallet.role || 'operator',
      address: wallet.address,
      source: wallet.source,
      createdAt: wallet.createdAt,
      protected: wallet.secret.mode !== 'plaintext'
    };
  }

  listWallets() {
    return this.state.wallets.map((wallet) => this.sanitizeWallet(wallet));
  }

  createWallet(payload) {
    const name = String(payload.name || '').trim() || `Wallet ${this.state.wallets.length + 1}`;
    const role = String(payload.role || '').trim() || 'operator';
    const mnemonic = bip39.generateMnemonic(256);
    const wallet = ethers.Wallet.fromMnemonic(mnemonic);
    const record = {
      id: randomUUID(),
      name,
      role,
      address: wallet.address,
      source: 'generated',
      createdAt: new Date().toISOString(),
      secret: this.encryptSecret({
        mnemonic,
        privateKey: wallet.privateKey
      })
    };

    this.state.wallets.unshift(record);
    this.persist();

    return {
      wallet: this.sanitizeWallet(record),
      reveal: {
        mnemonic,
        privateKey: wallet.privateKey
      }
    };
  }

  importWallet(payload) {
    const name = String(payload.name || '').trim() || `Imported ${this.state.wallets.length + 1}`;
    const role = String(payload.role || '').trim() || 'operator';
    const sourceText = String(payload.secret || '').trim();
    if (!sourceText) {
      throw new Error('Wallet import requires mnemonic or private key');
    }

    let wallet = null;
    let secretPayload = null;
    if (bip39.validateMnemonic(sourceText)) {
      wallet = ethers.Wallet.fromMnemonic(sourceText);
      secretPayload = { mnemonic: sourceText, privateKey: wallet.privateKey };
    } else {
      wallet = new ethers.Wallet(sourceText);
      secretPayload = { mnemonic: null, privateKey: wallet.privateKey };
    }

    const duplicate = this.state.wallets.find((item) => item.address === wallet.address);
    if (duplicate) {
      throw new Error(`Wallet already exists for address ${wallet.address}`);
    }

    const record = {
      id: randomUUID(),
      name,
      role,
      address: wallet.address,
      source: 'imported',
      createdAt: new Date().toISOString(),
      secret: this.encryptSecret(secretPayload)
    };

    this.state.wallets.unshift(record);
    this.persist();

    return {
      wallet: this.sanitizeWallet(record),
      reveal: secretPayload
    };
  }

  removeWallet(walletId) {
    const before = this.state.wallets.length;
    this.state.wallets = this.state.wallets.filter((wallet) => wallet.id !== walletId);
    this.persist();
    return { removed: before !== this.state.wallets.length };
  }
}

module.exports = { WalletManager };
