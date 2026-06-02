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

set ZION_MINER_ADDRESS=zion1f8m55606u500z8l7f8p7n85588s3x70048c66j3
set ZION_HUMANITARIAN_WALLET=zion1m4v5z8z850u480c5c208z274e334369275n5y20
set ZION_ISSOBELLA_WALLET=zion19242q4x0l3785003n8l0s873k3f5v8d4d8wz702
set ZION_POOL_FEE_WALLET=zion1p2a7a5q0t2z5z545y6m6j5e864n002v4z6w95w5

set ZION_POOL_BIND=0.0.0.0:8444
set ZION_NODE_RPC_ADDR=127.0.0.1:8443
set ZION_POOL_LOOP_COUNT=1000000
set ZION_MAX_SESSIONS_PER_IP=10

set ZION_POOL_WALLET=zion182e2v4x4r3u2j5r5t305k0d5y643q6l3n6je5f8
set ZION_POOL_PAYOUT_SK_HEX=b8d7341c97b9402b67ad2a961ef055c66e3b7fb2568cf48cc78f7b1ffd2098d0

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
