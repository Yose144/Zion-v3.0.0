/**
 * Seed ZIONFarm reward pool with wZION
 * Usage: npx hardhat run scripts/fund-farm.ts --network base-sepolia
 */
import { ethers } from "hardhat";

const FARM_ADDR  = "0x1B8BA92C401d53cBcEc422BAD4b83fABcb0A3843";
const WZION_ADDR = "0x0c493763d107ab0ABb0aee1Ca3999292d8202bb6";
const AMOUNT     = ethers.parseEther("500"); // 500 wZION seed

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log(`Seeding ZIONFarm — deployer: ${deployer.address}`);

  const wzion = await ethers.getContractAt("WZION", WZION_ADDR);
  const farm  = await ethers.getContractAt("ZIONFarm", FARM_ADDR);

  const bal = await wzion.balanceOf(deployer.address);
  console.log(`wZION balance: ${ethers.formatEther(bal)}`);
  if (bal < AMOUNT) throw new Error(`Insufficient wZION (have ${ethers.formatEther(bal)}, need 500)`);

  // Use high gas to clear any stuck pending txs
  const gasOpts = {
    maxFeePerGas: ethers.parseUnits("10", "gwei"),
    maxPriorityFeePerGas: ethers.parseUnits("2", "gwei"),
  };

  // approve
  console.log("Approving...");
  const tx1 = await wzion.approve(FARM_ADDR, AMOUNT, gasOpts);
  await tx1.wait();
  console.log("✅ Approved");

  // fundRewards
  console.log("Funding rewards...");
  const tx2 = await farm.fundRewards(AMOUNT, gasOpts);
  await tx2.wait();

  const pool = await farm.rewardPoolBalance();
  console.log(`✅ Farm rewardPoolBalance: ${ethers.formatEther(pool)} wZION`);
}
main().catch(e => { console.error(e); process.exit(1); });
