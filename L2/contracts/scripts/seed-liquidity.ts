/**
 * DEX-02 — Seed Initial Liquidity for wZION/WETH Uniswap V3 Pool
 *
 * Adds a full-range liquidity position via NonfungiblePositionManager.
 * "Full-range" = tickLower = MIN_TICK_ROUNDED, tickUpper = MAX_TICK_ROUNDED.
 * This maximizes price discovery range at the cost of higher impermanent loss.
 *
 * Steps:
 *   1. Read pool address from env / config
 *   2. Confirm pool is initialized (slot0.sqrtPriceX96 > 0)
 *   3. Approve NonfungiblePositionManager to spend our tokens
 *   4. Call PositionManager.mint() with desired amounts
 *   5. Print tokenId + actual amounts deposited
 *
 * Usage:
 *   POOL_ADDRESS=0x... WZION_SEED_AMOUNT=100000 ETH_SEED_AMOUNT=10 \
 *   npx hardhat run scripts/seed-liquidity.ts --network base-sepolia
 *
 * Env vars required:
 *   POOL_ADDRESS            — address of the deployed wZION/WETH V3 pool
 *   WZION_SEED_AMOUNT       — wZION to seed (default: "50000", whole tokens)
 *   ETH_SEED_AMOUNT         — WETH to seed (default: "5", whole ETH)
 *   WZION_ADDRESS_SEPOLIA   — wZION address (if not using dex-config default)
 *   DEPLOYER_PRIVATE_KEY    — signer private key (set in .env)
 */

import { ethers, network } from "hardhat";
import {
  getConfig,
  POOL_ABI,
  POSITION_MANAGER_ABI,
  ERC20_ABI,
  tickFromSqrtPriceX96,
  roundTick,
  TICK_SPACINGS,
  MIN_TICK,
  MAX_TICK,
} from "./dex-config";

const DEFAULT_WZION_SEED = "50000"; // 50,000 wZION
const DEFAULT_ETH_SEED = "5"; // 5 ETH worth of WETH

