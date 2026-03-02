import { ethers } from "hardhat";
const WZION = "0x0c493763d107ab0ABb0aee1Ca3999292d8202bb6";
const FARM  = "0x1B8BA92C401d53cBcEc422BAD4b83fABcb0A3843";
async function main() {
  const [s] = await ethers.getSigners();
  const eth = await ethers.provider.getBalance(s.address);
  const wzion = await ethers.getContractAt("WZION", WZION);
  const w = await wzion.balanceOf(s.address);
  const farm = await ethers.getContractAt("ZIONFarm", FARM);
  const rewardPool = await farm.rewardPoolBalance();
  console.log("Deployer:", s.address);
  console.log("ETH:     ", ethers.formatEther(eth));
  console.log("wZION:   ", ethers.formatEther(w));
  console.log("Farm rewardPool:", ethers.formatEther(rewardPool), "wZION");
}
main().catch(e => { console.error(e); process.exit(1); });
