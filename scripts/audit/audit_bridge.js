const { ethers } = require('ethers');
const provider = new ethers.providers.JsonRpcProvider('https://mainnet.base.org');

const bridge = new ethers.Contract('0x72c8f0Dc60E27aB7A83fe3B416fab4F0600a6467', [
  'function dailyLimit() view returns (uint256)',
  'function totalMinted() view returns (uint256)',
  'function totalBurned() view returns (uint256)',
  'function threshold() view returns (uint256)',
  'function validatorCount() view returns (uint256)',
  'function maxSingleAmount() view returns (uint256)',
  'function timelockThreshold() view returns (uint256)',
  'function processedL1Locks(bytes32) view returns (bool)',
  'function getLockProofStatus(bytes32) view returns (uint8 confirmations, bool executed, bool timelocked, uint256 timelockExpiry, address recipient, uint256 amount)',
], provider);

const oldBridge = new ethers.Contract('0xa5a09b2C09A7182BBA9623A2D2cd46cD7D041721', [
  'function dailyLimit() view returns (uint256)',
  'function totalMinted() view returns (uint256)',
  'function totalBurned() view returns (uint256)',
], provider);

(async () => {
  console.log('=== NEW Bridge (0x72c8...) ===');
  try { console.log('dailyLimit:', ethers.utils.formatEther(await bridge.dailyLimit())); } catch(e) { console.log('dailyLimit: ERROR'); }
  try { console.log('totalMinted:', ethers.utils.formatEther(await bridge.totalMinted())); } catch(e) { console.log('totalMinted: ERROR', e.message.substring(0,80)); }
  try { console.log('totalBurned:', ethers.utils.formatEther(await bridge.totalBurned())); } catch(e) { console.log('totalBurned: ERROR', e.message.substring(0,80)); }
  try { console.log('threshold:', (await bridge.threshold()).toString()); } catch(e) { console.log('threshold: ERROR'); }
  try { console.log('validatorCount:', (await bridge.validatorCount()).toString()); } catch(e) { console.log('validatorCount: ERROR'); }
  try { console.log('maxSingleAmount:', ethers.utils.formatEther(await bridge.maxSingleAmount())); } catch(e) { console.log('maxSingleAmount: ERROR'); }
  try { console.log('timelockThreshold:', ethers.utils.formatEther(await bridge.timelockThreshold())); } catch(e) { console.log('timelockThreshold: ERROR'); }

  console.log('\n=== OLD Bridge (0xa5a09b...) ===');
  try { console.log('dailyLimit:', ethers.utils.formatEther(await oldBridge.dailyLimit())); } catch(e) { console.log('dailyLimit: ERROR', e.message.substring(0,80)); }
  try { console.log('totalMinted:', ethers.utils.formatEther(await oldBridge.totalMinted())); } catch(e) { console.log('totalMinted: ERROR', e.message.substring(0,80)); }
  try { console.log('totalBurned:', ethers.utils.formatEther(await oldBridge.totalBurned())); } catch(e) { console.log('totalBurned: ERROR', e.message.substring(0,80)); }

  // Check the 7 L1 lock hashes on new bridge
  console.log('\n=== Lock proofs on NEW bridge ===');
  const locks = [
    '0x035c761d', '0x09fc9abb', '0x2cd12d90', '0x4b43e7a3',
    '0x6bc2aa3e', '0xd9ddb3c7', '0x8eb0bb8c',
  ];
  // We need full hashes - let me check a few known ones
  const fullLocks = [
    '0x8eb0bb8cf048f0afdd5b319f2799935b7b4dd6c2e4068ad48a39ed889a4571f5', // 100 ZION
  ];
  for (const hash of fullLocks) {
    try {
      const s = await bridge.getLockProofStatus(hash);
      console.log(hash.substring(0,12), ': conf=' + s.confirmations + ' executed=' + s.executed + ' amount=' + ethers.utils.formatEther(s.amount));
    } catch(e) { console.log(hash.substring(0,12), ': ERROR', e.message.substring(0,80)); }
  }

  // Check ETH balance of deployer
  const deployer = '0xdde17506BC2D2dCE1d594bD1D85B0BAbb389D186';
  const ethBal = await provider.getBalance(deployer);
  console.log('\n=== Deployer ===');
  console.log('ETH:', ethers.utils.formatEther(ethBal));
})();
