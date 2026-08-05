/**
 * add-uniswap-liquidity.ts — Add liquidity to existing Uniswap V3 wZION/USDT pool on Base
 *
 * Pool: 0x186b46c2f04153999d44D25179cD623fD62Bfda2 (0.3% fee, already initialized)
 * Price: ~$0.000183/wZION (from dust, keeping as-is)
 *
 * Uses all available USDT from deployer wallet + matching wZION at current pool price.
 *
 * Usage:
 *   npx hardhat run scripts/add-uniswap-liquidity.ts --network base
 *
 * Required env vars:
 *   DEPLOYER_PRIVATE_KEY  — signer (set in .env)
 */

import { ethers, network } from "hardhat";

// ─── Existing pool on Base ────────────────────────────────────────────────────
const POOL_ADDRESS = "0x186b46c2f04153999d44D25179cD623fD62Bfda2";

// Uniswap V3 NonfungiblePositionManager on Base
// (Base-specific deployment, NOT the standard 0xC36442b4...)
const NFT_POSITION_MANAGER = "0x03a520b32C04BF3bEEf7BEb72E919cf822Ed34f1";

// Token addresses on Base
const WZION = "0x0c493763d107ab0ABb0aee1Ca3999292d8202bb6";
const USDT  = "0xfde4C96c8593536E31F229EA8f37b2ADa2699bb2";

// Full range for 0.3% fee (tickSpacing = 60)
const TICK_LOWER = -887220;
const TICK_UPPER = 887220;

const POOL_ABI = [
  "function slot0() external view returns (uint160 sqrtPriceX96, int24 tick, uint16 observationIndex, uint16 observationCardinality, uint16 observationCardinalityNext, uint8 feeProtocol, bool unlocked)",
  "function liquidity() external view returns (uint128)",
  "function token0() external view returns (address)",
  "function token1() external view returns (address)",
  "function fee() external view returns (uint24)",
];

const NFT_ABI = [
  "function mint((address token0, address token1, uint24 fee, int24 tickLower, int24 tickUpper, uint256 amount0Desired, uint256 amount1Desired, uint256 amount0Min, uint256 amount1Min, address recipient, uint256 deadline)) external payable returns (uint256 tokenId, uint128 liquidity, uint256 amount0, uint256 amount1)",
];

const ERC20_ABI = [
  "function balanceOf(address) view returns (uint256)",
  "function approve(address spender, uint256 amount) returns (bool)",
  "function allowance(address owner, address spender) view returns (uint256)",
  "function decimals() view returns (uint8)",
];

