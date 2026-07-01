@echo off
cd "C:\Users\yosef\Desktop\Zion\2.9.6-main\V3\target\release"
set ZION_POOL_ADDR=77.42.71.94:8444
:: Fallback (Tailscale VPN): set ZION_POOL_ADDR=100.76.16.108:8444
set ZION_WORKER_NAME=desktop-agent
set ZION_MINER_ID=desktop-agent
set ZION_GPU_BACKEND=opencl
set ZION_PAYOUT_ADDRESS=zion1n0s6e756p7r360a0e47582n7r5t2e3t4e2wq5c8
set ZION_MINER_ALGORITHM=deeksha_lite_fire
set ZION_LOOP_COUNT=1000000
set ZION_INTERACTIVE=false
start zion-miner.exe
