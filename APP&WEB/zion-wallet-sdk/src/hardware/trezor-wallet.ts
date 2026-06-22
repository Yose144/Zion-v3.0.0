/**
 * Trezor Hardware Wallet Integration for ZION
 *
 * Uses @trezor/connect-web (browser) or @trezor/connect (Node/Electron).
 *
 * LIMITATIONS (as of 2026-06):
 * - Trezor firmware does NOT support generic Ed25519 transaction signing for custom coins.
 * - ZION uses Ed25519, which Trezor only exposes for specific coins (Cardano, Stellar, NEM,
 *   Monero, Tezos) via dedicated coin-specific protobuf messages.
 * - `TrezorConnect.signMessage` is hard-coded to Bitcoin-like (secp256k1) networks.
 * - Therefore this integration provides:
 *   1. Address derivation & on-device verification via `getPublicKey({ curve: 'ed25519' })`
 *   2. Watch-only operations (balance / UTXO / history via RPC)
 * - Full tx signing requires one of:
 *   a) A Trezor firmware PR adding ZION coin + signMessage support, or
 *   b) ZION switching to secp256k1 (breaking L1 change), or
 *   c) Using a Ledger (Ledger supports generic Ed25519 apps).
 */

import { publicKeyToAddress } from '../core/address.js';

// ─── Dynamic imports (kept soft to avoid bundling Trezor libs for non-users) ───

/** Lazy-loaded Trezor Connect module. */
async function loadTrezorConnect(): Promise<any> {
  // React Native
  if (typeof navigator !== 'undefined' && navigator.product === 'ReactNative') {
    // @ts-ignore optional peer dependency — not installed by default
    const mod = await import('@trezor/connect-mobile');
    return mod.default ?? mod;
  }
  // Browser / Next.js
  if (typeof window !== 'undefined') {
    // @ts-ignore optional peer dependency — not installed by default
    const mod = await import('@trezor/connect-web');
    return mod.default ?? mod;
  }
  // Node / Electron main process
  // @ts-ignore optional peer dependency — not installed by default
  const mod = await import('@trezor/connect');
  return mod.default ?? mod;
}

// ─── Constants ───────────────────────────────────────────────────────────────

/** Default BIP-44 derivation path for ZION on Trezor.
 *  We keep it inside the Bitcoin coin type (0') so the device recognises the path.
 *  The `curve: 'ed25519'` parameter overrides the secp256k1 default. */
export const DEFAULT_TREZOR_PATH = "m/44'/0'/0'";

/** Manifest metadata required by Trezor Connect init. */
export interface TrezorManifest {
  email: string;
  appUrl: string;
}

/** Result of a successful Trezor address export. */
export interface TrezorAddressResult {
  address: string;
  publicKey: string;
  path: string;
}

// ─── TrezorWallet class ──────────────────────────────────────────────────────

export class TrezorWallet {
  private trezor: any | null = null;
  private initPromise: Promise<void | null> | null = null;

  /**
   * Initialise Trezor Connect.
   * @param manifest Trezor Suite manifest (required by their ToS).
   * @param lazy If true, skips waiting for the device – useful for watch-only setup.
   */
  async connect(
    manifest: TrezorManifest = {
      email: 'dev@zionterranova.com',
      appUrl: 'https://zionterranova.com',
    },
    lazy = false
  ): Promise<void> {
    if (this.trezor) return;

    this.trezor = await loadTrezorConnect();

    this.initPromise = this.trezor.init({
      manifest,
      popup: true,
      lazyLoad: lazy,
    });

    await this.initPromise;
  }

  /** Dispose Trezor Connect session. */
  disconnect(): void {
    if (this.trezor?.dispose) {
      this.trezor.dispose();
    }
    this.trezor = null;
    this.initPromise = null;
  }

  private ensureReady(): void {
    if (!this.trezor) {
      throw new Error('Trezor not connected. Call connect() first.');
    }
  }

  /**
   * Export the Ed25519 public key from Trezor and derive the ZION address.
   * @param path BIP-32 derivation path. Defaults to `m/44'/0'/0'`.
   * @param verifyOnDevice If true, the address is shown on the Trezor screen for confirmation.
   */
  async getAddress(
    path: string = DEFAULT_TREZOR_PATH,
    verifyOnDevice = true
  ): Promise<TrezorAddressResult> {
    this.ensureReady();
    await this.initPromise;

    const result = await this.trezor.getPublicKey({
      path,
      curve: 'ed25519',
      showOnTrezor: verifyOnDevice,
    });

    if (!result.success || !result.payload?.publicKey) {
      throw new Error(`Trezor error: ${result.payload?.error ?? result.error ?? 'Failed to get public key'}`);
    }

    const publicKeyHex: string = result.payload.publicKey;
    const publicKey = Buffer.from(publicKeyHex, 'hex');
    const address = publicKeyToAddress(publicKey);

    return {
      address,
      publicKey: publicKeyHex,
      path: result.payload.serializedPath ?? path,
    };
  }

  /**
   * Request the user to confirm an address on the Trezor device screen.
   * Does NOT return private data – purely for verification UX.
   */
  async verifyAddress(path: string = DEFAULT_TREZOR_PATH): Promise<void> {
    await this.getAddress(path, true);
  }

  /**
   * ⚠️ NOT IMPLEMENTED – Trezor firmware limitation.
   *
   * Trezor `signMessage` is hard-coded to secp256k1 (Bitcoin-like) coins.
   * ZION's Ed25519 curve is only supported via coin-specific calls
   * (cardanoSignTransaction, stellarSignTransaction, …) which enforce
   * their own transaction formats. Signing a raw ZION UTXO hash is
   * therefore impossible without a firmware-level ZION coin definition.
   */
  async signTransaction(_txHash: Uint8Array, _path: string = DEFAULT_TREZOR_PATH): Promise<Uint8Array> {
    throw new Error(
      'Trezor firmware does not support Ed25519 transaction signing for custom coins like ZION. ' +
      'Supported Ed25519 coins: Cardano, Stellar, NEM, Monero, Tezos. ' +
      'Options: (1) Wait for official ZION Trezor support, ' +
      '(2) Use a Ledger device, or ' +
      '(3) Use a software wallet with the same seed phrase (less secure).'
    );
  }

  /**
   * ⚠️ NOT IMPLEMENTED – Trezor firmware limitation.
   * See `signTransaction` for details.
   */
  async signMessage(_message: string | Uint8Array, _path: string = DEFAULT_TREZOR_PATH): Promise<string> {
    throw new Error(
      'Trezor signMessage API only supports secp256k1 (Bitcoin-like) coins. ' +
      'ZION uses Ed25519, which is not available via the generic signMessage call.'
    );
  }
}
