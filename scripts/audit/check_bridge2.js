const {ethers} = require('ethers');

// 2026-07-02: live Base ZIONBridge is 0x72c8f0Dc...
const provider = new ethers.providers.JsonRpcProvider('https://mainnet.base.org');
const bridge = new ethers.Contract('0x72c8f0Dc60E27aB7A83fe3B416fab4F0600a6467', [
  'function getLockProofStatus(bytes32) view returns (uint8 confirmations, bool executed, bool timelocked, uint256 timelockExpiry, address recipient, uint256 amount)',
  'function dailyMinted() view returns (uint256)',
  'function dailyRemaining() view returns (uint256, uint256)',
  'function totalLocksProcessed() view returns (uint256)'
], provider);

const lockTxHashes = [
  '0x035c761db8a7e9d847ff56a8d8f8d7b37703631fac2b64453fb02fb20a1ef691',
  '0x09fc9abb00c5b95e797709259731313afca5e0cc4a14f6687351e9295c1c6bc1',
  '0x2cd12d90b10b3ce7218a17dd804d36ad9c8d5870f42e27132c91c33e92f8458e',
  '0x4b43e7a3623ec3d4c007c134bd831a21d6628195643c1d6a33a889324fecfe59',
  '0x6bc2aa3e2879dfb3d98b35b1a09d7abee8fa9e5f3092a464c0679e84d6519ef4',
  '0x8eb0bb8cf048f0afdd5b319f2799935b7b4dd6c2e4068ad48a39ed889a4571f5',
  '0xd9ddb3c7aaf2ad3a320c2878a1822298ec438240d9a9ffdbca95d256ec637cdb',
];

(async () => {
  console.log('=== Bridge Contract Status ===');
  const dm = await bridge.dailyMinted();
  console.log('dailyMinted:', ethers.utils.formatEther(dm));
  const [mintLeft, burnLeft] = await bridge.dailyRemaining();
  console.log('dailyRemaining mint:', ethers.utils.formatEther(mintLeft));
  console.log('dailyRemaining burn:', ethers.utils.formatEther(burnLeft));
  const tlp = await bridge.totalLocksProcessed();
  console.log('totalLocksProcessed:', tlp);

  let totalAmount = ethers.BigNumber.from(0);
  let readyToExecute = 0;
  let timelockExpired = 0;

  for (const hash of lockTxHashes) {
    try {
      const s = await bridge.getLockProofStatus(hash);
      const expiry = s.timelockExpiry > 0 ? new Date(Number(s.timelockExpiry)*1000).toISOString() : 'N/A';
      const now = Math.floor(Date.now()/1000);
      const expired = s.timelocked && Number(s.timelockExpiry) > 0 && Number(s.timelockExpiry) < now;
      console.log(`\n${hash.substring(0,16)}...`);
      console.log(`  confirmations: ${s.confirmations}/5  executed: ${s.executed}  timelocked: ${s.timelocked}`);
      console.log(`  timelockExpiry: ${expiry}  expired: ${expired}`);
      console.log(`  amount: ${ethers.utils.formatEther(s.amount)} wZION`);
      if (!s.executed && s.confirmations >= 5) {
        totalAmount = totalAmount.add(s.amount);
        if (expired) timelockExpired++;
        readyToExecute++;
      }
    } catch (e) {
      console.log(`Error for ${hash.substring(0,16)}: ${e.message}`);
    }
  }

  console.log('\n=== Summary ===');
  console.log('Ready to execute (5/5 confirmed, not executed):', readyToExecute);
  console.log('Timelock expired:', timelockExpired);
  console.log('Total amount to mint:', ethers.utils.formatEther(totalAmount), 'wZION');
  console.log('DAILY_LIMIT: 10,000,000 wZION');
  console.log('Can execute?', totalAmount.lte(ethers.utils.parseEther('10000000')) ? 'YES' : 'NO - exceeds DAILY_LIMIT');
})();
