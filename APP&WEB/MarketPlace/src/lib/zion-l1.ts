import { execFile } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs';
import * as path from 'path';
import { generateMnemonic, mnemonicToSeedSync, validateMnemonic } from '@scure/bip39';
import { wordlist } from '@scure/bip39/wordlists/english';
import { ed25519 } from '@noble/curves/ed25519';
import { sha256 } from '@noble/hashes/sha256';
import { ripemd160 } from '@noble/hashes/ripemd160';
import { bytesToHex } from '@noble/hashes/utils';

const execFileAsync = promisify(execFile);

const ZION_BASE32_ALPHABET = '023456789acdefghjklmnpqrstuvwxyz';

export interface ZionWallet {
  mnemonic: string;
  address: string;
  publicKey: string;
  secretKey: string;
}

export interface ZionPayoutResult {
  success: boolean;
  txHash?: string;
  change?: string;
  inputs?: string;
  outputs?: string;
  error?: string;
}

function zionBase32Encode(data: Uint8Array): string {
  let out = '';
  for (const byte of data) {
    out += ZION_BASE32_ALPHABET[byte % 32];
    out += ZION_BASE32_ALPHABET[Math.floor(byte / 32) % 32];
  }
  return out;
}

function computeAddressChecksum(body: string): string {
  const hash = sha256(new TextEncoder().encode('zion1' + body));
  return zionBase32Encode(hash.slice(0, 2));
}

export function deriveZionAddress(publicKey: Uint8Array | string): string {
  const pkBytes = typeof publicKey === 'string' ? Buffer.from(publicKey.replace(/^0x/, ''), 'hex') : publicKey;
  const hash = sha256(pkBytes);
  const keyHash = ripemd160(hash);
  let body = zionBase32Encode(keyHash).slice(0, 35);
  const checksum = computeAddressChecksum(body);
  return `zion1${body}${checksum}`;
}

export function isValidZionAddress(address: string): boolean {
  if (!address.startsWith('zion1') || address.length !== 44) return false;
  if (!address.slice(5).match(/^[0-9a-z]+$/)) return false;
  const body = address.slice(5, 40);
  const actual = address.slice(40, 44);
  return computeAddressChecksum(body) === actual;
}

export function generateCustomerWallet(): ZionWallet {
  const mnemonic = generateMnemonic(wordlist, 128); // 12 words
  const seed = mnemonicToSeedSync(mnemonic);
  // First 32 bytes of the BIP39 seed are used as the Ed25519 private key.
  const secretKey = seed.slice(0, 32);
  const publicKey = ed25519.getPublicKey(secretKey);
  const address = deriveZionAddress(publicKey);

  return {
    mnemonic,
    address,
    publicKey: bytesToHex(publicKey),
    secretKey: bytesToHex(secretKey),
  };
}

export function walletFromMnemonic(mnemonic: string): ZionWallet {
  if (!validateMnemonic(mnemonic, wordlist)) {
    throw new Error('Invalid mnemonic');
  }
  const seed = mnemonicToSeedSync(mnemonic);
  const secretKey = seed.slice(0, 32);
  const publicKey = ed25519.getPublicKey(secretKey);
  const address = deriveZionAddress(publicKey);

  return {
    mnemonic,
    address,
    publicKey: bytesToHex(publicKey),
    secretKey: bytesToHex(secretKey),
  };
}

export function walletFromSecretKey(secretKeyHex: string): Omit<ZionWallet, 'mnemonic'> {
  const secretKey = Buffer.from(secretKeyHex.replace(/^0x/, ''), 'hex');
  if (secretKey.length !== 32) throw new Error('Secret key must be 32 bytes');
  const publicKey = ed25519.getPublicKey(secretKey);
  const address = deriveZionAddress(publicKey);

  return {
    address,
    publicKey: bytesToHex(publicKey),
    secretKey: secretKeyHex.replace(/^0x/, ''),
  };
}

export function createWalletFile(wallet: ZionWallet | Omit<ZionWallet, 'mnemonic'>, filePath: string): string {
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true, mode: 0o700 });

  const payload: Record<string, string> = {
    address: wallet.address,
    public_key: wallet.publicKey,
    secret_key: wallet.secretKey,
    created_at: new Date().toISOString(),
  };
  if ('mnemonic' in wallet && wallet.mnemonic) {
    payload.mnemonic = wallet.mnemonic;
  }

  fs.writeFileSync(filePath, JSON.stringify(payload, null, 2), { mode: 0o600 });
  return filePath;
}

function getZionCliPath(): string {
  return (
    process.env.ZION_CLI_PATH ??
    '/home/zionserver/2.9.6-main/V31/releases/linux-x86_64/zion'
  );
}

function getL1RpcUrl(): string {
  return process.env.ZION_L1_RPC_URL ?? '127.0.0.1:9445';
}

