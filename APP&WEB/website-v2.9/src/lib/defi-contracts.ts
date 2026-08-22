/**
 * ZION L2 DeFi Contract Registry
 *
 * All deployed contract addresses, ABIs (minimal), and chain config
 * for Base Sepolia (testnet) and Base mainnet.
 */

// ─── Chain configs ───────────────────────────────────────────────────────────

export type NetworkId = 'base-sepolia' | 'base-mainnet';

export interface ChainConfig {
  id: NetworkId;
  label: string;
  chainId: number;
  rpcUrl: string;
  explorerBase: string;
  live: boolean;
}

export const CHAINS: Record<NetworkId, ChainConfig> = {
  'base-sepolia': {
    id: 'base-sepolia',
    label: 'Base Sepolia (Testnet)',
    chainId: 84532,
    rpcUrl: 'https://sepolia.base.org',
    explorerBase: 'https://sepolia.basescan.org',
    live: false,
  },
  'base-mainnet': {
    id: 'base-mainnet',
    label: 'Base Mainnet',
    chainId: 8453,
    rpcUrl: 'https://mainnet.base.org',
    explorerBase: 'https://basescan.org',
    live: true,
  },
};

/** Currently active network */
export const ACTIVE_NETWORK: NetworkId = 'base-mainnet';
export const ACTIVE_CHAIN = CHAINS[ACTIVE_NETWORK];

// ─── Deployed contract addresses ─────────────────────────────────────────────

/** Base Sepolia (testnet) — historical reference */
export const CONTRACTS_SEPOLIA = {
  wZION:          '0x0c493763d107ab0ABb0aee1Ca3999292d8202bb6',
  ZIONBridge:     '0xF4BF85443ad6c9b88f3a5314cC3Fb59C32Cedca1',
  ZIONAtomicSwap: '0xAf1E0645Ac409485EDA5EabD87b4eE3C3a5BA3Fc',
  ZIONGovernance: '0x039F730e3e1c3f36da95187697118791762290a1',
  ZIONTreasury:   '0x178d85323dC94Ce2477269Dfb93a12D04B9bE537',
  ZIONStaking:    '0x487D87E243f87b1DDEEDEB890c40F2cEcCf67913',
  ZIONFarm:       '0x1B8BA92C401d53cBcEc422BAD4b83fABcb0A3843',
  UniV3Pool:      '0xcCEaD51568E8d701f7db7e6699F3986031F07C7B',
} as const;

