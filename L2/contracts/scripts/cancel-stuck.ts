/**
 * Cancel stuck pending tx by sending 0 ETH to self with same nonce + high gas
 */
import { ethers } from "hardhat";
async function main() {
  const [s] = await ethers.getSigners();
  const confirmed = await ethers.provider.getTransactionCount(s.address, "latest");
  const pending   = await ethers.provider.getTransactionCount(s.address, "pending");
  console.log(`Confirmed nonce: ${confirmed}`);
  console.log(`Pending nonce:   ${pending}`);
  if (pending === confirmed) { console.log("No stuck txs"); return; }
  // Cancel each stuck nonce
  for (let n = confirmed; n < pending; n++) {
    console.log(`Cancelling nonce ${n}...`);
    const tx = await s.sendTransaction({
      to: s.address, value: 0n, nonce: n,
      maxFeePerGas:         ethers.parseUnits("50", "gwei"),
      maxPriorityFeePerGas: ethers.parseUnits("10", "gwei"),
    });
    await tx.wait();
    console.log(`✅ Nonce ${n} cleared: ${tx.hash}`);
  }
}
main().catch(e => { console.error(e); process.exit(1); });
