# Verify TX/BODY v2 rehearsal build (Windows).
# Prerequisite: close other cargo processes using V3\target (avoid LNK1104).
# If link fails on zion_core-*.exe, stop stale zion_core-* test processes (Task Manager).
# zion-core --lib can take 15+ minutes on Windows (debug PoW-heavy tests).
# Coordinated height: V3/L1/cosmic-harmony/src/deeksha.rs (testnet_fork_rehearsal).

$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent $PSScriptRoot
Set-Location $Root

function Invoke-Cargo {
    param([Parameter(ValueFromRemainingArguments = $true)][string[]]$CargoArgs)
    & cargo @CargoArgs
    if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
}

$feat = "--features", "testnet_fork_rehearsal"

Write-Host "== zion-cosmic-harmony (lib) ==" -ForegroundColor Cyan
Invoke-Cargo test --manifest-path Cargo.toml -p zion-cosmic-harmony @feat --lib -- --test-threads=1

Write-Host "== zion-core (lib) ==" -ForegroundColor Cyan
Invoke-Cargo test --manifest-path Cargo.toml -p zion-core @feat --lib -- --test-threads=1

Write-Host "== zion-pool (lib + integration) ==" -ForegroundColor Cyan
Invoke-Cargo test --manifest-path Cargo.toml -p zion-pool @feat -- --test-threads=1

Write-Host "== zion-miner ==" -ForegroundColor Cyan
Invoke-Cargo test --manifest-path Cargo.toml -p zion-miner @feat -- --test-threads=1

Write-Host "== release binaries: node, server, zion-miner ==" -ForegroundColor Cyan
Invoke-Cargo build --release --manifest-path Cargo.toml -p zion-core --bin node -p zion-pool --bin server -p zion-miner @feat

Write-Host "Done. Run local stack with empty ZION_SEED_PEERS; use rehearsal binaries only on test data." -ForegroundColor Green
