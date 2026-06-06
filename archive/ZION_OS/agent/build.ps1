# ZION Agent Build Script (Windows PowerShell)
# Pouziti:
#   .\build.ps1                    # Debug build
#   .\build.ps1 -Release           # Release build

param(
    [switch]$Release,
    [string]$Features = ""
)

$ErrorActionPreference = "Stop"

$Profile = if ($Release) { "--release" } else { "" }
$Feat = if ($Features) { "--features $Features" } else { "" }

Write-Host "=== ZION Agent Build ===" -ForegroundColor Cyan
Write-Host "Profile: $(if ($Release) { 'release' } else { 'dev' })"
Write-Host "Features: $(if ($Features) { $Features } else { 'default' })"

cargo build $Profile $Feat

$Binary = if ($Release) {
    "target\release\zion-agent.exe"
} else {
    "target\debug\zion-agent.exe"
}

Write-Host ""
Write-Host "=== Build hotovo ===" -ForegroundColor Green
Write-Host "Binary: $Binary"
if (Test-Path $Binary) {
    $Size = (Get-Item $Binary).Length / 1MB
    Write-Host "Size: $($Size.ToString('F2')) MB"
}
