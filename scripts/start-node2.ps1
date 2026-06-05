# ZION V3 — Start Node 2 (Local Dev / Optional)
$logDir = "C:\Users\yosef\Desktop\Zion\2.9.6-main\logs"
New-Item -ItemType Directory -Path $logDir -Force | Out-Null

[Environment]::SetEnvironmentVariable('ZION_NODE_ID', 'w11-native-node2', 'Process')
[Environment]::SetEnvironmentVariable('ZION_P2P_BIND', '0.0.0.0:8334', 'Process')
[Environment]::SetEnvironmentVariable('ZION_RPC_BIND', '0.0.0.0:8446', 'Process')
$DataDir = "C:\Users\yosef\Desktop\Zion\2.9.6-main\V3\data"
New-Item -ItemType Directory -Path $DataDir -Force | Out-Null
[Environment]::SetEnvironmentVariable('ZION_NODE_STATE_PATH', "$DataDir\zion-node2-state.db", 'Process')
[Environment]::SetEnvironmentVariable('ZION_SEED_PEERS', '127.0.0.1:8333', 'Process')
[Environment]::SetEnvironmentVariable('ZION_MINER_ADDRESS', 'zion1w523a76830x2t5m7f3j023w265e8g5c400a4790', 'Process')
[Environment]::SetEnvironmentVariable('ZION_HUMANITARIAN_WALLET', 'zion1s29403j538w6p6n0p783l6w5v6t254c0380c2d4', 'Process')
[Environment]::SetEnvironmentVariable('ZION_ISSOBELLA_WALLET', 'zion140n8a8t6f3083232r0g6c498r6c0d423f4h9702', 'Process')
[Environment]::SetEnvironmentVariable('ZION_POOL_FEE_WALLET', 'zion196m4n8x764v7a0s406j40094a8z5j8m6z7nk342', 'Process')

# Clean old Temp files if they exist (migration from previous runs)
Remove-Item -Path 'C:\Users\yosef\AppData\Local\Temp\peers.json' -ErrorAction SilentlyContinue
Remove-Item -Path 'C:\Users\yosef\AppData\Local\Temp\zion-node2-state.db' -ErrorAction SilentlyContinue
Remove-Item -Path 'C:\Users\yosef\AppData\Local\Temp\zion-node2-state.db-lock' -ErrorAction SilentlyContinue
Remove-Item -Path 'C:\Users\yosef\AppData\Local\Temp\zion-node2-state.db.journal' -ErrorAction SilentlyContinue
Remove-Item -Recurse -Path 'C:\Users\yosef\AppData\Local\Temp\zion-node2-state.db' -ErrorAction SilentlyContinue

$nodeExe = 'C:\Users\yosef\Desktop\Zion\2.9.6-main\V3\target\release\node.exe'
$p = Start-Process -FilePath $nodeExe -RedirectStandardOutput "$logDir\node2.log" -RedirectStandardError "$logDir\node2.err" -WindowStyle Hidden -PassThru
Write-Host "Started Node2  PID=$($p.Id)"
