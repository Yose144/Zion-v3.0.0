$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $PSScriptRoot
$artifacts = Join-Path $root "artifacts"

Write-Host "[native-libs] smoke check"
Write-Host "Artifacts path: $artifacts"

$expected = @(
    "zion_randomx.dll",
    "zion_kawpow.dll",
    "zion_autolykos.dll"
)

foreach ($name in $expected) {
    $path = Join-Path $artifacts $name
    if (Test-Path $path) {
        Write-Host "OK  $name"
    } else {
        Write-Host "MISS $name"
    }
}
