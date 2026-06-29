const { ethers } = require('ethers');
const provider = new ethers.providers.JsonRpcProvider('https://mainnet.base.org');

(async () => {
  const txHash = '0x6e5a2f4c414f546c6d';
  // We need the full tx hash - let me get it from the log
  const filter = {
    address: '0x0c493763d107ab0ABb0aee1Ca3999292d8202bb6',
    topics: [
      '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef',
      '0x0000000000000000000000000000000000000000000000000000000000000000',
    ],
    fromBlock: 47985900,
    toBlock: 47986000,
  };

  const logs = await provider.getLogs(filter);
  console.log('Logs in block 47985900-47986000:', logs.length);
  for (const log of logs) {
    console.log('  block:', log.blockNumber);
    console.log('  txHash:', log.transactionHash);
    console.log('  logIndex:', log.logIndex);
    const to = '0x' + log.topics[2].slice(26);
    const amount = ethers.BigNumber.from(log.data);
    console.log('  to:', to);
    console.log('  amount:', ethers.utils.formatEther(amount));

    // Get full transaction
    const tx = await provider.getTransaction(log.transactionHash);
    console.log('  TX from:', tx.from);
    console.log('  TX to:', tx.to);
    console.log('  TX value:', ethers.utils.formatEther(tx.value));
    console.log('  TX data (first 10 bytes):', tx.data.substring(0, 20));
    console.log('  TX data (function selector):', tx.data.substring(0, 10));

    // Get receipt for more info
    const receipt = await provider.getTransactionReceipt(log.transactionHash);
    console.log('  TX status:', receipt.status);
    console.log('  TX gas used:', receipt.gasUsed.toString());
    console.log('  Logs in TX:', receipt.logs.length);
    for (const rlog of receipt.logs) {
      console.log('    log addr:', rlog.address, 'topics[0]:', rlog.topics[0].substring(0, 20));
    }
  }
})();
