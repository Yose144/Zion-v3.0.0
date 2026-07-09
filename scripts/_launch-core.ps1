# Internal: launch Core stack with Edge peer configured
$env:ZION_TOPOLOGY = 'CORE'
$env:EDGE_TS_IP    = '62.171.141.136'
& "$PSScriptRoot\launch-stack.ps1"
