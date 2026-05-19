$env:ZION_SEED_PEERS=''
Write-Host "PowerShell env = [$env:ZION_SEED_PEERS]"
Write-Host "DotNet env = $([Environment]::GetEnvironmentVariable('ZION_SEED_PEERS', 'Process'))"
