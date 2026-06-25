const {ethers} = require('ethers');

const provider = new ethers.providers.JsonRpcProvider('https://mainnet.base.org');
const wzion = new ethers.Contract('0x0c493763d107ab0ABb0aee1Ca3999292d8202bb6', [
  'function paused() view returns (bool)',
  'function totalSupply() view returns (uint256)',
  'function MAX_SUPPLY() view returns (uint256)',
  'function MIN_BRIDGE_AMOUNT() view returns (uint256)'
], provider);

(async () => {
  const paused = await wzion.paused();
  console.log('wZION paused:', paused);
  const ts = await wzion.totalSupply();
  console.log('totalSupply:', ethers.utils.formatEther(ts));
  const ms = await wzion.MAX_SUPPLY();
  console.log('MAX_SUPPLY:', ethers.utils.formatEther(ms));
  const min = await wzion.MIN_BRIDGE_AMOUNT();
  console.log('MIN_BRIDGE_AMOUNT:', ethers.utils.formatEther(min));
})();