async function main() {
  const networkName = network.name;
  console.log(`\n💧 Seed wZION/WETH Uniswap V3 Liquidity — network: ${networkName}`);

  const cfg = getConfig(networkName);
  const [deployer] = await ethers.getSigners();
  console.log(`Deployer: ${deployer.address}`);

  // ── 1. Pool address ─────────────────────────────────────────────────────────
  const poolAddress = process.env.POOL_ADDRESS;
  if (!poolAddress || poolAddress === "0x0000000000000000000000000000000000000000") {
    throw new Error("Set POOL_ADDRESS env var to the deployed V3 pool address.");
  }
  console.log(`Pool:     ${poolAddress}`);

  // ── 2. Verify pool is initialized ───────────────────────────────────────────
  const pool = new ethers.Contract(poolAddress, POOL_ABI, deployer);
  const slot0 = await pool.slot0();
  if (slot0.sqrtPriceX96 === 0n) {
    throw new Error("Pool not initialized. Run deploy-pool.ts first.");
  }
  const currentTick = Number(slot0.tick);
  const tickSpacing = TICK_SPACINGS[cfg.feeTier];
  console.log(`Current tick: ${currentTick}, sqrtPriceX96: ${slot0.sqrtPriceX96}`);

  // ── 3. Read token order ──────────────────────────────────────────────────────
  const token0: string = await pool.token0();
  const token1: string = await pool.token1();
  const token0IsWzion = token0.toLowerCase() === cfg.wzionAddress.toLowerCase();
  console.log(`token0: ${token0} ${token0IsWzion ? "(wZION)" : "(WETH)"}`);
  console.log(`token1: ${token1} ${token0IsWzion ? "(WETH)" : "(wZION)"}`);

  // ── 4. Parse seed amounts ───────────────────────────────────────────────────
  const wzionSeedWhole = process.env.WZION_SEED_AMOUNT || DEFAULT_WZION_SEED;
  const ethSeedWhole = process.env.ETH_SEED_AMOUNT || DEFAULT_ETH_SEED;
  const wzionAmount = ethers.parseEther(wzionSeedWhole);
  const wethAmount = ethers.parseEther(ethSeedWhole);

  console.log(`\nSeed amounts:`);
  console.log(`  wZION: ${wzionSeedWhole} (${wzionAmount.toString()} wei)`);
  console.log(`  WETH:  ${ethSeedWhole} (${wethAmount.toString()} wei)`);

  const amount0Desired = token0IsWzion ? wzionAmount : wethAmount;
  const amount1Desired = token0IsWzion ? wethAmount : wzionAmount;

  // ── 5. Check balances ───────────────────────────────────────────────────────
  const wzionContract = new ethers.Contract(cfg.wzionAddress, ERC20_ABI, deployer);
  const wethContract = new ethers.Contract(cfg.wethAddress, ERC20_ABI, deployer);

  const wzionBalance = await wzionContract.balanceOf(deployer.address);
  const wethBalance = await wethContract.balanceOf(deployer.address);
  console.log(`\nBalances:`);
  console.log(`  wZION: ${ethers.formatEther(wzionBalance)}`);
  console.log(`  WETH:  ${ethers.formatEther(wethBalance)}`);

  if (wzionBalance < wzionAmount) {
    console.warn(`⚠️  Insufficient wZION. Have: ${ethers.formatEther(wzionBalance)}, need: ${wzionSeedWhole}`);
  }
  if (wethBalance < wethAmount) {
    console.warn(`⚠️  Insufficient WETH. Have: ${ethers.formatEther(wethBalance)}, need: ${ethSeedWhole}`);
    console.warn("    Tip: Deposit ETH into WETH contract first, or use wrapEth.ts helper.");
  }

  // ── 6. Approve PositionManager ───────────────────────────────────────────────
  const pm = cfg.uniswapV3NonfungiblePositionManager;
  console.log(`\nApproving NonfungiblePositionManager: ${pm}`);

  const approveTx0 = await wzionContract.approve(pm, wzionAmount);
  await approveTx0.wait();
  console.log(`  wZION approve: ${approveTx0.hash}`);

  const approveTx1 = await wethContract.approve(pm, wethAmount);
  await approveTx1.wait();
  console.log(`  WETH approve:  ${approveTx1.hash}`);

  // ── 7. Compute tick range (full-range, rounded to tickSpacing) ──────────────
  // Must use ceil for lower (rounds toward 0) and floor for upper (rounds toward 0)
  // Math.round would produce -887280 which exceeds MIN_TICK (-887272) → revert "T"
  const tickLower = Math.ceil(MIN_TICK / tickSpacing) * tickSpacing;  // e.g. -887220 for spacing=60
  const tickUpper = Math.floor(MAX_TICK / tickSpacing) * tickSpacing; // e.g.  887220 for spacing=60
  console.log(`\nTick range: [${tickLower}, ${tickUpper}] (full-range)`);

  // ── 8. Mint position ────────────────────────────────────────────────────────
  const positionManager = new ethers.Contract(pm, POSITION_MANAGER_ABI, deployer);
  const deadline = Math.floor(Date.now() / 1000) + 600; // 10 min from now

  const mintParams = {
    token0,
    token1,
    fee: cfg.feeTier,
    tickLower,
    tickUpper,
    amount0Desired,
    amount1Desired,
    amount0Min: 0n, // No slippage protection for initial seed (adjust for prod)
    amount1Min: 0n,
    recipient: deployer.address,
    deadline,
  };

  console.log(`\nMinting liquidity position...`);
  const mintTx = await positionManager.mint(mintParams);
  const mintReceipt = await mintTx.wait();
  console.log(`mint tx: ${mintTx.hash}`);

  // ── 9. Parse result ─────────────────────────────────────────────────────────
  // Look for the IncreaseLiquidity event to get tokenId + amounts
  const iface = new ethers.Interface([
    "event IncreaseLiquidity(uint256 indexed tokenId, uint128 liquidity, uint256 amount0, uint256 amount1)",
  ]);

  let tokenId: bigint | undefined;
  let liquidityAdded: bigint | undefined;
  let actualAmount0: bigint | undefined;
  let actualAmount1: bigint | undefined;

  for (const log of mintReceipt.logs) {
    try {
      const parsed = iface.parseLog({ topics: log.topics, data: log.data });
      if (parsed && parsed.name === "IncreaseLiquidity") {
        tokenId = parsed.args.tokenId;
        liquidityAdded = parsed.args.liquidity;
        actualAmount0 = parsed.args.amount0;
        actualAmount1 = parsed.args.amount1;
        break;
      }
    } catch {
      // not our event
    }
  }

  console.log(`\n✅ Liquidity seeded!`);
  if (tokenId !== undefined) {
    console.log(`  Position NFT tokenId: ${tokenId}`);
    console.log(`  Liquidity added:      ${liquidityAdded}`);
    console.log(`  Amount0 (${token0IsWzion ? "wZION" : "WETH"}) deposited: ${ethers.formatEther(actualAmount0 ?? 0n)}`);
    console.log(`  Amount1 (${token0IsWzion ? "WETH" : "wZION"}) deposited: ${ethers.formatEther(actualAmount1 ?? 0n)}`);
  } else {
    console.log("  (Could not parse IncreaseLiquidity event — check tx manually)");
  }

  console.log(`\n📋 Summary:`);
  console.log(`  Pool:      ${poolAddress}`);
  console.log(`  TokenId:   ${tokenId ?? "unknown"}`);
  console.log(`  Network:   ${networkName}`);
  console.log(`  Next step: Verify on Uniswap UI and set up price oracle monitoring.`);
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
