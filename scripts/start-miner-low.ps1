# ZION V3 — Low-impact CPU Miner (1 thread, idle priority)
# Designed to run in background without impacting desktop work.
$logDir = "C:\Users\yosef\Desktop\Zion\2.9.6-main\logs"
New-Item -ItemType Directory -Path $logDir -Force | Out-Null

# Edge-primary topology
[Environment]::SetEnvironmentVariable('ZION_POOL_ADDR',       '62.171.141.136:8444', 'Process')
[Environment]::SetEnvironmentVariable('ZION_LOOP_COUNT',        '1000000',            'Process')
[Environment]::SetEnvironmentVariable('ZION_MINER_THREADS',     '1',                  'Process')
[Environment]::SetEnvironmentVariable('ZION_WORKER_NAME',       'low-worker',         'Process')
[Environment]::SetEnvironmentVariable('ZION_MINER_ID',          'w11-low-miner',      'Process')
[Environment]::SetEnvironmentVariable('ZION_PAYOUT_ADDRESS',    'zion1w523a76830x2t5m7f3j023w265e8g5c400a4790', 'Process')
[Environment]::SetEnvironmentVariable('ZION_GPU_BACKEND',       'cpu',                'Process')

$minerExe = 'C:\Users\yosef\Desktop\Zion\2.9.6-main\V3\target\release\zion-miner.exe'
$p = Start-Process -FilePath $minerExe -RedirectStandardOutput "$logDir\miner-low.log" -RedirectStandardError "$logDir\miner-low.err" -WindowStyle Hidden -PassThru

# Drop priority so desktop work is not impacted
$p.PriorityClass = 'BelowNormal'

Write-Host "Started Low-Impact CPU Miner PID=$($p.Id) threads=1 priority=BelowNormal"
