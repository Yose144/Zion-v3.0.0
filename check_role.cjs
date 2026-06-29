const { ethers } = require('ethers');
const p = new ethers.providers.JsonRpcProvider('https://mainnet.base.org');
const wZION = new ethers.Contract('0x0c493763d107ab0ABb0aee1Ca3999292d8202bb6', [
  'function BRIDGE_ROLE() view returns (bytes32)',
  'function hasRole(bytes32,address) view returns (bool)',
  'function getRoleMemberCount(bytes32) view returns (uint256)',
  'function getRoleMember(bytes32,uint256) view returns (address)',
], p);

const OLD = '0xa5a09b2C09A7182BBA9623A2D2cd46cD7D041721';
const NEW = '0x72c8f0Dc60E27aB7A83fe3B416fab4F0600a6467';
const DEPLOYER = '0xdde17506BC2D2dCE1d594bD1D85B0BAbb389D186';

(async () => {
  const ROLE = await wZION.BRIDGE_ROLE();
  console.log('BRIDGE_ROLE hash:', ROLE);

  // Check the revoke TX receipt
  const tx = '0xfa665d2ab892f2960407878b15767352abf4c0dd65fa706570322132d22fe9ad';
  const receipt = await p.getTransactionReceipt(tx);
  console.log('Revoke TX status:', receipt.status);
  console.log('Revoke TX logs:', receipt.logs.length);
  for (const l of receipt.logs) {
    console.log('  addr:', l.address, 'topic0:', l.topics[0]);
  }

  // Check role members
  const count = await wZION.getRoleMemberCount(ROLE);
  console.log('\nBRIDGE_ROLE member count:', count.toString());
  for (let i = 0; i < count; i++) {
    const m = await wZION.getRoleMember(ROLE, i);
    console.log('  member', i, ':', m);
  }

  console.log('\nDirect hasRole checks:');
  console.log('  Old bridge:', await wZION.hasRole(ROLE, OLD));
  console.log('  New bridge:', await wZION.hasRole(ROLE, NEW));
  console.log('  Deployer:', await wZION.hasRole(ROLE, DEPLOYER));
})();
