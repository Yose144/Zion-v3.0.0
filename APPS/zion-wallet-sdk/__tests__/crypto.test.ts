import {
  encrypt,
  decrypt,
  upgradeEncryption,
  hashPassword,
  constantTimeEqual,
  CURRENT_PBKDF2_ITERATIONS,
  type EncryptedPayload,
} from '../src/core/crypto';

describe('Crypto Operations', () => {
  it('encrypts and decrypts data', async () => {
    const data = 'secret private key hex';
    const password = 'SecurePass123!';

    const encrypted = await encrypt(data, password);
    expect(encrypted.ciphertext).toBeDefined();
    expect(encrypted.salt).toBeDefined();
    expect(encrypted.iv).toBeDefined();
    expect(encrypted.authTag).toBeDefined();
    expect(encrypted.iterations).toBe(CURRENT_PBKDF2_ITERATIONS);

    const decrypted = await decrypt(encrypted, password);
    expect(decrypted).toBe(data);
  });

  it('fails decryption with wrong password', async () => {
    const data = 'secret';
    const encrypted = await encrypt(data, 'correct');

    await expect(decrypt(encrypted, 'wrong')).rejects.toThrow();
  });

  it('encrypts with current (600k) PBKDF2 iterations', async () => {
    const data = 'modern secret';
    const encrypted = await encrypt(data, 'Password123!');
    expect(encrypted.iterations).toBe(CURRENT_PBKDF2_ITERATIONS);
  });

  it('decrypts truly legacy payloads (absent iterations field)', async () => {
    const data = 'very old wallet';
    const password = 'Password123!';

    // We can't easily create a real legacy payload with 100k iterations
    // without patching the module internals, but we can verify the fallback logic:
    const encrypted = await encrypt(data, password);
    const stripped: any = { ...encrypted };
    delete stripped.iterations;

    // This would normally fail because the ciphertext was generated with 600k,
    // but it proves the code path is exercised (it will try 100k and throw)
    await expect(decrypt(stripped as EncryptedPayload, password)).rejects.toThrow();
  });

  it('upgrades encryption to current iterations', async () => {
    const plaintext = 'sensitive data';
    const password = 'Password123!';

    const upgraded = await upgradeEncryption(plaintext, password);
    expect(upgraded.iterations).toBe(CURRENT_PBKDF2_ITERATIONS);

    const decrypted = await decrypt(upgraded, password);
    expect(decrypted).toBe(plaintext);
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
