/**
 * wrap-eth.ts — Wrap ETH → WETH on Base Sepolia
 * Usage: WRAP_AMOUNT=0.005 npx hardhat run scripts/wrap-eth.ts --network base-sepolia
 */
import { ethers, network } from "hardhat";

const WETH_ABI = [
  "function deposit() payable",
  "function balanceOf(address) view returns (uint256)",
  "function withdraw(uint256) external",
];

async function main() {
  const [signer] = await ethers.getSigners();
  const wethAddress = "0x4200000000000000000000000000000000000006";
  const weth = new ethers.Contract(wethAddress, WETH_ABI, signer);

  const amountStr = process.env.WRAP_AMOUNT || "0.005";
  const amount = ethers.parseEther(amountStr);

  const ethBefore = await ethers.provider.getBalance(signer.address);
  const wethBefore = await weth.balanceOf(signer.address);
  console.log(`Network:     ${network.name}`);
  console.log(`Signer:      ${signer.address}`);
  console.log(`ETH before:  ${ethers.formatEther(ethBefore)}`);
  console.log(`WETH before: ${ethers.formatEther(wethBefore)}`);
  console.log(`Wrapping:    ${amountStr} ETH → WETH ...`);

  const tx = await weth.deposit({ value: amount });
  await tx.wait();
  console.log(`TX: ${tx.hash}`);

  const wethAfter = await weth.balanceOf(signer.address);
  const ethAfter = await ethers.provider.getBalance(signer.address);
  console.log(`ETH after:   ${ethers.formatEther(ethAfter)}`);
  console.log(`WETH after:  ${ethers.formatEther(wethAfter)}`);
  console.log(`✅ Done`);
}

main().catch((e) => { console.error(e); process.exit(1); });
