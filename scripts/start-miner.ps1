# ZION V3 — Start Miner with log redirect
$logDir = "C:\Users\yosef\Desktop\Zion\2.9.6-main\logs"
New-Item -ItemType Directory -Path $logDir -Force | Out-Null

[Environment]::SetEnvironmentVariable('ZION_POOL_ADDR', '127.0.0.1:8444', 'Process')
[Environment]::SetEnvironmentVariable('ZION_LOOP_COUNT', '1000000', 'Process')
[Environment]::SetEnvironmentVariable('ZION_MINER_THREADS', '2', 'Process')
[Environment]::SetEnvironmentVariable('ZION_WORKER_NAME', 'worker1', 'Process')
[Environment]::SetEnvironmentVariable('ZION_MINER_ID', 'w11-gpu-miner-01', 'Process')
[Environment]::SetEnvironmentVariable('ZION_GPU_BACKEND', 'opencl', 'Process')
[Environment]::SetEnvironmentVariable('ZION_GPU_WORK_SIZE', '4096', 'Process')

$minerExe = 'C:\Users\yosef\Desktop\Zion\2.9.6-main\V3\target\release\zion-miner.exe'
$p = Start-Process -FilePath $minerExe -RedirectStandardOutput "$logDir\miner.log" -RedirectStandardError "$logDir\miner.err" -WindowStyle Hidden -PassThru
Write-Host "Started Miner  PID=$($p.Id)"
