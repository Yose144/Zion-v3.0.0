const { ethers } = require('ethers');
const provider = new ethers.providers.JsonRpcProvider('https://mainnet.base.org');
const pm = new ethers.Contract('0x03a520b32c04bf3beef7beb72e919cf822ed34f1', [
  'function positions(uint256) view returns (uint96 nonce,address operator,address token0,address token1,uint24 fee,int24 tickLower,int24 tickUpper,uint128 liquidity,uint256 feeGrowthInside0LastX128,uint256 feeGrowthInside1LastX128,uint128 tokensOwed0,uint128 tokensOwed1)',
  'function ownerOf(uint256) view returns (address)',
  'function balanceOf(address) view returns (uint256)',
  'function tokenOfOwnerByIndex(address,uint256) view returns (uint256)'
], provider);
const deployer = '0xdde17506BC2D2dCE1d594bD1D85B0BAbb389D186';

(async () => {
  const bal = await pm.balanceOf(deployer);
  console.log('Deployer NFT count:', bal.toString());
  if (bal.gt(0)) {
    for (let i = 0; i < bal; i++) {
      const id = await pm.tokenOfOwnerByIndex(deployer, i);
      console.log('\nNFT ID:', id.toString());
      const pos = await pm.positions(id);
      console.log('  token0:', pos.token0);
      console.log('  token1:', pos.token1);
      console.log('  fee:', pos.fee.toString());
      console.log('  tickLower:', pos.tickLower);
      console.log('  tickUpper:', pos.tickUpper);
      console.log('  liquidity:', pos.liquidity.toString());
      console.log('  tokensOwed0:', ethers.utils.formatEther(pos.tokensOwed0));
      console.log('  tokensOwed1:', ethers.utils.formatEther(pos.tokensOwed1));
    }
  }
})();
