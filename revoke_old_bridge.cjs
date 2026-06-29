const { ethers } = require('ethers');
const provider = new ethers.providers.JsonRpcProvider('https://mainnet.base.org');
const pk = process.env.ZION_VALIDATOR_PRIVATE_KEY;
if (!pk) { console.error('ZION_VALIDATOR_PRIVATE_KEY not set'); process.exit(1); }
console.log('Key starts with:', pk.substring(0, 8) + '...');
const wallet = new ethers.Wallet(pk, provider);
console.log('Wallet address:', wallet.address);

const wZION = new ethers.Contract('0x0c493763d107ab0ABb0aee1Ca3999292d8202bb6', [
  'function BRIDGE_ROLE() view returns (bytes32)',
  'function hasRole(bytes32,address) view returns (bool)',
  'function revokeRole(bytes32,address) returns (bool)',
], wallet);

const OLD = '0xa5a09b2C09A7182BBA9623A2D2cd46cD7D041721';
const NEW = '0x72c8f0Dc60E27aB7A83fe3B416fab4F0600a6467';

(async () => {
  const ROLE = await wZION.BRIDGE_ROLE();
  console.log('Before: old bridge BRIDGE_ROLE =', await wZION.hasRole(ROLE, OLD));
  console.log('Before: new bridge BRIDGE_ROLE =', await wZION.hasRole(ROLE, NEW));

  const ethBal = await provider.getBalance(wallet.address);
  console.log('Deployer ETH:', ethers.utils.formatEther(ethBal));

  if (await wZION.hasRole(ROLE, OLD)) {
    console.log('Revoking BRIDGE_ROLE from old bridge...');
    const tx = await wZION.revokeRole(ROLE, OLD);
    console.log('TX:', tx.hash);
    const r = await tx.wait();
    console.log('Confirmed block', r.blockNumber, 'gas', r.gasUsed.toString());
  } else {
    console.log('Old bridge does not have BRIDGE_ROLE — nothing to revoke');
  }

  console.log('After: old bridge BRIDGE_ROLE =', await wZION.hasRole(ROLE, OLD));
  console.log('After: new bridge BRIDGE_ROLE =', await wZION.hasRole(ROLE, NEW));
})();
