/**
 * redeploy-bridge-only.ts
 *
 * Deploys a NEW ZIONBridge contract (without re-deploying wZION).
 * Use this to replace a broken bridge with correct validator setup.
 *
 * Usage:
 *   DEPLOYER_PRIVATE_KEY=0x... VALIDATOR2_ADDRESS=0x... \
 *   npx hardhat run scripts/redeploy-bridge-only.ts --network base-sepolia
 *
 * Required env vars:
 *   DEPLOYER_PRIVATE_KEY  — private key of deployer (who has DEFAULT_ADMIN_ROLE in wZION)
 *   WZION_ADDRESS         — existing wZION contract address (optional, from .env)
 *   OLD_BRIDGE_ADDRESS    — old ZIONBridge to revoke BRIDGE_ROLE from (optional)
 *   VALIDATOR2_ADDRESS    — second validator address (optional; if not set, uses deployer)
 */

import { ethers } from "hardhat";
import * as fs from "fs";
import * as path from "path";

async function main() {
  const [deployer] = await ethers.getSigners();
  const network = await ethers.provider.getNetwork();

  console.log("═".repeat(60));
  console.log("  ZIONBridge Re-Deploy (without wZION)");
  console.log("═".repeat(60));
  console.log("  Deployer:   ", deployer.address);
  console.log("  Network:    ", network.name, `(${network.chainId})`);
  console.log("  Balance:    ", ethers.formatEther(await ethers.provider.getBalance(deployer.address)), "ETH");

  // ── Config ───────────────────────────────────────────────
  const wzionAddr   = process.env.WZION_ADDRESS    ?? "0x0c493763d107ab0ABb0aee1Ca3999292d8202bb6";
  const oldBridgeAddr = process.env.OLD_BRIDGE_ADDRESS ?? "0xa5a09b2C09A7182BBA9623A2D2cd46cD7D041721";

  // Validators — index 0 = deployer, index 1 = server relay key
  // Set VALIDATOR2_ADDRESS=0x8cc6F931edDAf5F14D0071727Ed1640752B5c787 for single-validator mode
  const validatorAddr = process.env.VALIDATOR2_ADDRESS ?? deployer.address;
  const useSingleValidator = validatorAddr.toLowerCase() === deployer.address.toLowerCase();

  // For 1-of-1 testnet: [server_relay_key], threshold=1
  // For 2-of-2 testnet: [deployer, server_key], threshold=2
  let validators: string[];
  let threshold: number;

  if (useSingleValidator) {
    // Using server relay key only (threshold=1)
    validators = [validatorAddr];
    threshold  = 1;
    console.log(`  Validators: [${validators[0]}] (1-of-1)`);
  } else {
    // Two validators
    validators = [deployer.address, validatorAddr];
    threshold  = 1; // Still 1-of-2 to allow automated relay without manual confirmation
    console.log(`  Validators: [${validators[0]}, ${validators[1]}] (1-of-2)`);
  }

  console.log(`  Threshold:  ${threshold}-of-${validators.length}`);
  console.log(`  wZION:      ${wzionAddr}`);
  console.log(`  Old Bridge: ${oldBridgeAddr} (BRIDGE_ROLE will be revoked)`);
  console.log();

  // ── Step 1: Deploy new ZIONBridge ────────────────────────
  console.log("🌉 Step 1: Deploying ZIONBridge...");
  const ZIONBridge = await ethers.getContractFactory("ZIONBridge");
  const bridge = await ZIONBridge.deploy(
    deployer.address,  // admin
    deployer.address,  // guardian (testnet: same as admin)
    wzionAddr,
    validators,
    threshold,
  );
  await bridge.waitForDeployment();
  const newBridgeAddr = await bridge.getAddress();
  console.log("   ✅ New ZIONBridge deployed at:", newBridgeAddr);

  // ── Step 2: Grant BRIDGE_ROLE to new bridge in wZION ────
  console.log("\n🔐 Step 2: Granting BRIDGE_ROLE to new ZIONBridge in wZION...");
  const wzionAbi = [
    "function BRIDGE_ROLE() view returns (bytes32)",
    "function grantRole(bytes32 role, address account) returns (bool)",
    "function revokeRole(bytes32 role, address account) returns (bool)",
    "function hasRole(bytes32 role, address account) view returns (bool)",
  ];
  const wzion = new ethers.Contract(wzionAddr, wzionAbi, deployer);
  const BRIDGE_ROLE = await wzion.BRIDGE_ROLE();

  const tx1 = await wzion.grantRole(BRIDGE_ROLE, newBridgeAddr);
  await tx1.wait();
  console.log("   ✅ BRIDGE_ROLE granted to:", newBridgeAddr);

  // ── Step 3: Revoke BRIDGE_ROLE from old bridge ───────────
  if (oldBridgeAddr && ethers.isAddress(oldBridgeAddr)) {
    const hadRole = await wzion.hasRole(BRIDGE_ROLE, oldBridgeAddr);
    if (hadRole) {
      console.log("\n⛔ Step 3: Revoking BRIDGE_ROLE from old bridge...");
      const tx2 = await wzion.revokeRole(BRIDGE_ROLE, oldBridgeAddr);
      await tx2.wait();
      console.log("   ✅ BRIDGE_ROLE revoked from:", oldBridgeAddr);
    } else {
      console.log("\n⚠️  Step 3: Old bridge did not have BRIDGE_ROLE, skipping revoke.");
    }
  }

  // ── Summary ──────────────────────────────────────────────
  console.log("\n" + "═".repeat(60));
  console.log("  Re-Deployment Summary");
  console.log("═".repeat(60));
  console.log(`  Network:          ${network.name} (${network.chainId})`);
  console.log(`  wZION:            ${wzionAddr}    [unchanged]`);
  console.log(`  Old ZIONBridge:   ${oldBridgeAddr} [BRIDGE_ROLE revoked]`);
  console.log(`  NEW ZIONBridge:   ${newBridgeAddr} ← update bridge.toml!`);
  console.log(`  Validators:       ${validators.join(", ")}`);
  console.log(`  Threshold:        ${threshold}-of-${validators.length}`);
  console.log("═".repeat(60));

  // ── Save result to file ──────────────────────────────────
  const result = {
    network: network.name,
    chainId: network.chainId.toString(),
    wzion: wzionAddr,
    oldBridge: oldBridgeAddr,
    newBridge: newBridgeAddr,
    validators,
    threshold,
    deployedAt: new Date().toISOString(),
  };
  const outFile = path.resolve(__dirname, "../deployed-bridge.json");
  fs.writeFileSync(outFile, JSON.stringify(result, null, 2));
  console.log(`\n  📄 Saved to: ${outFile}`);
  console.log("\n  ⚠️  Update bridge.toml on the server:");
  console.log(`       bridge_contract_address = "${newBridgeAddr}"`);
  console.log(`       validator_addresses = ["${validators.join('", "')}"]`);
}

main().catch((e) => {
  console.error("Deployment failed:", e);
  process.exit(1);
});
