/**
 * DEX Configuration — wZION Uniswap V3 Pool
 *
 * Supports Base Sepolia (testnet) and Base Mainnet.
 * All Uniswap V3 addresses are official Uniswap deployments.
 *
 * Fee tiers: 500 (0.05%), 3000 (0.3%), 10000 (1%)
 * We use 3000 (0.3%) — standard for volatile / emerging pairs.
 */

export interface DexChainConfig {
  name: string;
  chainId: number;
  // wZION deployed by us
  wzionAddress: string;
  // WETH (canonical on Base / all EVM)
  wethAddress: string;
  // Uniswap V3 core
  uniswapV3Factory: string;
  uniswapV3NonfungiblePositionManager: string;
  uniswapV3SwapRouter: string;
  // Pool parameters
  feeTier: number; // 500 | 3000 | 10000
  // Initial price: how many WETH wei per 1 wZION (1e18)
  // Example: 0.0001 ETH per ZION → 1e14
  initialPriceWethPerWzion: bigint;
}

/**
 * Base Sepolia — testnet deployment
 * wZION deployed: 0x0c49... (Base Sepolia, Sprint 3.4.5)
 */
export const BASE_SEPOLIA_CONFIG: DexChainConfig = {
  name: "base-sepolia",
  chainId: 84532,
  wzionAddress: process.env.WZION_ADDRESS_SEPOLIA || "0x0c493763d107ab0ABb0aee1Ca3999292d8202bb6",
  wethAddress: "0x4200000000000000000000000000000000000006",
  uniswapV3Factory: "0x4752ba5DBc23f44D87826276BF6Fd6b1C372aD24",
  uniswapV3NonfungiblePositionManager: "0x27F971cb582BF9E50F397e4d29a5C7A34f11faA2",
  uniswapV3SwapRouter: "0x94cC0AaC535CCDB3C01d6787D6413C739ae12bc4",
  feeTier: 3000,
  // 1 ZION = 0.00005 ETH (test price, low for testnet)
  initialPriceWethPerWzion: 50_000_000_000_000n, // 5e13 wei = 0.00005 ETH
};

/**
 * Base Mainnet — production deployment
 * wZION deployed and verified on BaseScan.
 *
 * Seed price (confirmed 2026-06-24):
 *   $0.00002 / ZION  @  ETH = $1 656
 *   → price_eth = 0.00002 / 1656 ≈ 1.2077e-8 ETH per wZION
 *   → in wei (18 decimals): 12_077_000 (≈ 1.2077e-8 × 1e18 = 12_077_000 wei)
 *   → sqrtPriceX96 = 8_706_917_217_488_994_866_036_736
 *   → tick = -182_328
 */
export const BASE_MAINNET_CONFIG: DexChainConfig = {
  name: "base",
  chainId: 8453,
  wzionAddress: process.env.WZION_ADDRESS_MAINNET || "0x0c493763d107ab0ABb0aee1Ca3999292d8202bb6",
  wethAddress: "0x4200000000000000000000000000000000000006",
  uniswapV3Factory: "0x33128a8fC17869897dcE68Ed026d694621f6FDfD",
  uniswapV3NonfungiblePositionManager: "0x03a520b32C04BF3bEEf7BEb72E919cf822Ed34f1",
  uniswapV3SwapRouter: "0x2626664c2603336E57B271c5C0b26F421741e481",
  feeTier: 3000,
  // 1 ZION = $0.00002 @ ETH $1 656 → ≈ 1.2077e-8 ETH = 12_077 wei (rounded)
  // sqrtPriceX96 = 8_706_917_217_488_994_866_036_736
  // tick = -182_328
  initialPriceWethPerWzion: 12_077n, // 1.2077e-8 ETH × 1e18 ≈ 12_077 wei per wZION
};

/** Select config by network name */
export function getConfig(network: string): DexChainConfig {
  switch (network) {
    case "base-sepolia":
      return BASE_SEPOLIA_CONFIG;
    case "base":
      return BASE_MAINNET_CONFIG;
    default:
      throw new Error(`Unknown network: ${network}. Supported: base-sepolia, base`);
  }
}

// ──────────────────────────────────────────────────────────────────────────────
// Uniswap V3 ABIs (minimal — only functions we call)
// ──────────────────────────────────────────────────────────────────────────────

export const FACTORY_ABI = [
  "function getPool(address tokenA, address tokenB, uint24 fee) external view returns (address pool)",
  "function createPool(address tokenA, address tokenB, uint24 fee) external returns (address pool)",
];

