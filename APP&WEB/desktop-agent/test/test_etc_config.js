// Test ETC configuration
const config = {
  miningMode: 'gpu-revenue',
  gpuRevenue: true,
  gpuRevenueCoins: ['ETC', 'ERG', 'RVN', 'KAS', 'ALPH'],
  wallet: 'test_wallet_address',
  threads: 4
};

console.log('GPU Revenue Mining config with ETC:');
console.log('Mode:', config.miningMode);
console.log('GPU Revenue enabled:', config.gpuRevenue);
console.log('Supported coins:', config.gpuRevenueCoins.join(', '));
console.log('ETC is first priority coin:', config.gpuRevenueCoins[0] === 'ETC');
