/**
 * GitHub Release data for ZION v3-Mainnet public repo.
 * Source: https://github.com/Zion-TerraNova/v3-Mainnet/releases
 * Updated: 2026-07-10
 */

export const GITHUB_REPO = 'Zion-TerraNova/v3-Mainnet';
export const GITHUB_RELEASES_URL = `https://github.com/${GITHUB_REPO}/releases`;
export const GITHUB_REPO_URL = `https://github.com/${GITHUB_REPO}`;

export type ReleaseAsset = {
  name: string;
  label: string;
  description: string;
  sizeMB: number;
  downloadUrl: string;
  category: 'cli' | 'node' | 'miner' | 'pool' | 'bridge' | 'dao' | 'swap' | 'all' | 'checksum';
};

export type Release = {
  tag: string;
  name: string;
  publishedAt: string;
  prerelease: boolean;
  commitHash: string;
  htmlUrl: string;
  assets: ReleaseAsset[];
};

const DL_BASE = `https://github.com/${GITHUB_REPO}/releases/download/v3.0.4-beta`;

export const LATEST_RELEASE: Release = {
  tag: 'v3.0.4-beta',
  name: 'ZION v3.0.4-beta — Mainnet Public Release',
  publishedAt: '2026-07-09',
  prerelease: true,
  commitHash: '3753f69',
  htmlUrl: `https://github.com/${GITHUB_REPO}/releases/tag/v3.0.4-beta`,
  assets: [
    {
      name: 'zion-cli-linux-x86_64.tar.gz',
      label: 'ZION CLI',
      description: 'Unified CLI wallet + node management',
      sizeMB: 3.0,
      downloadUrl: `${DL_BASE}/zion-cli-linux-x86_64.tar.gz`,
      category: 'cli',
    },
    {
      name: 'zion-node-linux-x86_64.tar.gz',
      label: 'ZION Node',
      description: 'Full L1 consensus node',
      sizeMB: 1.2,
      downloadUrl: `${DL_BASE}/zion-node-linux-x86_64.tar.gz`,
      category: 'node',
    },
    {
      name: 'zion-miner-linux-x86_64.tar.gz',
      label: 'ZION Miner',
      description: 'GPU/CPU miner (Ekam Deeksha dual-algo)',
      sizeMB: 0.6,
      downloadUrl: `${DL_BASE}/zion-miner-linux-x86_64.tar.gz`,
      category: 'miner',
    },
    {
      name: 'zion-pool-linux-x86_64.tar.gz',
      label: 'ZION Pool',
      description: 'Stratum mining pool (node + pool wallet tools)',
      sizeMB: 0.4,
      downloadUrl: `${DL_BASE}/zion-pool-linux-x86_64.tar.gz`,
      category: 'pool',
    },
    {
      name: 'zion-bridge-linux-x86_64.tar.gz',
      label: 'ZION Bridge',
      description: 'L1↔EVM bridge relay daemon',
      sizeMB: 4.3,
      downloadUrl: `${DL_BASE}/zion-bridge-linux-x86_64.tar.gz`,
      category: 'bridge',
    },
    {
      name: 'zion-dao-linux-x86_64.tar.gz',
      label: 'ZION DAO',
      description: 'DAO governance daemon',
      sizeMB: 2.8,
      downloadUrl: `${DL_BASE}/zion-dao-linux-x86_64.tar.gz`,
      category: 'dao',
    },
    {
      name: 'zion-atomic-swap-linux-x86_64.tar.gz',
      label: 'ZION Atomic Swap',
      description: 'HTLC atomic swap daemon',
      sizeMB: 3.7,
      downloadUrl: `${DL_BASE}/zion-atomic-swap-linux-x86_64.tar.gz`,
      category: 'swap',
    },
    {
      name: 'zion-all-linux-x86_64.tar.gz',
      label: 'ZION All-in-One',
      description: 'All binaries in one archive',
      sizeMB: 16.1,
      downloadUrl: `${DL_BASE}/zion-all-linux-x86_64.tar.gz`,
      category: 'all',
    },
    {
      name: 'SHA256SUMS.txt',
      label: 'SHA256 Checksums',
      description: 'Verification checksums for all binaries',
      sizeMB: 0.0,
      downloadUrl: `${DL_BASE}/SHA256SUMS.txt`,
      category: 'checksum',
    },
  ],
};

export const NETWORK_PARAMS = [
  { label: 'Genesis hash', value: '4f75a0dfe6dde3b167287d445aa1ade56577b0e9166c641ed288b4c20a79bd6e', mono: true },
  { label: 'Consensus', value: 'PoW (Ekam Deeksha dual-algo: BLAKE3 + RandomNPU)' },
  { label: 'Block target', value: '60 seconds' },
  { label: 'Supply', value: '144 billion ZION (144,000,000,000)' },
  { label: 'Decimals', value: '6 (1 ZION = 1,000,000 flowers)' },
  { label: 'Emission split', value: '89% miner / 5% humanitarian / 5% issobella / 1% burn' },
  { label: 'Pool', value: '62.171.141.136:8444', mono: true },
  { label: 'RPC (localhost)', value: '127.0.0.1:8443', mono: true },
];
