/**
 * ZIONDex AMM setup (direct) — adds liquidity by transferring tokens
 * directly to the pair and calling pair.addLiquidity(), bypassing the router.
 *
 * This avoids transferFrom issues with non-standard test tokens.
 *
 * Usage:
 *   DEPLOYER_KEY=0x... node add-liquidity-direct.js
 */

const fs = require('fs');
const path = require('path');

const RPC_URL = process.env.RPC_URL || 'https://mainnet.base.org';
const DEPLOYER_KEY = process.env.DEPLOYER_KEY;

const buildDir = path.join(__dirname, 'build');

const PAIR_ADDR  = '0x1fE64df93226b8434877D5826aE2DCEda171e39E';
const TZION_ADDR = '0xC5E79b8C6475137aC3a982651097a219B63b0c33';  // 18 decimals
const TUSDT_ADDR = '0x677693fbFDe6a9EeA655033fffF93054B559552C';  // 6 decimals

const ERC20_ABI = [
  'function balanceOf(address) view returns (uint256)',
  'function decimals() view returns (uint8)',
  'function transfer(address to, uint256 amount) returns (bool)',
];

const PAIR_ABI = JSON.parse(fs.readFileSync(path.join(buildDir, 'ZIONDexPair_ZIONDexPair.abi'), 'utf8'));

async function main() {
  const ethers = require('ethers');
  if (!DEPLOYER_KEY) { console.error('DEPLOYER_KEY required'); process.exit(1); }

  const provider = new ethers.JsonRpcProvider(RPC_URL);
  const deployer = new ethers.Wallet(DEPLOYER_KEY, provider);

  console.log(`Deployer: ${deployer.address}`);
  console.log(`ETH balance: ${ethers.formatEther(await provider.getBalance(deployer.address))}`);

  const tZion = new ethers.Contract(TZION_ADDR, ERC20_ABI, deployer);
  const tUsdt = new ethers.Contract(TUSDT_ADDR, ERC20_ABI, deployer);
  const pair = new ethers.Contract(PAIR_ADDR, PAIR_ABI, deployer);

  const tZionDec = await tZion.decimals();
  const tUsdtDec = await tUsdt.decimals();

  // Amounts: 100k tZION + 1k tUSDT
  const tZionAmount = ethers.parseUnits('100000', tZionDec);
  const tUsdtAmount = ethers.parseUnits('1000', tUsdtDec);

  console.log(`\nAdding liquidity directly to pair: ${PAIR_ADDR}`);
  console.log(`tZION: ${ethers.formatUnits(tZionAmount, tZionDec)}`);
  console.log(`tUSDT: ${ethers.formatUnits(tUsdtAmount, tUsdtDec)}`);

  // Step 1: Transfer tokens directly to the pair
  console.log('\nTransferring tZION to pair...');
  const tx1 = await tZion.transfer(PAIR_ADDR, tZionAmount);
  await tx1.wait();
  console.log('tZION transferred');

  console.log('Transferring tUSDT to pair...');
  const tx2 = await tUsdt.transfer(PAIR_ADDR, tUsdtAmount);
  await tx2.wait();
  console.log('tUSDT transferred');

  // Step 2: Call pair.addLiquidity(amount0, amount1)
  // Need to determine which token is token0 and which is token1
  // token0 is the one with the lower address
  const token0IsZion = TZION_ADDR.toLowerCase() < TUSDT_ADDR.toLowerCase();
  const amount0 = token0IsZion ? tZionAmount : tUsdtAmount;
  const amount1 = token0IsZion ? tUsdtAmount : tZionAmount;

  console.log(`\ntoken0 is ${token0IsZion ? 'tZION' : 'tUSDT'}`);
  console.log('Calling pair.addLiquidity...');
  const liqTx = await pair.addLiquidity(amount0, amount1);
  console.log(`Liquidity tx: ${liqTx.hash}`);
  const receipt = await liqTx.wait();
  console.log(`Liquidity added in block ${receipt.blockNumber}, gas: ${receipt.gasUsed}`);

  // Check reserves
  const [reserve0, reserve1] = await pair.getReserves();
  const totalSupply = await pair.totalSupply();
  console.log(`\n── Pair State ──────────────────────`);
  console.log(`Reserve0: ${ethers.formatUnits(reserve0, token0IsZion ? tZionDec : tUsdtDec)}`);
  console.log(`Reserve1: ${ethers.formatUnits(reserve1, token0IsZion ? tUsdtDec : tZionDec)}`);
  console.log(`LP total supply: ${ethers.formatUnits(totalSupply, 18)}`);
  console.log(`───────────────────────────────────`);
  console.log('\n✅ Liquidity added successfully!');
}

main().catch(e => { console.error('Error:', e.message); process.exit(1); });
