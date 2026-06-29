const { ethers } = require('ethers');
const p = new ethers.providers.JsonRpcProvider('https://mainnet.base.org');
const wZION = new ethers.Contract('0x0c493763d107ab0ABb0aee1Ca3999292d8202bb6', ['function balanceOf(address) view returns (uint256)','function totalSupply() view returns (uint256)'], p);
(async () => {
  const deployer = '0xdde17506BC2D2dCE1d594bD1D85B0BAbb389D186';
  const bal = await wZION.balanceOf(deployer);
  const ts = await wZION.totalSupply();
  console.log('Deployer wZION:', ethers.utils.formatEther(bal));
  console.log('totalSupply:', ethers.utils.formatEther(ts));

  const pools = [
    ['USDT', '0x186b46c2f04153999d44D25179cD623fD62Bfda2'],
    ['WETH', '0x18c0DaeF295E63F1bfBC7C39e71d0fabf4600699'],
    ['SOL',  '0xF38c56bbBBBC6d9FA11E7DE84bF7Bb70e1e8D2b3'],
  ];
  for (const [n,a] of pools) {
    const b = await wZION.balanceOf(a);
    console.log(n, 'pool wZION:', ethers.utils.formatEther(b));
  }

  const bridge = '0x72c8f0Dc60E27aB7A83fe3B416fab4F0600a6467';
  const bb = await wZION.balanceOf(bridge);
  console.log('Bridge wZION:', ethers.utils.formatEther(bb));

  // Check recent Transfer events FROM deployer
  const cur = await p.getBlockNumber();
  console.log('Current block:', cur);
  const transferTopic = '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef';
  const deployerTopic = '0x000000000000000000000000' + deployer.slice(2).toLowerCase();
  for (let from = cur - 5000; from < cur; from += 10000) {
    const to = Math.min(from + 9999, cur);
    try {
      const logs = await p.getLogs({
        address: '0x0c493763d107ab0ABb0aee1Ca3999292d8202bb6',
        topics: [transferTopic, deployerTopic],
        fromBlock: from,
        toBlock: to,
      });
      for (const l of logs) {
        const toAddr = '0x' + l.topics[2].slice(26);
        const amt = ethers.BigNumber.from(l.data);
        console.log('TRANSFER from deployer block', l.blockNumber, 'to', toAddr, 'amount', ethers.utils.formatEther(amt), 'tx', l.transactionHash.slice(0,20));
      }
    } catch(e) {}
  }
})();
