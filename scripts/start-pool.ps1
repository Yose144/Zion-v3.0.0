# ZION V3 — Start Pool with log redirect
$logDir = "C:\Users\yosef\Desktop\Zion\2.9.6-main\logs"
New-Item -ItemType Directory -Path $logDir -Force | Out-Null

[Environment]::SetEnvironmentVariable('ZION_POOL_BIND', '0.0.0.0:8444', 'Process')
[Environment]::SetEnvironmentVariable('ZION_NODE_RPC_ADDR', '127.0.0.1:8443', 'Process')
[Environment]::SetEnvironmentVariable('ZION_POOL_LOOP_COUNT', '1000000', 'Process')
[Environment]::SetEnvironmentVariable('ZION_MAX_SESSIONS_PER_IP', '100', 'Process')
# WARNING: ZION_POOL_WALLET and ZION_POOL_PAYOUT_SK_HEX must be a matched pair.
# The SK_HEX below corresponds to the OLD pool wallet. Update both together.
[Environment]::SetEnvironmentVariable('ZION_POOL_WALLET', 'zion16825y2v5f3q507e5c2e0j8n666z43558l3zt604', 'Process')
[Environment]::SetEnvironmentVariable('ZION_POOL_PAYOUT_SK_HEX', '[REDACTED — pool SK removed for security]', 'Process')
[Environment]::SetEnvironmentVariable('ZION_NONCE_COUNT', '4096', 'Process')
[Environment]::SetEnvironmentVariable('ZION_VARDIFF_START_DIFF', '1', 'Process')
[Environment]::SetEnvironmentVariable('ZION_VARDIFF_MAX_DIFF', '1000000', 'Process')

$poolExe = 'C:\Users\yosef\Desktop\Zion\2.9.6-main\V3\target\release\server.exe'
$p = Start-Process -FilePath $poolExe -RedirectStandardOutput "$logDir\pool.log" -RedirectStandardError "$logDir\pool.err" -WindowStyle Hidden -PassThru
Write-Host "Started Pool   PID=$($p.Id)"
