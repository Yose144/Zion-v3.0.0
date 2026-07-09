@echo off
set ZION_POOL_ADDR=62.171.141.136:8444
set ZION_MINER_ID=w11-amd-gpu-miner-01
set ZION_WORKER_NAME=worker1
set ZION_LOOP_COUNT=1000000
set ZION_GPU_BACKEND=opencl
set ZION_PAYOUT_ADDRESS=zion1w523a76830x2t5m7f3j023w265e8g5c400a4790

zion-miner.exe --gpu opencl --pool 62.171.141.136:8444 --wallet zion1w523a76830x2t5m7f3j023w265e8g5c400a4790 --worker worker1 --loops 1000000
