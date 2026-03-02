/**
 * Post-deploy setup: addPool(0) + REWARD_FUNDER_ROLE for already-deployed ZIONFarm
 * Usage: npx hardhat run scripts/setup-farm.ts --network base-sepolia
 */
import { ethers } from "hardhat";
import * as fs from "fs";

const FARM_ADDR  = "0x1B8BA92C401d53cBcEc422BAD4b83fABcb0A3843";
const WZION_ADDR = "0x0c493763d107ab0ABb0aee1Ca3999292d8202bb6";

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log(`Deployer: ${deployer.address}`);

  const farm = await ethers.getContractAt("ZIONFarm", FARM_ADDR);

  // Check if pool 0 already exists
  const poolCount = await farm.poolCount();
  if (poolCount === 0n) {
    console.log("Adding Pool 0: wZION single-asset staking...");
    const tx = await farm.addPool(100, WZION_ADDR, "wZION Single", false);
    await tx.wait();
    console.log("✅ Pool 0 added");
  } else {
    console.log(`Pool count already: ${poolCount}`);
  }

  // Grant REWARD_FUNDER_ROLE to deployer
  const REWARD_FUNDER_ROLE = await farm.REWARD_FUNDER_ROLE();
  const hasRole = await farm.hasRole(REWARD_FUNDER_ROLE, deployer.address);
  if (!hasRole) {
    const tx2 = await farm.grantRole(REWARD_FUNDER_ROLE, deployer.address);
    await tx2.wait();
    console.log("✅ REWARD_FUNDER_ROLE granted");
  } else {
    console.log("✅ REWARD_FUNDER_ROLE already set");
  }

  // Save deployment info
  const info = {
    network:          "base-sepolia",
    deployedAt:       new Date().toISOString(),
    deployer:         deployer.address,
    ZIONFarm:         FARM_ADDR,
    rewardToken:      WZION_ADDR,
    rewardPerSecond:  ethers.parseEther("3").toString(),
    halvingInterval:  90 * 24 * 3600,
    pools: [{ pid: 0, name: "wZION Single", lpToken: WZION_ADDR, allocPoints: 100 }],
  };
  fs.writeFileSync("deployed-farm-base-sepolia.json", JSON.stringify(info, null, 2));
  console.log("📄 deployed-farm-base-sepolia.json saved");

  console.log("\n✅ ZIONFarm setup complete");
  console.log(`   Farm:  ${FARM_ADDR}`);
  console.log(`   wZION: ${WZION_ADDR}`);
}

main().catch(e => { console.error(e); process.exit(1); });
