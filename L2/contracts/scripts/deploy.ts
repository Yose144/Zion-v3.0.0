import { ethers } from "hardhat";

async function main() {
  const [deployer] = await ethers.getSigners();
  const network = await ethers.provider.getNetwork();
  const isLocal = network.chainId === 31337n;

  console.log("Deploying wZION + ZIONBridge with account:", deployer.address);
  console.log("Balance:", ethers.formatEther(await ethers.provider.getBalance(deployer.address)));
  console.log("Network:", network.name, `(${network.chainId})`);

  // ── Configuration ──────────────────────────────────
  // For testnet: deployer is admin + guardian
  // For mainnet: use separate multisig addresses!
  const admin = deployer.address;
  const guardian = deployer.address;

  // Validator addresses (bridge relay operators)
  // Testnet: 2 validators (threshold must be >= 2, contract requirement)
  //   - Validator 1 = deployer (primary relay)
  //   - Validator 2 = VALIDATOR2_ADDRESS env var OR second hardhat account (local only)
  // Mainnet: 5 independent validators required
  let validator2Addr: string;
  if (isLocal) {
    const signers = await ethers.getSigners();
    validator2Addr = signers[1].address;
  } else {
    validator2Addr = process.env.VALIDATOR2_ADDRESS ?? "";
    if (!validator2Addr || !ethers.isAddress(validator2Addr)) {
      console.error("❌ VALIDATOR2_ADDRESS not set or invalid. Run scripts/gen-wallets.ts first.");
      process.exit(1);
    }
  }

  const validators = [deployer.address, validator2Addr];
  const threshold = 2; // Testnet: 2-of-2 (min allowed by contract). Mainnet: 3-of-5

  // ── Step 1: Deploy wZION ERC-20 ────────────────────

  console.log("\n📜 Step 1: Deploying wZION ERC-20...");
  const WZION = await ethers.getContractFactory("WZION");

  // wZION needs bridge address — deploy bridge first? No, circular.
  // Solution: deploy wZION with a temp bridge, then update.
  // Actually: deploy wZION first with bridge=deployer, then deploy bridge,
  // then grant BRIDGE_ROLE to bridge contract.

  const wzion = await WZION.deploy(admin, deployer.address, guardian);
  await wzion.waitForDeployment();
  const wzionAddr = await wzion.getAddress();
  console.log("   ✅ wZION deployed at:", wzionAddr);

  // ── Step 2: Deploy ZIONBridge ──────────────────────

  console.log("\n🌉 Step 2: Deploying ZIONBridge...");
  const ZIONBridge = await ethers.getContractFactory("ZIONBridge");
  const bridge = await ZIONBridge.deploy(admin, guardian, wzionAddr, validators, threshold);
  await bridge.waitForDeployment();
  const bridgeAddr = await bridge.getAddress();
  console.log("   ✅ ZIONBridge deployed at:", bridgeAddr);

  // ── Step 3: Grant BRIDGE_ROLE to ZIONBridge ────────

  console.log("\n🔐 Step 3: Granting BRIDGE_ROLE to ZIONBridge...");
  const BRIDGE_ROLE = await wzion.BRIDGE_ROLE();
  const tx1 = await wzion.grantRole(BRIDGE_ROLE, bridgeAddr);
  await tx1.wait();
  console.log("   ✅ BRIDGE_ROLE granted to:", bridgeAddr);

  // Revoke BRIDGE_ROLE from deployer (was temp)
  const tx2 = await wzion.revokeRole(BRIDGE_ROLE, deployer.address);
  await tx2.wait();
  console.log("   ✅ BRIDGE_ROLE revoked from deployer");

  // ── Summary ────────────────────────────────────────

  console.log("\n" + "═".repeat(60));
  console.log("  ZION Bridge Deployment Summary");
  console.log("═".repeat(60));
  console.log(`  Network:        ${(await ethers.provider.getNetwork()).name} (${(await ethers.provider.getNetwork()).chainId})`);
  console.log(`  wZION (ERC-20): ${wzionAddr}`);
  console.log(`  ZIONBridge:     ${bridgeAddr}`);
  console.log(`  Admin:          ${admin}`);
  console.log(`  Guardian:       ${guardian}`);
  console.log(`  Validators:     ${validators.join(", ")}`);
  console.log(`  Threshold:      ${threshold}-of-${validators.length}`);
  console.log("═".repeat(60));
  console.log("\n⚠️  Update config/bridge-testnet.toml with these addresses!");
  console.log(`    wzion_address          = "${wzionAddr}"`);
  console.log(`    bridge_contract_address = "${bridgeAddr}"`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
