// Test all mining modes
const modes = ['cpu', 'gpu', 'dual', 'gpu-revenue'];

modes.forEach(mode => {
  const config = { miningMode: mode };
  const miningMode = config.miningMode || 'cpu';
  const wantsGpu = ['gpu', 'dual', 'gpu-revenue'].includes(miningMode);
  const gpuAllowed = true; // Cosmic Harmony supports GPU
  const effectiveGpu = wantsGpu && gpuAllowed;
  
  let modeLabel = 'CPU Only';
  if (miningMode === 'gpu') {
    modeLabel = 'GPU Only';
  } else if (miningMode === 'dual') {
    modeLabel = 'DUAL (CPU + GPU)';
  } else if (miningMode === 'gpu-revenue') {
    modeLabel = 'GPU Revenue Mining (Profit Switching)';
  }
  
  console.log(`${mode}: ${modeLabel} | GPU: ${effectiveGpu}`);
});
