import { ethers } from "hardhat";
async function main() {
  const staking = await ethers.getContractAt("ZIONStaking", "0x487D87E243f87b1DDEEDEB890c40F2cEcCf67913");
  const wzion   = await ethers.getContractAt("WZION", "0x0c493763d107ab0ABb0aee1Ca3999292d8202bb6");
  const deployer = (await ethers.getSigners())[0];

  const rewardPool = await staking.rewardPoolBalance();
  const contractBal = await wzion.balanceOf("0x487D87E243f87b1DDEEDEB890c40F2cEcCf67913");
  const deployerBal = await wzion.balanceOf(deployer.address);
  const totalStaked = await staking.totalStaked();
  const aprBps = await staking.aprBps();
  const rewardRate = await staking.rewardRatePerSecond();

  console.log("=== ZIONStaking State ===");
  console.log("rewardPoolBalance:", ethers.formatEther(rewardPool), "wZION");
  console.log("wZION in contract:", ethers.formatEther(contractBal), "wZION");
  console.log("totalStaked:      ", ethers.formatEther(totalStaked), "wZION");
  console.log("APR:              ", Number(aprBps) / 100, "%");
  console.log("rewardRate/sec:   ", rewardRate.toString(), "wei");
  console.log("deployer wZION:   ", ethers.formatEther(deployerBal));
}
main().catch(e => { console.error(e); process.exit(1); });
