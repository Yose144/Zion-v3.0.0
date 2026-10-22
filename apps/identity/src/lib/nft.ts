// ── ERC-1155 avatar binding ─────────────────────────────────────────
// Verifies that the caller owns a token (balanceOf > 0 on any of their
// linked EVM addresses) and resolves the token metadata image so it can
// be stored as `user.avatar`. Read-only `eth_call`s over plain JSON-RPC —
// no ethers/web3 dependency; the binding is checked once at set-time, so
// a later sale leaves the stored URL stale until the user rebinds.

export class NftError extends Error {
  constructor(
    public code: string,
    message: string,
  ) {
    super(message);
    this.name = 'NftError';
  }
}

export interface NftBindConfig {
  enabled: boolean;
  rpcUrl: string;
  /** Lowercase contract allowlist; empty = allow any (dev only). */
  allowedContracts: Set<string>;
  timeoutMs: number;
  ipfsGateway: string;
  /** Optional fetch injection point for tests. */
  fetchImpl?: typeof fetch;
}

export function loadNftConfig(env: NodeJS.ProcessEnv = process.env): NftBindConfig {
  return {
    enabled: env.ZIS_NFT_BIND === '1',
    rpcUrl: env.ZIS_NFT_RPC || 'https://mainnet.base.org',
    allowedContracts: new Set(
      (env.ZIS_NFT_CONTRACTS || '')
        .split(',')
        .map((s) => s.trim().toLowerCase())
        .filter(Boolean),
    ),
    timeoutMs: Number(env.ZIS_NFT_TIMEOUT_MS) || 8_000,
    ipfsGateway: env.ZIS_IPFS_GATEWAY || 'https://ipfs.io/ipfs/',
  };
}

// ── ABI codecs ──────────────────────────────────────────────────────

const SEL_BALANCE_OF = '00fdd58e'; // balanceOf(address,uint256)
const SEL_URI = '0e89341c'; // uri(uint256)

const pad32 = (hex: string) => hex.replace(/^0x/i, '').toLowerCase().padStart(64, '0');

export function encodeBalanceOf(owner: string, tokenId: bigint): string {
  return '0x' + SEL_BALANCE_OF + pad32(owner) + tokenId.toString(16).padStart(64, '0');
}

export function encodeUri(tokenId: bigint): string {
  return '0x' + SEL_URI + tokenId.toString(16).padStart(64, '0');
}

/** Decode a single-word uint256 return value. */
export function decodeUint(hex: string): bigint {
  const h = hex.replace(/^0x/i, '');
  if (!h || h.length < 64) throw new NftError('RPC_BAD_RETURN', 'Short eth_call return');
  return BigInt('0x' + h.slice(-64));
}

/** Decode an ABI-encoded `string` return value (offset + length + data). */
export function decodeAbiString(hex: string): string {
  const h = hex.replace(/^0x/i, '');
  if (h.length < 128) throw new NftError('RPC_BAD_RETURN', 'Short string return');
  const off = Number(BigInt('0x' + h.slice(0, 64))) * 2;
  const len = Number(BigInt('0x' + h.slice(off, off + 64))) * 2;
  if (off + 64 + len > h.length) throw new NftError('RPC_BAD_RETURN', 'String overrun');
  const bytes = Buffer.from(h.slice(off + 64, off + 64 + len), 'hex');
  return bytes.toString('utf8');
}

// ── JSON-RPC ────────────────────────────────────────────────────────

async function ethCall(cfg: NftBindConfig, to: string, data: string): Promise<string> {
  const fetchImpl = cfg.fetchImpl ?? fetch;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), cfg.timeoutMs);
  try {
    const res = await fetchImpl(cfg.rpcUrl, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'eth_call',
        params: [{ to, data }, 'latest'],
      }),
      signal: ctrl.signal,
    });
    if (!res.ok) throw new NftError('RPC_UNAVAILABLE', `RPC HTTP ${res.status}`);
    const json = (await res.json()) as { result?: string; error?: { message?: string } };
    if (json.error) throw new NftError('RPC_REVERTED', json.error.message || 'eth_call reverted');
    if (typeof json.result !== 'string' || json.result === '0x')
      throw new NftError('RPC_BAD_RETURN', 'Empty eth_call result');
    return json.result;
  } catch (e) {
    if (e instanceof NftError) throw e;
    throw new NftError('RPC_UNAVAILABLE', (e as Error).message);
  } finally {
    clearTimeout(timer);
  }
}

export async function erc1155BalanceOf(
  cfg: NftBindConfig,
  contract: string,
  owner: string,
  tokenId: bigint,
): Promise<bigint> {
  return decodeUint(await ethCall(cfg, contract, encodeBalanceOf(owner, tokenId)));
}

export async function erc1155Uri(
  cfg: NftBindConfig,
  contract: string,
  tokenId: bigint,
): Promise<string> {
  return decodeAbiString(await ethCall(cfg, contract, encodeUri(tokenId)));
}

// ── URL helpers ─────────────────────────────────────────────────────

/** ipfs://CID/path → gateway URL; http(s) passes through; else null. */
export function normalizeTokenUrl(url: string, ipfsGateway: string): string | null {
  const u = url.trim();
  if (u.startsWith('ipfs://')) return ipfsGateway + u.slice('ipfs://'.length).replace(/^ipfs\//, '');
  if (/^https?:\/\//i.test(u)) return u;
  return null;
}

/**
 * Fetch token metadata JSON and return a validated image URL.
 * Rejects non-http(s) schemes, >512 chars (matches avatar column limit).
 */
export async function fetchMetadataImage(
  cfg: NftBindConfig,
  metadataUrl: string,
): Promise<string> {
  const fetchImpl = cfg.fetchImpl ?? fetch;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), cfg.timeoutMs);
  try {
    const res = await fetchImpl(metadataUrl, { signal: ctrl.signal });
    if (!res.ok) throw new NftError('METADATA_FETCH', `Metadata HTTP ${res.status}`);
    const meta = (await res.json()) as { image?: unknown; image_url?: unknown };
    const image = meta.image ?? meta.image_url;
    if (typeof image !== 'string' || image.length === 0)
      throw new NftError('NO_METADATA_IMAGE', 'Token metadata has no image');
    const normalized = normalizeTokenUrl(image, cfg.ipfsGateway);
    if (!normalized || normalized.length > 512)
      throw new NftError('BAD_IMAGE_URL', 'Unsupported or oversized image URL');
    return normalized;
  } catch (e) {
    if (e instanceof NftError) throw e;
    throw new NftError('METADATA_FETCH', (e as Error).message);
  } finally {
    clearTimeout(timer);
  }
}

// ── Top-level resolve ───────────────────────────────────────────────

/**
 * Returns {avatar, owner} for the first `owners` address holding tokenId,
 * or throws NftError('NOT_OWNER') when none of them hold a balance.
 */
export async function resolveNftAvatar(
  cfg: NftBindConfig,
  contract: string,
  tokenId: bigint,
  owners: string[],
): Promise<{ avatar: string; owner: string }> {
  for (const owner of owners) {
    const balance = await erc1155BalanceOf(cfg, contract, owner, tokenId);
    if (balance === 0n) continue;
    const uri = await erc1155Uri(cfg, contract, tokenId);
    const metaUrl = normalizeTokenUrl(uri, cfg.ipfsGateway);
    if (!metaUrl) throw new NftError('BAD_TOKEN_URI', 'Unsupported token URI scheme');
    const avatar = await fetchMetadataImage(cfg, metaUrl);
    return { avatar, owner };
  }
  throw new NftError('NOT_OWNER', 'No linked EVM address holds this token');
}
