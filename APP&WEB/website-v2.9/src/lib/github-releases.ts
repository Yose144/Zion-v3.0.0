/**
 * GitHub Release data for ZION v3-Mainnet public repo.
 * Source: https://github.com/Zion-TerraNova/v3-Mainnet/releases
 * Updated: 2026-08-21 — network version v3.2.0 "One Love" (Mainnet Stable).
 *   Latest binary releases: v3.2.0-miner (Terminal Miner, 5 platforms)
 *                          v3.2.0-cli (Community CLI, 5 platforms).
 *   v3.2.0 is the network/protocol version; binary releases track separately.
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

const DL_BASE_320_MINER = `https://github.com/${GITHUB_REPO}/releases/download/v3.2.0-miner`;
const DL_BASE_320_CLI = `https://github.com/${GITHUB_REPO}/releases/download/v3.2.0-cli`;
const DL_BASE_306 = `https://github.com/${GITHUB_REPO}/releases/download/v3.0.6-beta`;

/**
 * v3.2.0-miner — Public Terminal Miner (2026-08-21)
 * One-click GPU auto-detect: CUDA → OpenCL → Metal → CPU.
 * TUI dashboard, public Boost branding, and all native algorithms.
 * 5 platforms: Linux x86_64, Linux ARM64, macOS Apple Silicon, macOS Intel, Windows x86_64.
 *
 * NOTE: sizeMB values are placeholders until the CI release produces final assets.
 */
