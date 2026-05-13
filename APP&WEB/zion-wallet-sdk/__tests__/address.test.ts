import { publicKeyToAddress, isValidAddress, getAddressType } from '../src/core/address';

describe('Address Derivation', () => {
  const testPubkey = new Uint8Array(32).fill(0xab);

  it('generates a 44-character address', () => {
    const addr = publicKeyToAddress(testPubkey);
    expect(addr).toHaveLength(44);
    expect(addr.startsWith('zion1')).toBe(true);
  });

  it('validates a correct address', () => {
    const addr = publicKeyToAddress(testPubkey);
    expect(isValidAddress(addr)).toBe(true);
  });

  it('rejects invalid addresses', () => {
    expect(isValidAddress('')).toBe(false);
    expect(isValidAddress('zion1')).toBe(false);
    expect(isValidAddress('zion1' + 'a'.repeat(39))).toBe(false); // no checksum
    expect(isValidAddress('invalid')).toBe(false);
  });

  it('detects address types', () => {
    const addr = publicKeyToAddress(testPubkey);
    expect(getAddressType(addr)).toBe('zion1');
    expect(getAddressType('ZIONABCDEFGHIJKLMNOPQRSTUVWXYZ234567')).toBe('legacy');
    expect(getAddressType('bad')).toBe('invalid');
  });

  it('is deterministic', () => {
    const a1 = publicKeyToAddress(testPubkey);
    const a2 = publicKeyToAddress(testPubkey);
    expect(a1).toBe(a2);
  });
});
