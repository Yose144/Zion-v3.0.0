const { ethers } = require('ethers');
const p = new ethers.providers.JsonRpcProvider('https://mainnet.base.org');

const wZION = new ethers.Contract('0x0c493763d107ab0ABb0aee1Ca3999292d8202bb6', [
  'function processedL1Locks(bytes32) view returns (bool)',
], p);

const bridge = new ethers.Contract('0x72c8f0Dc60E27aB7A83fe3B416fab4F0600a6467', [
  'function lockProofs(bytes32) view returns (uint8 confirmations, bool executed, uint256 timelockExpiry, address recipient, uint256 amount)',
], p);

const locks = [
  { hash: '0x6de6a6382b9b6f42b5169df088ed2bab6abedd889078a08df373ae2d6e5ddcb3', note: '99.99M (Failed in DB)' },
  { hash: '0x8eb0bb8cf048f0afdd5b319f2799935b7b4dd6c2e4068ad48a39ed889a4571f5', note: '100 ZION' },
  { hash: '0xd9ddb3c7aaf2ad3a320c2878a1822298ec438240d9a9ffdbca95d256ec637cdb', note: '16.67M #1' },
  { hash: '0x09fc9abb00c5b95e797709259731313afca5e0cc4a14f6687351e9295c1c6bc1', note: '16.67M #2' },
  { hash: '0x035c761db8a7e9d847ff56a8d8f8d7b37703631fac2b64453fb02fb20a1ef691', note: '16.67M #3' },
  { hash: '0x4b43e7a3623ec3d4c007c134bd831a21d6628195643c1d6a33a889324fecfe59', note: '16.67M #4' },
  { hash: '0x2cd12d90b10b3ce7218a17dd804d36ad9c8d5870f42e27132c91c33e92f8458e', note: '16.67M #5' },
  { hash: '0x6bc2aa3e2879dfb3d98b35b1a09d7abee8fa9e5f3092a464c0679e84d6519ef4', note: '16.67M #6' },
];

(async () => {
  console.log('=== processedL1Locks on wZION ===');
  for (const lock of locks) {
    try {
      const processed = await wZION.processedL1Locks(lock.hash);
      console.log(lock.note, '→ processed:', processed);
    } catch(e) {
      console.log(lock.note, '→ ERROR:', e.message.substring(0, 60));
    }
  }

  console.log('\n=== lockProofs on bridge ===');
  for (const lock of locks) {
    try {
      const proof = await bridge.lockProofs(lock.hash);
      console.log(lock.note, '→ conf=' + proof.confirmations + ' executed=' + proof.executed + ' amount=' + ethers.utils.formatEther(proof.amount) + ' recipient=' + proof.recipient);
    } catch(e) {
      console.log(lock.note, '→ ERROR:', e.message.substring(0, 60));
    }
  }
})();