async function main() {
  const networkName = network.name;
  const { chainId } = await ethers.provider.getNetwork();

  console.log("\n" + "═".repeat(70));
  console.log("  Add Liquidity — Uniswap V3 wZION/USDT on Base");
  console.log("═".repeat(70));
  console.log(`Network:  ${networkName} (chain ${chainId})`);

  const [deployer] = await ethers.getSigners();
  const balance = await ethers.provider.getBalance(deployer.address);
  console.log(`Deployer: ${deployer.address}`);
  console.log(`ETH:     ${ethers.formatEther(balance)}`);

  if (balance < ethers.parseEther("0.001")) {
    console.error("❌ Insufficient ETH (need ≥ 0.001 for gas)");
    process.exit(1);
  }

  const pool = new ethers.Contract(POOL_ADDRESS, POOL_ABI, deployer);
  const wzion = new ethers.Contract(WZION, ERC20_ABI, deployer);
  const usdt = new ethers.Contract(USDT, ERC20_ABI, deployer);

  // ── Pool info ──────────────────────────────────────────────────────────
  const token0 = await pool.token0();
  const token1 = await pool.token1();
  const fee = await pool.fee();
  const slot0 = await pool.slot0();
  const currentLiquidity = await pool.liquidity();
  const isWzionToken0 = token0.toLowerCase() === WZION.toLowerCase();

  // Calculate current price (USDT per wZION)
  // token0 = wZION (18 dec), token1 = USDT (6 dec)
  // price = (sqrtPriceX96 / 2^96)^2 * 10^(token0dec - token1dec)
  const Q96 = 2n ** 96n;
  const sqrtNum = Number(slot0.sqrtPriceX96) / Number(Q96);
  const rawPrice = sqrtNum * sqrtNum;
  const priceUsdtPerWzion = rawPrice * 10 ** (18 - 6); // 10^12 adjustment

  console.log(`\nPool info:`);
  console.log(`  Address:     ${POOL_ADDRESS}`);
  console.log(`  token0:      ${token0} (${isWzionToken0 ? "wZION" : "USDT"})`);
  console.log(`  token1:      ${token1} (${isWzionToken0 ? "USDT" : "wZION"})`);
  console.log(`  fee:         ${Number(fee) / 10000}%`);
  console.log(`  tick:        ${slot0.tick}`);
  console.log(`  sqrtPriceX96:${slot0.sqrtPriceX96}`);
  console.log(`  price:       $${priceUsdtPerWzion}/wZION`);
  console.log(`  liquidity:   ${currentLiquidity}`);

  // ── Balances ────────────────────────────────────────────────────────────
  const wzBal = await wzion.balanceOf(deployer.address);
  const usdtBal = await usdt.balanceOf(deployer.address);

  console.log(`\nDeployer balances:`);
  console.log(`  wZION: ${ethers.formatUnits(wzBal, 18)}`);
  console.log(`  USDT:  ${ethers.formatUnits(usdtBal, 6)}`);

  if (usdtBal < 1000n) {
    console.error("❌ Insufficient USDT (need ≥ 0.001 USDT)");
    process.exit(1);
  }

  // ── Calculate amounts ───────────────────────────────────────────────────
  // Use ALL available USDT, calculate matching wZION at current pool price
  const usdtAmount = usdtBal;
  // wZION = USDT / price (in human terms)
  // price = USDT/wZION ≈ 0.000183
  // wZION (human) = USDT (human) / price
  // wZION (raw 18dec) = USDT (raw 6dec) / 1e6 / price * 1e18
  const usdtHuman = Number(usdtAmount) / 1e6;
  const wzionHuman = usdtHuman / priceUsdtPerWzion;
  const wzionAmount = BigInt(Math.floor(wzionHuman * 1e18));

  console.log(`\nLiquidity to add:`);
  console.log(`  wZION: ${ethers.formatUnits(wzionAmount, 18)}`);
  console.log(`  USDT:  ${ethers.formatUnits(usdtAmount, 6)}`);

  if (wzBal < wzionAmount) {
    console.error(`❌ Insufficient wZION (need ${ethers.formatUnits(wzionAmount, 18)}, have ${ethers.formatUnits(wzBal, 18)})`);
    process.exit(1);
  }

  // ── Step 1: Approve tokens ──────────────────────────────────────────────
  console.log("\n[1/2] Approving tokens to NFT Position Manager...");

  const wzAllow = await wzion.allowance(deployer.address, NFT_POSITION_MANAGER);
  if (wzAllow < wzionAmount) {
    const tx = await wzion.approve(NFT_POSITION_MANAGER, ethers.MaxUint256);
    await tx.wait();
    console.log(`  ✓ wZION approved`);
    await new Promise(r => setTimeout(r, 2000));
  } else {
    console.log(`  ✓ wZION already approved`);
  }

  const usdtAllow = await usdt.allowance(deployer.address, NFT_POSITION_MANAGER);
  if (usdtAllow < usdtAmount) {
    const tx = await usdt.approve(NFT_POSITION_MANAGER, ethers.MaxUint256);
    await tx.wait();
    console.log(`  ✓ USDT approved`);
    await new Promise(r => setTimeout(r, 2000));
  } else {
    console.log(`  ✓ USDT already approved`);
  }

  // ── Step 2: Add liquidity ───────────────────────────────────────────────
  console.log("\n[2/2] Adding liquidity...");

  const nftManager = new ethers.Contract(NFT_POSITION_MANAGER, NFT_ABI, deployer);

  const amount0Desired = isWzionToken0 ? wzionAmount : usdtAmount;
  const amount1Desired = isWzionToken0 ? usdtAmount : wzionAmount;

  const deadline = Math.floor(Date.now() / 1000) + 3600;

  const mintParams = {
    token0: token0,
    token1: token1,
    fee: fee,
    tickLower: TICK_LOWER,
    tickUpper: TICK_UPPER,
    amount0Desired: amount0Desired,
    amount1Desired: amount1Desired,
    amount0Min: 0,
    amount1Min: 0,
    recipient: deployer.address,
    deadline: deadline,
  };

  console.log(`  tickLower:    ${TICK_LOWER}`);
  console.log(`  tickUpper:    ${TICK_UPPER}`);
  console.log(`  amount0:      ${ethers.formatUnits(amount0Desired, isWzionToken0 ? 18 : 6)}`);
  console.log(`  amount1:      ${ethers.formatUnits(amount1Desired, isWzionToken0 ? 6 : 18)}`);

  const tx = await nftManager.mint(mintParams);
  console.log(`  TX: ${tx.hash}`);
  const receipt = await tx.wait();

  // Parse IncreaseLiquidity event
  const event = receipt?.logs.find((log) => {
    try {
      const parsed = nftManager.interface.parseLog(log);
      return parsed?.name === "IncreaseLiquidity";
    } catch { return false; }
  });

  let tokenId: string | undefined;
  if (event) {
    const parsed = nftManager.interface.parseLog(event);
    tokenId = parsed?.args?.tokenId?.toString();
  }

  console.log(`  ✓ Liquidity added! NFT Position ID: ${tokenId ?? "unknown"}`);

  // ── Summary ─────────────────────────────────────────────────────────────
  console.log("\n" + "═".repeat(70));
  console.log("  ✅ Uniswap V3 Liquidity Added!");
  console.log("═".repeat(70));
  console.log(`  Pool:       ${POOL_ADDRESS}`);
  console.log(`  Fee:        0.3%`);
  console.log(`  NFT ID:     ${tokenId ?? "unknown"}`);
  console.log(`  Price:      $${priceUsdtPerWzion}/wZION`);
  console.log(`  Basescan:   https://basescan.org/address/${POOL_ADDRESS}`);
  console.log(`  NFT:        https://basescan.org/address/${NFT_POSITION_MANAGER}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
