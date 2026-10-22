/**
 * ZION URI Parser
 * ================
 * Parsuje ZION URI schéma pro import wallet z QR kódů.
 * 
 * Podporované formáty:
 * - zion://import?mnemonic=word1+word2+...&network=testnet
 * - zion://wallet?address=zion1...&tokens=1000
 * - Prostý text (12-slovní mnemonic)
 * 
 * @module utils/zionUri
 */

/**
 * Rozpozná typ ZION URI a vrátí parsovaná data
 * 
 * @param {string} input - QR kód data nebo mnemonic
 * @returns {Object} Parsovaná data
 */
export const parseZionUri = (input) => {
  if (!input || typeof input !== 'string') {
    return { type: 'invalid', error: 'Empty or invalid input' };
  }

  const trimmed = input.trim();

  // 1. ZION Import URI: zion://import?mnemonic=...
  if (trimmed.startsWith('zion://import')) {
    return parseImportUri(trimmed);
  }

  // 2. ZION Wallet URI: zion://wallet?address=...
  if (trimmed.startsWith('zion://wallet')) {
    return parseWalletUri(trimmed);
  }

  // 3. JSON format (legacy V3)
  if (trimmed.startsWith('{')) {
    return parseJsonFormat(trimmed);
  }

  // 4. Plain mnemonic (12-24 words)
  if (isMnemonic(trimmed)) {
    return {
      type: 'mnemonic',
      mnemonic: trimmed,
      network: 'testnet',
    };
  }

  // 5. Může být private key (hex string)
  if (isHexPrivateKey(trimmed)) {
    return {
      type: 'privateKey',
      privateKey: trimmed,
    };
  }

  // 6. Stellar secret seed (S...)
  if (isStellarSecret(trimmed)) {
    return {
      type: 'privateKey',
      privateKey: trimmed,
    };
  }

  return { type: 'unknown', raw: trimmed };
};

/**
 * Parsuje zion://import?mnemonic=...&network=...
 */
const parseImportUri = (uri) => {
  try {
    const url = new URL(uri);
    const params = new URLSearchParams(url.search);
    
    const mnemonic = params.get('mnemonic');
    if (!mnemonic) {
      return { type: 'invalid', error: 'Missing mnemonic parameter' };
    }

    // Dekódovat + zpět na mezery
    const decodedMnemonic = mnemonic.replace(/\+/g, ' ');
    
    return {
      type: 'import',
      mnemonic: decodedMnemonic,
      network: params.get('network') || 'testnet',
    };
  } catch (error) {
    return { type: 'invalid', error: 'Failed to parse import URI' };
  }
};

/**
 * Parsuje zion://wallet?address=...&tokens=...
 */
const parseWalletUri = (uri) => {
  try {
    const url = new URL(uri);
    const params = new URLSearchParams(url.search);
    
    return {
      type: 'wallet',
      address: params.get('address'),
      tokens: parseInt(params.get('tokens') || '0', 10),
      label: params.get('label'),
    };
  } catch (error) {
    return { type: 'invalid', error: 'Failed to parse wallet URI' };
  }
};

/**
 * Parsuje JSON formát (legacy V3 QR)
 */
const parseJsonFormat = (jsonStr) => {
  try {
    const data = JSON.parse(jsonStr);
    
    if (data.type === 'ZION_PRESALE_WALLET' && data.mnemonic) {
      return {
        type: 'import',
        mnemonic: data.mnemonic,
        address: data.address,
        tokens: data.tokens || 0,
        network: data.network || 'testnet',
        orderId: data.orderId,
      };
    }

    return {
      type: 'json',
      data,
    };
  } catch (error) {
    return { type: 'invalid', error: 'Failed to parse JSON' };
  }
};

/**
 * Kontroluje zda string vypadá jako mnemonic (12-24 slov)
 */
const isMnemonic = (str) => {
  const words = str.toLowerCase().split(/\s+/);
  return words.length >= 12 && words.length <= 24 && words.every(w => /^[a-z]+$/.test(w));
};

/**
 * Kontroluje zda string je hex private key
 */
const isHexPrivateKey = (str) => {
  return /^0x?[0-9a-fA-F]{64}$/.test(str);
};

/**
 * Kontroluje zda string je Stellar secret seed (StrKey, S...)
 */
const isStellarSecret = (str) => {
  return /^S[0-9A-Z]{55}$/.test(str);
};

/**
 * Vytvoří ZION import URI z mnemonic
 * 
 * @param {string} mnemonic - 12-slovní seed phrase
 * @param {string} network - Síť (testnet/mainnet)
 * @returns {string} ZION URI
 */
export const createImportUri = (mnemonic, network = 'testnet') => {
  const encodedMnemonic = mnemonic.replace(/\s+/g, '+');
  return `zion://import?mnemonic=${encodedMnemonic}&network=${network}`;
};

/**
 * Kontroluje zda input lze použít pro import wallet
 * 
 * @param {string} input - User input
 * @returns {boolean} True pokud lze importovat
 */
export const canImport = (input) => {
  const parsed = parseZionUri(input);
  return ['import', 'mnemonic', 'privateKey'].includes(parsed.type);
};

/**
 * Získá mnemonic z jakéhokoliv validního vstupu
 * 
 * @param {string} input - QR data nebo plain text
 * @returns {string|null} Mnemonic nebo null
 */
export const extractMnemonic = (input) => {
  const parsed = parseZionUri(input);
  
  if (parsed.type === 'import' || parsed.type === 'mnemonic') {
    return parsed.mnemonic;
  }
  
  return null;
};

export default {
  parseZionUri,
  createImportUri,
  canImport,
  extractMnemonic,
};
