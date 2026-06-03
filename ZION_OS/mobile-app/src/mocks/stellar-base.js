/**
 * Web mock for stellar-base
 * Provides stub Keypair and StrKey for web environment
 */
class Keypair {
  constructor(keys) {
    this._publicKey = keys?.publicKey || 'MOCK_PUBLIC_KEY';
    this._secret = keys?.secret || 'MOCK_SECRET';
  }
  static random() { return new Keypair(); }
  static fromSecret(secret) { return new Keypair({ secret }); }
  static fromPublicKey(pub) { return new Keypair({ publicKey: pub }); }
  publicKey() { return this._publicKey; }
  secret() { return this._secret; }
  rawPublicKey() { return new Uint8Array(32); }
  rawSecretKey() { return new Uint8Array(64); }
  sign(data) { return new Uint8Array(64); }
  verify(data, signature) { return true; }
}

const StrKey = {
  encodeEd25519PublicKey: (buf) => 'G' + 'A'.repeat(55),
  decodeEd25519PublicKey: (str) => new Uint8Array(32),
  isValidEd25519PublicKey: (str) => typeof str === 'string' && str.length > 0,
  encodeEd25519SecretSeed: (buf) => 'S' + 'A'.repeat(55),
  decodeEd25519SecretSeed: (str) => new Uint8Array(32),
};

module.exports = { Keypair, StrKey };
