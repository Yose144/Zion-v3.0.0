const { ethers } = require('ethers');
const provider = new ethers.providers.JsonRpcProvider('https://mainnet.base.org');

const POOLS = [
  { name: 'wZION/USDT 0.3%', addr: '0x186b46c2f04153999d44D25179cD623fD62Bfda2', fee: 3000 },
  { name: 'wZION/WETH 1.0%', addr: '0x18c0DaeF295E63F1bfBC7C39e71d0fabf4600699', fee: 10000 },
  { name: 'wZION/SOL 0.01%', addr: '0xF38c56bbBBBC6d9FA11E7DE84bF7Bb70e1e8D2b3', fee: 100 },
  { name: 'OLD wZION/WETH 0.3%', addr: '0xa88C4C89EB4597Df2e29A8061895300FcDF44FBB', fee: 3000 },
  { name: 'OLD wZION/USDC 0.3%', addr: '0x5eBdC6E1D516f42EEB54f14faCF8715AbD5B9d8d', fee: 3000 },
];

const ABIs = [
  'function slot0() view returns (uint160 sqrtPriceX96,int24 tick,uint16 obsIdx,uint16 obsCard,uint16 obsCardNext,uint8 feeProtocol,bool unlocked)',
  'function liquidity() view returns (uint128)',
  'function token0() view returns (address)',
  'function token1() view returns (address)',
  'function fee() view returns (uint24)',
];

const ERC20_ABI = ['function balanceOf(address) view returns (uint256)', 'function decimals() view returns (uint8)'];

(async () => {
  const wzion = new ethers.Contract('0x0c493763d107ab0ABb0aee1Ca3999292d8202bb6', ERC20_ABI, provider);
  const weth = new ethers.Contract('0x4200000000000000000000000000000000000006', ERC20_ABI, provider);
  const usdt_real = new ethers.Contract('0xfde4C96cE8598e1fDd71d3B79D3583f4Cba96B2b', ERC20_ABI, provider);
  const usdt_api = new ethers.Contract('0xfde4C96c8593536E31F229EA8f37b2ADa2699bb2', ERC20_ABI, provider);
  const sol_token = new ethers.Contract('0x311935Cd80B76769bF2ecC9D8Ab7635b2139cf82', ERC20_ABI, provider);

  console.log('=== Token verification ===');
  console.log('wZION totalSupply:', ethers.utils.formatEther(await wzion.balanceOf('0xdde17506BC2D2dCE1d594bD1D85B0BAbb389D186')));
  try { console.log('USDT (canonical) decimals:', await usdt_real.decimals()); } catch(e) { console.log('USDT canonical: NOT A CONTRACT'); }
  try { console.log('USDT (API) decimals:', await usdt_api.decimals()); } catch(e) { console.log('USDT API addr: NOT A CONTRACT'); }
  try { console.log('SOL decimals:', await sol_token.decimals()); } catch(e) { console.log('SOL: NOT A CONTRACT'); }

  console.log('\n=== Pool verification ===');
  for (const p of POOLS) {
    try {
      const pool = new ethers.Contract(p.addr, ABIs, provider);
      const s = await pool.slot0();
      const l = await pool.liquidity();
      const t0 = await pool.token0();
      const t1 = await pool.token1();
      const f = await pool.fee();
      const price = Number(s.sqrtPriceX96) ** 2 / 2 ** 192;
      console.log(`\n${p.name} (${p.addr})`);
      console.log('  fee:', f.toString(), 'liquidity:', l.toString());
      console.log('  tick:', s.tick, 'sqrtPriceX96:', s.sqrtPriceX96.toString());
      console.log('  token0:', t0);
      console.log('  token1:', t1);
      console.log('  price (token1/token0):', price);

      // Check token balances in pool
      const t0Contract = new ethers.Contract(t0, ERC20_ABI, provider);
      const t1Contract = new ethers.Contract(t1, ERC20_ABI, provider);
      const bal0 = await t0Contract.balanceOf(p.addr);
      const bal1 = await t1Contract.balanceOf(p.addr);
      const dec0 = await t0Contract.decimals();
      const dec1 = await t1Contract.decimals();
      console.log('  bal0:', ethers.utils.formatUnits(bal0, dec0));
      console.log('  bal1:', ethers.utils.formatUnits(bal1, dec1));
    } catch (e) {
      console.log(`\n${p.name} (${p.addr})`);
      console.log('  ERROR:', e.message.substring(0, 100));
    }
  }
})();
