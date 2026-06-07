@echo off
setlocal EnableDelayedExpansion
chcp 65001 >nul

cd /d "C:\Users\yosef\Desktop\Zion\2.9.6-main"

if not exist "logs" mkdir logs
if not exist "V3\data" mkdir V3\data

set ZION_NODE_ID=local-backup-node
set ZION_P2P_BIND=0.0.0.0:8333
set ZION_RPC_BIND=0.0.0.0:8443
set ZION_NODE_STATE_PATH=V3\data\zion-node-state.db
set ZION_SEED_PEERS=77.42.71.94:8333
set ZION_MINER_ADDRESS=zion1w523a76830x2t5m7f3j023w265e8g5c400a4790
set ZION_HUMANITARIAN_WALLET=zion165a527w5d0n085t775x3w8n8q20742a6w7xr0z3
set ZION_ISSOBELLA_WALLET=zion140n8a8t6f3083232r0g6c498r6c0d423f4h9702

echo ===========================================================
echo  ZION Node :: P2P 0.0.0.0:8333  RPC 0.0.0.0:8443
echo  Seed: 77.42.71.94:8333 (Edge)
echo ===========================================================
echo.

V3\target\release\node.exe
