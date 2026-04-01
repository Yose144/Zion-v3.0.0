import { ethers } from "hardhat";

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Deployer:", deployer.address);
  console.log("Nonce:", await ethers.provider.getTransactionCount(deployer.address));

  const wzionAddr = "0x0c493763d107ab0ABb0aee1Ca3999292d8202bb6";
  const bridgeAddr = "0xa5a09b2C09A7182BBA9623A2D2cd46cD7D041721";

  const wzionAbi = [
    "function BRIDGE_ROLE() view returns (bytes32)",
    "function grantRole(bytes32 role, address account) returns (bool)",
    "function hasRole(bytes32 role, address account) view returns (bool)",
  ];
  const wzion = new ethers.Contract(wzionAddr, wzionAbi, deployer);
  const BRIDGE_ROLE = await wzion.BRIDGE_ROLE();
  console.log("BRIDGE_ROLE:", BRIDGE_ROLE);

  const hasRole = await wzion.hasRole(BRIDGE_ROLE, bridgeAddr);
  console.log("Bridge already has BRIDGE_ROLE:", hasRole);

  if (!hasRole) {
    console.log("Granting BRIDGE_ROLE...");
    const tx = await wzion.grantRole(BRIDGE_ROLE, bridgeAddr);
    const receipt = await tx.wait();
    console.log("TX hash:", receipt!.hash);
    console.log("BRIDGE_ROLE granted!");
  } else {
    console.log("Already granted, skipping.");
  }

  const finalCheck = await wzion.hasRole(BRIDGE_ROLE, bridgeAddr);
  console.log("Final check — bridge has BRIDGE_ROLE:", finalCheck);
}

main().catch(e => { console.error(e); process.exit(1); });
