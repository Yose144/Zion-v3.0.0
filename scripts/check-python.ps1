Get-WmiObject Win32_Process | Where-Object { $_.Name -eq 'python.exe' } | ForEach-Object {
    $cmd = $_.CommandLine
    $pid = $_.ProcessId
    $mem = [math]::Round($_.WorkingSetSize / 1MB, 1)
    [PSCustomObject]@{ PID=$pid; MemoryMB=$mem; CommandLine=($cmd -replace '^.*?python\.exe\s*','').Substring(0,[Math]::Min(120, ($cmd -replace '^.*?python\.exe\s*','').Length)) }
} | Format-Table -AutoSize
