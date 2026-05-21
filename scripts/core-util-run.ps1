# ZION V3 — zion-core-util wrapper for dashboard API
# Runs core-util.exe with given arguments and returns JSON with stdout, stderr, exit code.
# Usage: core-util-run.ps1 -Cmd "verify-db V3\data\zion-node-state.db"

param(
    [Parameter(Mandatory=$true)]
    [string]$Cmd
)

$Exe = "C:\Users\yosef\Desktop\Zion\2.9.6-main\V3\target\release\core-util.exe"

# Validate executable exists
if (-not (Test-Path $Exe)) {
    $fallback = "C:\Users\yosef\Desktop\Zion\2.9.6-main\V3\target\debug\core-util.exe"
    if (Test-Path $fallback) {
        $Exe = $fallback
    } else {
        Write-Output (@{ok=$false; error="core-util.exe not found. Run 'cargo build --release -p zion-core --bin core-util' first."} | ConvertTo-Json -Compress)
        exit 1
    }
}

# Build argument list
$argList = @()
$Cmd -split ' (?=(?:[^"]*"[^"]*")*[^"]*$)' | ForEach-Object {
    $argList += $_.Trim('"')
}

# Run and capture output
$psi = New-Object System.Diagnostics.ProcessStartInfo
$psi.FileName = $Exe
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
    exe        = $Exe
}

Write-Output ($result | ConvertTo-Json -Depth 3 -Compress)
exit 0
