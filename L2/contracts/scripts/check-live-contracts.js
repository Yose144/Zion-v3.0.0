const { ethers } = require("hardhat");

async function main() {
  const wZION = await ethers.getContractAt("WZION", "0x0c493763d107ab0ABb0aee1Ca3999292d8202bb6");
  const bridge = await ethers.getContractAt("ZIONBridge", "0xa5a09b2C09A7182BBA9623A2D2cd46cD7D041721");
  const swap = await ethers.getContractAt("ZIONAtomicSwap", "0x3DE9Ad42716854083ab837706E3961d10B0e63Eb");

  const name = await wZION.name();
  const symbol = await wZION.symbol();
  const decimals = await wZION.decimals();
  const totalSupply = await wZION.totalSupply();
  const maxSupply = await wZION.MAX_SUPPLY();
  const minBridge = await wZION.MIN_BRIDGE_AMOUNT();
  const wPaused = await wZION.paused();

  console.log("=== wZION ===");
  console.log("name:", name);
  console.log("symbol:", symbol);
  console.log("decimals:", decimals.toString());
  console.log("totalSupply:", ethers.formatEther(totalSupply), "wZION");
  console.log("maxSupply:", ethers.formatEther(maxSupply), "wZION");
  console.log("minBridge:", ethers.formatEther(minBridge), "wZION");
  console.log("paused:", wPaused);

  const threshold = await bridge.threshold();
  const bridgePaused = await bridge.paused();
  console.log("\n=== ZIONBridge ===");
  console.log("threshold:", threshold.toString());
  console.log("paused:", bridgePaused);

  const feeBps = await swap.feeBps();
  const minTimelock = await swap.MIN_TIMELOCK();
  const maxTimelock = await swap.MAX_TIMELOCK();
  const swapPaused = await swap.paused();
  console.log("\n=== ZIONAtomicSwap ===");
  console.log("feeBps:", feeBps.toString());
  console.log("minTimelock:", minTimelock.toString(), "s");
  console.log("maxTimelock:", maxTimelock.toString(), "s");
  console.log("paused:", swapPaused);

  console.log("\n✅ ALL 3 L2 CONTRACTS LIVE ON BASE MAINNET");
}

main().catch(console.error);
