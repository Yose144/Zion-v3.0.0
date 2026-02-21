const { ethers } = require("ethers");
const fs = require("fs");
require("dotenv").config();

const WZION_ADDR = "0x0c493763d107ab0ABb0aee1Ca3999292d8202bb6";
const BRIDGE_ADDR = "0xa5a09b2C09A7182BBA9623A2D2cd46cD7D041721";

async function main() {
  const provider = new ethers.JsonRpcProvider("https://sepolia.base.org");
  const wallet = new ethers.Wallet(process.env.DEPLOYER_PRIVATE_KEY, provider);
  const art = JSON.parse(fs.readFileSync("./artifacts/sol/wZION.sol/WZION.json"));
  const wzion = new ethers.Contract(WZION_ADDR, art.abi, wallet);
  const BRIDGE_ROLE = await wzion.BRIDGE_ROLE();

  const deployerHas = await wzion.hasRole(BRIDGE_ROLE, wallet.address);
  const bridgeHas = await wzion.hasRole(BRIDGE_ROLE, BRIDGE_ADDR);
  console.log("Deployer has BRIDGE_ROLE:", deployerHas);
  console.log("ZIONBridge has BRIDGE_ROLE:", bridgeHas);

  if (deployerHas) {
    console.log("Revoking deployer BRIDGE_ROLE...");
    const tx = await wzion.revokeRole(BRIDGE_ROLE, wallet.address);
    await tx.wait();
    console.log("Revoked. TX:", tx.hash);
  }

  const bal = ethers.formatEther(await provider.getBalance(wallet.address));
  console.log("Balance left:", bal, "ETH");
  console.log("wZION:      " + WZION_ADDR);
  console.log("ZIONBridge: " + BRIDGE_ADDR);
  console.log("wZION Basescan: https://sepolia.basescan.org/address/" + WZION_ADDR);
  console.log("Bridge Basescan: https://sepolia.basescan.org/address/" + BRIDGE_ADDR);
}

main().catch(e => { console.error(e.message); process.exit(1); });
