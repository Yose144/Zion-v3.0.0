# ZION V3 — Start Miner with log redirect
$logDir = "C:\Users\yosef\Desktop\Zion\2.9.6-main\logs"
New-Item -ItemType Directory -Path $logDir -Force | Out-Null

# Edge-primary topology: connect to Edge pool via Tailscale VPN
[Environment]::SetEnvironmentVariable('ZION_POOL_ADDR', '100.76.16.108:8444', 'Process')
[Environment]::SetEnvironmentVariable('ZION_LOOP_COUNT', '1000000', 'Process')
[Environment]::SetEnvironmentVariable('ZION_MINER_THREADS', '2', 'Process')
[Environment]::SetEnvironmentVariable('ZION_WORKER_NAME', 'worker1', 'Process')
[Environment]::SetEnvironmentVariable('ZION_MINER_ID', 'w11-gpu-miner-01', 'Process')
[Environment]::SetEnvironmentVariable('ZION_PAYOUT_ADDRESS', 'zion1w523a76830x2t5m7f3j023w265e8g5c400a4790', 'Process')
[Environment]::SetEnvironmentVariable('ZION_GPU_BACKEND', 'opencl', 'Process')
[Environment]::SetEnvironmentVariable('ZION_GPU_WORK_SIZE', '4096', 'Process')

$minerExe = 'C:\Users\yosef\Desktop\Zion\2.9.6-main\V3\target\release\zion-miner.exe'
$ts = [int][double]::Parse((Get-Date -UFormat %s))
$logFile = "$logDir\miner_${ts}.log"
$errFile = "$logDir\miner_${ts}.err"
$p = Start-Process -FilePath $minerExe -WorkingDirectory 'C:\Users\yosef\Desktop\Zion\2.9.6-main' -RedirectStandardOutput $logFile -RedirectStandardError $errFile -WindowStyle Hidden -PassThru
Write-Host "Started Miner  PID=$($p.Id)  log=$logFile"
