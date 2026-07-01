const { ethers } = require('ethers');
const provider = new ethers.providers.JsonRpcProvider('https://mainnet.base.org');

const wZION = new ethers.Contract('0x0c493763d107ab0ABb0aee1Ca3999292d8202bb6', [
  'function processedL1Locks(bytes32) view returns (bool)',
  'function totalSupply() view returns (uint256)',
  'function balanceOf(address) view returns (uint256)',
], provider);

// Known L1 lock hashes (full 32 bytes)
const locks = [
  { hash: '0x035c761d00000000000000000000000000000000000000000000000000000000', note: 'partial - need full hash' },
  { hash: '0x8eb0bb8cf048f0afdd5b319f2799935b7b4dd6c2e4068ad48a39ed889a4571f5', note: '100 ZION lock' },
];

// Let me also query Transfer events from wZION to find all mint events
(async () => {
  console.log('wZION totalSupply:', ethers.utils.formatEther(await wZION.totalSupply()));

  // Check the 100 ZION lock
  const processed = await wZION.processedL1Locks('0x8eb0bb8cf048f0afdd5b319f2799935b7b4dd6c2e4068ad48a39ed889a4571f5');
  console.log('100 ZION lock processed:', processed);

  // Get all Transfer events (from address(0) = mint) in last 50000 blocks
  const currentBlock = await provider.getBlockNumber();
  console.log('Current block:', currentBlock);

  const filter = {
    address: '0x0c493763d107ab0ABb0aee1Ca3999292d8202bb6',
    topics: [
      '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef', // Transfer event
      '0x0000000000000000000000000000000000000000000000000000000000000000', // from address(0)
    ],
    fromBlock: currentBlock - 100000,
    toBlock: 'latest',
  };

  const events = await provider.getLogs(filter);
  console.log('\n=== Mint events (Transfer from 0x0) ===');
  console.log('Total mint events:', events.length);
  for (const e of events) {
    const block = e.blockNumber;
    const to = '0x' + e.topics[2].slice(26);
    const amount = ethers.BigNumber.from(e.data);
    console.log(`  Block ${block}: to=${to} amount=${ethers.utils.formatEther(amount)} tx=${e.transactionHash.substring(0,16)}`);
  }
})();
