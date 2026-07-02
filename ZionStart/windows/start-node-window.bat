@echo off

:: ============================================================================
::  ZION Node - okno pro start-all / start-all-visible
:: ============================================================================

cd /d "C:\Users\yosef\Desktop\Zion\2.9.6-main"
if not exist "logs"    mkdir logs
if not exist "V3\data" mkdir V3\data

set ZION_NODE_ID=local-backup-node
set ZION_P2P_BIND=0.0.0.0:8333
set ZION_RPC_BIND=0.0.0.0:8443
set ZION_WEBSOCKET_BIND=0.0.0.0:8445
set ZION_NODE_STATE_PATH=V3\data\zion-node-state.db
set ZION_SEED_PEERS=77.42.71.94:8333
:: Fallback (Tailscale VPN): set ZION_SEED_PEERS=100.76.16.108:8333
set ZION_MINER_ADDRESS=zion16825y2v5f3q507e5c2e0j8n666z43558l3zt604
set ZION_HUMANITARIAN_WALLET=zion1s29403j538w6p6n0p783l6w5v6t254c0380c2d4
set ZION_ISSOBELLA_WALLET=zion140n8a8t6f3083232r0g6c498r6c0d423f4h9702
set ZION_MIGRATION_HEIGHT=18850
set ZION_BLOCK_RETENTION=10000
set ZION_ACCOUNT_TX_MEMO_V1_HEIGHT=24000
set ZION_BRIDGE_VALIDATOR_PUBKEYS=02d6406dab8cc71d88f55abca3fe8bae91c26a60162ad3dd1ee55a6aa9cfc96368,038aba9fe33b6253f759c771e37dcd3dfb2532e3c0b65c3b02530fcfbeef8dc67d,03c116081150774bdff61043b8aa57c25ddea273e24f8215555df7387714f91b2f,035f466ffeba4abb7f56caef5c6e27c979590fc5b1508d440a88e3b9ceff3c5630,03b64fa89d8fffbd08d9c75fe8a49434e7b0cb2f02a395f22b64f3d4adc5eecd44
set ZION_BRIDGE_VALIDATOR_THRESHOLD=5

echo ===========================================================
echo  ZION Node :: P2P 0.0.0.0:8333  RPC 0.0.0.0:8443  WS 0.0.0.0:8445
echo  Seed: 77.42.71.94:8333 (Edge public, Tailscale fallback 100.76.16.108)
echo ===========================================================
echo.

V3\target\release\node.exe
echo [EXIT] Node skoncil s kodem %ERRORLEVEL% v %TIME%
pause
