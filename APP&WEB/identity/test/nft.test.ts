import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  encodeBalanceOf,
  encodeUri,
  decodeUint,
  decodeAbiString,
  normalizeTokenUrl,
  resolveNftAvatar,
  NftError,
  type NftBindConfig,
} from '../src/lib/nft.js';

const CONTRACT = '0x' + '11'.repeat(20);
const ADDR1 = '0x' + 'aa'.repeat(20);
const ADDR2 = '0x' + 'bb'.repeat(20);

const cfg = (over: Partial<NftBindConfig> = {}): NftBindConfig => ({
  enabled: true,
  rpcUrl: 'http://mock-rpc',
  allowedContracts: new Set([CONTRACT]),
  timeoutMs: 5_000,
  ipfsGateway: 'https://ipfs.io/ipfs/',
  ...over,
});

/** Build an ABI-encoded eth_call result. */
const abiUint = (v: bigint) => '0x' + v.toString(16).padStart(64, '0');
const abiString = (s: string) => {
  const data = Buffer.from(s, 'utf8').toString('hex');
  const words = Math.ceil(data.length / 64) * 64;
  return (
    '0x' +
    (32).toString(16).padStart(64, '0') +
    (data.length / 2).toString(16).padStart(64, '0') +
    data.padEnd(words, '0')
  );
};

/** Mock fetch that answers eth_call + metadata GETs from a table. */
function mockFetch(table: {
  balanceOf?: Record<string, bigint>;
  uri?: string;
  meta?: { image?: string; image_url?: string };
}) {
  return async (url: any, init?: any): Promise<any> => {
    const u = typeof url === 'string' ? url : url.url;
    if (u === 'http://mock-rpc') {
      const body = JSON.parse(init.body);
      const data: string = body.params[0].data;
      if (data.startsWith('0x00fdd58e')) {
        const owner = '0x' + data.slice(10, 74).slice(-40);
        const bal = table.balanceOf?.[owner] ?? 0n;
        return { ok: true, json: async () => ({ result: abiUint(bal) }) };
      }
      if (data.startsWith('0x0e89341c')) {
        return { ok: true, json: async () => ({ result: abiString(table.uri ?? '') }) };
      }
      throw new Error('unexpected call ' + data.slice(0, 10));
    }
    // metadata fetch
    return { ok: true, json: async () => table.meta ?? {} };
  };
}

describe('nft ABI codecs', () => {
  it('encodeBalanceOf produces selector + padded args', () => {
    const data = encodeBalanceOf(ADDR1, 42n);
    assert.match(data, /^0x00fdd58e/);
    assert.equal(data.length, 2 + 8 + 64 + 64);
    assert.ok(data.endsWith((42).toString(16).padStart(64, '0')));
    assert.ok(data.includes('aa'.repeat(20)));
  });

  it('encodeUri produces uri(uint256) call', () => {
    const data = encodeUri(7n);
    assert.match(data, /^0x0e89341c/);
    assert.equal(data.length, 2 + 8 + 64);
  });

  it('decodeUint reads last 32 bytes', () => {
    assert.equal(decodeUint(abiUint(255n)), 255n);
    assert.equal(decodeUint(abiUint(0n)), 0n);
    assert.throws(() => decodeUint('0x12'), NftError);
  });

  it('decodeAbiString round-trips', () => {
    const s = 'https://market.zionterranova.com/api/metadata/42.json';
    assert.equal(decodeAbiString(abiString(s)), s);
  });
});

describe('normalizeTokenUrl', () => {
  const gw = 'https://gw.example/ipfs/';
  it('passes http(s) through', () => {
    assert.equal(normalizeTokenUrl('https://x/img.png', gw), 'https://x/img.png');
  });
  it('translates ipfs://', () => {
    assert.equal(normalizeTokenUrl('ipfs://bafyCID/meta.json', gw), gw + 'bafyCID/meta.json');
    assert.equal(normalizeTokenUrl('ipfs://ipfs/bafyCID/x', gw), gw + 'bafyCID/x');
  });
  it('rejects other schemes', () => {
    assert.equal(normalizeTokenUrl('javascript:alert(1)', gw), null);
    assert.equal(normalizeTokenUrl('data:image/png;base64,x', gw), null);
  });
});

describe('resolveNftAvatar', () => {
  it('resolves avatar for the owner among linked addresses', async () => {
    const c = cfg({
      fetchImpl: mockFetch({
        balanceOf: { [ADDR1]: 0n, [ADDR2]: 3n },
        uri: 'https://meta.example/42.json',
        meta: { image: 'https://img.example/42.png' },
      }) as any,
    });
    const r = await resolveNftAvatar(c, CONTRACT, 42n, [ADDR1, ADDR2]);
    assert.equal(r.avatar, 'https://img.example/42.png');
    assert.equal(r.owner, ADDR2);
  });

  it('throws NOT_OWNER when no linked address holds the token', async () => {
    const c = cfg({
      fetchImpl: mockFetch({ balanceOf: { [ADDR1]: 0n, [ADDR2]: 0n } }) as any,
    });
    await assert.rejects(
      resolveNftAvatar(c, CONTRACT, 1n, [ADDR1, ADDR2]),
      (e: NftError) => e instanceof NftError && e.code === 'NOT_OWNER',
    );
  });

  it('throws NO_METADATA_IMAGE when token metadata lacks image', async () => {
    const c = cfg({
      fetchImpl: mockFetch({
        balanceOf: { [ADDR1]: 1n },
        uri: 'https://meta.example/9.json',
        meta: { name: 'no image here' } as any,
      }) as any,
    });
    await assert.rejects(
      resolveNftAvatar(c, CONTRACT, 9n, [ADDR1]),
      (e: NftError) => e instanceof NftError && e.code === 'NO_METADATA_IMAGE',
    );
  });

  it('translates ipfs metadata + image through the gateway', async () => {
    const c = cfg({
      fetchImpl: mockFetch({
        balanceOf: { [ADDR1]: 1n },
        uri: 'ipfs://bafyMETA/meta.json',
        meta: { image: 'ipfs://bafyIMG/art.png' },
      }) as any,
    });
    const r = await resolveNftAvatar(c, CONTRACT, 3n, [ADDR1]);
    assert.equal(r.avatar, 'https://ipfs.io/ipfs/bafyIMG/art.png');
  });

  it('rejects non-http image URLs in metadata', async () => {
    const c = cfg({
      fetchImpl: mockFetch({
        balanceOf: { [ADDR1]: 1n },
        uri: 'https://meta.example/x.json',
        meta: { image: 'javascript:alert(1)' },
      }) as any,
    });
    await assert.rejects(
      resolveNftAvatar(c, CONTRACT, 1n, [ADDR1]),
      (e: NftError) => e instanceof NftError && e.code === 'BAD_IMAGE_URL',
    );
  });
});
