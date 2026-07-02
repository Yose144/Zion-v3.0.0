/**
 * BaseScan source-code verification for Base Mainnet contracts.
 *
 * Usage: BASESCAN_API_KEY=... npx hardhat run scripts/verify-base-mainnet-basescan.ts --network base
 *
 * Verifies:
 *   1. Already-deployed contracts (wZION, ZIONBridge v3, ZIONAtomicSwap)
 *   2. New 3.0.4 contracts (ZIONStaking, ZIONFarm, ZIONGovernance, ZIONTreasury)
 *      — reads addresses from deployed-defi.json and deployed-farm-base.json
 */
import { run } from "hardhat";
import * as fs from "fs";
import * as path from "path";

const DEPLOYER = "0xdde17506BC2D2dCE1d594bD1D85B0BAbb389D186";
const VALIDATOR2 = "0x8cc6F931edDAf5F14D0071727Ed1640752B5c787";

// ─── Already deployed (verify if not already) ────────────────────────────────
const EXISTING_CONTRACTS = {
  wZION: {
    address: "0x0c493763d107ab0ABb0aee1Ca3999292d8202bb6",
    contract: "sol/wZION.sol:WZION",
    constructorArguments: [DEPLOYER, DEPLOYER, DEPLOYER], // admin, bridge/minter, guardian
  },
  ZIONBridge: {
    address: "0x72c8f0Dc60E27aB7A83fe3B416fab4F0600a6467", // v3 — updated 2026-06-29
    contract: "sol/ZIONBridge.sol:ZIONBridge",
    constructorArguments: [
      DEPLOYER,                                             // admin
      DEPLOYER,                                             // guardian
      "0x0c493763d107ab0ABb0aee1Ca3999292d8202bb6",         // wZION address
      [DEPLOYER, VALIDATOR2],                               // validators array
      1,                                                    // threshold (initial; raised to 5 via setThreshold)
    ],
  },
  ZIONAtomicSwap: {
    address: "0x3DE9Ad42716854083ab837706E3961d10B0e63Eb",
    contract: "sol/ZIONAtomicSwap.sol:ZIONAtomicSwap",
    constructorArguments: [DEPLOYER, DEPLOYER], // admin, guardian
  },
};

// ─── New 3.0.4 contracts (read from deployed JSON files) ─────────────────────
// Constructor signatures (must match exactly what was used at deploy time):
//   ZIONGovernance(address _zionToken)
//   ZIONTreasury(address _zionToken, address[] _signers, uint256 _required)
//   ZIONStaking(address _wzion, address _admin, address _guardian, uint256 _aprBps)
//   ZIONFarm(address _rewardToken, address _admin, address _guardian, uint256 _rewardPerSecond, uint256 _halvingInterval)
function loadNewContracts(): Record<string, any> {
  const result: Record<string, any> = {};
  const defiPath = path.join(__dirname, "..", "deployed-defi.json");
  const farmPath = path.join(__dirname, "..", "deployed-farm-base.json");
  const WZION_DEFAULT = "0x0c493763d107ab0ABb0aee1Ca3999292d8202bb6";

  if (fs.existsSync(defiPath)) {
    const defi = JSON.parse(fs.readFileSync(defiPath, "utf8"));
    const wzion = defi.wzion || WZION_DEFAULT;
    const cfg = defi.config || {};

    if (defi.governance) {
      // constructor(address _zionToken)
      result.ZIONGovernance = {
        address: defi.governance,
        contract: "sol/ZIONGovernance.sol:ZIONGovernance",
        constructorArguments: [wzion],
      };
    }
    if (defi.treasury) {
      // constructor(address _zionToken, address[] _signers, uint256 _required)
      result.ZIONTreasury = {
        address: defi.treasury,
        contract: "sol/ZIONTreasury.sol:ZIONTreasury",
        constructorArguments: [
          wzion,
          cfg.treasurySigners || [DEPLOYER],
          cfg.treasuryThreshold || 3,
        ],
      };
    }
    if (defi.staking) {
      // constructor(address _wzion, address _admin, address _guardian, uint256 _aprBps)
      result.ZIONStaking = {
        address: defi.staking,
        contract: "sol/ZIONStaking.sol:ZIONStaking",
        constructorArguments: [
          wzion,
          DEPLOYER,                              // admin
          cfg.guardian || DEPLOYER,               // guardian
          cfg.stakingAprBps || 1200,              // APR in bps (12%)
        ],
      };
    }
  }

  if (fs.existsSync(farmPath)) {
    const farm = JSON.parse(fs.readFileSync(farmPath, "utf8"));
    const farmAddr = farm.ZIONFarm || farm.farm;
    if (farmAddr) {
      // constructor(address _rewardToken, address _admin, address _guardian, uint256 _rewardPerSecond, uint256 _halvingInterval)
      result.ZIONFarm = {
        address: farmAddr,
        contract: "sol/ZIONFarm.sol:ZIONFarm",
        constructorArguments: [
          farm.rewardToken || WZION_DEFAULT,
          farm.deployer || DEPLOYER,                       // admin
          farm.deployer || DEPLOYER,                       // guardian (same as admin at deploy)
          farm.rewardPerSecond || "1000000000000000000",   // 1 wZION/s
          farm.halvingInterval || 7776000,                 // 90-day halving
        ],
      };
    }
  }

  return result;
}

async function verifyContract(name: string, info: any) {
  console.log(`\n▸ Verifying ${name} at ${info.address}...`);
  try {
    await run("verify:verify", {
      address: info.address,
      contract: info.contract,
      constructorArguments: info.constructorArguments,
    });
    console.log(`  ✅ ${name} verified`);
  } catch (err: any) {
    if (err.message?.includes("Already Verified") || err.message?.includes("already verified")) {
      console.log(`  ✅ ${name} already verified`);
    } else {
      console.error(`  ❌ ${name} verification failed:`, err.message || err);
    }
  }
}

async function main() {
  console.log("═".repeat(70));
  console.log("  BaseScan Verification — Base Mainnet");
  console.log("═".repeat(70));

  // Verify existing contracts
  console.log("\n── Existing contracts ──");
  for (const [name, info] of Object.entries(EXISTING_CONTRACTS)) {
    await verifyContract(name, info);
  }

  // Verify new 3.0.4 contracts
  console.log("\n── New 3.0.4 contracts ──");
  const newContracts = loadNewContracts();
  if (Object.keys(newContracts).length === 0) {
    console.log("  ⚠️  No deployed-defi.json or deployed-farm-base.json found.");
    console.log("  Run deploy-defi.ts and deploy-farm.ts first.");
  } else {
    for (const [name, info] of Object.entries(newContracts)) {
      await verifyContract(name, info);
    }
  }
}

main().catch(console.error);
