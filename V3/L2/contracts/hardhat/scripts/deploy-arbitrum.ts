/**
 * deploy-arbitrum.ts — Deploy wZION + ZIONBridge on Arbitrum One Mainnet
 *
 * Deploys the same contract stack as Base but on Arbitrum One (chain 42161).
 * After deploy, grants BRIDGE_ROLE on wZION for ZIONBridge and configures
 * the 5/5 validator multisig.
 *
 * Usage:
 *   npx hardhat run scripts/deploy-arbitrum.ts --network arbitrum
 *
 * Required env vars:
 *   DEPLOYER_PRIVATE_KEY  — funded deployer (needs ~0.01 ETH on Arbitrum for gas)
 *   ARB_RPC               — Arbitrum RPC (default: https://arb1.arbitrum.io/rpc)
 *
 * Optional (defaults to Base mainnet validator set):
 *   VALIDATOR_1..5        — 5 validator addresses (default: same as Base)
 *   BRIDGE_THRESHOLD      — validator threshold (default: 5)
 *   GUARDIAN_ADDRESS      — guardian address (default: deployer)
 *
 * After deploy:
 *   1. Update bridge-mainnet.toml — Arbitrum section with real addresses
 *   2. Update LiFiWidget.tsx — wZION Arbitrum address
 *   3. Update bridge-api.ts — Arbitrum chain entry
 *   4. Restart zion-edge-bridge.service
 *   5. E2E test: lock ZION on L1 → mint wZION on Arbitrum
 */

import { ethers, network } from "hardhat";
import * as fs from "fs";
import * as path from "path";

// ─── Validator defaults (same as Base mainnet) ───────────────────────────────

const DEFAULT_VALIDATORS = [
  "0xdde17506BC2D2dCE1d594bD1D85B0BAbb389D186", // validator-1 (deployer)
  "0x24d986841E56e5571489B25951eE8C1Ae761FA82", // validator-2
  "0x665c55eDCF25c2c5A1dfF1B20eE950cBDC58d3d0", // validator-3
  "0x8E644b3E9FaBf52eE321DC5B3D5AA06d6e3E66C6", // validator-4
  "0x7e0D2eD71d78B9CFB5034A83333e82e304bc4CB2", // validator-5
];

const DEFAULT_THRESHOLD = 5;

// ─────────────────────────────────────────────────────────────────────────────

