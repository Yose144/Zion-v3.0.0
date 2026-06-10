@echo off

:: ============================================================================
::  ZION Node - lokalni backup node (pripojuje se na Edge seed 77.42.71.94)
::  RPC  : 0.0.0.0:8443
::  P2P  : 0.0.0.0:8333
::  WS   : 0.0.0.0:8445
:: ============================================================================

cd /d "C:\Users\yosef\Desktop\Zion\2.9.6-main"
if not exist "logs"    mkdir logs
if not exist "V3\data" mkdir V3\data

:: -- Node identita -------------------------------------------------------------
set ZION_NODE_ID=local-backup-node
set ZION_P2P_BIND=0.0.0.0:8333
set ZION_RPC_BIND=0.0.0.0:8443
set ZION_WEBSOCKET_BIND=0.0.0.0:8445
set ZION_NODE_STATE_PATH=V3\data\zion-node-state.db

:: -- Sit -----------------------------------------------------------------------
set ZION_SEED_PEERS=77.42.71.94:8333

:: -- Penazenky (constitutional emission) --------------------------------------
set ZION_MINER_ADDRESS=zion1w523a76830x2t5m7f3j023w265e8g5c400a4790
set ZION_HUMANITARIAN_WALLET=zion1s29403j538w6p6n0p783l6w5v6t254c0380c2d4
set ZION_ISSOBELLA_WALLET=zion140n8a8t6f3083232r0g6c498r6c0d423f4h9702

echo ===========================================================
echo  ZION Node :: P2P 0.0.0.0:8333  RPC 0.0.0.0:8443  WS 0.0.0.0:8445
echo  Seed: 77.42.71.94:8333 (Edge)
echo ===========================================================
echo.

V3\target\release\node.exe >> logs\node1.log 2>&1
echo [EXIT] Node skoncil s kodem %ERRORLEVEL% v %TIME%
pause
