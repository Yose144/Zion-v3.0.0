# ZION V3 — Start Miner with GPU backend
# Uses environment variables if set, otherwise falls back to defaults.
$logDir = "C:\Users\yosef\Desktop\Zion\2.9.6-main\logs"
New-Item -ItemType Directory -Path $logDir -Force | Out-Null

# Helper to get env var with fallback
function Get-EnvOrDefault($name, $default) {
    $v = [Environment]::GetEnvironmentVariable($name, 'Process')
    if ($v) { return $v }
    return $default
}

# Edge-primary topology: default to Edge pool via Tailscale VPN
[Environment]::SetEnvironmentVariable('ZION_POOL_ADDR',       (Get-EnvOrDefault 'ZION_POOL_ADDR'       '62.171.141.136:8444'),       'Process')
[Environment]::SetEnvironmentVariable('ZION_LOOP_COUNT',        (Get-EnvOrDefault 'ZION_LOOP_COUNT'        '1000000'),             'Process')
[Environment]::SetEnvironmentVariable('ZION_MINER_THREADS',     (Get-EnvOrDefault 'ZION_MINER_THREADS'     '2'),                   'Process')
[Environment]::SetEnvironmentVariable('ZION_WORKER_NAME',       (Get-EnvOrDefault 'ZION_WORKER_NAME'       'worker1'),             'Process')
[Environment]::SetEnvironmentVariable('ZION_MINER_ID',          (Get-EnvOrDefault 'ZION_MINER_ID'          'w11-gpu-miner-01'),    'Process')
[Environment]::SetEnvironmentVariable('ZION_PAYOUT_ADDRESS',      (Get-EnvOrDefault 'ZION_PAYOUT_ADDRESS'      'zion1w523a76830x2t5m7f3j023w265e8g5c400a4790'), 'Process')
[Environment]::SetEnvironmentVariable('ZION_GPU_BACKEND',       (Get-EnvOrDefault 'ZION_GPU_BACKEND'       'opencl'),              'Process')
[Environment]::SetEnvironmentVariable('ZION_GPU_WORK_SIZE',     (Get-EnvOrDefault 'ZION_GPU_WORK_SIZE'     '4096'),                'Process')

$minerExe = 'C:\Users\yosef\Desktop\Zion\2.9.6-main\V3\target\release\zion-miner.exe'
$p = Start-Process -FilePath $minerExe -RedirectStandardOutput "$logDir\miner.log" -RedirectStandardError "$logDir\miner.err" -WindowStyle Hidden -PassThru
Write-Host "Started GPU Miner PID=$($p.Id)"
