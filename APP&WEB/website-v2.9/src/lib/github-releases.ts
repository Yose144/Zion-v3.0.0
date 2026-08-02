/**
 * GitHub Release data for ZION v3-Mainnet public repo.
 * Source: https://github.com/Zion-TerraNova/v3-Mainnet/releases
 * Updated: 2026-08-02 — v3.1.0 (Boost Miner) + v3.1.0-desktop (Desktop GUI)
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
  platform: 'linux-x86_64' | 'linux-aarch64' | 'macos-arm64' | 'macos-x86_64' | 'windows-x86_64' | 'checksum';
};

export type Release = {
  tag: string;
  name: string;
  publishedAt: string;
  prerelease: boolean;
  htmlUrl: string;
  assets: ReleaseAsset[];
};

const DL_BASE_310 = `https://github.com/${GITHUB_REPO}/releases/download/v3.1.0`;
const DL_BASE_306 = `https://github.com/${GITHUB_REPO}/releases/download/v3.0.6-beta`;
const DL_BASE_305 = `https://github.com/${GITHUB_REPO}/releases/download/v3.0.5-beta`;

/**
 * v3.1.0 — Boost Miner (2026-08-02)
 * Three-stream mining: ZION (primary) + Boost Stream 1 (GPU) + Boost Stream 2 (CPU).
 * Auto GPU backend detection: OpenCL/CUDA/Metal.
 * TUI dashboard with real-time hashrate, shares, and stream status.
 * Currently Linux x86_64 only — macOS/Windows use v3.0.6-beta Trinity Miner below.
 */
export const LATEST_RELEASE: Release = {
  tag: 'v3.1.0',
  name: 'ZION v3.1.0 — Boost Miner',
  publishedAt: '2026-08-02',
  prerelease: false,
  htmlUrl: `https://github.com/${GITHUB_REPO}/releases/tag/v3.1.0`,
  assets: [
    {
      name: 'zion-miner-v3.1.0-linux-x86_64.tar.gz',
      label: 'Linux x86_64',
      description: 'Boost Miner — three-stream mining with auto GPU backend detection',
      sizeMB: 2.0,
      downloadUrl: `${DL_BASE_310}/zion-miner-v3.1.0-linux-x86_64.tar.gz`,
      platform: 'linux-x86_64',
    },
    {
      name: 'SHA256SUMS-miner.txt',
      label: 'SHA256 Checksums',
      description: 'Verification checksums for v3.1.0 downloads',
      sizeMB: 0.0,
      downloadUrl: `${DL_BASE_310}/SHA256SUMS-miner.txt`,
      platform: 'checksum',
    },
  ],
};

/**
 * v3.0.6-beta — Trinity Miner (2026-08-01)
 * Standalone zion-miner binary with interactive setup menu.
 * Full GPU backends: CUDA + OpenCL + Metal (platform-gated).
 * Native algorithms: VerusHash v2.2, RandomX, BLAKE3.
 * All 5 platforms: Linux x86_64/ARM64, macOS Apple Silicon/Intel, Windows x86_64.
 * Use this if you need macOS or Windows — v3.1.0 is Linux-only for now.
 */
