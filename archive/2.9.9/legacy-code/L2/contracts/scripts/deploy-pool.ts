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
    console.log(`\nPool already exists: ${poolAddress} — checking if initialized...`);
    const existingPool = new ethers.Contract(poolAddress, POOL_ABI, deployer);
    const slot0 = await existingPool.slot0();
    if (slot0.sqrtPriceX96 !== 0n) {
      console.log(`✅ Pool already initialized: ${poolAddress}`);
      await printPoolState(poolAddress, deployer);
      return;
    }
    console.log(`⚠️  Pool exists but NOT initialized — running initialize...`);
  }

  // ── 3. Create pool (skip if already exists) ────────────────────────────────
  if (poolAddress === ethers.ZeroAddress) {
  console.log(`\nCreating pool...`);
  const createTx = await factory.createPool(
    cfg.wzionAddress,
    cfg.wethAddress,
    cfg.feeTier
  );
  const receipt = await createTx.wait(2); // wait 2 confirmations
  console.log(`createPool tx: ${createTx.hash} (status: ${receipt?.status})`);

  // Retry getPool up to 10 times with 3 s delay
  for (let i = 0; i < 10; i++) {
    poolAddress = await factory.getPool(
      cfg.wzionAddress,
      cfg.wethAddress,
      cfg.feeTier
    );
    if (poolAddress !== ethers.ZeroAddress) break;
    console.log(`  getPool returned zero, retry ${i + 1}/10...`);
    await new Promise((r) => setTimeout(r, 3000));
  }

  if (poolAddress === ethers.ZeroAddress) {
    // Extract pool from PoolCreated event as fallback
    const iface = new ethers.Interface([
      "event PoolCreated(address indexed token0, address indexed token1, uint24 indexed fee, int24 tickSpacing, address pool)"
    ]);
    const logs = receipt?.logs ?? [];
    for (const log of logs) {
      try {
        const parsed = iface.parseLog({ topics: [...log.topics], data: log.data });
        if (parsed?.name === "PoolCreated") {
          poolAddress = parsed.args.pool as string;
          console.log(`Pool address recovered from event: ${poolAddress}`);
          break;
        }
      } catch { /* not this event */ }
    }
  }

  if (poolAddress === ethers.ZeroAddress) {
    throw new Error("Pool creation failed — address still zero after tx + retries");
  }
  console.log(`Pool deployed at: ${poolAddress}`);
  } // end create-pool block

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

  // ── 6. Initialize pool (re-check, prev tx may have landed) ─────────────────
  const slot0Check = await pool.slot0();
  if (slot0Check.sqrtPriceX96 !== 0n) {
    console.log(`\nPool already initialized (sqrtPriceX96: ${slot0Check.sqrtPriceX96})`);
  } else {
  console.log(`\nInitializing pool...`);
  const initTx = await pool.initialize(sqrtPriceX96);
  const initReceipt = await initTx.wait(2);
  console.log(`initialize tx: ${initTx.hash} (status: ${initReceipt?.status})`);
  if (initReceipt?.status === 0) throw new Error("initialize() reverted");
  await new Promise((r) => setTimeout(r, 3000)); // let RPC index the new state
  }

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