/** Base Mainnet — production */
export const CONTRACTS = {
  wZION:          '0x0c493763d107ab0ABb0aee1Ca3999292d8202bb6',
  WETH:           '0x4200000000000000000000000000000000000006',
  USDC:           '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
  USDT:           '0xfde4C96c8593536E31F229EA8f37b2ADa2699bb2',
  SOL:            '0x311935Cd80B76769bF2ecC9D8Ab7635b2139cf82',
  ZIONBridge:     '0x72c8f0Dc60E27aB7A83fe3B416fab4F0600a6467',
  ZIONAtomicSwap: '0x3DE9Ad42716854083ab837706E3961d10B0e63Eb',
  // Uniswap V3 — canonical (only source of real DEX liquidity)
  UniV3Factory:   '0x33128a8fC17869897dcE68Ed026d694621f6FDfD',
  UniV3PoolWETH:  '0x18c0DaeF295E63F1bfBC7C39e71d0fabf4600699',
  UniV3PoolUSDT:  '0x186b46c2f04153999d44D25179cD623fD62Bfda2',
  UniV3PoolSOL:   '0xF38c56bbBBBC6d9FA11E7DE84bF7Bb70e1e8D2b3',
  UniV3Router:    '0x2626664c2603336E57B271c5C0b26F421741e481',
  QuoterV2:       '0x3d4e44Eb1374240CE5F1B871ab261CD16335B76a',
  PositionManager:'0x03a520b32C04BF3bEEf7BEb72E919cf822Ed34f1',
  // Uniswap V4 — positions were burned; kept for reference only
  V4PoolManager:      '0x498581fF718922c3f8e6A244956aF099B2652b2b',
  V4PositionManager:  '0x7C5f5A4bBd8fD63184577525326123B519429BdC',
  V4StateView:        '0xa3c0c9b65bad0b08107aa264b0f3db444b867a71',
  V4Quoter:           '0x0d5e0f971ed27fbff6c2837bf31316121532048d',
  V4UniversalRouter:  '0xFdf682F51fe81aa4898f0ae2163d8a55c127fbc7',
  // DeFi contracts — deployed 2026-06-29 on Base Mainnet
  ZIONGovernance: '0xB77eB4ab9468Ce03FBd7eCec70e976EFCfa623E8',
  ZIONTreasury:   '0x455f465ac7e14fdA97dC46fdd74bCa78bfC0aEeD', // 3-of-3 multisig
  ZIONStaking:    '0xbd5cEe7878337d22188BFBaF9aa9F39A850Be78B', // 12% APR, 100K wZION reward pool
  ZIONFarm:       '0x167B2753F5D8D9F8e62875cc9e379d7804308B08', // 1 wZION/s, 90d halving, 500K wZION pool
  // Uniswap CCA Auction — deployed 2026-06-30 on Base Mainnet
  CCAAuction:     '0x4eD4EbBaa975d20cEA746E3569802D51768e1f93', // 66.47M wZION for USDC, 184-day lock
  // PancakeSwap V3 on Base — contracts (pool to be deployed)
  PancakeV3Factory:           '0x0BFbCF9fa4f9C56B0F40a671Ad40E0805A091865',
  PancakeV3NFTPositionManager:'0x46A15B0b27311cedF172AB29E4f4766fbE7F4364',
  PancakeV3SwapRouter:        '0x1b81D678ffb9C0263b24A97847620C99d213eB14',
  PancakeV3QuoterV2:          '0xB048Bbc1Ee6b733FFfCFb9e9CeF7375518e25997',
  PancakeV3SmartRouter:       '0x678Aa4bF4E210cf2166753e054d5b7c31cc7fa86',
  // PancakeSwap V3 wZION/USDT pool — deployed 2026-06-30 on Base Mainnet
  PancakeV3PoolUSDT:          '0x46cc98dec9d2a60f2850225c942d6017b82b6f47', // 0.25% fee, NFT #2054747
} as const;

/** PancakeSwap V3 config on Base */
export const PANCAKE_V3 = {
  factory:             '0x0BFbCF9fa4f9C56B0F40a671Ad40E0805A091865',
  nftPositionManager:  '0x46A15B0b27311cedF172AB29E4f4766fbE7F4364',
  swapRouter:          '0x1b81D678ffb9C0263b24A97847620C99d213eB14',
  quoterV2:            '0xB048Bbc1Ee6b733FFfCFb9e9CeF7375518e25997',
  smartRouter:         '0x678Aa4bF4E210cf2166753e054d5b7c31cc7fa86',
  feeTiers: { '0.01%': 100, '0.05%': 500, '0.25%': 2500, '1%': 10000 },
  defaultFee: 2500, // 0.25% — PancakeSwap's standard tier
  swapUrl: `https://pancakeswap.finance/swap?outputCurrency=0x0c493763d107ab0ABb0aee1Ca3999292d8202bb6&chain=base`,
  addLiquidityUrl: 'https://pancakeswap.finance/addLiquidity',
} as const;

/** CCA Auction immutable parameters (from AUCTION_CCA_BASE.md) */
export const CCA_AUCTION_PARAMS = {
  auctionContract:  '0x4eD4EbBaa975d20cEA746E3569802D51768e1f93',
  token:            '0x0c493763d107ab0ABb0aee1Ca3999292d8202bb6', // wZION
  currency:         '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913', // USDC (Base)
  totalSupply:      66_466_631.15,                                // wZION deposited
  tokensRecipient:  '0xdde17506BC2D2dCE1d594bD1D85B0BAbb389D186',
  fundsRecipient:   '0x5bb4bafafec57bED50d864Aaa9d1ef992611e000',
  startBlock:       48_013_356,
  endBlock:         55_959_126,
  claimBlock:       55_959_126,
  floorPriceQ96:    '15053350877700',
  uniswapUrl:       'https://app.uniswap.org/explore/auctions/base/0x4eD4EbBaa975d20cEA746E3569802D51768e1f93',
  basescanUrl:      'https://basescan.org/address/0x4eD4EbBaa975d20cEA746E3569802D51768e1f93',
} as const;

