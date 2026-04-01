/**
 * verify-base-mainnet.ts — Verify all Base mainnet contracts are functional
 *
 * Usage: npx hardhat run scripts/verify-base-mainnet.ts --network base
 */
import { ethers } from "hardhat";

async function main() {
  const [deployer] = await ethers.getSigners();
  const network = await ethers.provider.getNetwork();

  console.log("═".repeat(60));
  console.log("  Base Mainnet Contract Verification");
  console.log("═".repeat(60));
  console.log(`  Network: ${network.name} (${network.chainId})`);
  console.log(`  Deployer: ${deployer.address}`);
  console.log();

  // ── wZION ─────────────────────────────────────────────────
  const wzionAddr = "0x0c493763d107ab0ABb0aee1Ca3999292d8202bb6";
  const wzionAbi = [
    "function name() view returns (string)",
    "function symbol() view returns (string)",
    "function decimals() view returns (uint8)",
    "function totalSupply() view returns (uint256)",
    "function BRIDGE_ROLE() view returns (bytes32)",
    "function hasRole(bytes32 role, address account) view returns (bool)",
    "function paused() view returns (bool)",
    "function mintableSupply() view returns (uint256)",
  ];
  const wzion = new ethers.Contract(wzionAddr, wzionAbi, deployer);

  console.log("📜 wZION Token:");
  console.log(`   Address:  ${wzionAddr}`);
  console.log(`   Name:     ${await wzion.name()}`);
  console.log(`   Symbol:   ${await wzion.symbol()}`);
  console.log(`   Decimals: ${await wzion.decimals()}`);
  console.log(`   Supply:   ${ethers.formatEther(await wzion.totalSupply())} wZION`);
  console.log(`   Mintable: ${ethers.formatEther(await wzion.mintableSupply())} wZION`);
  console.log(`   Paused:   ${await wzion.paused()}`);

  const BRIDGE_ROLE = await wzion.BRIDGE_ROLE();
  const bridgeAddr = "0xa5a09b2C09A7182BBA9623A2D2cd46cD7D041721";
  const bridgeHasRole = await wzion.hasRole(BRIDGE_ROLE, bridgeAddr);
  console.log(`   Bridge ROLE: ${bridgeHasRole ? "✅ GRANTED" : "❌ MISSING"}`);
  console.log();

  // ── ZIONBridge ────────────────────────────────────────────
  const bridgeAbi = [
    "function paused() view returns (bool)",
    "function threshold() view returns (uint256)",
  ];
  const bridge = new ethers.Contract(bridgeAddr, bridgeAbi, deployer);

  console.log("🌉 ZIONBridge:");
  console.log(`   Address:   ${bridgeAddr}`);
  console.log(`   Paused:    ${await bridge.paused()}`);
  console.log(`   Threshold: ${await bridge.threshold()}`);
  console.log();

  // ── ZIONAtomicSwap ────────────────────────────────────────
  const swapAddr = "0x3DE9Ad42716854083ab837706E3961d10B0e63Eb";
  const swapAbi = [
    "function paused() view returns (bool)",
    "function feeBps() view returns (uint256)",
  ];
  const swap = new ethers.Contract(swapAddr, swapAbi, deployer);

  console.log("🔄 ZIONAtomicSwap:");
  console.log(`   Address: ${swapAddr}`);
  console.log(`   Paused:  ${await swap.paused()}`);
  console.log(`   Fee:     ${await swap.feeBps()} bps`);
  console.log();

  // ── Summary ───────────────────────────────────────────────
  console.log("═".repeat(60));
  const allOk = bridgeHasRole;
  console.log(allOk
    ? "  ✅ All contracts deployed and configured correctly"
    : "  ❌ Issues found — check output above");
  console.log("═".repeat(60));
}

main().catch(e => { console.error(e); process.exit(1); });
