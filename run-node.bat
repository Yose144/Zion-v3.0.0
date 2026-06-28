@echo off

:: ============================================================================
::  ZION Node - lokalni backup node (pripojuje se na Edge seed 77.42.71.94)
::  RPC  : 0.0.0.0:8443
::  P2P  : 0.0.0.0:8333
::  WS   : 0.0.0.0:8445
::  Protokol: v3.0.3 (6-decimal flowers, post-fork)
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

:: -- Sit (Edge public IP — Tailscale VPN fallback v komentari) ----------------
set ZION_SEED_PEERS=77.42.71.94:8333
:: Fallback (Tailscale VPN): set ZION_SEED_PEERS=100.76.16.108:8333

:: -- Penazenky (constitutional emission 89/5/5/1 burn) ------------------------
set ZION_MINER_ADDRESS=zion16825y2v5f3q507e5c2e0j8n666z43558l3zt604
set ZION_HUMANITARIAN_WALLET=zion1s29403j538w6p6n0p783l6w5v6t254c0380c2d4
set ZION_ISSOBELLA_WALLET=zion140n8a8t6f3083232r0g6c498r6c0d423f4h9702

:: -- 3.0.3 decimal fork: MIGRATION_HEIGHT=0 znamena fresh post-fork node ------
::    (vsechny bloky se berou jako 6-decimal, zadna migrace potreba)
:: set ZION_MIGRATION_HEIGHT=0

echo ===========================================================
echo  ZION Node v3.0.3 :: P2P 0.0.0.0:8333  RPC 0.0.0.0:8443
echo  Seed: 77.42.71.94:8333 (Edge public, Tailscale fallback 100.76.16.108)
echo  DB:   V3\data\zion-node-state.db
echo ===========================================================
echo.

V3\target\release\node.exe >> logs\node1.log 2>&1
echo [EXIT] Node skoncil s kodem %ERRORLEVEL% v %TIME%
pause
