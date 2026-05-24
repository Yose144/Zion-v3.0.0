# Internal: launch Core stack with Edge peer configured
$env:ZION_TOPOLOGY = 'CORE'
$env:EDGE_TS_IP    = '100.76.16.108'
& "$PSScriptRoot\launch-stack.ps1"