/** Helper: check if a DeFi contract is deployed on mainnet */
export const STAKING_DEPLOYED = (CONTRACTS.ZIONStaking as string) !== '0x0000000000000000000000000000000000000000';
export const FARM_DEPLOYED = (CONTRACTS.ZIONFarm as string) !== '0x0000000000000000000000000000000000000000';
export const GOVERNANCE_DEPLOYED = (CONTRACTS.ZIONGovernance as string) !== '0x0000000000000000000000000000000000000000';

export const DEPLOYER = '0xdde17506BC2D2dCE1d594bD1D85B0BAbb389D186';
export const VALIDATOR2 = '0x8cc6F931edDAf5F14D0071727Ed1640752B5c787';

/** Base Mainnet ZIONBridge guardian validators (5/5 multisig) */
export const BRIDGE_VALIDATORS = [
  '0xdde17506BC2D2dCE1d594bD1D85B0BAbb389D186',
  '0x24d986841E56e5571489B25951eE8C1Ae761FA82',
  '0x665c55eDCF25c2c5A1dfF1B20eE950cBDC58d3d0',
  '0x8E644b3E9FaBf52eE321DC5B3D5AA06d6e3E66C6',
  '0x7e0D2eD71d78B9CFB5034A83333e82e304bc4CB2',
] as const;

// ─── Seed price constants ($0.0002 / ZION) ───────────────────────────────────
//
// These are used as fallback values while the Uni V3 pool has no liquidity yet,
// or while ETH/USD Chainlink data is temporarily unavailable.
//
// Updated 2026-06-29: Pools created on Base mainnet at $0.0002/ZION.
// wZION/WETH pool (1% fee, tickSpacing=200): sqrtPriceX96 = 25054144837504793613172736, tick = -161190
// wZION/USDC pool (0.3% fee, tickSpacing=60): sqrtPriceX96 = 1120455419495722778624, tick = -361501
//
// Derivation (2026-06-29, ETH = $2000):
//   price_eth_per_wzion = $0.0002 / $2000  = 1e-7 ETH/wZION
//   sqrtPriceX96 = floor(sqrt(1e-7) × 2^96) = 25054144837504793613172736
//   tick = floor(log(1e-7) / log(1.0001)) = -161190
//
// wZION (token0) < WETH (token1) by address — so price = WETH per wZION.

/** Seed price in USD for 1 wZION = 1 ZION on the L2 */
export const SEED_PRICE_USD = 0.0002;

/** ETH/USD reference rate used to derive SEED_SQRT_PRICE_X96 */
export const SEED_ETH_USD = 2000;

/** Seed price expressed in ETH (WETH per wZION) */
export const SEED_PRICE_ETH = SEED_PRICE_USD / SEED_ETH_USD; // = 1e-7

/** sqrtPriceX96 for the Uni V3 wZION/WETH 1% pool at seed price */
export const SEED_SQRT_PRICE_X96 = '25054144837504793613172736';

/** Tick corresponding to the seed price (wZION is token0, WETH is token1) */
export const SEED_TICK = -161190;

/** Full-range tick bounds for the 1% pool (tickSpacing = 200) */
export const TICK_LOWER_FULL = -887200;
export const TICK_UPPER_FULL = 887200;

/** Concentrated-range tick bounds for two-sided WETH position */
export const TICK_LOWER_CONC = -162000; // snapped to tickSpacing=200
export const TICK_UPPER_CONC = -160000; // snapped to tickSpacing=200

// ─── Minimal ABIs ────────────────────────────────────────────────────────────

export const WZION_ABI = [
  'function name() view returns (string)',
  'function symbol() view returns (string)',
  'function decimals() view returns (uint8)',
  'function totalSupply() view returns (uint256)',
  'function balanceOf(address) view returns (uint256)',
  'function mintableSupply() view returns (uint256)',
  'function bridgeStats() view returns (uint256 totalMinted, uint256 totalBurned, uint256 netSupply)',
  'function approve(address spender, uint256 amount) returns (bool)',
  'function allowance(address owner, address spender) view returns (uint256)',
] as const;

export const STAKING_ABI = [
  'function totalStaked() view returns (uint256)',
  'function rewardPoolBalance() view returns (uint256)',
  'function aprBps() view returns (uint256)',
  'function cooldownSeconds() view returns (uint256)',
  'function paused() view returns (bool)',
  'function stakes(address) view returns (uint256 staked, uint256 rewardPerTokenPaid, uint256 pendingRewards, uint256 cooldownStarted, uint256 cooldownAmount)',
  'function earned(address) view returns (uint256)',
  'function cooldownExpiresAt(address) view returns (uint256)',
  // Write functions
  'function stake(uint256 amount)',
  'function queueUnstake(uint256 amount)',
  'function unstake()',
  'function claimRewards()',
  'function emergencyWithdraw()',
] as const;

