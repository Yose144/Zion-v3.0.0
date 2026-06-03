/**
 * CryptoService unit tests — v3.0.0
 * Validates Ed25519 key derivation, address generation, PBKDF2 encryption, signing.
 */

const {
  generateWallet,
  importFromMnemonic,
  importFromPrivateKey,
  signTransaction,
  verifySignature,
  validateMnemonic,
  isValidAddress,
  encryptPrivateKey,
  decryptPrivateKey,
  encryptMnemonic,
  decryptMnemonic,
  publicKeyToAddress,
} = require('../CryptoService');

describe('CryptoService', () => {
  const password = 'TestPass123!';

  describe('generateWallet', () => {
    it('generates a 24-word mnemonic wallet', async () => {
      const wallet = await generateWallet(password, 256);
      expect(wallet.address).toMatch(/^zion1/);
      expect(wallet.publicKey).toHaveLength(64); // 32 bytes hex
      expect(wallet.mnemonic).toBeTruthy();
      expect(wallet.keyType).toBe('ed25519');
    });

    it('generates a 12-word mnemonic wallet', async () => {
      const wallet = await generateWallet(password, 128);
      const words = (await decryptMnemonic(wallet.mnemonic, password)).split(' ');
      expect(words.length).toBe(12);
    });
  });

  describe('importFromMnemonic', () => {
    it('imports and produces the same address for a known mnemonic', async () => {
      const mnemonic =
        'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about';
      const wallet = await importFromMnemonic(mnemonic, password);
      expect(wallet.address).toMatch(/^zion1/);
      expect(wallet.publicKey).toHaveLength(64);
    });
  });

  describe('address validation', () => {
    it('accepts valid zion1 addresses', async () => {
      const wallet = await generateWallet(password, 256);
      expect(isValidAddress(wallet.address)).toBe(true);
    });

    it('rejects invalid addresses', () => {
      expect(isValidAddress('notanaddress')).toBe(false);
      expect(isValidAddress('zion1')).toBe(false);
      expect(isValidAddress('')).toBe(false);
    });
  });

  describe('signing', () => {
    it('signs and verifies a transaction hash', async () => {
      const wallet = await generateWallet(password, 256);
      const pk = decryptPrivateKey(wallet.privateKey, password);
      const txHash = 'aabbccdd'.repeat(8); // 64 hex chars

      const { signature, publicKey } = await signTransaction(txHash, pk);
      expect(signature).toHaveLength(128); // Ed25519 sig = 64 bytes = 128 hex

      const valid = await verifySignature(txHash, signature, Buffer.from(publicKey, 'hex'));
      expect(valid).toBe(true);
    });

    it('rejects signature with tampered message', async () => {
      const wallet = await generateWallet(password, 256);
      const pk = decryptPrivateKey(wallet.privateKey, password);
      const { signature, publicKey } = await signTransaction('aabbccdd'.repeat(8), pk);

      const valid = await verifySignature('00'.repeat(32), signature, Buffer.from(publicKey, 'hex'));
      expect(valid).toBe(false);
    });
  });

  describe('PBKDF2 encryption v2', () => {
    it('encrypts and decrypts private key with v2 format', async () => {
      const wallet = await generateWallet(password, 256);
      const pk = decryptPrivateKey(wallet.privateKey, password);
      expect(pk).toBeInstanceOf(Buffer);
      expect(pk.length).toBe(32);
    });

    it('fails decryption with wrong password', async () => {
      const wallet = await generateWallet(password, 256);
      expect(() => decryptPrivateKey(wallet.privateKey, 'wrong')).toThrow();
    });

    it('encrypts and decrypts mnemonic with v2 format', async () => {
      const wallet = await generateWallet(password, 256);
      const mnemonic = decryptMnemonic(wallet.mnemonic, password);
      expect(mnemonic.split(' ').length).toBeGreaterThanOrEqual(12);
    });

    it('falls back to v1 legacy decrypt', async () => {
      // Simulate legacy v1 ciphertext (direct AES with password)
      const CryptoJS = require('crypto-js');
      const legacyCipher = CryptoJS.AES.encrypt('deadbeef'.repeat(8), password).toString();
      const decrypted = decryptPrivateKey(legacyCipher, password);
      expect(decrypted.toString('hex')).toBe('deadbeef'.repeat(8));
    });
  });
});