export const TRINITY_RELEASE: Release = {
  tag: 'v3.0.6-beta',
  name: 'ZION v3.0.6-beta — Trinity Miner',
  publishedAt: '2026-08-01',
  prerelease: true,
  htmlUrl: `https://github.com/${GITHUB_REPO}/releases/tag/v3.0.6-beta`,
  assets: [
    {
      name: 'zion-miner-linux-x86_64.tar.gz',
      label: 'Linux x86_64',
      description: 'Trinity Miner — OpenCL (AMD/Intel) + CUDA (NVIDIA) + native VerusHash/RandomX',
      sizeMB: 3.4,
      downloadUrl: `${DL_BASE_306}/zion-miner-linux-x86_64.tar.gz`,
      platform: 'linux-x86_64',
    },
    {
      name: 'zion-miner-linux-aarch64.tar.gz',
      label: 'Linux ARM64',
      description: 'Trinity Miner — CUDA (Jetson/ARM64 servers)',
      sizeMB: 2.7,
      downloadUrl: `${DL_BASE_306}/zion-miner-linux-aarch64.tar.gz`,
      platform: 'linux-aarch64',
    },
    {
      name: 'zion-miner-macos-aarch64.tar.gz',
      label: 'macOS Apple Silicon (M1–M4)',
      description: 'Trinity Miner — Metal + OpenCL',
      sizeMB: 3.2,
      downloadUrl: `${DL_BASE_306}/zion-miner-macos-aarch64.tar.gz`,
      platform: 'macos-arm64',
    },
    {
      name: 'zion-miner-macos-x86_64.tar.gz',
      label: 'macOS Intel x86_64',
      description: 'Trinity Miner — Metal + OpenCL',
      sizeMB: 3.3,
      downloadUrl: `${DL_BASE_306}/zion-miner-macos-x86_64.tar.gz`,
      platform: 'macos-x86_64',
    },
    {
      name: 'zion-miner-windows-x86_64.zip',
      label: 'Windows x86_64',
      description: 'Trinity Miner — CUDA (NVIDIA); OpenCL/AMD coming later',
      sizeMB: 2.9,
      downloadUrl: `${DL_BASE_306}/zion-miner-windows-x86_64.zip`,
      platform: 'windows-x86_64',
    },
    {
      name: 'SHA256SUMS.txt',
      label: 'SHA256 Checksums',
      description: 'Verification checksums for v3.0.6-beta downloads',
      sizeMB: 0.0,
      downloadUrl: `${DL_BASE_306}/SHA256SUMS.txt`,
      platform: 'checksum',
    },
  ],
};

/**
 * v3.0.5-beta — Simplified Community CLI (2026-07-10)
 * 4 platforms. Use this for wallet creation, node, pool, and basic mining.
 */
export const COMMUNITY_CLI_RELEASE: Release = {
  tag: 'v3.0.5-beta',
  name: 'ZION v3.0.5-beta — Simplified Community CLI',
  publishedAt: '2026-07-10',
  prerelease: true,
  htmlUrl: `https://github.com/${GITHUB_REPO}/releases/tag/v3.0.5-beta`,
  assets: [
    {
      name: 'zion-cli-linux-x86_64.tar.gz',
      label: 'Linux x86_64',
      description: 'Single zion binary — interactive menu, wallet, node, mining, pool',
      sizeMB: 2.3,
      downloadUrl: `${DL_BASE_305}/zion-cli-linux-x86_64.tar.gz`,
      platform: 'linux-x86_64',
    },
    {
      name: 'zion-cli-macos-aarch64.tar.gz',
      label: 'macOS Apple Silicon (M1–M4)',
      description: 'Single zion binary for Apple Silicon Macs',
      sizeMB: 2.1,
      downloadUrl: `${DL_BASE_305}/zion-cli-macos-aarch64.tar.gz`,
      platform: 'macos-arm64',
    },
    {
      name: 'zion-cli-macos-x86_64.tar.gz',
      label: 'macOS Intel x86_64',
      description: 'Single zion binary for Intel Macs',
      sizeMB: 2.3,
      downloadUrl: `${DL_BASE_305}/zion-cli-macos-x86_64.tar.gz`,
      platform: 'macos-x86_64',
    },
    {
      name: 'zion-cli-windows-x86_64.zip',
      label: 'Windows x86_64',
      description: 'Single zion.exe — node + pool + miner embedded (10 MB)',
      sizeMB: 4.7,
      downloadUrl: `${DL_BASE_305}/zion-cli-windows-x86_64.zip`,
      platform: 'windows-x86_64',
    },
    {
      name: 'SHA256SUMS.txt',
      label: 'SHA256 Checksums',
      description: 'Verification checksums for v3.0.5-beta downloads',
      sizeMB: 0.0,
      downloadUrl: `${DL_BASE_305}/SHA256SUMS.txt`,
      platform: 'checksum',
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
  { label: 'Pool', value: 'stratum.zionterranova.com:8444', mono: true },
  { label: 'RPC (localhost)', value: '127.0.0.1:8443', mono: true },
];