export const FARM_ABI = [
  'function rewardPerSecond() view returns (uint256)',
  'function poolCount() view returns (uint256)',
  'function totalAllocPoints() view returns (uint256)',
  'function rewardPoolBalance() view returns (uint256)',
  'function halvingInterval() view returns (uint256)',
  'function nextHalvingTime() view returns (uint256)',
  'function halvingCount() view returns (uint256)',
  'function paused() view returns (bool)',
  'function getPool(uint256 pid) view returns (address lpToken, uint256 allocPoints, uint256 lastRewardTime, uint256 accRewardPerShare, uint256 totalStaked, bool active, string name)',
  'function getUser(uint256 pid, address account) view returns (uint256 staked, uint256 rewardDebt, uint256 pendingHarvest)',
  'function pendingReward(uint256 pid, address account) view returns (uint256)',
  // Write functions
  'function deposit(uint256 pid, uint256 amount)',
  'function withdraw(uint256 pid, uint256 amount)',
  'function harvest(uint256 pid)',
  'function emergencyWithdraw(uint256 pid)',
] as const;

export const SWAP_ABI = [
  'function feeBps() view returns (uint256)',
  'function paused() view returns (bool)',
  'function MIN_TIMELOCK() view returns (uint256)',
  'function MAX_TIMELOCK() view returns (uint256)',
] as const;

export const GOVERNANCE_ABI = [
  'function proposalCount() view returns (uint256)',
  'function votingPeriod() view returns (uint256)',
  'function timelockDuration() view returns (uint256)',
  'function quorumPercentage() view returns (uint256)',
  'function proposalThreshold() view returns (uint256)',
  'function getProposal(uint256 proposalId) view returns (address proposer, string title, string description, string ipfsHash, uint256 forVotes, uint256 againstVotes, uint256 abstainVotes, uint8 currentState)',
  'function state(uint256 proposalId) view returns (uint8)',
  'function getReceipt(uint256 proposalId, address voter) view returns (bool hasVoted, uint8 support, uint256 votes)',
] as const;

export const BRIDGE_ABI = [
  'function threshold() view returns (uint256)',
  'function validatorCount() view returns (uint256)',
  'function paused() view returns (bool)',
  'function dailyLimit() view returns (uint256)',
  'function dailyMinted() view returns (uint256)',
] as const;

// ─── Uniswap V3 ABIs ────────────────────────────────────────────────────────

export const SWAP_ROUTER_ABI = [
  'function exactInputSingle((address tokenIn, address tokenOut, uint24 fee, address recipient, uint256 amountIn, uint256 amountOutMinimum, uint160 sqrtPriceLimitX96)) external payable returns (uint256 amountOut)',
] as const;

export const QUOTER_V2_ABI = [
  'function quoteExactInputSingle((address tokenIn, address tokenOut, uint256 amountIn, uint24 fee, uint160 sqrtPriceLimitX96)) external returns (uint256 amountOut, uint160 sqrtPriceX96After, uint32 initializedTicksCrossed, uint256 gasEstimate)',
] as const;

export const POOL_V3_ABI = [
  'function slot0() view returns (uint160 sqrtPriceX96, int24 tick, uint16 observationIndex, uint16 observationCardinality, uint16 observationCardinalityNext, uint8 feeProtocol, bool unlocked)',
  'function liquidity() view returns (uint128)',
  'function token0() view returns (address)',
  'function token1() view returns (address)',
  'function fee() view returns (uint24)',
  'function tickSpacing() view returns (int24)',
] as const;

/** ERC20 ABI for balance checks */
export const ERC20_ABI = [
  'function balanceOf(address) view returns (uint256)',
  'function totalSupply() view returns (uint256)',
  'function decimals() view returns (uint8)',
  'function symbol() view returns (string)',
] as const;

/** NPM ABI for position queries */
export const NPM_ABI = [
  'function positions(uint256 tokenId) view returns (uint96 nonce, address operator, address token0, address token1, uint24 fee, int24 tickLower, int24 tickUpper, uint128 liquidity, uint256 feeGrowthInside0LastX128, uint256 feeGrowthInside1LastX128, uint128 tokensOwed0, uint128 tokensOwed1)',
] as const;

