/**
 * ZIONDex AMM setup — creates a pair and adds initial liquidity.
 *
 * Usage:
 *   DEPLOYER_KEY=0x... node add-liquidity.js
 *
 * Creates tZION/tUSDT pair via ZIONDexFactory, then adds liquidity
 * via ZIONDexRouter.
 */

const fs = require('fs');
const path = require('path');

const RPC_URL = process.env.RPC_URL || 'https://mainnet.base.org';
const DEPLOYER_KEY = process.env.DEPLOYER_KEY;

const buildDir = path.join(__dirname, 'build');

// Contract addresses (Base Mainnet)
const FACTORY_ADDR = '0x9F57998CC5Cb2a53426068c707Beac110966F351';
const ROUTER_ADDR  = '0x7A2Ef5dDCD6278E2500F34a0cd1F241a6Da76662';

// Test token addresses (Base Mainnet)
const TZION_ADDR  = '0xC5E79b8C6475137aC3a982651097a219B63b0c33';  // 18 decimals
const TUSDT_ADDR  = '0x677693fbFDe6a9EeA655033fffF93054B559552C';  // 6 decimals

const ERC20_ABI = [
  'function balanceOf(address) view returns (uint256)',
  'function decimals() view returns (uint8)',
  'function approve(address spender, uint256 amount) returns (bool)',
  'function allowance(address owner, address spender) view returns (uint256)',
];

const FACTORY_ABI = JSON.parse(fs.readFileSync(path.join(buildDir, 'ZIONDexFactory_ZIONDexFactory.abi'), 'utf8'));
const ROUTER_ABI = JSON.parse(fs.readFileSync(path.join(buildDir, 'ZIONDexRouter_ZIONDexRouter.abi'), 'utf8'));

async function main() {
  let ethers;
  try { ethers = require('ethers'); } catch {
    console.error('ethers not installed. Run: npm install ethers');
    process.exit(1);
  }

  if (!DEPLOYER_KEY) {
    console.error('DEPLOYER_KEY required. Set DEPLOYER_KEY=0x...');
    process.exit(1);
  }

  const provider = new ethers.JsonRpcProvider(RPC_URL);
  const deployer = new ethers.Wallet(DEPLOYER_KEY, provider);

  console.log(`Deployer: ${deployer.address}`);
  const balance = await provider.getBalance(deployer.address);
  console.log(`ETH balance: ${ethers.formatEther(balance)}`);

  const factory = new ethers.Contract(FACTORY_ADDR, FACTORY_ABI, deployer);
  const router = new ethers.Contract(ROUTER_ADDR, ROUTER_ABI, deployer);
  const tZion = new ethers.Contract(TZION_ADDR, ERC20_ABI, deployer);
  const tUsdt = new ethers.Contract(TUSDT_ADDR, ERC20_ABI, deployer);

  // ── Check token balances ──
  const tZionBal = await tZion.balanceOf(deployer.address);
  const tUsdtBal = await tUsdt.balanceOf(deployer.address);
  const tZionDec = await tZion.decimals();
  const tUsdtDec = await tUsdt.decimals();
  console.log(`\ntZION balance: ${ethers.formatUnits(tZionBal, tZionDec)} (${tZionDec} decimals)`);
  console.log(`tUSDT balance: ${ethers.formatUnits(tUsdtBal, tUsdtDec)} (${tUsdtDec} decimals)`);

  // ── Check if pair already exists ──
  // Pair was created in tx 0x9422575... at block 50769079
  let pairAddr = '0x1fE64df93226b8434877D5826aE2DCEda171e39E';
  console.log(`\nPair address: ${pairAddr}`);

  // ── Add liquidity ──
  // Use 100,000 tZION + 1,000 tUSDT (1 tZION = 0.01 tUSDT initial price)
  const tZionAmount = ethers.parseUnits('100000', tZionDec);  // 100k tZION
  const tUsdtAmount = ethers.parseUnits('1000', tUsdtDec);    // 1k tUSDT

  console.log(`\nAdding liquidity: ${ethers.formatUnits(tZionAmount, tZionDec)} tZION + ${ethers.formatUnits(tUsdtAmount, tUsdtDec)} tUSDT`);

  // Approve router to spend tokens (unconditionally — some test tokens
  // have non-standard allowance that fails on view calls)
  console.log('Approving tZION...');
  const approveTx1 = await tZion.approve(ROUTER_ADDR, tZionAmount);
  await approveTx1.wait();
  console.log('tZION approved');

  console.log('Approving tUSDT...');
  const approveTx2 = await tUsdt.approve(ROUTER_ADDR, tUsdtAmount);
  await approveTx2.wait();
  console.log('tUSDT approved');

  // Add liquidity via router
  // addLiquidity(tokenA, tokenB, amountADesired, amountBDesired, amountAMin, amountBMin, to, deadline)
  const deadline = Math.floor(Date.now() / 1000) + 600; // 10 min
  console.log('\nAdding liquidity via router...');
  const liqTx = await router.addLiquidity(
    TZION_ADDR,
    TUSDT_ADDR,
    tZionAmount,
    tUsdtAmount,
    tZionAmount * 99n / 100n,  // 1% slippage
    tUsdtAmount * 99n / 100n,
    deployer.address,
    deadline
  );
  console.log(`Liquidity tx: ${liqTx.hash}`);
  const liqReceipt = await liqTx.wait();
  console.log(`Liquidity added in block ${liqReceipt.blockNumber}`);

  // ── Check pair reserves ──
  const PAIR_ABI = [
    'function getReserves() view returns (uint112, uint112, uint32)',
    'function totalSupply() view returns (uint256)',
  ];
  const pair = new ethers.Contract(pairAddr, PAIR_ABI, provider);
  const [reserve0, reserve1] = await pair.getReserves();
  const totalSupply = await pair.totalSupply();
  console.log(`\n── Pair State ──────────────────────`);
  console.log(`Pair: ${pairAddr}`);
  console.log(`Reserve0: ${ethers.formatUnits(reserve0, tZionDec)}`);
  console.log(`Reserve1: ${ethers.formatUnits(reserve1, tUsdtDec)}`);
  console.log(`LP total supply: ${ethers.formatUnits(totalSupply, 18)}`);
  console.log(`───────────────────────────────────`);

  console.log('\n✅ AMM pair created and liquidity added!');
  console.log(`Update defi-contracts.ts: ZIONDexPairTZionTUsdt: '${pairAddr}'`);
}

main().catch(e => {
  console.error('Error:', e.message);
  process.exit(1);
});
