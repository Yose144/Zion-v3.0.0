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
    live: true,
  },
  'base-mainnet': {
    id: 'base-mainnet',
    label: 'Base Mainnet',
    chainId: 8453,
    rpcUrl: 'https://mainnet.base.org',
    explorerBase: 'https://basescan.org',
    live: false,
  },
};

/** Currently active network */
export const ACTIVE_NETWORK: NetworkId = 'base-sepolia';
export const ACTIVE_CHAIN = CHAINS[ACTIVE_NETWORK];

// ─── Deployed contract addresses (Base Sepolia) ──────────────────────────────

export const CONTRACTS = {
  wZION:          '0x0c493763d107ab0ABb0aee1Ca3999292d8202bb6',
  ZIONBridge:     '0xF4BF85443ad6c9b88f3a5314cC3Fb59C32Cedca1',
  ZIONAtomicSwap: '0xAf1E0645Ac409485EDA5EabD87b4eE3C3a5BA3Fc',
  ZIONGovernance: '0x039F730e3e1c3f36da95187697118791762290a1',
  ZIONTreasury:   '0x178d85323dC94Ce2477269Dfb93a12D04B9bE537',
  ZIONStaking:    '0x487D87E243f87b1DDEEDEB890c40F2cEcCf67913',
  ZIONFarm:       '0x1B8BA92C401d53cBcEc422BAD4b83fABcb0A3843',
  UniV3Pool:      '0xcCEaD51568E8d701f7db7e6699F3986031F07C7B',
} as const;

export const DEPLOYER = '0xdde17506BC2D2dCE1d594bD1D85B0BAbb389D186';
export const VALIDATOR2 = '0x8cc6F931edDAf5F14D0071727Ed1640752B5c787';

// ─── Minimal ABIs ────────────────────────────────────────────────────────────

export const WZION_ABI = [
  'function name() view returns (string)',
  'function symbol() view returns (string)',
  'function decimals() view returns (uint8)',
  'function totalSupply() view returns (uint256)',
  'function balanceOf(address) view returns (uint256)',
  'function mintableSupply() view returns (uint256)',
  'function bridgeStats() view returns (uint256 totalMinted, uint256 totalBurned, uint256 netSupply)',
] as const;

export const STAKING_ABI = [
  'function totalStaked() view returns (uint256)',
  'function rewardPool() view returns (uint256)',
  'function annualRateBps() view returns (uint256)',
  'function cooldownPeriod() view returns (uint256)',
  'function paused() view returns (bool)',
  'function stakeInfo(address) view returns (uint256 amount, uint256 rewardDebt, uint256 lastStakeTime, uint256 unstakeRequestTime)',
] as const;

export const FARM_ABI = [
  'function rewardPerSecond() view returns (uint256)',
  'function poolLength() view returns (uint256)',
  'function totalAllocPoint() view returns (uint256)',
  'function poolInfo(uint256) view returns (address lpToken, uint256 allocPoint, uint256 lastRewardTime, uint256 accRewardPerShare)',
  'function paused() view returns (bool)',
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
  'function quorumBps() view returns (uint256)',
  'function paused() view returns (bool)',
] as const;

export const BRIDGE_ABI = [
  'function threshold() view returns (uint256)',
  'function validatorCount() view returns (uint256)',
  'function paused() view returns (bool)',
  'function dailyLimit() view returns (uint256)',
  'function dailyMinted() view returns (uint256)',
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
  status: 'live' | 'testnet' | 'planned';
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
    status: 'testnet',
    icon: 'bridge',
    color: 'from-cyan-500 to-blue-500',
    tags: ['Lock/Mint', 'Burn/Unlock', 'Multi-sig', 'Timelock'],
  },
  {
    id: 'staking',
    name: 'ZION Staking',
    nameCs: 'ZION Staking',
    description: 'Stake wZION for fixed 12% APR. 7-day cooldown period. Rewards funded from bridge fees and ecosystem allocation.',
    descriptionCs: 'Stakuj wZION za fixních 12% APR. 7denní cooldown. Odměny z bridge poplatků a ekosystémové alokace.',
    contract: CONTRACTS.ZIONStaking,
    href: '/defi#staking',
    status: 'testnet',
    icon: 'staking',
    color: 'from-emerald-500 to-green-500',
    tags: ['12% APR', '7d Cooldown', 'Reward Pool'],
  },
  {
    id: 'farm',
    name: 'ZION Farm',
    nameCs: 'ZION Farma',
    description: 'MasterChef-style yield farming. Stake wZION or LP tokens in pools. Halving schedule with emergency withdraw.',
    descriptionCs: 'Yield farming ve stylu MasterChef. Stakuj wZION nebo LP tokeny v poolech. Halving harmonogram s emergency výběrem.',
    contract: CONTRACTS.ZIONFarm,
    href: '/defi#farm',
    status: 'testnet',
    icon: 'farm',
    color: 'from-amber-500 to-yellow-500',
    tags: ['Multi-pool', 'Halving', 'LP Farming'],
  },
  {
    id: 'swap',
    name: 'Atomic Swap',
    nameCs: 'Atomický Swap',
    description: 'Hash Time-Locked Contract (HTLC) swaps between ZION L1 and Base EVM. Trustless, no intermediary.',
    descriptionCs: 'HTLC swapy mezi ZION L1 a Base EVM. Trustless, bez prostředníka.',
    contract: CONTRACTS.ZIONAtomicSwap,
    href: '/defi#swap',
    status: 'testnet',
    icon: 'swap',
    color: 'from-purple-500 to-pink-500',
    tags: ['HTLC', 'Trustless', 'Cross-chain'],
  },
  {
    id: 'dex',
    name: 'wZION/WETH Pool',
    nameCs: 'wZION/WETH Pool',
    description: 'Uniswap V3 concentrated liquidity pool. Trade wZION for WETH and vice-versa. 0.3% fee tier.',
    descriptionCs: 'Uniswap V3 pool s koncentrovanou likviditou. Obchoduj wZION za WETH a zpět. 0.3% poplatek.',
    contract: CONTRACTS.UniV3Pool,
    href: '/defi#dex',
    status: 'testnet',
    icon: 'dex',
    color: 'from-sky-500 to-indigo-500',
    tags: ['Uniswap V3', '0.3% Fee', 'Concentrated LP'],
  },
  {
    id: 'governance',
    name: 'Governance',
    nameCs: 'Governance',
    description: 'Token-weighted on-chain voting. Create proposals, vote, execute via timelock. Quorum-based decision making.',
    descriptionCs: 'On-chain hlasování váhou tokenů. Vytváření návrhů, hlasování, exekuce přes timelock. Rozhodování na kvórum.',
    contract: CONTRACTS.ZIONGovernance,
    href: '/dao',
    status: 'testnet',
    icon: 'governance',
    color: 'from-rose-500 to-red-500',
    tags: ['Proposals', 'Voting', 'Timelock', 'Quorum'],
  },
];