async function main() {
  const networkName = network.name;
  const { chainId } = await ethers.provider.getNetwork();

  console.log("\n" + "═".repeat(70));
  console.log("  ZION Bridge Deploy — wZION + ZIONBridge on Arbitrum One");
  console.log("═".repeat(70));
  console.log(`Network:  ${networkName} (chain ${chainId})`);

  if (networkName !== "arbitrum") {
    console.error(`❌ This script is for Arbitrum One mainnet only. Got: ${networkName}`);
    process.exit(1);
  }

  const [deployer] = await ethers.getSigners();
  const balance = await ethers.provider.getBalance(deployer.address);
  console.log(`Deployer: ${deployer.address}`);
  console.log(`Balance:  ${ethers.formatEther(balance)} ETH`);

  if (balance < ethers.parseEther("0.005")) {
    console.error("❌ Insufficient ETH balance on Arbitrum (need ≥ 0.005 ETH for gas)");
    console.error("   Bridge ETH from Ethereum to Arbitrum via https://bridge.arbitrum.io");
    process.exit(1);
  }

  // ── Resolve validator set ──────────────────────────────────────────────────

  const validators: string[] = [];
  for (let i = 1; i <= 5; i++) {
    const addr = process.env[`VALIDATOR_${i}`] || DEFAULT_VALIDATORS[i - 1];
    if (!ethers.isAddress(addr)) {
      console.error(`❌ Invalid validator ${i} address: ${addr}`);
      process.exit(1);
    }
    validators.push(addr);
  }
  const threshold = parseInt(process.env.BRIDGE_THRESHOLD || String(DEFAULT_THRESHOLD));
  const guardianAddr = process.env.GUARDIAN_ADDRESS || deployer.address;

  console.log(`\nValidators (${threshold}-of-${validators.length}):`);
  validators.forEach((v, i) => console.log(`  ${i + 1}. ${v}`));
  console.log(`Guardian: ${guardianAddr}`);

  // ── Nonce management ───────────────────────────────────────────────────────

  let nonce = await ethers.provider.getTransactionCount(deployer.address, "pending");
  const nextNonce = () => nonce++;
  const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));
  const waitForConfirm = async (tx: { wait: (confirms?: number) => Promise<any> }) => {
    const receipt = await tx.wait(2);
    await sleep(5000); // Arbitrum has ~1s blocks, extra delay for RPC propagation
    return receipt;
  };

  // ── Step 1: Deploy wZION ───────────────────────────────────────────────────

  console.log("\n📜 Step 1: Deploying wZION (ERC-20)...");
  const WZION = await ethers.getContractFactory("WZION");
  // constructor(admin, bridge, guardian) — bridge is placeholder, we'll grant role after ZIONBridge deploy
  const wzion = await WZION.deploy(deployer.address, deployer.address, guardianAddr, {
    nonce: nextNonce(),
  });
  await wzion.waitForDeployment();
  await sleep(5000);
  const wzionAddr = await wzion.getAddress();
  console.log(`   ✅ wZION: ${wzionAddr}`);
  console.log(`      Name: Wrapped ZION | Symbol: wZION | Decimals: 18`);
  console.log(`      MAX_SUPPLY: 144,000,000,000 wZION`);

  // ── Step 2: Deploy ZIONBridge ──────────────────────────────────────────────

  console.log("\n🌉 Step 2: Deploying ZIONBridge (5/5 multisig)...");
  const ZIONBridge = await ethers.getContractFactory("ZIONBridge");
  // constructor(admin, guardian, wZIONAddr, validators[], threshold)
  const bridge = await ZIONBridge.deploy(
    deployer.address,    // admin
    guardianAddr,        // guardian
    wzionAddr,           // wZION
    validators,          // 5 validator addresses
    threshold,           // 5
    { nonce: nextNonce() }
  );
  await bridge.waitForDeployment();
  await sleep(5000);
  const bridgeAddr = await bridge.getAddress();
  console.log(`   ✅ ZIONBridge: ${bridgeAddr}`);
  console.log(`      Validators: ${validators.length} | Threshold: ${threshold}`);

  // ── Step 3: Grant BRIDGE_ROLE on wZION for ZIONBridge ──────────────────────

  console.log("\n🔐 Step 3: Granting BRIDGE_ROLE on wZION for ZIONBridge...");
  const BRIDGE_ROLE = await wzion.BRIDGE_ROLE();
  const grantTx = await wzion.grantRole(BRIDGE_ROLE, bridgeAddr, { nonce: nextNonce() });
  await waitForConfirm(grantTx);
  console.log(`   ✅ BRIDGE_ROLE granted to ZIONBridge (${bridgeAddr})`);

  // ── Step 4: Renounce deployer's temporary BRIDGE_ROLE (security) ───────────

  console.log("\n🔒 Step 4: Renouncing deployer's temporary BRIDGE_ROLE...");
  try {
    const renounceTx = await wzion.renounceRole(BRIDGE_ROLE, deployer.address, {
      nonce: nextNonce(),
    });
    await waitForConfirm(renounceTx);
    console.log(`   ✅ Deployer BRIDGE_ROLE renounced — only ZIONBridge can mint/burn`);
  } catch (e) {
    console.log(`   ⚠️  Could not renounce (may need DEFAULT_ADMIN): ${(e as Error).message}`);
  }

  // ── Save deployment JSON ───────────────────────────────────────────────────

  const deployedAt = new Date().toISOString();
  const output = {
    network: networkName,
    chainId: Number(chainId),
    wzion: wzionAddr,
    bridge: bridgeAddr,
    config: {
      validators,
      threshold,
      guardian: guardianAddr,
      deployer: deployer.address,
    },
    deployedAt,
  };

  const outPath = path.join(__dirname, "..", "deployed-arbitrum.json");
  fs.writeFileSync(outPath, JSON.stringify(output, null, 2));
  console.log(`\n📁 Deployment saved to: deployed-arbitrum.json`);

  // ── Summary ────────────────────────────────────────────────────────────────

  console.log("\n" + "═".repeat(70));
  console.log("  ZION Arbitrum Deploy Summary");
  console.log("═".repeat(70));
  console.log(`  Network:      ${networkName} (${chainId})`);
  console.log(`  wZION:        ${wzionAddr}`);
  console.log(`  ZIONBridge:   ${bridgeAddr}`);
  console.log(`  Validators:   ${threshold}-of-${validators.length}`);
  console.log("═".repeat(70));

  console.log("\n⚠️  Next steps:");
  console.log(`  1. Update V3/L2/bridge/config/bridge-mainnet.toml:`);
  console.log(`     - Set wzion_address = "${wzionAddr}"`);
  console.log(`     - Set bridge_contract_address = "${bridgeAddr}"`);
  console.log(`     - Set enabled = true`);
  console.log(`  2. Update LiFiWidget.tsx — wZION Arbitrum address`);
  console.log(`  3. Update bridge-api.ts — Arbitrum chain entry`);
  console.log(`  4. Restart zion-edge-bridge.service on Edge`);
  console.log(`  5. E2E test: lock ZION on L1 → mint wZION on Arbitrum`);
  console.log(`  6. Verify on Arbiscan: https://arbiscan.io/address/${wzionAddr}`);
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
