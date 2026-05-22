# ZION V3 — Start Node 2 (Follower) with log redirect
$logDir = "C:\Users\yosef\Desktop\Zion\2.9.6-main\logs"
New-Item -ItemType Directory -Path $logDir -Force | Out-Null

[Environment]::SetEnvironmentVariable('ZION_NODE_ID', 'w11-native-node2', 'Process')
[Environment]::SetEnvironmentVariable('ZION_P2P_BIND', '0.0.0.0:8334', 'Process')
[Environment]::SetEnvironmentVariable('ZION_RPC_BIND', '0.0.0.0:8446', 'Process')
$DataDir = "C:\Users\yosef\Desktop\Zion\2.9.6-main\V3\data"
New-Item -ItemType Directory -Path $DataDir -Force | Out-Null
[Environment]::SetEnvironmentVariable('ZION_NODE_STATE_PATH', "$DataDir\zion-node2-state.db", 'Process')
[Environment]::SetEnvironmentVariable('ZION_SEED_PEERS', '127.0.0.1:8333', 'Process')
[Environment]::SetEnvironmentVariable('ZION_MINER_ADDRESS', 'zion1f8m55606u500z8l7f8p7n85588s3x70048c66j3', 'Process')
[Environment]::SetEnvironmentVariable('ZION_HUMANITARIAN_WALLET', 'zion1m4v5z8z850u480c5c208z274e334369275n5y20', 'Process')
[Environment]::SetEnvironmentVariable('ZION_ISSOBELLA_WALLET', 'zion19242q4x0l3785003n8l0s873k3f5v8d4d8wz702', 'Process')
[Environment]::SetEnvironmentVariable('ZION_POOL_FEE_WALLET', 'zion1p2a7a5q0t2z5z545y6m6j5e864n002v4z6w95w5', 'Process')

# Clean old Temp files if they exist (migration from previous runs)
Remove-Item -Path 'C:\Users\yosef\AppData\Local\Temp\peers.json' -ErrorAction SilentlyContinue
Remove-Item -Path 'C:\Users\yosef\AppData\Local\Temp\zion-node2-state.db' -ErrorAction SilentlyContinue
Remove-Item -Path 'C:\Users\yosef\AppData\Local\Temp\zion-node2-state.db-lock' -ErrorAction SilentlyContinue
Remove-Item -Path 'C:\Users\yosef\AppData\Local\Temp\zion-node2-state.db.journal' -ErrorAction SilentlyContinue
Remove-Item -Recurse -Path 'C:\Users\yosef\AppData\Local\Temp\zion-node2-state.db' -ErrorAction SilentlyContinue

$nodeExe = 'C:\Users\yosef\Desktop\Zion\2.9.6-main\V3\target\release\node.exe'
$p = Start-Process -FilePath $nodeExe -RedirectStandardOutput "$logDir\node2.log" -RedirectStandardError "$logDir\node2.err" -WindowStyle Hidden -PassThru
Write-Host "Started Node2  PID=$($p.Id)"
