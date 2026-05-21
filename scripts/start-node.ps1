# ZION V3 — Start Node 1 (Genesis) with log redirect
$logDir = "C:\Users\yosef\Desktop\Zion\2.9.6-main\logs"
New-Item -ItemType Directory -Path $logDir -Force | Out-Null

[Environment]::SetEnvironmentVariable('ZION_NODE_ID', 'w11-native-node', 'Process')
[Environment]::SetEnvironmentVariable('ZION_P2P_BIND', '0.0.0.0:8333', 'Process')
[Environment]::SetEnvironmentVariable('ZION_RPC_BIND', '0.0.0.0:8443', 'Process')
$DataDir = "C:\Users\yosef\Desktop\Zion\2.9.6-main\V3\data"
New-Item -ItemType Directory -Path $DataDir -Force | Out-Null
[Environment]::SetEnvironmentVariable('ZION_NODE_STATE_PATH', "$DataDir\zion-node-state.db", 'Process')
[Environment]::SetEnvironmentVariable('ZION_SEED_PEERS', 'none', 'Process')
[Environment]::SetEnvironmentVariable('ZION_MINER_ADDRESS', 'zion1e2z646u403s6c7k8m6m8m4q0a6r2a5h5j8534d8', 'Process')
[Environment]::SetEnvironmentVariable('ZION_HUMANITARIAN_WALLET', 'zion1t4w447d7k4c600h3x893m5r55645w4p057yf4d7', 'Process')
[Environment]::SetEnvironmentVariable('ZION_ISSOBELLA_WALLET', 'zion1e4t5a390m2r427a8f3s39885v4f2v6n8u3mj3f5', 'Process')
[Environment]::SetEnvironmentVariable('ZION_POOL_FEE_WALLET', 'zion1f3d840y886x6r658j3t0f583j347l2e2h84z402', 'Process')

# Clean old Temp files if they exist (migration from previous runs)
Remove-Item -Path 'C:\Users\yosef\AppData\Local\Temp\peers.json' -ErrorAction SilentlyContinue
Remove-Item -Path 'C:\Users\yosef\AppData\Local\Temp\zion-node-state.db' -ErrorAction SilentlyContinue
Remove-Item -Path 'C:\Users\yosef\AppData\Local\Temp\zion-node-state.db-lock' -ErrorAction SilentlyContinue
Remove-Item -Path 'C:\Users\yosef\AppData\Local\Temp\zion-node-state.db.journal' -ErrorAction SilentlyContinue
Remove-Item -Recurse -Path 'C:\Users\yosef\AppData\Local\Temp\zion-node-state.db' -ErrorAction SilentlyContinue

$nodeExe = 'C:\Users\yosef\Desktop\Zion\2.9.6-main\V3\target\release\node.exe'
$p = Start-Process -FilePath $nodeExe -RedirectStandardOutput "$logDir\node1.log" -RedirectStandardError "$logDir\node1.err" -WindowStyle Hidden -PassThru
Write-Host "Started Node1  PID=$($p.Id)"
