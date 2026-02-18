import {bech32, bech32m} from 'bech32';
import {CHAIN_IDS} from '../constants/chains';
import {isValidAddress as isValidZionAddress} from '../services/CryptoService';

const BASE58_REGEX = /^[1-9A-HJ-NP-Za-km-z]+$/;

const isBase58String = (s) => typeof s === 'string' && BASE58_REGEX.test(s);

export const validateAddress = (chainId, address) => {
  if (!address || typeof address !== 'string') {
    return {ok: false, reason: 'Address is required'};
  }

  const trimmed = address.trim();

  switch (chainId) {
    case CHAIN_IDS.ZION: {
      const ok = isValidZionAddress(trimmed);
      return ok ? {ok: true} : {ok: false, reason: 'Invalid ZION address'};
    }

    case CHAIN_IDS.ETH: {
      const ok = /^0x[0-9a-fA-F]{40}$/.test(trimmed);
      return ok ? {ok: true} : {ok: false, reason: 'Invalid ETH address (expected 0x + 40 hex chars)'};
    }

    case CHAIN_IDS.SOL: {
      // Solana addresses are base58 and typically 32-44 chars.
      const ok = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(trimmed);
      return ok ? {ok: true} : {ok: false, reason: 'Invalid SOL address (expected Base58, 32-44 chars)'};
    }

    case CHAIN_IDS.TRX: {
      // Tron addresses are Base58Check, usually start with T and are 34 chars.
      const ok = /^T[1-9A-HJ-NP-Za-km-z]{33}$/.test(trimmed);
      return ok ? {ok: true} : {ok: false, reason: 'Invalid TRX address (expected T... Base58Check)'};
    }

    case CHAIN_IDS.XLM: {
      // Stellar public key (G...) is 56 chars base32.
      const ok = /^G[2-7A-Z]{55}$/.test(trimmed);
      return ok ? {ok: true} : {ok: false, reason: 'Invalid XLM address (expected G... 56 chars)'};
    }

    case CHAIN_IDS.BTC: {
      // Accept legacy Base58 formats (1..., 3...) and bech32/bech32m segwit (bc1...).
      const lower = trimmed.toLowerCase();

      if (lower.startsWith('bc1')) {
        // Attempt bech32/bech32m decode (be tolerant; no deep witness program checks here).
        try {
          try {
            bech32.decode(lower);
          } catch (_) {
            bech32m.decode(lower);
          }
          return {ok: true};
        } catch (_) {
          return {ok: false, reason: 'Invalid BTC bech32 address (bc1...)'};
        }
      }

      // Minimal Base58Check-like pattern (no checksum validation).
      const ok = /^[13][1-9A-HJ-NP-Za-km-z]{25,34}$/.test(trimmed);
      return ok ? {ok: true} : {ok: false, reason: 'Invalid BTC address (expected bc1... or 1.../3... Base58)'};
    }

    case CHAIN_IDS.ETC: {
      const ok = /^0x[0-9a-fA-F]{40}$/.test(trimmed);
      return ok ? {ok: true} : {ok: false, reason: 'Invalid ETC address (expected 0x + 40 hex chars)'};
    }

    case CHAIN_IDS.RVN: {
      // Typical RVN P2PKH starts with R (Base58Check); keep minimal pattern validation.
      const ok = /^R[1-9A-HJ-NP-Za-km-z]{25,34}$/.test(trimmed);
      return ok ? {ok: true} : {ok: false, reason: 'Invalid RVN address (expected R... Base58)'};
    }

    case CHAIN_IDS.ERG: {
      // User spec: starts with 9 and 51 chars total.
      const ok = /^9[1-9A-HJ-NP-Za-km-z]{50}$/.test(trimmed);
      return ok ? {ok: true} : {ok: false, reason: 'Invalid ERG address (expected 9 + 50 Base58 chars)'};
    }

    case CHAIN_IDS.KAS: {
      // Kaspa uses a cashaddr-like "kaspa:..." prefix. We'll validate charset and attempt bech32/bech32m decode.
      if (!/^kaspa:[0-9a-z]+$/.test(trimmed)) {
        return {ok: false, reason: 'Invalid KAS address (expected kaspa:...)'};
      }

      const payload = trimmed.split(':', 2)[1];
      // Quick charset sanity check
      if (!/^[qpzry9x8gf2tvdw0s3jn54khce6mua7l]+$/.test(payload)) {
        return {ok: false, reason: 'Invalid KAS address charset'};
      }

      // Best-effort decode: accept either bech32 or bech32m variants
      try {
        // Some libs expect full string with hrp + '1'. Kaspa uses ':' separator; attempt a conservative decode only if possible.
        // We still return ok on charset+prefix match; decoding is optional best-effort.
        try {
          bech32.decode(`kaspa1${payload}`);
        } catch (_) {
          bech32m.decode(`kaspa1${payload}`);
        }
      } catch (_) {
        // Ignore decode errors; prefix+charset check already filters most invalid inputs.
      }

      return {ok: true};
    }

    case CHAIN_IDS.ALPH: {
      // Alephium examples show Base58-like addresses starting with '1' (mainnet) or 'T' (test/dev).
      const ok = (trimmed.startsWith('1') || trimmed.startsWith('T')) &&
        trimmed.length >= 30 &&
        trimmed.length <= 70 &&
        isBase58String(trimmed);

      return ok ? {ok: true} : {ok: false, reason: 'Invalid ALPH address (expected Base58 starting with 1 or T)'};
    }

    case CHAIN_IDS.XMR: {
      // Monero addresses are Base58:
      // - Standard: 95 chars starting with 4 or 8
      // - Integrated: 106 chars
      if (!isBase58String(trimmed)) {
        return {ok: false, reason: 'Invalid XMR address charset'};
      }

      const ok =
        (/^[48]/.test(trimmed) && trimmed.length === 95) ||
        (/^[48]/.test(trimmed) && trimmed.length === 106);

      return ok ? {ok: true} : {ok: false, reason: 'Invalid XMR address (expected 95 or 106 Base58 chars starting with 4 or 8)'};
    }

    default:
      return {ok: false, reason: 'Unsupported chain'};
  }
};
