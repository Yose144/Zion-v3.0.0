/**
 * S-08 — Deploy ZIONAtomicSwap (EVM HTLC contract)
 *
 * Usage:
 *   npx hardhat run scripts/deploy-atomic-swap.ts --network base-sepolia
 *   npx hardhat run scripts/deploy-atomic-swap.ts --network base
 *
 * Env vars:
 *   DEPLOYER_PRIVATE_KEY   — signer (set in .env)
 *   SWAP_ADMIN             — admin address (defaults to deployer)
 *   SWAP_GUARDIAN          — guardian address (defaults to deployer)
 */

import { ethers, network, run } from "hardhat";
import * as fs from "fs";

async function main() {
  const networkName = network.name;
  console.log(`\n🔐 Deploy ZIONAtomicSwap — network: ${networkName}`);

  const [deployer] = await ethers.getSigners();
  console.log(`Deployer: ${deployer.address}`);

  const adminAddr    = process.env.SWAP_ADMIN    || deployer.address;
  const guardianAddr = process.env.SWAP_GUARDIAN || deployer.address;

  console.log(`Admin:    ${adminAddr}`);
  console.log(`Guardian: ${guardianAddr}`);

  // ── Deploy ────────────────────────────────────────────────────────────────
  const Factory = await ethers.getContractFactory("ZIONAtomicSwap");
  console.log("\n⏳ Deploying ZIONAtomicSwap...");
  const swap = await Factory.deploy(adminAddr, guardianAddr);
  await swap.waitForDeployment();
  const swapAddr = await swap.getAddress();
  console.log(`✅ ZIONAtomicSwap deployed: ${swapAddr}`);

  // ── Save deployment info ──────────────────────────────────────────────────
  const deployInfo = {
    network:         networkName,
    deployedAt:      new Date().toISOString(),
    deployer:        deployer.address,
    ZIONAtomicSwap:  swapAddr,
    admin:           adminAddr,
    guardian:        guardianAddr,
  };

  const outPath = `deployed-atomic-swap-${networkName}.json`;
  fs.writeFileSync(outPath, JSON.stringify(deployInfo, null, 2));
  console.log(`\n📄 Deployment saved to ${outPath}`);

  // ── Verify (non-local networks) ───────────────────────────────────────────
  if (networkName !== "hardhat" && networkName !== "localhost") {
    console.log("\n⏳ Waiting 10s for block explorer indexing...");
    await new Promise(r => setTimeout(r, 10_000));

    console.log("🔍 Verifying on block explorer...");
    try {
      await run("verify:verify", {
        address:              swapAddr,
        constructorArguments: [adminAddr, guardianAddr],
      });
      console.log("✅ Verified on block explorer");
    } catch (e: any) {
      console.warn("⚠️  Verification failed (may already be verified):", e.message);
    }
  }

  // ── Summary ───────────────────────────────────────────────────────────────
  console.log("\n╔══════════════════════════════════════════════════════════════╗");
  console.log("║  ZIONAtomicSwap Deployment Summary                          ║");
  console.log("╠══════════════════════════════════════════════════════════════╣");
  console.log(`║  Network:         ${networkName.padEnd(44)}║`);
  console.log(`║  Contract:        ${swapAddr.padEnd(44)}║`);
  console.log(`║  MIN_TIMELOCK:    30 minutes                                 ║`);
  console.log(`║  MAX_TIMELOCK:    7 days                                     ║`);
  console.log(`║  Fee:             0 bps (update via setFeeBps)               ║`);
  console.log("╚══════════════════════════════════════════════════════════════╝");
  console.log("\n📌 Next: Update DEFI.md with ZIONAtomicSwap address");
  console.log("   Connect to zion-atomic-swap daemon:");
  console.log(`   ZION_ATOMIC_SWAP_ADDR=${swapAddr}`);
}

main().catch(e => { console.error(e); process.exit(1); });
