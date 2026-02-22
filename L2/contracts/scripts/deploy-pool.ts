/**
 * DEX-01 — Deploy & Initialize wZION/WETH Uniswap V3 Pool
 *
 * Steps:
 *   1. Load config (network-aware)
 *   2. Determine token order (token0 < token1 by address)
 *   3. Call Factory.createPool(wZION, WETH, fee)
 *   4. Call Pool.initialize(sqrtPriceX96)
 *   5. Print pool address + initial tick for handoff to seed-liquidity.ts
 *
 * Usage:
 *   npx hardhat run scripts/deploy-pool.ts --network base-sepolia
 *   npx hardhat run scripts/deploy-pool.ts --network base
 *
 * Env vars:
 *   WZION_ADDRESS_SEPOLIA  — wZION address on Base Sepolia
 *   WZION_ADDRESS_MAINNET  — wZION address on Base Mainnet
 *   DEPLOYER_PRIVATE_KEY   — signer private key (set in .env)
 */

import { ethers, network } from "hardhat";
import {
  getConfig,
  FACTORY_ABI,
  POOL_ABI,
  computeSqrtPriceX96,
  tickFromSqrtPriceX96,
  TICK_SPACINGS,
} from "./dex-config";

async function main() {
  const networkName = network.name;
  console.log(`\n🚀 Deploy wZION/WETH Uniswap V3 Pool — network: ${networkName}`);

  const cfg = getConfig(networkName);
  const [deployer] = await ethers.getSigners();
  console.log(`Deployer: ${deployer.address}`);
  console.log(`wZION:    ${cfg.wzionAddress}`);
  console.log(`WETH:     ${cfg.wethAddress}`);
  console.log(`Fee tier: ${cfg.feeTier} (${cfg.feeTier / 10000}%)`);

  // ── 1. Factory ──────────────────────────────────────────────────────────────
  const factory = new ethers.Contract(cfg.uniswapV3Factory, FACTORY_ABI, deployer);

  // ── 2. Check if pool already exists ────────────────────────────────────────
  let poolAddress: string = await factory.getPool(
    cfg.wzionAddress,
    cfg.wethAddress,
    cfg.feeTier
  );

  if (poolAddress !== ethers.ZeroAddress) {
    console.log(`\n✅ Pool already exists: ${poolAddress}`);
    await printPoolState(poolAddress, deployer);
    return;
  }

  // ── 3. Create pool ──────────────────────────────────────────────────────────
  console.log(`\nCreating pool...`);
  const createTx = await factory.createPool(
    cfg.wzionAddress,
    cfg.wethAddress,
    cfg.feeTier
  );
  const receipt = await createTx.wait();
  console.log(`createPool tx: ${createTx.hash}`);

  poolAddress = await factory.getPool(
    cfg.wzionAddress,
    cfg.wethAddress,
    cfg.feeTier
  );

  if (poolAddress === ethers.ZeroAddress) {
    throw new Error("Pool creation failed — address still zero after tx");
  }
  console.log(`Pool deployed at: ${poolAddress}`);

  // ── 4. Determine token order ────────────────────────────────────────────────
  const pool = new ethers.Contract(poolAddress, POOL_ABI, deployer);
  const token0 = await pool.token0();
  const token0IsWzion =
    token0.toLowerCase() === cfg.wzionAddress.toLowerCase();

  console.log(`token0: ${token0} ${token0IsWzion ? "(wZION)" : "(WETH)"}`);
  console.log(`token1: ${token0IsWzion ? cfg.wethAddress : cfg.wzionAddress}`);

  // ── 5. Compute initial price ────────────────────────────────────────────────
  const sqrtPriceX96 = computeSqrtPriceX96(
    cfg.initialPriceWethPerWzion,
    token0IsWzion
  );

  const initialTick = tickFromSqrtPriceX96(sqrtPriceX96);
  const tickSpacing = TICK_SPACINGS[cfg.feeTier];
  console.log(`\nInitial price: 1 wZION = ${formatEther(cfg.initialPriceWethPerWzion)} WETH`);
  console.log(`sqrtPriceX96:  ${sqrtPriceX96.toString()}`);
  console.log(`Initial tick:  ${initialTick} (tickSpacing: ${tickSpacing})`);

  // ── 6. Initialize pool ──────────────────────────────────────────────────────
  console.log(`\nInitializing pool...`);
  const initTx = await pool.initialize(sqrtPriceX96);
  await initTx.wait();
  console.log(`initialize tx: ${initTx.hash}`);

  // ── 7. Print state ──────────────────────────────────────────────────────────
  await printPoolState(poolAddress, deployer);

  console.log(`\n✅ Pool ready!`);
  console.log(`Pool address: ${poolAddress}`);
  console.log(`\n📋 Next step:`);
  console.log(`  Set POOL_ADDRESS=${poolAddress} in .env`);
  console.log(`  Run: npx hardhat run scripts/seed-liquidity.ts --network ${networkName}`);
}

async function printPoolState(poolAddress: string, signer: ethers.Signer) {
  const pool = new ethers.Contract(poolAddress, POOL_ABI, signer);
  try {
    const slot0 = await pool.slot0();
    const liquidity = await pool.liquidity();
    console.log(`\nPool state:`);
    console.log(`  sqrtPriceX96: ${slot0.sqrtPriceX96.toString()}`);
    console.log(`  tick:         ${slot0.tick}`);
    console.log(`  liquidity:    ${liquidity.toString()}`);
  } catch {
    console.log("Pool not yet initialized (slot0 call failed).");
  }
}

function formatEther(wei: bigint): string {
  const eth = Number(wei) / 1e18;
  return eth.toFixed(8);
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
