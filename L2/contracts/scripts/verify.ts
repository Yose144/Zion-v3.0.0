import { ethers } from "hardhat";
import hre from "hardhat";

/**
 * 🔍 Verify deployed contracts on block explorer.
 *
 * Usage:
 *   npx hardhat run scripts/verify.ts --network base-sepolia
 *
 * Requires: BASESCAN_API_KEY in .env
 * Requires: Update addresses below after deploy!
 */
async function main() {
  // ═══════════════════════════════════════════════════════════════
  // ⚠️  UPDATE THESE AFTER DEPLOY
  // ═══════════════════════════════════════════════════════════════
  const WZION_ADDRESS = process.env.WZION_ADDRESS || "0x_FILL_AFTER_DEPLOY";
  const BRIDGE_ADDRESS = process.env.BRIDGE_ADDRESS || "0x_FILL_AFTER_DEPLOY";

  const [deployer] = await ethers.getSigners();
  const admin = deployer.address;
  const guardian = deployer.address;
  const validators = [deployer.address];
  const threshold = 1;

  console.log("🔍 Verifying contracts on block explorer...\n");

  // ── Verify wZION ──────────────────────────────────────────────
  try {
    console.log("📜 Verifying wZION at:", WZION_ADDRESS);
    await hre.run("verify:verify", {
      address: WZION_ADDRESS,
      constructorArguments: [admin, deployer.address, guardian],
    });
    console.log("   ✅ wZION verified!\n");
  } catch (err: any) {
    if (err.message.includes("Already Verified")) {
      console.log("   ℹ️  wZION already verified\n");
    } else {
      console.error("   ❌ wZION verification failed:", err.message, "\n");
    }
  }

  // ── Verify ZIONBridge ─────────────────────────────────────────
  try {
    console.log("🌉 Verifying ZIONBridge at:", BRIDGE_ADDRESS);
    await hre.run("verify:verify", {
      address: BRIDGE_ADDRESS,
      constructorArguments: [admin, guardian, WZION_ADDRESS, validators, threshold],
    });
    console.log("   ✅ ZIONBridge verified!\n");
  } catch (err: any) {
    if (err.message.includes("Already Verified")) {
      console.log("   ℹ️  ZIONBridge already verified\n");
    } else {
      console.error("   ❌ ZIONBridge verification failed:", err.message, "\n");
    }
  }

  console.log("═".repeat(50));
  console.log("  Verification complete. Check on block explorer.");
  console.log("═".repeat(50));
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
