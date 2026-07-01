const {ethers} = require('ethers');
const provider = new ethers.providers.JsonRpcProvider('https://mainnet.base.org');
const bridge = new ethers.Contract('0x89504D6eD6993d726438E1A9C18aaC79e8d0eF88', [
  'function getLockProofStatus(bytes32) view returns (uint8 confirmations, bool executed, bool timelocked, uint256 timelockExpiry, address recipient, uint256 amount)'
], provider);

(async () => {
  const s = await bridge.getLockProofStatus('0x8eb0bb8cf048f0afdd5b319f2799935b7b4dd6c2e4068ad48a39ed889a4571f5');
  console.log('7th lock (100 wZION):');
  console.log('  confirmations:', s.confirmations, '/ 5');
  console.log('  executed:', s.executed);
  console.log('  timelocked:', s.timelocked);
  console.log('  amount:', ethers.utils.formatEther(s.amount), 'wZION');
  console.log('  recipient:', s.recipient);
})();