function getPoolWalletPath(): string {
  return (
    process.env.ZION_L1_POOL_WALLET_PATH ??
    '/etc/zion/MarketPlace/pool-wallet.json'
  );
}

function ensurePoolWallet(): string {
  const walletPath = getPoolWalletPath();
  if (fs.existsSync(walletPath)) return walletPath;

  const secretKey = process.env.ZION_L1_POOL_WALLET_SECRET_KEY;
  const mnemonic = process.env.ZION_L1_POOL_WALLET_MNEMONIC;

  if (secretKey) {
    const wallet = walletFromSecretKey(secretKey);
    createWalletFile(wallet, walletPath);
    return walletPath;
  }

  if (mnemonic) {
    const wallet = walletFromMnemonic(mnemonic);
    createWalletFile(wallet, walletPath);
    return walletPath;
  }

  throw new Error(
    'ZION pool wallet not configured. Set ZION_L1_POOL_WALLET_PATH, ZION_L1_POOL_WALLET_SECRET_KEY, or ZION_L1_POOL_WALLET_MNEMONIC.'
  );
}

export async function sendZionPayout(
  toAddress: string,
  amountZion: number,
  feeZion: number = parseFloat(process.env.ZION_L1_PAYOUT_FEE ?? '0.01'),
  memo?: string
): Promise<ZionPayoutResult> {
  if (!isValidZionAddress(toAddress)) {
    return { success: false, error: `Invalid ZION address: ${toAddress}` };
  }
  if (amountZion <= 0) {
    return { success: false, error: 'Amount must be positive' };
  }

  const poolWalletPath = ensurePoolWallet();
  const cli = getZionCliPath();
  const rpc = getL1RpcUrl();

  const args = [
    'wallet',
    'send',
    '--wallet',
    poolWalletPath,
    '--to',
    toAddress,
    '--amount',
    amountZion.toString(),
    '--fee',
    feeZion.toString(),
    '--rpc',
    rpc,
  ];
  if (memo) args.push('--memo', memo);

  try {
    const { stdout, stderr } = await execFileAsync(cli, args, {
      timeout: 120_000,
      env: { ...process.env },
    });
    const output = stdout + stderr;

    // Extract tx hash from "TX hash: <hash>" or "Broadcast OK. Result: ..."
    const txMatch = output.match(/TX hash:\s*([a-f0-9]{64})/i);
    const txHash = txMatch ? txMatch[1] : undefined;
    const changeMatch = output.match(/Change:\s*(\d+)\s*flowers/);
    const inputsMatch = output.match(/Inputs:\s*(\d+)/);
    const outputsMatch = output.match(/Outputs:\s*(\d+)/);

    return {
      success: true,
      txHash,
      change: changeMatch ? changeMatch[1] : undefined,
      inputs: inputsMatch ? inputsMatch[1] : undefined,
      outputs: outputsMatch ? outputsMatch[1] : undefined,
    };
  } catch (err: any) {
    return {
      success: false,
      error: err?.stderr?.toString() || err?.message || String(err),
    };
  }
}

export async function getZionBalance(address: string): Promise<{ flowers: number; zion: number } | null> {
  try {
    const rpc = getL1RpcUrl();
    const result = await l1RpcCall<{ balance_flowers?: number; balance?: number }>('getBalance', { address });
    const flowers = Number(result?.balance_flowers ?? result?.balance ?? 0);
    return { flowers, zion: flowers / 1_000_000 };
  } catch (e) {
    console.error('getZionBalance failed:', e);
    return null;
  }
}

function l1RpcCall<T = unknown>(method: string, params: unknown): Promise<T> {
  const rpc = getL1RpcUrl();
  const host = rpc.replace(/^https?:\/\//, '').split('/')[0];
  const [hostname, port] = host.split(':');
  const portNum = port ? parseInt(port, 10) : 9445;

  return new Promise((resolve, reject) => {
    const net = require('net');
    const sock = net.createConnection({ host: hostname, port: portNum }, () => {
      const req = JSON.stringify({ jsonrpc: '2.0', method, params, id: 1 });
      sock.write(req + '\n');
    });

    let buf = '';
    sock.on('data', (chunk: Buffer) => {
      buf += chunk.toString();
      const idx = buf.indexOf('\n');
      if (idx >= 0) {
        sock.end();
        try {
          const resp = JSON.parse(buf.slice(0, idx));
          if (resp.error) reject(new Error(`L1 RPC error: ${JSON.stringify(resp.error)}`));
          else resolve(resp.result as T);
        } catch (e) {
          reject(new Error(`L1 RPC parse error: ${e}`));
        }
      }
    });
    sock.on('error', (e: Error) => reject(new Error(`L1 RPC connect failed: ${e.message}`)));
    sock.setTimeout(15_000, () => {
      sock.destroy();
      reject(new Error('L1 RPC timeout'));
    });
  });
}
