$env:ZION_POOL_ADDR='100.76.16.108:8444'
$env:ZION_LOOP_COUNT='1000000'
$env:ZION_WORKER_NAME='worker1'
$env:ZION_MINER_ID='w11-amd-gpu-miner-01'
$env:ZION_PAYOUT_ADDRESS='zion1n0s6e756p7r360a0e47582n7r5t2e3t4e2wq5c8'
$env:ZION_MINER_ALGORITHM='deeksha_lite_fire'
$env:ZION_GPU_BACKEND='opencl'
$env:ZION_MINER_THREADS='1'
$env:ZION_NONCE_COUNT_GPU='262144'

Write-Host "==========================================================="
Write-Host " ZION GPU Miner :: $env:ZION_POOL_ADDR"
Write-Host " Algoritmus : $env:ZION_MINER_ALGORITHM (OPTIMIZED: THERMAL_ITERS=16384)"
Write-Host " Backend    : $env:ZION_GPU_BACKEND   (RDNA1 auto-tune)"
Write-Host " Payout     : $env:ZION_PAYOUT_ADDRESS"
Write-Host "==========================================================="
Write-Host ""

.\V3\target\release\zion-miner.exe