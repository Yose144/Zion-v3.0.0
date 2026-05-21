# Internal: launch Core stack with Edge peer configured
$env:ZION_TOPOLOGY = 'CORE'
$env:EDGE_TS_IP    = '100.66.162.125'
& "$PSScriptRoot\launch-stack.ps1"
