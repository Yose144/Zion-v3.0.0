// Test configuration for GPU revenue mining
const config = {
  miningMode: 'gpu-revenue',
  gpuRevenue: true,
  gpuRevenueCoins: ['ERG', 'RVN', 'KAS', 'ALPH'],
  wallet: 'test_wallet_address',
  threads: 4
};

console.log('Test config:', JSON.stringify(config, null, 2));

// Simulate mining mode detection
const miningMode = config.miningMode || 'cpu';
const wantsGpu = ['gpu', 'dual', 'gpu-revenue'].includes(miningMode);
const gpuAllowed = true; // Cosmic Harmony supports GPU
const effectiveGpu = wantsGpu && gpuAllowed;

console.log('Mining mode:', miningMode);
console.log('Wants GPU:', wantsGpu);
console.log('GPU allowed:', gpuAllowed);
console.log('Effective GPU:', effectiveGpu);

if (miningMode === 'gpu-revenue') {
  console.log('GPU Revenue Mining enabled with coins:', config.gpuRevenueCoins.join(', '));
}
