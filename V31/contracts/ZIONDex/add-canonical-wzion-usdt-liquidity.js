#!/usr/bin/env node
/**
 * Add canonical liquidity to the Uniswap V3 wZION/USDT pool on Base.
 *
 * Pool:  0x186b46c2f04153999d44D25179cD623fD62Bfda2 (0.3% fee)
 * wZION: 0x0c493763d107ab0ABb0aee1Ca3999292d8202bb6
 * USDT:  0xfde4C96c8593536E31F229EA8f37b2ADa2699bb2
 * NFT PositionManager: 0x03a520b32C04BF3bEEf7BEb72E919cf822Ed34f1
 *
 * Usage:
 *   DEPLOYER_KEY=0x... USDT_AMOUNT=1000 node add-canonical-wzion-usdt-liquidity.js
 *
 * The script uses all USDT_AMOUNT provided, computes matching wZION at the
 * current pool price, approves both tokens to the PositionManager, and mints
 * a full-range position.
 */

const { ethers } = require('ethers');

const fs = require('fs');

const RPC_URL = process.env.RPC_URL || 'https://mainnet.base.org';
const DEPLOYER_KEY = process.env.DEPLOYER_KEY || (
  process.env.DEPLOYER_KEY_FILE ? fs.readFileSync(process.env.DEPLOYER_KEY_FILE, 'utf8').trim() : undefined
);
const USDT_AMOUNT = process.env.USDT_AMOUNT; // human units, e.g. 1000
const ETH_MIN_ETH = process.env.ETH_MIN ? Number(process.env.ETH_MIN) : 0.0005; // Base gas is cheap

const POOL_ADDRESS = '0x186b46c2f04153999d44D25179cD623fD62Bfda2';
const NFT_POSITION_MANAGER = '0x03a520b32C04BF3bEEf7BEb72E919cf822Ed34f1';
const WZION = '0x0c493763d107ab0ABb0aee1Ca3999292d8202bb6';
const USDT = '0xfde4C96c8593536E31F229EA8f37b2ADa2699bb2';

// Full range for 0.3% fee (tickSpacing = 60)
const TICK_LOWER = -887220;
const TICK_UPPER = 887220;

const POOL_ABI = [
  'function slot0() external view returns (uint160 sqrtPriceX96, int24 tick, uint16 observationIndex, uint16 observationCardinality, uint16 observationCardinalityNext, uint8 feeProtocol, bool unlocked)',
  'function liquidity() external view returns (uint128)',
  'function token0() external view returns (address)',
  'function token1() external view returns (address)',
  'function fee() external view returns (uint24)',
];

const NFT_ABI = [
  'function mint((address token0, address token1, uint24 fee, int24 tickLower, int24 tickUpper, uint256 amount0Desired, uint256 amount1Desired, uint256 amount0Min, uint256 amount1Min, address recipient, uint256 deadline)) external payable returns (uint256 tokenId, uint128 liquidity, uint256 amount0, uint256 amount1)',
];

const ERC20_ABI = [
  'function balanceOf(address) view returns (uint256)',
  'function approve(address spender, uint256 amount) returns (bool)',
  'function allowance(address owner, address spender) view returns (uint256)',
  'function decimals() view returns (uint8)',
  'function symbol() view returns (string)',
];

function priceUsdtPerWzion(sqrtPriceX96, token0IsWzion) {
  const Q96 = 2n ** 96n;
  const sqrtNum = Number(sqrtPriceX96) / Number(Q96);
  const rawPrice = sqrtNum * sqrtNum;
  // token0 = wZION (18 dec), token1 = USDT (6 dec)
  return token0IsWzion ? rawPrice * 10 ** (18 - 6) : rawPrice;
}

