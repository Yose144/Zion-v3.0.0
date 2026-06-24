const { ethers } = require('ethers');
const provider = new ethers.providers.JsonRpcProvider('https://mainnet.base.org');
const pool = new ethers.Contract('0xa88C4C89EB4597Df2e29A8061895300FcDF44FBB', [
  'function slot0() view returns (uint160 sqrtPriceX96,int24 tick,uint16 observationIndex,uint16 observationCardinality,uint16 observationCardinalityNext,uint8 feeProtocol,bool unlocked)',
  'function liquidity() view returns (uint128)',
  'function token0() view returns (address)',
  'function token1() view returns (address)',
  'function fee() view returns (uint24)',
  'function balanceOf(address) view returns (uint256)',
  'function positions(uint256) view returns (uint96 nonce,address operator,address token0,address token1,uint24 fee,int24 tickLower,int24 tickUpper,uint128 liquidity,uint256 feeGrowthInside0LastX128,uint256 feeGrowthInside1LastX128,uint128 tokensOwed0,uint128 tokensOwed1)'
], provider);

const wzion = new ethers.Contract('0x0c493763d107ab0ABb0aee1Ca3999292d8202bb6', [
  'function balanceOf(address) view returns (uint256)',
  'function decimals() view returns (uint8)'
], provider);
const weth = new ethers.Contract('0x4200000000000000000000000000000000000006', [
  'function balanceOf(address) view returns (uint256)',
  'function decimals() view returns (uint8)'
], provider);

const pm = '0x03a520b32c04bf3beef7beb72e919cf822ed34f8';
const deployer = '0xdde17506BC2D2dCE1d594bD1D85B0BAbb389D186';

(async () => {
  const s = await pool.slot0();
  const l = await pool.liquidity();
  const t0 = await pool.token0();
  const t1 = await pool.token1();
  const f = await pool.fee();
  const poolWzion = await wzion.balanceOf(pool.address);
  const poolWeth = await weth.balanceOf(pool.address);
  const pmWzion = await wzion.balanceOf(pm);
  const pmWeth = await weth.balanceOf(pm);
  const dec0 = await wzion.decimals();
  const dec1 = await weth.decimals();

  console.log('=== Pool info ===');
  console.log('token0:', t0, '(wZION?)', t0.toLowerCase() === '0x0c493763d107ab0ABb0aee1Ca3999292d8202bb6');
  console.log('token1:', t1, '(WETH?)', t1.toLowerCase() === '0x4200000000000000000000000000000000000006');
  console.log('fee:', f.toString(), '(0.3% = 3000)');
  console.log('sqrtPriceX96:', s.sqrtPriceX96.toString());
  console.log('tick:', s.tick);
  console.log('liquidity:', l.toString());
  console.log('unlocked:', s.unlocked);
  const price = Number(s.sqrtPriceX96) ** 2 / 2 ** 192;
  console.log('wZION per WETH:', 1 / price);
  console.log('wZION price in ETH:', price);
  console.log('wZION price in USD (@ ETH $1656):', price * 1656);

  console.log('\n=== Pool balances ===');
  console.log('wZION in pool:', ethers.utils.formatUnits(poolWzion, dec0));
  console.log('WETH in pool:', ethers.utils.formatUnits(poolWeth, dec1));

  console.log('\n=== Position Manager balances ===');
  console.log('wZION in NPM:', ethers.utils.formatUnits(pmWzion, dec0));
  console.log('WETH in NPM:', ethers.utils.formatUnits(pmWeth, dec1));

  console.log('\n=== Deployer balances ===');
  console.log('wZION deployer:', ethers.utils.formatUnits(await wzion.balanceOf(deployer), dec0));
  console.log('ETH deployer:', ethers.utils.formatEther(await provider.getBalance(deployer)));
})();