// ─── DeFi product definitions ────────────────────────────────────────────────

export interface DefiProduct {
  id: string;
  name: string;
  nameCs: string;
  description: string;
  descriptionCs: string;
  contract: string;
  href: string;
  status: 'live' | 'testnet' | 'planned' | 'pending';
  icon: string;
  color: string;
  tags: string[];
}

export const DEFI_PRODUCTS: DefiProduct[] = [
  {
    id: 'bridge',
    name: 'wZION Bridge',
    nameCs: 'wZION Most',
    description: 'Lock ZION on L1, receive wZION ERC-20 on Base. Burn wZION to unlock back to L1. 1:1 peg, multi-validator relay.',
    descriptionCs: 'Zamkni ZION na L1, obdrž wZION ERC-20 na Base. Spal wZION pro odemčení zpět na L1. 1:1 peg, multi-validátorový relay.',
    contract: CONTRACTS.ZIONBridge,
    href: '/bridge',
    status: 'live',
    icon: 'bridge',
    color: 'from-zion-cyan to-zion-purple',
    tags: ['Lock/Mint', 'Burn/Unlock', 'Multi-sig', 'Timelock'],
  },
  {
    id: 'dex',
    name: 'wZION DEX Pools',
    nameCs: 'wZION DEX Pooly',
    description: 'Uniswap V3 concentrated liquidity pools on Base. Primary USDT pair (0.3% fee), secondary WETH pair (1% fee), and SOL pair (0.01% fee). All seeded at $0.0002/ZION.',
    descriptionCs: 'Uniswap V3 pooly s koncentrovanou likviditou na Base. Primární USDT pár (0.3% poplatek), sekundární WETH pár (1% poplatek) a SOL pár (0.01% poplatek). Všechny seednuté na $0.0002/ZION.',
    contract: CONTRACTS.UniV3PoolUSDT,
    href: '/defi',
    status: 'live',
    icon: 'dex',
    color: 'from-zion-cyan to-zion-purple',
    tags: ['Uniswap V3', 'USDT Primary', 'WETH', 'SOL', 'Active Liquidity'],
  },
  {
    id: 'farming',
    name: 'ZION Farm',
    nameCs: 'ZION Farm',
    description: 'MasterChef v2 LP farming. Deposit LP tokens, earn wZION rewards. 90-day halving schedule per pool with dynamic allocPoint rebalancing.',
    descriptionCs: 'MasterChef v2 LP farming. Vlož LP tokeny, získej wZION odměny. 90denní halving schedule na pool s dynamickým allocPoint.',
    contract: CONTRACTS.ZIONFarm,
    href: '/defi/farming',
    status: FARM_DEPLOYED ? 'live' : 'pending',
    icon: 'farm',
    color: 'from-zion-cyan to-zion-cyan',
    tags: ['MasterChef v2', 'LP Rewards', '90d Halving'],
  },
  {
    id: 'staking',
    name: 'ZION Staking',
    nameCs: 'ZION Staking',
    description: 'Stake wZION for fixed APR. Cooldown period for safe unstaking. Rewards funded from bridge fees and ecosystem allocation.',
    descriptionCs: 'Stakuj wZION za fixní APR. Cooldown pro bezpečný unstake. Odměny z bridge poplatků a ekosystémové alokace.',
    contract: CONTRACTS.ZIONStaking,
    href: '/defi/staking',
    status: STAKING_DEPLOYED ? 'live' : 'pending',
    icon: 'staking',
    color: 'from-zion-cyan to-zion-cyan',
    tags: ['APR', 'Cooldown', 'Reward Pool'],
  },
  {
    id: 'governance',
    name: 'Governance',
    nameCs: 'Governance',
    description: 'Token-weighted on-chain voting. Create proposals, vote, execute via timelock. Quorum-based decision making.',
    descriptionCs: 'On-chain hlasování váhou tokenů. Vytváření návrhů, hlasování, exekuce přes timelock. Rozhodování na kvórum.',
    contract: CONTRACTS.ZIONGovernance,
    href: '/defi/dao',
    status: GOVERNANCE_DEPLOYED ? 'live' : 'pending',
    icon: 'governance',
    color: 'from-zion-purple to-zion-purple',
    tags: ['Proposals', 'Voting', 'Timelock', 'Quorum'],
  },
];
