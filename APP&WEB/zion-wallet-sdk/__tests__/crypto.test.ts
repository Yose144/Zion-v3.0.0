import { encrypt, decrypt, hashPassword, constantTimeEqual } from '../src/core/crypto';

describe('Crypto Operations', () => {
  it('encrypts and decrypts data', async () => {
    const data = 'secret private key hex';
    const password = 'SecurePass123!';

    const encrypted = await encrypt(data, password);
    expect(encrypted.ciphertext).toBeDefined();
    expect(encrypted.salt).toBeDefined();
    expect(encrypted.iv).toBeDefined();
    expect(encrypted.authTag).toBeDefined();

    const decrypted = await decrypt(encrypted, password);
    expect(decrypted).toBe(data);
  });

  it('fails decryption with wrong password', async () => {
    const data = 'secret';
    const encrypted = await encrypt(data, 'correct');

    await expect(decrypt(encrypted, 'wrong')).rejects.toThrow();
  });

  it('hashes passwords', () => {
    const h1 = hashPassword('password123');
    const h2 = hashPassword('password123');
    expect(h1).toBe(h2);
    expect(h1).toHaveLength(64); // SHA-256 hex
  });

  it('compares strings in constant time', () => {
    expect(constantTimeEqual('abc', 'abc')).toBe(true);
    expect(constantTimeEqual('abc', 'abd')).toBe(false);
    expect(constantTimeEqual('abc', 'ab')).toBe(false);
  });
});
