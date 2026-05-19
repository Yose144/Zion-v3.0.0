@echo off
:: ZION V3 Full Stack — Windows 11 Native
:: Node + Pool + GPU Miner

cd /d C:\Users\yosef\Desktop\Zion\2.9.6-main

:: Environment
set ZION_NODE_ID=w11-native-node
set ZION_P2P_BIND=0.0.0.0:8333
set ZION_RPC_BIND=0.0.0.0:8443
set ZION_NODE_STATE_PATH=C:\Users\yosef\AppData\Local\Temp\zion-node-state.db
set ZION_SEED_PEERS=

set ZION_MINER_ADDRESS=zion1e2z646u403s6c7k8m6m8m4q0a6r2a5h5j8534d8
set ZION_HUMANITARIAN_WALLET=zion1t4w447d7k4c600h3x893m5r55645w4p057yf4d7
set ZION_ISSOBELLA_WALLET=zion1e4t5a390m2r427a8f3s39885v4f2v6n8u3mj3f5
set ZION_POOL_FEE_WALLET=zion1f3d840y886x6r658j3t0f583j347l2e2h84z402

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