export const LATEST_RELEASE: Release = {
  tag: 'v3.2.0-miner',
  name: 'ZION v3.2.0 — Public Boost Miner',
  publishedAt: '2026-08-21',
  prerelease: false,
  htmlUrl: `https://github.com/${GITHUB_REPO}/releases/tag/v3.2.0-miner`,
  assets: [
    {
      name: 'zion-miner-v3.2.0-linux-x86_64.tar.gz',
      label: 'Linux x86_64',
      description: 'Public Boost Miner — CUDA + OpenCL + all native algorithms + TUI',
      sizeMB: 3.6,
      downloadUrl: `${DL_BASE_320_MINER}/zion-miner-v3.2.0-linux-x86_64.tar.gz`,
      platform: 'linux-x86_64',
    },
    {
      name: 'zion-miner-v3.2.0-linux-arm64.tar.gz',
      label: 'Linux ARM64',
      description: 'Public Boost Miner — OpenCL + all native algorithms + TUI',
      sizeMB: 3.2,
      downloadUrl: `${DL_BASE_320_MINER}/zion-miner-v3.2.0-linux-arm64.tar.gz`,
      platform: 'linux-aarch64',
    },
    {
      name: 'zion-miner-v3.2.0-macos-arm64.tar.gz',
      label: 'macOS Apple Silicon (M1–M4)',
      description: 'Public Boost Miner — Metal + OpenCL + all native algorithms + TUI',
      sizeMB: 3.1,
      downloadUrl: `${DL_BASE_320_MINER}/zion-miner-v3.2.0-macos-arm64.tar.gz`,
      platform: 'macos-arm64',
    },
    {
      name: 'zion-miner-v3.2.0-macos-x86_64.tar.gz',
      label: 'macOS Intel x86_64',
      description: 'Public Boost Miner — Metal + OpenCL + all native algorithms + TUI',
      sizeMB: 3.3,
      downloadUrl: `${DL_BASE_320_MINER}/zion-miner-v3.2.0-macos-x86_64.tar.gz`,
      platform: 'macos-x86_64',
    },
    {
      name: 'zion-miner-v3.2.0-windows-x86_64.zip',
      label: 'Windows x86_64',
      description: 'Public Boost Miner — CUDA + OpenCL + all native algorithms + TUI',
      sizeMB: 3.6,
      downloadUrl: `${DL_BASE_320_MINER}/zion-miner-v3.2.0-windows-x86_64.zip`,
      platform: 'windows-x86_64',
    },
    {
      name: 'SHA256SUMS.txt',
      label: 'SHA256 Checksums',
      description: 'Verification checksums for v3.2.0-miner downloads',
      sizeMB: 0.0,
      downloadUrl: `${DL_BASE_320_MINER}/SHA256SUMS.txt`,
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
 * v3.2.0-cli — Public CLI (2026-08-21)
 * 5 platforms. Use this for wallet creation, node, pool, and basic mining.
 *
 * NOTE: sizeMB values are placeholders until the CI release produces final assets.
 */
export const COMMUNITY_CLI_RELEASE: Release = {
  tag: 'v3.2.0-cli',
  name: 'ZION v3.2.0 — Public CLI',
  publishedAt: '2026-08-21',
  prerelease: false,
  htmlUrl: `https://github.com/${GITHUB_REPO}/releases/tag/v3.2.0-cli`,
  assets: [
    {
      name: 'zion-cli-v3.2.0-linux-x86_64.tar.gz',
      label: 'Linux x86_64',
      description: 'Single zion binary — interactive menu, wallet, node, mining, pool',
      sizeMB: 3.0,
      downloadUrl: `${DL_BASE_320_CLI}/zion-cli-v3.2.0-linux-x86_64.tar.gz`,
      platform: 'linux-x86_64',
    },
    {
      name: 'zion-cli-v3.2.0-linux-arm64.tar.gz',
      label: 'Linux ARM64',
      description: 'Single zion binary for Linux ARM64',
      sizeMB: 2.8,
      downloadUrl: `${DL_BASE_320_CLI}/zion-cli-v3.2.0-linux-arm64.tar.gz`,
      platform: 'linux-aarch64',
    },
    {
      name: 'zion-cli-v3.2.0-macos-aarch64.tar.gz',
      label: 'macOS Apple Silicon (M1–M4)',
      description: 'Single zion binary for Apple Silicon Macs',
      sizeMB: 2.5,
      downloadUrl: `${DL_BASE_320_CLI}/zion-cli-v3.2.0-macos-aarch64.tar.gz`,
      platform: 'macos-arm64',
    },
    {
      name: 'zion-cli-v3.2.0-macos-x86_64.tar.gz',
      label: 'macOS Intel x86_64',
      description: 'Single zion binary for Intel Macs',
      sizeMB: 2.7,
      downloadUrl: `${DL_BASE_320_CLI}/zion-cli-v3.2.0-macos-x86_64.tar.gz`,
      platform: 'macos-x86_64',
    },
    {
      name: 'zion-cli-v3.2.0-windows-x86_64.zip',
      label: 'Windows x86_64',
      description: 'Single zion.exe — node + pool + miner embedded',
      sizeMB: 5.5,
      downloadUrl: `${DL_BASE_320_CLI}/zion-cli-v3.2.0-windows-x86_64.zip`,
      platform: 'windows-x86_64',
    },
    {
      name: 'SHA256SUMS.txt',
      label: 'SHA256 Checksums',
      description: 'Verification checksums for v3.2.0-cli downloads',
      sizeMB: 0.0,
      downloadUrl: `${DL_BASE_320_CLI}/SHA256SUMS.txt`,
      platform: 'checksum',
    },
  ],
};

export const NETWORK_PARAMS = [
  { label: 'Genesis hash', value: '96109423298542a836edc10b9ba5ff9b29a1970418db543c2ee5cd952fe35bdb', mono: true },
  { label: 'Consensus', value: 'PoW (Ekam Deeksha v3.2 — 512 KiB, 2 passes, 128 reads, Keccak-256)' },
  { label: 'Block target', value: '60 seconds' },
  { label: 'Supply', value: '144 billion ZION (144,000,000,000)' },
  { label: 'Decimals', value: '6 (1 ZION = 1,000,000 flowers)' },
  { label: 'Emission split', value: '89% miner / 5% humanitarian / 5% issobella / 1% burn' },
  { label: 'Pool', value: 'stratum.zionterranova.com:8444', mono: true },
  { label: 'RPC (public)', value: 'rpc.zionterranova.com:8443', mono: true },
];