export const POOL_ABI = [
  "function initialize(uint160 sqrtPriceX96) external",
  "function slot0() external view returns (uint160 sqrtPriceX96, int24 tick, uint16 observationIndex, uint16 observationCardinality, uint16 observationCardinalityNext, uint8 feeProtocol, bool unlocked)",
  "function token0() external view returns (address)",
  "function token1() external view returns (address)",
  "function fee() external view returns (uint24)",
  "function liquidity() external view returns (uint128)",
];

export const POSITION_MANAGER_ABI = [
  `function mint(
    (address token0, address token1, uint24 fee, int24 tickLower, int24 tickUpper, uint256 amount0Desired, uint256 amount1Desired, uint256 amount0Min, uint256 amount1Min, address recipient, uint256 deadline)
  ) external payable returns (uint256 tokenId, uint128 liquidity, uint256 amount0, uint256 amount1)`,
  "function positions(uint256 tokenId) external view returns (uint96 nonce, address operator, address token0, address token1, uint24 fee, int24 tickLower, int24 tickUpper, uint128 liquidity, uint256 feeGrowthInside0LastX128, uint256 feeGrowthInside1LastX128, uint128 tokensOwed0, uint128 tokensOwed1)",
];

export const ERC20_ABI = [
  "function approve(address spender, uint256 amount) external returns (bool)",
  "function allowance(address owner, address spender) external view returns (uint256)",
  "function balanceOf(address account) external view returns (uint256)",
  "function decimals() external view returns (uint8)",
  "function symbol() external view returns (string)",
];

// ──────────────────────────────────────────────────────────────────────────────
// Price math helpers
// ──────────────────────────────────────────────────────────────────────────────

/**
 * Compute sqrtPriceX96 from a price ratio.
 *
 * Uniswap V3 uses Q64.96 fixed-point: sqrtPriceX96 = sqrt(price) * 2^96
 * price = token1Amount / token0Amount (in wei, same decimals)
 *
 * @param price_weth_per_wzion  How many WETH wei per 1 wZION (both 18 decimals)
 * @param token0IsWzion         Whether wZION is token0 (lower address)
 */
export function computeSqrtPriceX96(
  price_weth_per_wzion: bigint,
  token0IsWzion: boolean
): bigint {
  const Q96 = 2n ** 96n;
  const ONE_E18 = 10n ** 18n;

  // If token0 = wZION, token1 = WETH → price = WETH/wZION = price_weth_per_wzion / 1e18
  // sqrtPrice = sqrt(price_weth_per_wzion / 1e18) * 2^96
  // = sqrt(price_weth_per_wzion) * 2^96 / sqrt(1e18)
  // We use integer sqrt via Newton's method.

  let numerator: bigint;
  let denominator: bigint;

  if (token0IsWzion) {
    // price = WETH_amount / wZION_amount
    numerator = price_weth_per_wzion;
    denominator = ONE_E18;
  } else {
    // token0 = WETH, price = wZION_amount / WETH_amount = 1e18 / price_weth_per_wzion
    numerator = ONE_E18;
    denominator = price_weth_per_wzion;
  }

  // sqrtPriceX96 = sqrt(numerator * 2^192 / denominator)
  const ratio = (numerator * Q96 * Q96) / denominator;
  return bigIntSqrt(ratio);
}

/** Integer square root (Newton's method) */
function bigIntSqrt(n: bigint): bigint {
  if (n < 0n) throw new Error("sqrt of negative");
  if (n === 0n) return 0n;
  let x = n;
  let y = (x + 1n) / 2n;
  while (y < x) {
    x = y;
    y = (x + n / x) / 2n;
  }
  return x;
}

/**
 * Compute tick from sqrtPriceX96 (approximate, for Uniswap V3).
 * tick = floor(log(price) / log(1.0001))
 */
export function tickFromSqrtPriceX96(sqrtPriceX96: bigint): number {
  const Q96 = 2n ** 96n;
  // Convert to float for log computation
  const price = Number(sqrtPriceX96) / Number(Q96);
  const sqrtPrice = price;
  const tick = Math.floor(Math.log(sqrtPrice * sqrtPrice) / Math.log(1.0001));
  return tick;
}

/** Round tick to nearest tickSpacing (Uniswap V3 requires multiples of tickSpacing) */
export function roundTick(tick: number, tickSpacing: number): number {
  return Math.round(tick / tickSpacing) * tickSpacing;
}

/** Tick spacing per fee tier */
export const TICK_SPACINGS: Record<number, number> = {
  500: 10,
  3000: 60,
  10000: 200,
};

// Uniswap V3 tick bounds
export const MIN_TICK = -887272;
export const MAX_TICK = 887272;
