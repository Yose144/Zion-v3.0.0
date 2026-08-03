Param(
    [string]$Configuration = "Release"
)

$ErrorActionPreference = "Stop"

Write-Host "[native-libs] Windows scaffold build start"
Write-Host "Configuration: $Configuration"

$root = Split-Path -Parent $PSScriptRoot
$artifacts = Join-Path $root "artifacts"
if (!(Test-Path $artifacts)) {
    New-Item -Path $artifacts -ItemType Directory | Out-Null
}

# TODO: add CMake or custom build calls per algorithm.
# Expected outputs (future):
# - zion_randomx.dll
# - zion_kawpow.dll
# - zion_autolykos.dll

Write-Host "[native-libs] Scaffold only - no binaries built yet"
