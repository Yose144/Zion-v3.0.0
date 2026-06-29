/**
 * BaseScan source-code verification for Base Mainnet contracts.
 * Usage: BASESCAN_API_KEY=... npx hardhat run scripts/verify-base-mainnet-basescan.ts --network base
 */
import { run } from "hardhat";

const DEPLOYER = "0xdde17506BC2D2dCE1d594bD1D85B0BAbb389D186";
const VALIDATOR2 = "0x8cc6F931edDAf5F14D0071727Ed1640752B5c787";

const CONTRACTS = {
  wZION: {
    address: "0x0c493763d107ab0ABb0aee1Ca3999292d8202bb6",
    contract: "sol/wZION.sol:WZION",
    constructorArguments: [DEPLOYER, DEPLOYER, DEPLOYER], // admin, bridge/minter, guardian
  },
  ZIONBridge: {
    address: "0xa5a09b2C09A7182BBA9623A2D2cd46cD7D041721",
    contract: "sol/ZIONBridge.sol:ZIONBridge",
    constructorArguments: [
      DEPLOYER,                                             // admin
      DEPLOYER,                                             // guardian
      "0x0c493763d107ab0ABb0aee1Ca3999292d8202bb6",         // wZION address
      [DEPLOYER, VALIDATOR2],                               // validators array
      1,                                                    // threshold
    ],
  },
  ZIONAtomicSwap: {
    address: "0x3DE9Ad42716854083ab837706E3961d10B0e63Eb",
    contract: "sol/ZIONAtomicSwap.sol:ZIONAtomicSwap",
    constructorArguments: [DEPLOYER, DEPLOYER], // admin, guardian
  },
};

async function main() {
  for (const [name, info] of Object.entries(CONTRACTS)) {
    console.log(`\n▸ Verifying ${name} at ${info.address}...`);
    try {
      await run("verify:verify", {
        address: info.address,
        contract: info.contract,
        constructorArguments: info.constructorArguments,
      });
      console.log(`  ✅ ${name} verified`);
    } catch (err: any) {
      if (err.message?.includes("Already Verified")) {
        console.log(`  ✅ ${name} already verified`);
      } else {
        console.error(`  ❌ ${name} verification failed:`, err.message || err);
      }
    }
  }
}

main().catch(console.error);
