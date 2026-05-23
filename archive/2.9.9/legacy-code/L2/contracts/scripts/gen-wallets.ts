/**
 * ZION Bridge — Testnet Wallet Generator
 *
 * Generates 2 fresh validator wallets for testnet deployment.
 * Private keys are shown ONCE — save them securely immediately!
 *
 * Usage:
 *   npx hardhat run scripts/gen-wallets.ts --network hardhat
 *
 * WARNING: Run only on your local machine. Never share private keys!
 */

import { ethers } from "hardhat";

async function main() {
  console.log("═".repeat(62));
  console.log("  ZION Bridge — Testnet Wallet Generator");
  console.log("═".repeat(62));
  console.log("");
  console.log("⚠️  SECURITY: Do NOT run this script on a shared machine!");
  console.log("⚠️  Save the private keys in a password manager immediately.");
  console.log("");

  // Generate 2 fresh wallets
  const validator1 = ethers.Wallet.createRandom();
  const validator2 = ethers.Wallet.createRandom();

  console.log("── Validator 1 (Deployer & primary relay) ────────────────");
  console.log(`   Address:     ${validator1.address}`);
  console.log(`   Private key: ${validator1.privateKey}`);
  console.log(`   Mnemonic:    ${validator1.mnemonic?.phrase ?? "N/A"}`);
  console.log("");

  console.log("── Validator 2 (Secondary relay) ──────────────────────────");
  console.log(`   Address:     ${validator2.address}`);
  console.log(`   Private key: ${validator2.privateKey}`);
  console.log(`   Mnemonic:    ${validator2.mnemonic?.phrase ?? "N/A"}`);
  console.log("");

  console.log("═".repeat(62));
  console.log("  Next steps:");
  console.log("═".repeat(62));
  console.log("");
  console.log("1️⃣  Fund Validator 1 with Base Sepolia ETH (~0.02 ETH):");
  console.log(`    https://www.alchemy.com/faucets/base-sepolia`);
  console.log(`    https://faucet.quicknode.com/base/sepolia`);
  console.log(`    Wallet: ${validator1.address}`);
  console.log("");
  console.log("2️⃣  Create .env file in L2/contracts/:");
  console.log(`    cp .env.example .env`);
  console.log(`    # Set DEPLOYER_PRIVATE_KEY=${validator1.privateKey}`);
  console.log(`    # Set VALIDATOR2_ADDRESS=${validator2.address}`);
  console.log("");
  console.log("3️⃣  Deploy to Base Sepolia:");
  console.log("    npx hardhat run scripts/deploy.ts --network base-sepolia");
  console.log("");
  console.log("4️⃣  Update config/bridge-testnet.toml with deployed addresses.");
  console.log("    See deploy output for wzion_address + bridge_contract_address.");
  console.log("");
  console.log("5️⃣  Start relay on Helsinki server:");
  console.log("    ZION_BRIDGE_CONFIG=config/bridge-testnet.toml ./zion-bridge");
  console.log("═".repeat(62));
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
