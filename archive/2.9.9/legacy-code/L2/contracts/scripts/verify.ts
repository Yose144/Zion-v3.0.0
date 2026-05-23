import { ethers } from "hardhat";
import hre from "hardhat";

/**
 * 🔍 Verify all 7 deployed contracts on BaseScan.
 *
 * Usage:
 *   npx hardhat run scripts/verify.ts --network base-sepolia
 *
 * Requires:
 *   - BASESCAN_API_KEY in .env  (get from https://basescan.org/myapikey)
 *   - Contracts already deployed (addresses hardcoded for Base Sepolia sprint)
 */

// ── Deployed addresses (Base Sepolia, sprint 3.x) ─────────────────────────
const ADDRESSES = {
  wZION:          "0x0c493763d107ab0ABb0aee1Ca3999292d8202bb6",
  ZIONBridge:     "0xF4BF85443ad6c9b88f3a5314cC3Fb59C32Cedca1",
  ZIONStaking:    "0x487D87E243f87b1DDEEDEB890c40F2cEcCf67913",
  ZIONFarm:       "0x1B8BA92C401d53cBcEc422BAD4b83fABcb0A3843",
  ZIONAtomicSwap: "0xAf1E0645Ac409485EDA5EabD87b4eE3C3a5BA3Fc",
  ZIONGovernance: "0x039F730e3e1c3f36da95187697118791762290a1",
  ZIONTreasury:   "0x178d85323dC94Ce2477269Dfb93a12D04B9bE537",
};

async function tryVerify(label: string, address: string, constructorArguments: unknown[]) {
  try {
    console.log(`\n📜 Verifying ${label} at ${address} ...`);
    await hre.run("verify:verify", { address, constructorArguments });
    console.log(`   ✅ ${label} verified!`);
  } catch (err: any) {
    if (err.message?.includes("Already Verified") || err.message?.includes("already verified")) {
      console.log(`   ℹ️  ${label} already verified`);
    } else {
      console.error(`   ❌ ${label} failed: ${err.message}`);
    }
  }
}

async function main() {
  const [deployer] = await ethers.getSigners();
  const admin    = deployer.address;
  const guardian = deployer.address;

  if (!process.env.BASESCAN_API_KEY) {
    console.warn("⚠️  BASESCAN_API_KEY not set — verification will likely fail.");
    console.warn("    Get a free key at https://basescan.org/myapikey and add to .env\n");
  }

  console.log("🔍 Verifying ZION DeFi contracts on BaseScan (Base Sepolia)");
  console.log(`   Deployer/admin/guardian: ${admin}\n`);

  // ── wZION ERC-20 ──────────────────────────────────────────────────────────
  // constructor(address admin, address minter, address guardian)
  await tryVerify("wZION", ADDRESSES.wZION, [admin, admin, guardian]);

  // ── ZIONBridge ────────────────────────────────────────────────────────────
  // constructor(address admin, address guardian, address wzion, address[] validators, uint256 threshold)
  await tryVerify("ZIONBridge", ADDRESSES.ZIONBridge, [
    admin, guardian, ADDRESSES.wZION, [admin], 1,
  ]);

  // ── ZIONStaking ───────────────────────────────────────────────────────────
  // constructor(address wzion, address admin, address guardian, uint256 aprBps, uint256 cooldownSeconds)
  await tryVerify("ZIONStaking", ADDRESSES.ZIONStaking, [
    ADDRESSES.wZION, admin, guardian, 1200, 7 * 24 * 3600,
  ]);

  // ── ZIONFarm ──────────────────────────────────────────────────────────────
  // constructor(address wzion, address admin, address guardian)
  await tryVerify("ZIONFarm", ADDRESSES.ZIONFarm, [ADDRESSES.wZION, admin, guardian]);

  // ── ZIONAtomicSwap ────────────────────────────────────────────────────────
  // constructor(address admin, address guardian)
  await tryVerify("ZIONAtomicSwap", ADDRESSES.ZIONAtomicSwap, [admin, guardian]);

  // ── ZIONGovernance ────────────────────────────────────────────────────────
  // constructor(address wzion, address admin, address guardian)
  await tryVerify("ZIONGovernance", ADDRESSES.ZIONGovernance, [ADDRESSES.wZION, admin, guardian]);

  // ── ZIONTreasury ──────────────────────────────────────────────────────────
  // constructor(address admin, address[] signers, uint256 threshold)
  await tryVerify("ZIONTreasury", ADDRESSES.ZIONTreasury, [admin, [admin], 1]);

  console.log("\n" + "═".repeat(56));
  console.log("  Verification pass complete.");
  console.log("  View on: https://sepolia.basescan.org/address/");
  console.log("═".repeat(56));
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
