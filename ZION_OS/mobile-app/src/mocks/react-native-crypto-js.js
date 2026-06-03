/**
 * Web mock for react-native-crypto-js
 * Uses browser's built-in crypto when available
 */
const CryptoJS = {
  SHA256: (msg) => ({
    toString: () => {
      // Simple hash placeholder for web
      let hash = 0;
      const str = String(msg);
      for (let i = 0; i < str.length; i++) {
        const char = str.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash |= 0;
      }
      return Math.abs(hash).toString(16).padStart(64, '0');
    },
  }),
  AES: {
    encrypt: (msg, key) => ({ toString: () => btoa(msg) }),
    decrypt: (cipher, key) => ({
      toString: (enc) => {
        try { return atob(cipher); } catch { return ''; }
      },
    }),
  },
  enc: {
    Utf8: 'utf8',
    Hex: 'hex',
  },
  lib: {
    WordArray: { random: (n) => ({ toString: () => Array.from(crypto.getRandomValues(new Uint8Array(n)), b => b.toString(16).padStart(2, '0')).join('') }) },
  },
};

module.exports = CryptoJS;
module.exports.default = CryptoJS;