async function main() {
  if (!DEPLOYER_KEY) {
    console.error('Set DEPLOYER_KEY env var');
    process.exit(1);
  }
  if (!USDT_AMOUNT || isNaN(Number(USDT_AMOUNT))) {
    console.error('Set USDT_AMOUNT env var (human USDT, e.g. 1000)');
    process.exit(1);
  }

  const provider = new ethers.JsonRpcProvider(RPC_URL);
  const deployer = new ethers.Wallet(DEPLOYER_KEY, provider);

  console.log('=== Canonical wZION/USDT UniV3 Liquidity Add ===');
  console.log('Network: Base Mainnet');
  console.log('Deployer:', deployer.address);

  const ethBal = await provider.getBalance(deployer.address);
  console.log('ETH:', ethers.formatEther(ethBal));

  if (ethBal < ethers.parseEther(String(ETH_MIN_ETH))) {
    console.error(`Need >= ${ETH_MIN_ETH} ETH for gas`);
    process.exit(1);
  }

  const wzion = new ethers.Contract(WZION, ERC20_ABI, deployer);
  const usdt = new ethers.Contract(USDT, ERC20_ABI, deployer);
  const pool = new ethers.Contract(POOL_ADDRESS, POOL_ABI, deployer);

  const token0 = await pool.token0();
  const token1 = await pool.token1();
  const fee = await pool.fee();
  const slot0 = await pool.slot0();
  const currentLiquidity = await pool.liquidity();
  const isWzionToken0 = token0.toLowerCase() === WZION.toLowerCase();

  const price = priceUsdtPerWzion(slot0.sqrtPriceX96, isWzionToken0);
  console.log(`\nPool: ${POOL_ADDRESS}`);
  console.log(` token0: ${token0} (${isWzionToken0 ? 'wZION' : 'USDT'})`);
  console.log(` token1: ${token1} (${isWzionToken0 ? 'USDT' : 'wZION'})`);
  console.log(` fee: ${Number(fee) / 10000}%`);
  console.log(` tick: ${slot0.tick}`);
  console.log(` sqrtPriceX96: ${slot0.sqrtPriceX96}`);
  console.log(` current liquidity: ${currentLiquidity}`);
  console.log(` price: ~$${price.toExponential(6)}/wZION`);

  const wzionBal = await wzion.balanceOf(deployer.address);
  const usdtBal = await usdt.balanceOf(deployer.address);
  console.log(`\nDeployer balances:`);
  console.log(` wZION: ${ethers.formatUnits(wzionBal, 18)}`);
  console.log(` USDT:  ${ethers.formatUnits(usdtBal, 6)}`);

  const usdtRaw = ethers.parseUnits(USDT_AMOUNT, 6);
  if (usdtBal < usdtRaw) {
    console.error(`Insufficient USDT: need ${USDT_AMOUNT}, have ${ethers.formatUnits(usdtBal, 6)}`);
    process.exit(1);
  }

  // wZION (human) = USDT (human) / price
  const usdtHuman = Number(USDT_AMOUNT);
  const wzionHuman = usdtHuman / price;
  const wzionRaw = ethers.parseUnits(String(Math.floor(wzionHuman * 1e12) / 1e12), 18);

  if (wzionBal < wzionRaw) {
    console.error(`Insufficient wZION: need ${ethers.formatUnits(wzionRaw, 18)}, have ${ethers.formatUnits(wzionBal, 18)}`);
    process.exit(1);
  }

  console.log(`\nAdding liquidity:`);
  console.log(` USDT:  ${USDT_AMOUNT} USDT`);
  console.log(` wZION: ${ethers.formatUnits(wzionRaw, 18)} wZION`);

  // Approve tokens to PositionManager
  const wzAllow = await wzion.allowance(deployer.address, NFT_POSITION_MANAGER);
  if (wzAllow < wzionRaw) {
    console.log('[1/2] Approving wZION...');
    const tx = await wzion.approve(NFT_POSITION_MANAGER, ethers.MaxUint256);
    await tx.wait();
    console.log('  tx:', tx.hash);
  } else {
    console.log(' wZION already approved');
  }

  const usdtAllow = await usdt.allowance(deployer.address, NFT_POSITION_MANAGER);
  if (usdtAllow < usdtRaw) {
    console.log('[2/2] Approving USDT...');
    const tx = await usdt.approve(NFT_POSITION_MANAGER, ethers.MaxUint256);
    await tx.wait();
    console.log('  tx:', tx.hash);
  } else {
    console.log(' USDT already approved');
  }

  // Mint position
  console.log('\nMinting full-range position...');
  const nftManager = new ethers.Contract(NFT_POSITION_MANAGER, NFT_ABI, deployer);

  const amount0Desired = isWzionToken0 ? wzionRaw : usdtRaw;
  const amount1Desired = isWzionToken0 ? usdtRaw : wzionRaw;

  const mintParams = {
    token0,
    token1,
    fee,
    tickLower: TICK_LOWER,
    tickUpper: TICK_UPPER,
    amount0Desired,
    amount1Desired,
    amount0Min: 0,
    amount1Min: 0,
    recipient: deployer.address,
    deadline: Math.floor(Date.now() / 1000) + 3600,
  };

  const tx = await nftManager.mint(mintParams);
  console.log(' TX:', tx.hash);
  const receipt = await tx.wait();

  // Parse IncreaseLiquidity event
  const increaseAbi = ['event IncreaseLiquidity(uint256 indexed tokenId, uint128 liquidity, uint256 amount0, uint256 amount1)'];
  const iface = new ethers.Interface(increaseAbi);
  let tokenId;
  for (const log of receipt.logs) {
    try {
      const parsed = iface.parseLog(log);
      if (parsed && parsed.args.tokenId) {
        tokenId = parsed.args.tokenId.toString();
        break;
      }
    } catch {}
  }

  console.log('\n=== Done ===');
  console.log(`NFT Position ID: ${tokenId || 'unknown'}`);
  console.log(`Pool:  https://basescan.org/address/${POOL_ADDRESS}`);
  console.log(`NFT:   https://basescan.org/address/${NFT_POSITION_MANAGER}`);
  console.log(`Tx:    https://basescan.org/tx/${tx.hash}`);
}

main().catch((e) => {
  console.error('Error:', e.reason || e.message || e);
  process.exit(1);
});
