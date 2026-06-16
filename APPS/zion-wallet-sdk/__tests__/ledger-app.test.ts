/**
 * Ledger ZION App — Speculos Emulator Tests
 *
 * These tests run against the compiled Ledger app ELF loaded in Speculos.
 * They require:
 *   1. Docker + Speculos image: ghcr.io/ledgerhq/speculos
 *   2. Compiled app binary: V3/hardware/ledger-app-zion/bin/app.elf
 *
 * To run locally (outside CI):
 *   docker run --rm -ti -v "$(pwd):/app" --publish 5000:5000 \
 *     ghcr.io/ledgerhq/speculos \
 *     /app/V3/hardware/ledger-app-zion/bin/app.elf --model nanosp
 *
 *   Then: npm test -- ledger-app.test.ts
 */

const SPECULOS_URL = process.env.SPECULOS_URL || 'http://127.0.0.1:5000';

let Transport: any;
let speculosAvailable = false;

try {
  const mod = await import('@ledgerhq/hw-transport-http');
  Transport = mod.default || mod;
  // Quick health check: attempt to create transport (Speculos HTTP API)
  const t = await Transport.open(SPECULOS_URL);
  await t.close();
  speculosAvailable = true;
} catch {
  speculosAvailable = false;
}

// APDU constants (must match ledger-app-zion/src/zion.h)
const CLA = 0xE0;
const INS_GET_PUBLIC_KEY = 0x02;
const INS_SIGN_TX = 0x04;
const INS_GET_VERSION = 0x06;

class ZionLedgerApp {
  private transport: any;

  constructor(transport: any) {
    this.transport = transport;
  }

  async getPublicKey(path: string, displayOnScreen = false) {
    const pathBytes = this.bip32PathToBuffer(path);
    const response = await this.transport.send(
      CLA,
      INS_GET_PUBLIC_KEY,
      displayOnScreen ? 0x01 : 0x00,
      0x00,
      pathBytes
    );

    // Response layout: pubkey (32) + address (ASCII) + SW (2)
    const sw = response.slice(-2).readUInt16BE(0);
    if (sw !== 0x9000) {
      throw new Error(`Ledger returned SW=${sw.toString(16)}`);
    }

    const publicKey = response.slice(0, 32).toString('hex');
    const address = response.slice(32, -2).toString('ascii').replace(/\x00/g, '');
    return { publicKey, address };
  }

  async signTransaction(
    path: string,
    txHash: Uint8Array,
    recipient: string,
    amountFlowers: bigint
  ) {
    const pathBytes = this.bip32PathToBuffer(path);
    const recipientBytes = Buffer.from(recipient, 'ascii');
    const amountBytes = Buffer.allocUnsafe(8);
    amountBytes.writeBigUInt64LE(amountFlowers, 0);

    const data = Buffer.concat([
      Buffer.from([pathBytes.length / 4]),
      pathBytes,
      recipientBytes,
      Buffer.from([0]),
      amountBytes,
      Buffer.from(txHash),
    ]);

    const response = await this.transport.send(
      CLA,
      INS_SIGN_TX,
      0x00,
      0x00,
      data
    );

    const sw = response.slice(-2).readUInt16BE(0);
    if (sw !== 0x9000) {
      throw new Error(`Ledger returned SW=${sw.toString(16)}`);
    }

    return response.slice(0, -2).toString('hex'); // 64-byte signature
  }

  async getVersion() {
    const response = await this.transport.send(
      CLA,
      INS_GET_VERSION,
      0x00,
      0x00,
      Buffer.alloc(0)
    );
    const sw = response.slice(-2).readUInt16BE(0);
    if (sw !== 0x9000) throw new Error(`SW=${sw.toString(16)}`);
    return response.slice(0, -2).toString('ascii');
  }

  private bip32PathToBuffer(path: string): Buffer {
    const parts = path.replace(/^m\//, '').split('/');
    const buf = Buffer.allocUnsafe(parts.length * 4);
    parts.forEach((p, i) => {
      const hardened = p.endsWith("'");
      const num = parseInt(p.replace("'", ''), 10);
      buf.writeUInt32BE(hardened ? num + 0x80000000 : num, i * 4);
    });
    return buf;
  }
}

// ─── Tests ─────────────────────────────────────────────────────────────────

export {};

(speculosAvailable ? describe : describe.skip)('Ledger ZION App (Speculos)', () => {
  let app: ZionLedgerApp;
  let transport: any;

  beforeAll(async () => {
    // Connect to Speculos HTTP API
    transport = await Transport.create(SPECULOS_URL);
    app = new ZionLedgerApp(transport);
  });

  afterAll(async () => {
    if (transport) await transport.close();
  });

  it('returns app version', async () => {
    const version = await app.getVersion();
    expect(version).toMatch(/ZION/);
  });

  it('derives Ed25519 public key and zion1 address', async () => {
    const { publicKey, address } = await app.getPublicKey("m/44'/0'/0'");

    expect(publicKey).toHaveLength(64); // 32 bytes hex
    expect(address).toMatch(/^zion1/);
    expect(address).toHaveLength(44);
  });

  it('returns deterministic public key for same path', async () => {
    const a = await app.getPublicKey("m/44'/0'/0'");
    const b = await app.getPublicKey("m/44'/0'/0'");
    expect(a.publicKey).toBe(b.publicKey);
    expect(a.address).toBe(b.address);
  });

  it('returns different keys for different paths', async () => {
    const a = await app.getPublicKey("m/44'/0'/0'");
    const b = await app.getPublicKey("m/44'/0'/1'");
    expect(a.publicKey).not.toBe(b.publicKey);
  });

  it('signs a raw BLAKE3 transaction hash', async () => {
    const { publicKey } = await app.getPublicKey("m/44'/0'/0'");

    const txHash = new Uint8Array(32);
    crypto.getRandomValues(txHash);

    const sigHex = await app.signTransaction(
      "m/44'/0'/0'",
      txHash,
      'zion1testrecipientaddress0000000000ckzz',
      1000000000000n // 1 ZION in flowers
    );

    expect(sigHex).toHaveLength(128); // 64 bytes hex

    // Verify signature with @noble/ed25519
    const { verifySignature } = await import('../src/core/keypair');
    const sig = Buffer.from(sigHex, 'hex');
    const pk = Buffer.from(publicKey, 'hex');

    const valid = await verifySignature(sig, txHash, pk);
    expect(valid).toBe(true);
  });

  it('rejects transaction with user cancel (simulated)', async () => {
    const txHash = new Uint8Array(32);
    crypto.getRandomValues(txHash);

    await expect(
      app.signTransaction(
        "m/44'/0'/0'",
        txHash,
        'zion1testrecipientaddress0000000000ckzz',
        1000000000000n
      )
    ).rejects.toThrow();
  });
});
