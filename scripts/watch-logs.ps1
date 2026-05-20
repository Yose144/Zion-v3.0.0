# Open 4 separate windows tailing each ZION log file
# Windows auto-close after 5 min of inactivity so they don't hang forever.
$logDir = "C:\Users\yosef\Desktop\Zion\2.9.6-main\logs"

function Open-LogWindow($Title, $LogFile) {
    $cmd = @"
`$file = '$LogFile'
`$lastCount = 0
`$idle = 0
while(`$true) {
    `$lines = Get-Content `$file -Tail 50 -ErrorAction SilentlyContinue
    if(`$lines) { `$lines | ForEach-Object { Write-Host `$_ } }
    if(`$lines.Length -eq `$lastCount) { `$idle++ } else { `$idle = 0; `$lastCount = `$lines.Length }
    if(`$idle -gt 150) { Write-Host "[auto-close] No new logs for 5 min. Closing window." -ForegroundColor Yellow; Start-Sleep 2; exit }
    Start-Sleep 2
}
"@
    Start-Process powershell -ArgumentList "-NoExit","-Command",$cmd -WindowStyle Normal
}

Open-LogWindow "Node1" "$logDir\node1.log"
Start-Sleep -Milliseconds 300
Open-LogWindow "Node2" "$logDir\node2.log"
Start-Sleep -Milliseconds 300
Open-LogWindow "Pool" "$logDir\pool.log"
Start-Sleep -Milliseconds 300
Open-LogWindow "Miner" "$logDir\miner.log"

Write-Host "Opened 4 log windows. They auto-close after 5 min of no new logs. Close them manually when done."
