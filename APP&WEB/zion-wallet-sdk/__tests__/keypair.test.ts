import {
  generateMnemonic,
  validateMnemonic,
  deriveKeypairFromMnemonic,
  deriveKeypairFromPrivateKey,
  signMessage,
  verifySignature,
} from '../src/core/keypair';

describe('Keypair Generation', () => {
  it('generates a valid 24-word mnemonic', () => {
    const mnemonic = generateMnemonic(256);
    expect(mnemonic.split(' ')).toHaveLength(24);
    expect(validateMnemonic(mnemonic)).toBe(true);
  });

  it('generates a valid 12-word mnemonic', () => {
    const mnemonic = generateMnemonic(128);
    expect(mnemonic.split(' ')).toHaveLength(12);
    expect(validateMnemonic(mnemonic)).toBe(true);
  });

  it('derives deterministic keypair from mnemonic', async () => {
    const mnemonic = generateMnemonic(256);
    const kp1 = await deriveKeypairFromMnemonic(mnemonic);
    const kp2 = await deriveKeypairFromMnemonic(mnemonic);

    expect(kp1.privateKey).toEqual(kp2.privateKey);
    expect(kp1.publicKey).toEqual(kp2.publicKey);
    expect(kp1.publicKey).toHaveLength(32);
    expect(kp1.privateKey).toHaveLength(32);
  });

  it('derives keypair from private key hex', async () => {
    const mnemonic = generateMnemonic(256);
    const kp1 = await deriveKeypairFromMnemonic(mnemonic);
    const hex = Buffer.from(kp1.privateKey).toString('hex');
    const kp2 = await deriveKeypairFromPrivateKey(hex);

    expect(kp2.privateKey).toEqual(kp1.privateKey);
    expect(kp2.publicKey).toEqual(kp1.publicKey);
  });

  it('signs and verifies messages', async () => {
    const mnemonic = generateMnemonic(256);
    const kp = await deriveKeypairFromMnemonic(mnemonic);
    const message = new TextEncoder().encode('hello zion');

    const sig = await signMessage(message, kp.privateKey);
    const valid = await verifySignature(sig, message, kp.publicKey);

    expect(valid).toBe(true);
  });

  it('rejects invalid mnemonic', async () => {
    await expect(deriveKeypairFromMnemonic('invalid mnemonic phrase')).rejects.toThrow();
  });
});
