/**
 * Ledger Hardware Wallet Integration for ZION
 *
 * Uses @ledgerhq/hw-transport-webusb / webhid + @ledgerhq/hw-app-ada
 * to export the Ed25519 public key via the Cardano app.
 *
 * LIMITATIONS (as of 2026-06):
 * - Ledger firmware gates Ed25519 signing behind coin-specific apps.
 * - The Cardano app can export a raw Ed25519 public key, but its
 *   `signTransaction` enforces Cardano tx format.
 * - No generic Ed25519 `signMessage` / `signRaw` API exists on Ledger.
 * - Therefore this integration provides:
 *   1. Address derivation & on-device verification
 *   2. Watch-only operations (balance / UTXO / history via RPC)
 * - Full tx signing requires a custom ZION Ledger app (Phase B).
 */

import { publicKeyToAddress } from '../core/address.js';

// ─── Dynamic imports (soft dependency) ───────────────────────────────────────

async function loadTransport(): Promise<any> {
  // Prefer WebHID over WebUSB (better UX, fewer permission prompts)
  if (typeof window !== 'undefined' && 'hid' in navigator) {
    try {
      // @ts-ignore optional peer dependency
      const mod = await import('@ledgerhq/hw-transport-webhid');
      return mod.default ?? mod;
    } catch {
      // fallthrough to WebUSB
    }
  }
  // @ts-ignore optional peer dependency
  const mod = await import('@ledgerhq/hw-transport-webusb');
  return mod.default ?? mod;
}

async function loadAdaApp(transport: any): Promise<any> {
  // @ts-ignore optional peer dependency
  const mod = await import('@ledgerhq/hw-app-ada');
  const AdaApp = mod.default ?? mod.Ada ?? mod;
  return new AdaApp(transport);
}

// ─── Constants ───────────────────────────────────────────────────────────────

/** Default BIP-44 derivation path used with the Cardano app.
 *  Cardano uses `1852'/1815'/…`, but we use a compatible path for ZION.
 *  The Cardano app returns the raw Ed25519 public key regardless. */
export const DEFAULT_LEDGER_PATH = "m/1852'/1815'/0'/0/0";

/** Result of a successful Ledger address export. */
export interface LedgerAddressResult {
  address: string;
  publicKey: string;
  path: string;
}

// ─── LedgerWallet class ────────────────────────────────────────────────────

export class LedgerWallet {
  private transport: any | null = null;
  private ada: any | null = null;

  /**
   * Request access to the Ledger device via WebHID or WebUSB.
   * The user must have the Cardano app open on the Ledger.
   */
  async connect(): Promise<void> {
    if (this.transport) return;

    const Transport = await loadTransport();
    this.transport = await Transport.create();
    this.transport.on('disconnect', () => {
      this.transport = null;
      this.ada = null;
    });

    this.ada = await loadAdaApp(this.transport);
  }

  /** Close the transport and release the device. */
  disconnect(): void {
    if (this.transport) {
      try {
        this.transport.close();
      } catch {
        // ignore
      }
    }
    this.transport = null;
    this.ada = null;
  }

  private ensureReady(): void {
    if (!this.ada) {
      throw new Error('Ledger not connected. Call connect() first and open the Cardano app.');
    }
  }

  /**
   * Export the Ed25519 public key from Ledger and derive the ZION address.
   * @param path BIP-32 derivation path. Defaults to `m/1852'/1815'/0'/0/0`.
   * @param verifyOnDevice If true, the address is shown on the Ledger screen.
   */
  async getAddress(
    path: string = DEFAULT_LEDGER_PATH,
    verifyOnDevice = true
  ): Promise<LedgerAddressResult> {
    this.ensureReady();

    // Convert string path to Ledger-style number array
    const pathArray = path
      .replace(/^m\//, '')
      .split('/')
      .map((p) => {
        const hardened = p.endsWith("'");
        const num = parseInt(p.replace("'", ''), 10);
        return hardened ? num + 0x80000000 : num;
      });

    // Cardano app: getPublicKey returns { publicKey: hex }
    const result = await this.ada.getPublicKey(pathArray, verifyOnDevice);

    if (!result?.publicKey) {
      throw new Error('Ledger did not return a public key. Is the Cardano app open?');
    }

    const publicKeyHex: string = result.publicKey;
    const publicKey = Buffer.from(publicKeyHex, 'hex');
    const address = publicKeyToAddress(publicKey);

    return {
      address,
      publicKey: publicKeyHex,
      path,
    };
  }

  /**
   * Request the user to confirm an address on the Ledger device screen.
   * Does NOT return private data – purely for verification UX.
   */
  async verifyAddress(path: string = DEFAULT_LEDGER_PATH): Promise<void> {
    await this.getAddress(path, true);
  }

  /**
   * ⚠️ NOT IMPLEMENTED – Ledger firmware limitation.
   *
   * Ledger Cardano app enforces Cardano transaction format.
   * ZION UTXO hashes cannot be signed without a custom Ledger app.
   */
  async signTransaction(_txHash: Uint8Array, _path: string = DEFAULT_LEDGER_PATH): Promise<Uint8Array> {
    throw new Error(
      'Ledger transaction signing for ZION is not yet supported. ' +
      'The Ledger Cardano app requires Cardano-specific transaction format. ' +
      'Options: (1) Wait for official ZION Ledger app, ' +
      '(2) Use a Ledger with the same seed phrase in a software wallet (less secure), or ' +
      '(3) Use a Trezor device for watch-only monitoring.'
    );
  }

  /**
   * ⚠️ NOT IMPLEMENTED – Ledger firmware limitation.
   * See `signTransaction` for details.
   */
  async signMessage(_message: string | Uint8Array, _path: string = DEFAULT_LEDGER_PATH): Promise<string> {
    throw new Error(
      'Ledger message signing for custom Ed25519 coins is not available. ' +
      'Ledger apps only support signing within their native transaction format.'
    );
  }
}
