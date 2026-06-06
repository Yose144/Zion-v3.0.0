@echo off
:: ============================================================================
::  LEGACY / LOCAL-DEV ONLY  —  NOT FOR EDGE-PRIMARY TOPOLOGY
:: ============================================================================
::  This script starts a FULL LOCAL stack (genesis node + pool + miner).
::  In edge-primary topology, the primary node + pool run on Edge (Hetzner).
::  Local PC should ONLY run backup node + miners connecting to Edge pool.
::
::  For edge-primary on W11, use instead:
::    .\scripts\launch-local-backup.ps1
::
::  This script is kept for local-dev testing only.
:: ============================================================================

cd /d C:\Users\yosef\Desktop\Zion\2.9.6-main

:: Environment
set ZION_NODE_ID=w11-native-node
set ZION_P2P_BIND=0.0.0.0:8333
set ZION_RPC_BIND=0.0.0.0:8443
set ZION_NODE_STATE_PATH=C:\Users\yosef\AppData\Local\Temp\zion-node-state.db
set ZION_SEED_PEERS=

set ZION_MINER_ADDRESS=zion1w523a76830x2t5m7f3j023w265e8g5c400a4790
set ZION_HUMANITARIAN_WALLET=zion165a527w5d0n085t775x3w8n8q20742a6w7xr0z3
set ZION_ISSOBELLA_WALLET=zion140n8a8t6f3083232r0g6c498r6c0d423f4h9702
set ZION_POOL_FEE_WALLET=zion196m4n8x764v7a0s406j40094a8z5j8m6z7nk342

set ZION_POOL_BIND=0.0.0.0:8444
set ZION_NODE_RPC_ADDR=127.0.0.1:8443
set ZION_POOL_LOOP_COUNT=1000000
set ZION_MAX_SESSIONS_PER_IP=10

set ZION_POOL_WALLET=zion182e2v4x4r3u2j5r5t305k0d5y643q6l3n6je5f8
set ZION_POOL_PAYOUT_SK_HEX=[REDACTED — pool SK removed for security]

set ZION_POOL_ADDR=127.0.0.1:8444
set ZION_LOOP_COUNT=1000000
set ZION_MINER_THREADS=2
set ZION_WORKER_NAME=worker1
set ZION_MINER_ID=w11-gpu-miner-01
set ZION_GPU_BACKEND=opencl
set ZION_GPU_WORK_SIZE=4096

mkdir logs 2>nul

:: Clean old state
del /Q "C:\Users\yosef\AppData\Local\Temp\zion-node-state.db" "C:\Users\yosef\AppData\Local\Temp\zion-node-state.db-lock" "C:\Users\yosef\AppData\Local\Temp\zion-node-peers.json" 2>nul

echo [start] Launching ZION node ...
start "ZION Node" cmd /k "V3\target\release\node.exe > logs\win-node.log 2>&1"

timeout /t 5 /nobreak >nul

echo [start] Launching ZION pool ...
start "ZION Pool" cmd /k "V3\target\release\server.exe > logs\win-pool.log 2>&1"

timeout /t 3 /nobreak >nul

echo [start] Launching ZION GPU miner ...
start "ZION GPU Miner" cmd /k "V3\target\release\zion-miner.exe > logs\win-miner.log 2>&1"

echo [start] Stack launched in separate windows.
echo [start] Node RPC:  http://127.0.0.1:8443
echo [start] Pool:      127.0.0.1:8444
echo [start] Logs:      C:\Users\yosef\Desktop\Zion\2.9.6-main\logs\
echo [start] Stop:      Close the windows or use Task Manager
