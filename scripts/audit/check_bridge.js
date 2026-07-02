const {ethers} = require('ethers');

// Works with both ethers v5 and v6
const ROLE = ethers.utils ? ethers.utils.id('VALIDATOR_ROLE') : ethers.id('VALIDATOR_ROLE');
console.log('VALIDATOR_ROLE:', ROLE);

// 2026-07-02: live Base ZIONBridge is 0x72c8f0Dc...
const provider = new ethers.providers.JsonRpcProvider('https://mainnet.base.org');
const bridge = new ethers.Contract('0x72c8f0Dc60E27aB7A83fe3B416fab4F0600a6467', [
  'function hasRole(bytes32,address) view returns (bool)',
  'function threshold() view returns (uint8)',
  'function validatorCount() view returns (uint8)',
  'function paused() view returns (bool)',
  'function totalLocksProcessed() view returns (uint256)',
  'function dailyMinted() view returns (uint256)',
  'function dailyResetTimestamp() view returns (uint256)',
  'function getLockProofStatus(bytes32) view returns (uint8 confirmations, bool executed, bool timelocked, uint256 timelockExpiry, address recipient, uint256 amount)'
], provider);

(async () => {
  const validators = [
    '0xdde17506BC2D2dCE1d594bD1D85B0BAbb389D186',
    '0x24d986841E56e5571489B25951eE8C1Ae761FA82',
    '0x665c55eDCF25c2c5A1dfF1B20eE950cBDC58d3d0',
    '0x8E644b3E9FaBf52eE321DC5B3D5AA06d6e3E66C6',
    '0x7e0D2eD71d78B9CFB5034A83333e82e304bc4CB2',
  ];

  for (const v of validators) {
    const hasRole = await bridge.hasRole(ROLE, v);
    console.log(`  ${v}: VALIDATOR_ROLE=${hasRole}`);
  }

  const t = await bridge.threshold();
  console.log('threshold:', t);
  const vc = await bridge.validatorCount();
  console.log('validatorCount:', vc);
  const paused = await bridge.paused();
  console.log('paused:', paused);
  const dm = await bridge.dailyMinted();
  console.log('dailyMinted:', ethers.utils.formatEther(dm));
  const drs = await bridge.dailyResetTimestamp();
  console.log('dailyResetTimestamp:', new Date(Number(drs)*1000).toISOString());

  // Check lock proof status for the L1 TX hash from the reverted TX
  // l1TxHash from input data: 09fc9abb00c5b95e797709259731313afca5e0cc4a14f6687351e9295c1c6bc1
  const l1TxHash = '0x09fc9abb00c5b95e797709259731313afca5e0cc4a14f6687351e9295c1c6bc1';
  try {
    const status = await bridge.getLockProofStatus(l1TxHash);
    console.log('\nLockProof for', l1TxHash);
    console.log('  confirmations:', status.confirmations);
    console.log('  executed:', status.executed);
    console.log('  timelocked:', status.timelocked);
    console.log('  timelockExpiry:', status.timelockExpiry > 0 ? new Date(Number(status.timelockExpiry)*1000).toISOString() : '0');
    console.log('  recipient:', status.recipient);
    console.log('  amount:', ethers.utils.formatEther(status.amount));
  } catch (e) {
    console.log('getLockProofStatus error:', e.message);
  }
})();
