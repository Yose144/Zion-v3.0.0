/**
 * wZION/USDC AMM pair creation + liquidity on ZIONDex.
 * Uses real wZION + real USDC (Coinbase) on Base Mainnet.
 *
 * Usage:
 *   DEPLOYER_KEY=0x... node add-wzion-liquidity.js
 */

const fs = require('fs');
const path = require('path');

const RPC_URL = process.env.RPC_URL || 'https://mainnet.base.org';
const DEPLOYER_KEY = process.env.DEPLOYER_KEY;

const buildDir = path.join(__dirname, 'build');

const FACTORY_ADDR = '0x9F57998CC5Cb2a53426068c707Beac110966F351';
const PAIR_ADDR_HARDCODED = ''; // will be set from event

// Real tokens on Base Mainnet
const WZION_ADDR = '0x0c493763d107ab0ABb0aee1Ca3999292d8202bb6';  // 18 decimals
const USDC_ADDR  = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913';  // 6 decimals (Coinbase USDC)

const ERC20_ABI = [
  'function balanceOf(address) view returns (uint256)',
  'function decimals() view returns (uint8)',
  'function transfer(address to, uint256 amount) returns (bool)',
  'function approve(address spender, uint256 amount) returns (bool)',
];

const FACTORY_ABI = JSON.parse(fs.readFileSync(path.join(buildDir, 'ZIONDexFactory_ZIONDexFactory.abi'), 'utf8'));
const PAIR_ABI = JSON.parse(fs.readFileSync(path.join(buildDir, 'ZIONDexPair_ZIONDexPair.abi'), 'utf8'));

async function main() {
  const ethers = require('ethers');
  if (!DEPLOYER_KEY) { console.error('DEPLOYER_KEY required'); process.exit(1); }

  const provider = new ethers.JsonRpcProvider(RPC_URL);
  const deployer = new ethers.Wallet(DEPLOYER_KEY, provider);

  console.log(`Deployer: ${deployer.address}`);
  console.log(`ETH balance: ${ethers.formatEther(await provider.getBalance(deployer.address))}`);

  const wZion = new ethers.Contract(WZION_ADDR, ERC20_ABI, deployer);
  const usdc = new ethers.Contract(USDC_ADDR, ERC20_ABI, deployer);
  const factory = new ethers.Contract(FACTORY_ADDR, FACTORY_ABI, deployer);

  const wZionDec = await wZion.decimals();
  const usdcDec = await usdc.decimals();
  const wZionBal = await wZion.balanceOf(deployer.address);
  const usdcBal = await usdc.balanceOf(deployer.address);

  console.log(`\nwZION balance: ${ethers.formatUnits(wZionBal, wZionDec)} (${wZionDec} decimals)`);
  console.log(`USDC balance: ${ethers.formatUnits(usdcBal, usdcDec)} (${usdcDec} decimals)`);

  // Use all available USDC + proportional wZION
  // Price: 1 wZION = ~0.0055 USDC (based on existing Uniswap V3 pool)
  // With 0.5487 USDC, we'd need ~100 wZION
  // But let's use a round number: all USDC + 1000 wZION
  const usdcAmount = usdcBal;  // use all USDC
  const wZionAmount = ethers.parseUnits('1000', wZionDec);  // 1000 wZION

  console.log(`\nAdding liquidity: ${ethers.formatUnits(wZionAmount, wZionDec)} wZION + ${ethers.formatUnits(usdcAmount, usdcDec)} USDC`);

  // Create pair
  console.log('\nCreating wZION/USDC pair...');
  const createTx = await factory.createPair(WZION_ADDR, USDC_ADDR);
  console.log(`Create tx: ${createTx.hash}`);
  const receipt = await createTx.wait();
  console.log(`Pair created in block ${receipt.blockNumber}`);

  // Extract pair address from PairCreated event
  let pairAddr = ethers.ZeroAddress;
  for (const log of receipt.logs) {
    try {
      const parsed = factory.interface.parseLog(log);
      if (parsed && parsed.name === 'PairCreated') {
        pairAddr = parsed.args.pair || parsed.args[2];
        break;
      }
    } catch {}
  }
  console.log(`Pair address: ${pairAddr}`);

  if (pairAddr === ethers.ZeroAddress) {
    // Maybe pair already exists — try pairFor
    pairAddr = await factory.pairFor(WZION_ADDR, USDC_ADDR);
    console.log(`pairFor result: ${pairAddr}`);
  }

  // Transfer tokens directly to pair (bypass router transferFrom issues)
  console.log('\nTransferring wZION to pair...');
  const tx1 = await wZion.transfer(pairAddr, wZionAmount);
  await tx1.wait();
  console.log('wZION transferred');

  console.log('Transferring USDC to pair...');
  const tx2 = await usdc.transfer(pairAddr, usdcAmount);
  await tx2.wait();
  console.log('USDC transferred');

  // Call pair.addLiquidity(amount0, amount1)
  // token0 is the one with lower address
  const token0IsWZion = WZION_ADDR.toLowerCase() < USDC_ADDR.toLowerCase();
  const amount0 = token0IsWZion ? wZionAmount : usdcAmount;
  const amount1 = token0IsWZion ? usdcAmount : wZionAmount;

  console.log(`\ntoken0 is ${token0IsWZion ? 'wZION' : 'USDC'}`);
  console.log('Calling pair.addLiquidity...');
  const pair = new ethers.Contract(pairAddr, PAIR_ABI, deployer);
  const liqTx = await pair.addLiquidity(amount0, amount1);
  console.log(`Liquidity tx: ${liqTx.hash}`);
  const liqReceipt = await liqTx.wait();
  console.log(`Liquidity added in block ${liqReceipt.blockNumber}, gas: ${liqReceipt.gasUsed}`);

  // Check reserves
  const [reserve0, reserve1] = await pair.getReserves();
  const totalSupply = await pair.totalSupply();
  const lpBal = await pair.balanceOf(deployer.address);

  console.log(`\n── Pair State ──────────────────────`);
  console.log(`Pair: ${pairAddr}`);
  console.log(`Reserve0 (${token0IsWZion ? 'wZION' : 'USDC'}): ${ethers.formatUnits(reserve0, token0IsWZion ? wZionDec : usdcDec)}`);
  console.log(`Reserve1 (${token0IsWZion ? 'USDC' : 'wZION'}): ${ethers.formatUnits(reserve1, token0IsWZion ? usdcDec : wZionDec)}`);
  console.log(`LP total supply: ${ethers.formatUnits(totalSupply, 18)}`);
  console.log(`Deployer LP balance: ${ethers.formatUnits(lpBal, 18)}`);
  console.log(`───────────────────────────────────`);
  console.log('\n✅ wZION/USDC pair created and liquidity added!');
  console.log(`Update defi-contracts.ts: ZIONDexPairWZionUSDC: '${pairAddr}'`);
}

main().catch(e => { console.error('Error:', e.message); process.exit(1); });
