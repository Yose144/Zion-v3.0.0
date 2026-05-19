# Open 4 separate windows tailing each ZION log file
$logDir = "C:\Users\yosef\Desktop\Zion\2.9.6-main\logs"

function Open-LogWindow($Title, $LogFile, $Color) {
    $cmd = "Get-Content '$LogFile' -Wait -Tail 50"
    Start-Process powershell -ArgumentList "-NoExit","-Command",$cmd -WindowStyle Normal
}

Open-LogWindow "Node1" "$logDir\node1.log"
Start-Sleep -Milliseconds 300
Open-LogWindow "Node2" "$logDir\node2.log"
Start-Sleep -Milliseconds 300
Open-LogWindow "Pool" "$logDir\pool.log"
Start-Sleep -Milliseconds 300
Open-LogWindow "Miner" "$logDir\miner.log"

Write-Host "Opened 4 log windows. Close them when done."
