const { ethers } = require('ethers');
const provider = new ethers.providers.JsonRpcProvider('https://mainnet.base.org');

const wZION = new ethers.Contract('0x0c493763d107ab0ABb0aee1Ca3999292d8202bb6', [
  'function totalSupply() view returns (uint256)',
  'function balanceOf(address) view returns (uint256)',
  'function BRIDGE_ROLE() view returns (bytes32)',
  'function DEFAULT_ADMIN_ROLE() view returns (bytes32)',
  'function hasRole(bytes32,address) view returns (bool)',
  'function getRoleMemberCount(bytes32) view returns (uint256)',
  'function getRoleMember(bytes32,uint256) view returns (address)',
  'function processedL1Locks(bytes32) view returns (bool)',
  'function paused() view returns (bool)',
], provider);

const bridge = new ethers.Contract('0x72c8f0Dc60E27aB7A83fe3B416fab4F0600a6467', [
  'function dailyLimit() view returns (uint256)',
  'function totalMinted() view returns (uint256)',
  'function totalBurned() view returns (uint256)',
  'function threshold() view returns (uint256)',
  'function validatorCount() view returns (uint256)',
], provider);

const deployer = '0xdde17506BC2D2dCE1d594bD1D85B0BAbb389D186';

(async () => {
  const totalSupply = await wZION.totalSupply();
  console.log('wZION totalSupply:', ethers.utils.formatEther(totalSupply));

  const deployerBal = await wZION.balanceOf(deployer);
  console.log('Deployer wZION balance:', ethers.utils.formatEther(deployerBal));

  const BRIDGE_ROLE = await wZION.BRIDGE_ROLE();
  const ADMIN_ROLE = await wZION.DEFAULT_ADMIN_ROLE();

  console.log('\n=== Roles on wZION ===');
  console.log('Deployer has BRIDGE_ROLE:', await wZION.hasRole(BRIDGE_ROLE, deployer));
  console.log('Deployer has ADMIN_ROLE:', await wZION.hasRole(ADMIN_ROLE, deployer));
  console.log('Bridge (0x72c8...) has BRIDGE_ROLE:', await wZION.hasRole(BRIDGE_ROLE, '0x72c8f0Dc60E27aB7A83fe3B416fab4F0600a6467'));
  console.log('Old bridge (0x89504D...) has BRIDGE_ROLE:', await wZION.hasRole(BRIDGE_ROLE, '0x89504D6eD6993d726438E1A9C18aaC79e8d0eF88'));
  console.log('Old bridge (0xa5a09b...) has BRIDGE_ROLE:', await wZION.hasRole(BRIDGE_ROLE, '0xa5a09b2C09A7182BBA9623A2D2cd46cD7D041721'));

  const bridgeRoleCount = await wZION.getRoleMemberCount(BRIDGE_ROLE);
  console.log('\nBRIDGE_ROLE member count:', bridgeRoleCount.toString());
  for (let i = 0; i < bridgeRoleCount; i++) {
    const member = await wZION.getRoleMember(BRIDGE_ROLE, i);
    console.log('  BRIDGE_ROLE member', i, ':', member);
  }

  console.log('\n=== Bridge contract state ===');
  try {
    console.log('Bridge dailyLimit:', ethers.utils.formatEther(await bridge.dailyLimit()));
  } catch(e) { console.log('Bridge dailyLimit: ERROR', e.message.substring(0,80)); }
  try {
    console.log('Bridge totalMinted:', ethers.utils.formatEther(await bridge.totalMinted()));
  } catch(e) { console.log('Bridge totalMinted: ERROR', e.message.substring(0,80)); }
  try {
    console.log('Bridge totalBurned:', ethers.utils.formatEther(await bridge.totalBurned()));
  } catch(e) { console.log('Bridge totalBurned: ERROR', e.message.substring(0,80)); }
  try {
    console.log('Bridge threshold:', (await bridge.threshold()).toString());
  } catch(e) { console.log('Bridge threshold: ERROR', e.message.substring(0,80)); }
  try {
    console.log('Bridge validatorCount:', (await bridge.validatorCount()).toString());
  } catch(e) { console.log('Bridge validatorCount: ERROR', e.message.substring(0,80)); }

  console.log('\n=== wZION paused? ===');
  console.log('paused:', await wZION.paused());

  // Check top holders by checking common addresses
  console.log('\n=== Balance check ===');
  const addrs = [
    deployer,
    '0x72c8f0Dc60E27aB7A83fe3B416fab4F0600a6467', // bridge
    '0x89504D6eD6993d726438E1A9C18aaC79e8d0eF88', // old bridge
    '0x186b46c2f04153999d44D25179cD623fD62Bfda2', // USDT pool
    '0x18c0DaeF295E63F1bfBC7C39e71d0fabf4600699', // WETH pool
    '0xF38c56bbBBBC6d9FA11E7DE84bF7Bb70e1e8D2b3', // SOL pool
  ];
  for (const a of addrs) {
    const bal = await wZION.balanceOf(a);
    console.log('  ', a, ':', ethers.utils.formatEther(bal));
  }
})();
