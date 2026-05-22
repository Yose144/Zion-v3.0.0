# ZION V3 — Start Pool with log redirect
$logDir = "C:\Users\yosef\Desktop\Zion\2.9.6-main\logs"
New-Item -ItemType Directory -Path $logDir -Force | Out-Null

[Environment]::SetEnvironmentVariable('ZION_POOL_BIND', '0.0.0.0:8444', 'Process')
[Environment]::SetEnvironmentVariable('ZION_NODE_RPC_ADDR', '127.0.0.1:8443', 'Process')
[Environment]::SetEnvironmentVariable('ZION_POOL_LOOP_COUNT', '1000000', 'Process')
[Environment]::SetEnvironmentVariable('ZION_MAX_SESSIONS_PER_IP', '100', 'Process')
[Environment]::SetEnvironmentVariable('ZION_POOL_WALLET', 'zion182e2v4x4r3u2j5r5t305k0d5y643q6l3n6je5f8', 'Process')
[Environment]::SetEnvironmentVariable('ZION_POOL_PAYOUT_SK_HEX', 'b8d7341c97b9402b67ad2a961ef055c66e3b7fb2568cf48cc78f7b1ffd2098d0', 'Process')
[Environment]::SetEnvironmentVariable('ZION_NONCE_COUNT', '4096', 'Process')
[Environment]::SetEnvironmentVariable('ZION_VARDIFF_START_DIFF', '1', 'Process')
[Environment]::SetEnvironmentVariable('ZION_VARDIFF_MAX_DIFF', '1000000', 'Process')

$poolExe = 'C:\Users\yosef\Desktop\Zion\2.9.6-main\V3\target\release\server.exe'
$p = Start-Process -FilePath $poolExe -RedirectStandardOutput "$logDir\pool.log" -RedirectStandardError "$logDir\pool.err" -WindowStyle Hidden -PassThru
Write-Host "Started Pool   PID=$($p.Id)"
