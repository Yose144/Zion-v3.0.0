$env:ZION_NODE_ID='local-backup-node'
$env:ZION_P2P_BIND='0.0.0.0:8333'
$env:ZION_RPC_BIND='0.0.0.0:8443'
$env:ZION_WEBSOCKET_BIND='0.0.0.0:8445'
$env:ZION_NODE_STATE_PATH='V3\data\zion-node-state.db'
$env:ZION_SEED_PEERS='100.76.16.108:8333'
$env:ZION_MINER_ADDRESS='zion16825y2v5f3q507e5c2e0j8n666z43558l3zt604'
$env:ZION_HUMANITARIAN_WALLET='zion1s29403j538w6p6n0p783l6w5v6t254c0380c2d4'
$env:ZION_ISSOBELLA_WALLET='zion140n8a8t6f3083232r0g6c498r6c0d423f4h9702'

Write-Host "==========================================================="
Write-Host " ZION Local Backup Node"
Write-Host " P2P 0.0.0.0:8333  RPC 0.0.0.0:8443  WS 0.0.0.0:8445"
Write-Host " Seed: 100.76.16.108:8333 (Edge Tailscale)"
Write-Host "==========================================================="
Write-Host ""

.\V3\target\release\node.exe