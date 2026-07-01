const { ethers } = require('ethers');
const p = new ethers.providers.JsonRpcProvider('https://mainnet.base.org');

const NPM = new ethers.Contract('0x03a520b32C04BF3bEEf7BEb72E919cf822Ed34f1', [
  'function positions(uint256) view returns (uint96 nonce, address operator, address token0, address token1, uint24 fee, int24 tickLower, int24 tickUpper, uint128 liquidity, uint256 feeGrowthInside0LastX128, uint256 feeGrowthInside1LastX128, uint128 tokensOwed0, uint128 tokensOwed1)',
  'function ownerOf(uint256) view returns (address)',
], p);

const POOL = new ethers.Contract('0x18c0DaeF295E63F1bfBC7C39e71d0fabf4600699', [
  'function slot0() view returns (uint160,int24,uint16,uint16,uint16,uint8,bool)',
  'function liquidity() view returns (uint128)',
  'function token0() view returns (address)',
  'function token1() view returns (address)',
], p);

const wZION = new ethers.Contract('0x0c493763d107ab0ABb0aee1Ca3999292d8202bb6', [
  'function balanceOf(address) view returns (uint256)',
], p);

(async () => {
  // Check all 3 active NFT positions
  const positions = [
    { id: 5434576, name: 'WETH 1%' },
    { id: 5435121, name: 'USDT 0.3%' },
    { id: 5434872, name: 'SOL 0.01%' },
  ];

  for (const pos of positions) {
    console.log('\n=== NFT #' + pos.id + ' (' + pos.name + ') ===');
    try {
      const owner = await NPM.ownerOf(pos.id);
      console.log('  Owner:', owner);
    } catch(e) { console.log('  Owner: ERROR (maybe burned)'); continue; }

    const info = await NPM.positions(pos.id);
    console.log('  token0:', info.token0);
    console.log('  token1:', info.token1);
    console.log('  fee:', info.fee);
    console.log('  tickLower:', info.tickLower);
    console.log('  tickUpper:', info.tickUpper);
    console.log('  liquidity:', info.liquidity.toString());
    console.log('  tokensOwed0:', info.tokensOwed0.toString());
    console.log('  tokensOwed1:', info.tokensOwed1.toString());

    // Get pool slot0 for this position's pool
    const poolAddr = info.token1.toLowerCase() === '0x4200000000000000000000000000000000000006'
      ? '0x18c0DaeF295E63F1bfBC7C39e71d0fabf4600699'
      : info.token1.toLowerCase() === '0xfde4c96c8593536e31f229ea8f37b2ada2699bb2'
      ? '0x186b46c2f04153999d44D25179cD623fD62Bfda2'
      : '0xF38c56bbBBBC6d9FA11E7DE84bF7Bb70e1e8D2b3';

    const pool = new ethers.Contract(poolAddr, [
      'function slot0() view returns (uint160,int24,uint16,uint16,uint16,uint8,bool)',
    ], p);
    const s = await pool.slot0();
    const currentTick = s[1];
    const inRange = currentTick >= info.tickLower && currentTick < info.tickUpper;
    console.log('  pool current tick:', currentTick);
    console.log('  IN RANGE:', inRange);

    // wZION is token0 (lower address) in all our pools
    // If in range: both tokens are in position
    // If below tickLower: position is 100% token1 (USDT/WETH/SOL)
    // If above tickUpper: position is 100% token0 (wZION)
    if (info.liquidity.toString() === '0') {
      console.log('  >>> LIQUIDITY IS 0 — position was withdrawn!');
    } else if (!inRange) {
      if (currentTick < info.tickLower) {
        console.log('  >>> Below range — position is 100% token1 (no wZION, all USDT/WETH/SOL)');
      } else {
        console.log('  >>> Above range — position is 100% wZION (no USDT/WETH/SOL)');
      }
    } else {
      console.log('  >>> In range — both tokens present');
    }
  }

  // Also check deployer's NFT positions via balanceOf
  console.log('\n=== Deployer NFT balance on NPM ===');
  const npmBal = await new ethers.Contract('0x03a520b32C04BF3bEEf7BEb72E919cf822Ed34f1', ['function balanceOf(address) view returns (uint256)'], p).balanceOf('0xdde17506BC2D2dCE1d594bD1D85B0BAbb389D186');
  console.log('  NFTs owned:', npmBal.toString());
})();
