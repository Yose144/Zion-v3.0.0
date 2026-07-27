$env:PATH = "C:\Zion\nvrtc_tmp\nvidia\cuda_nvrtc\bin;" + $env:PATH
$env:ZION_AUTOTUNE = "0"
$env:ZION_GPU_WORK_SIZE = "8192"
$env:ZION_SECONDARY_GPU_WORK_SIZE = "5242880"
$env:ZION_EXT_GPU_BACKEND = "cuda"
$env:ZION_LOOP_COUNT = "1000000"
$env:ZION_RECONNECT = "true"
$env:ZION_STREAM3_ENABLED = "0"
$miner = Start-Process -FilePath "C:\Zion\Zion-v3.0.0-main\V3\target\release\zion-miner.exe" -ArgumentList @("--pool", "62.171.141.136:8461", "--wallet", "zion178f7h2z0t7h7m8l2v7h2h565e3c7x038k0qh4w0", "--worker", "zion-erg-test", "--gpu", "cuda", "--algorithm", "autolykos", "--no-tui") -RedirectStandardOutput "C:\Zion\Zion-v3.0.0-main\V3\logs\erg_miner.log" -RedirectStandardError "C:\Zion\Zion-v3.0.0-main\V3\logs\erg_miner.err" -NoNewWindow -PassThru
Start-Sleep -Seconds 120
Stop-Process -Id $miner.Id -Force -ErrorAction SilentlyContinue
