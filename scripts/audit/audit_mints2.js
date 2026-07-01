const { ethers } = require('ethers');
const provider = new ethers.providers.JsonRpcProvider('https://mainnet.base.org');

const wZION_ADDR = '0x0c493763d107ab0ABb0aee1Ca3999292d8202bb6';
const TRANSFER_TOPIC = '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef';
const MINT_FROM_TOPIC = '0x0000000000000000000000000000000000000000000000000000000000000000';

(async () => {
  const currentBlock = await provider.getBlockNumber();
  console.log('Current block:', currentBlock);

  // Search in 10K block chunks from block 47770000 to current
  const startBlock = 47770000;
  const chunkSize = 10000;
  let allMints = [];

  for (let from = startBlock; from < currentBlock; from += chunkSize) {
    const to = Math.min(from + chunkSize - 1, currentBlock);
    try {
      const logs = await provider.getLogs({
        address: wZION_ADDR,
        topics: [TRANSFER_TOPIC, MINT_FROM_TOPIC],
        fromBlock: from,
        toBlock: to,
      });
      if (logs.length > 0) {
        for (const log of logs) {
          const toAddr = '0x' + log.topics[2].slice(26);
          const amount = ethers.BigNumber.from(log.data);
          allMints.push({
            block: log.blockNumber,
            to: toAddr,
            amount: ethers.utils.formatEther(amount),
            tx: log.transactionHash,
          });
        }
      }
    } catch (e) {
      console.log(`Error at blocks ${from}-${to}:`, e.message.substring(0, 80));
    }
  }

  console.log('\n=== ALL wZION mint events ===');
  console.log('Total mints found:', allMints.length);
  let totalMinted = 0;
  for (const m of allMints) {
    console.log(`  Block ${m.block}: to=${m.to} amount=${m.amount} tx=${m.tx.substring(0,20)}...`);
    totalMinted += parseFloat(m.amount);
  }
  console.log('\nTotal minted (sum):', totalMinted);
})();
