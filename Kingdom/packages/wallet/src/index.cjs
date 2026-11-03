// @zion/wallet — orchestrátor desktop peněženky pro Kingdom Electron klienta.
//
// Bezpečnostní hranice: soukromý klíč žije jen v paměti tohoto procesu
// (Electron main). Renderer dostává adresu, zůstatek a výsledky transakcí —
// nikdy seed ani klíč. Persistenční soubor drží klíč AES-256-GCM za heslem.
//
// Konsensus-kritický kód je verbatim port z apps/desktop-agent (donor):
//   keys.cjs    ← wallet-generator.js  (bip39 → ed25519 → zion1 adresa, AES store)
//   tx.cjs      ← utxo-builder.js      (V31 UTXO tx, keccak preimage, podpis)
//   account.cjs ← account-builder.js   (account-model tx pro premine účty)

const fs = require('fs');
const path = require('path');
const Keys = require('./keys.cjs');
const Utxo = require('./tx.cjs');
const Account = require('./account.cjs');
const Api = require('./api.cjs');

const WALLET_FILE = 'zion-wallet.json';

class WalletCore {
  /**
   * @param {string} dir - adresář pro wallet soubor (Electron userData)
   */
  constructor(dir) {
    this.dir = dir;
    this.file = path.join(dir, WALLET_FILE);
    /** @type {Buffer|null} dešifrovaný PKCS8 DER — jen v paměti, jen odemčeno */
    this._privDer = null;
    /** @type {{address:string, publicKey:string, encrypted:Object}|null} */
    this._stored = null;
  }

  _loadStored() {
    if (this._stored) return this._stored;
    if (!fs.existsSync(this.file)) return null;
    this._stored = JSON.parse(fs.readFileSync(this.file, 'utf8'));
    return this._stored;
  }

  _saveStored(stored) {
    fs.mkdirSync(this.dir, { recursive: true });
    const tmp = this.file + '.tmp';
    fs.writeFileSync(tmp, JSON.stringify(stored, null, 2), { mode: 0o600 });
    fs.renameSync(tmp, this.file);
    this._stored = stored;
  }

  /** Veřejný stav pro renderer — bez jakéhokoli tajného materiálu. */
  status() {
    const stored = this._loadStored();
    return {
      exists: !!stored,
      unlocked: !!this._privDer,
      address: stored ? stored.address : null,
    };
  }

  /**
   * Nová peněženka. Mnemonic vracíme JEDNOU — renderer ho zobrazí k záloze
   * a zahodí; soubor drží jen zašifrovaný klíč.
   */
  create(password) {
    if (this._loadStored()) throw new Error('Wallet already exists');
    if (!password) throw new Error('Password is required');
    const w = Keys.generateWallet();
    this._saveStored({
      address: w.address,
      publicKey: w.publicKey,
      encrypted: Keys.encryptPrivateKey(w.privateKey, password),
      createdAt: w.createdAt,
    });
    this._privDer = Buffer.from(w.privateKey, 'hex');
    return { address: w.address, mnemonic: w.mnemonic };
  }

  /** Import z BIP39 fráze. */
  importMnemonic(mnemonic, password) {
    if (this._loadStored()) throw new Error('Wallet already exists');
    if (!password) throw new Error('Password is required');
    const w = Keys.recoverWallet(mnemonic);
    this._saveStored({
      address: w.address,
      publicKey: w.publicKey,
      encrypted: Keys.encryptPrivateKey(w.privateKey, password),
      recoveredAt: w.recoveredAt,
    });
    this._privDer = Buffer.from(w.privateKey, 'hex');
    return { address: w.address };
  }

  /** Odemknutí heslem — ověříme, že dešifrovaný klíč patří uložené adrese. */
  unlock(password) {
    const stored = this._loadStored();
    if (!stored) throw new Error('No wallet file');
    const privHex = Keys.decryptPrivateKey(stored.encrypted, password); // throws on bad password/tag
    const privDer = Buffer.from(privHex, 'hex');
    const derived = Keys.deriveAddress(Utxo.extractPublicKey(privDer));
    if (derived !== stored.address) {
      throw new Error('Decrypted key does not match stored address');
    }
    this._privDer = privDer;
    return { address: stored.address };
  }

  lock() {
    if (this._privDer) this._privDer.fill(0);
    this._privDer = null;
    return { unlocked: false };
  }

  _requireUnlocked() {
    const stored = this._loadStored();
    if (!stored) throw new Error('No wallet file');
    if (!this._privDer) throw new Error('Wallet is locked');
    return stored;
  }

  /** Zůstatek + UTXO snapshot z veřejného API. */
  async balance() {
    const stored = this._loadStored();
    if (!stored) throw new Error('No wallet file');
    const snap = await Api.fetchWalletSnapshot(stored.address);
    return {
      address: stored.address,
      total: snap.balance?.total ?? 0,
      spendable: snap.balance?.spendable ?? snap.balance?.total ?? 0,
      utxoCount: Array.isArray(snap.utxos) ? snap.utxos.length : 0,
      unlocked: !!this._privDer,
    };
  }

  /**
   * Odeslání ZION — UTXO model primárně, account model pro premine účty.
   * Podepisuje lokálně; ven jde jen hotová transakce.
   */
  async send({ to, amountZion, memo }) {
    const stored = this._requireUnlocked();
    if (!Keys.isValidAddress(to)) throw new Error('Invalid recipient address');
    const amt = Number(amountZion);
    if (!Number.isFinite(amt) || amt <= 0) throw new Error('Amount must be positive');

    const snap = await Api.fetchWalletSnapshot(stored.address);
    const utxos = Array.isArray(snap.utxos) ? snap.utxos : [];

    let txPayload, txModel, txIdStr;
    if (utxos.length > 0) {
      txModel = 'utxo';
      const signed = Utxo.buildUtxoTransaction({
        fromAddress: stored.address,
        toAddress: to,
        amountZion: amt,
        utxos,
        privateKeyDer: this._privDer,
        memo: memo || undefined,
      });
      txPayload = signed.transaction;
      txIdStr = signed.tx_id;
    } else {
      const balanceFlowers = BigInt(Math.round(Number(snap.balance?.total ?? 0) * 1_000_000));
      const amountFlowers = BigInt(Math.floor(amt * 1e6));
      const feeFlowers = Account.DEFAULT_FEE_FLOWERS;
      if (balanceFlowers < amountFlowers + feeFlowers) {
        throw new Error(
          `Insufficient balance: need ${amt} + fee ZION, have ${(Number(balanceFlowers) / 1e6).toFixed(6)} ZION`,
        );
      }
      txModel = 'account';
      txPayload = Account.buildAccountTransaction({
        fromAddress: stored.address,
        toAddress: to,
        amountZion: amt,
        privateKeyDer: this._privDer,
        memo: memo || undefined,
      });
      txIdStr = txPayload.tx_id;
    }

    const res = await Api.broadcastTransaction(txPayload, txModel);
    return { tx_id: res.tx_id || txIdStr, status: res.accepted || res.tx_id ? 'submitted' : 'sent', model: txModel };
  }
}

module.exports = { WalletCore, Keys, Utxo, Account };
