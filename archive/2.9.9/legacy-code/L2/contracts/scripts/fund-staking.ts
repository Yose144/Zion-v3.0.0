/**
 * Fund ZIONStaking reward pool with wZION
 * Usage: npx hardhat run scripts/fund-staking.ts --network base-sepolia
 */
import { ethers } from "hardhat";

const STAKING_ADDR = "0x487D87E243f87b1DDEEDEB890c40F2cEcCf67913";
const WZION_ADDR   = "0x0c493763d107ab0ABb0aee1Ca3999292d8202bb6";
const AMOUNT       = ethers.parseEther("50"); // 50 wZION seed

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log(`Funding ZIONStaking — deployer: ${deployer.address}`);

  const wzion   = await ethers.getContractAt("WZION", WZION_ADDR);
  const staking = await ethers.getContractAt("ZIONStaking", STAKING_ADDR);

  const bal = await wzion.balanceOf(deployer.address);
  console.log(`wZION balance: ${ethers.formatEther(bal)}`);
  if (bal < AMOUNT) throw new Error(`Insufficient wZION (have ${ethers.formatEther(bal)}, need 50)`);

  // approve
  console.log("Approving wZION...");
  const tx1 = await wzion.approve(STAKING_ADDR, AMOUNT);
  await tx1.wait();
  console.log(`✅ Approved: ${tx1.hash}`);

  // fund
  console.log("Funding reward pool...");
  const tx2 = await staking.fundRewardPool(AMOUNT);
  await tx2.wait();
  console.log(`✅ Funded: ${tx2.hash}`);

  const pool = await staking.rewardPoolBalance();
  console.log(`✅ Staking rewardPoolBalance: ${ethers.formatEther(pool)} wZION`);
}
main().catch(e => { console.error(e); process.exit(1); });
