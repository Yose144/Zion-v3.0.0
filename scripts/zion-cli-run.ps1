# ZION V3 — zion-cli wrapper for dashboard API
# Runs zion.exe with given arguments and returns JSON with stdout, stderr, exit code.
# Usage: zion-cli-run.ps1 -Cmd "node status"

param(
    [Parameter(Mandatory=$true)]
    [string]$Cmd
)

$ZionExe = "C:\Users\yosef\Desktop\Zion\2.9.6-main\V3\target\release\zion.exe"

# Validate executable exists
if (-not (Test-Path $ZionExe)) {
    $fallback = "C:\Users\yosef\Desktop\Zion\2.9.6-main\V3\target\debug\zion.exe"
    if (Test-Path $fallback) {
        $ZionExe = $fallback
    } else {
        Write-Output (@{ok=$false; error="zion.exe not found. Run 'cargo build --release -p zion-cli' first."} | ConvertTo-Json -Compress)
        exit 1
    }
}

# Build argument list (handle quoted args)
$argList = @()
$Cmd -split ' (?=(?:[^"]*"[^"]*")*[^"]*$)' | ForEach-Object {
    $argList += $_.Trim('"')
}

# Run and capture output
$psi = New-Object System.Diagnostics.ProcessStartInfo
$psi.FileName = $ZionExe
$psi.Arguments = ($argList | ForEach-Object { '"{0}"' -f $_ }) -join ' '
$psi.WorkingDirectory = "C:\Users\yosef\Desktop\Zion\2.9.6-main"
$psi.UseShellExecute = $false
$psi.RedirectStandardOutput = $true
$psi.RedirectStandardError = $true
$psi.CreateNoWindow = $true

$proc = New-Object System.Diagnostics.Process
$proc.StartInfo = $psi
$proc.Start() | Out-Null

$stdout = $proc.StandardOutput.ReadToEnd()
$stderr = $proc.StandardError.ReadToEnd()
$proc.WaitForExit()

$result = @{
    ok         = $true
    stdout     = $stdout
    stderr     = $stderr
    exit_code  = $proc.ExitCode
    cmd        = $Cmd
    exe        = $ZionExe
}

Write-Output ($result | ConvertTo-Json -Depth 3 -Compress)
exit 0
