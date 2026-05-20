# ZION V3 — One-click dependency install & build
# Checks prerequisites, builds Rust workspace, installs npm deps, logs everything.

$logDir  = "C:\Users\yosef\Desktop\Zion\2.9.6-main\logs"
$repoDir = "C:\Users\yosef\Desktop\Zion\2.9.6-main"
$logFile = Join-Path $logDir "install-deps.log"
New-Item -ItemType Directory -Path $logDir -Force | Out-Null

function Write-Log($msg) {
    $ts = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
    $line = "[$ts] $msg"
    Write-Host $line
    $line | Out-File -FilePath $logFile -Append -Encoding UTF8
}

Write-Log "============================================"
Write-Log "ZION V3 Dependency Install & Build Started"
Write-Log "============================================"

# ── 1. Rust / Cargo ──
Write-Log "[1/5] Checking Rust toolchain..."
$rustOk = $false
try {
    $cargoVer = & cargo --version 2>$null
    $rustcVer = & rustc --version 2>$null
    if ($LASTEXITCODE -eq 0 -and $cargoVer -and $rustcVer) {
        Write-Log "  OK  : $cargoVer"
        Write-Log "  OK  : $rustcVer"
        $rustOk = $true
    }
} catch {}

if (-not $rustOk) {
    Write-Log "  MISSING: Rust / Cargo not found."
    Write-Log "  ACTION : Please install from https://rustup.rs/"
    Write-Log "           (run: rustup default stable)"
    Write-Log "  STATUS : Cannot build V3 without Rust. Aborting build."
    # Continue to check other deps, but skip build
} else {
    # ── 2. Build V3 Rust workspace ──
    Write-Log "[2/5] Building V3 Rust workspace (release)..."
    Push-Location $repoDir
    try {
        & cargo build --release --manifest-path "$repoDir\V3\Cargo.toml" --workspace 2>&1 | ForEach-Object { Write-Log "  BUILD: $_" }
        if ($LASTEXITCODE -eq 0) {
            Write-Log "  OK  : V3 workspace built successfully."
        } else {
            Write-Log "  FAIL: cargo build exited with code $LASTEXITCODE"
        }
    } catch {
        Write-Log "  FAIL: Exception during cargo build: $_"
    } finally {
        Pop-Location
    }
}

# ── 3. Node / npm ──
Write-Log "[3/5] Checking Node.js / npm..."
$nodeOk = $false
try {
    $nodeVer = & node --version 2>$null
    $npmVer  = & npm --version 2>$null
    if ($LASTEXITCODE -eq 0 -and $nodeVer -and $npmVer) {
        Write-Log "  OK  : node $nodeVer"
        Write-Log "  OK  : npm $npmVer"
        $nodeOk = $true
    }
} catch {}

if (-not $nodeOk) {
    Write-Log "  MISSING: Node.js / npm not found."
    Write-Log "  ACTION : Please install from https://nodejs.org/"
} else {
    $webDir = "$repoDir\APP&WEB\website-v2.9"
    if (Test-Path "$webDir\package.json") {
        Write-Log "[4/5] Installing website-v2.9 npm dependencies..."
        Push-Location $webDir
        try {
            & npm install 2>&1 | ForEach-Object { Write-Log "  NPM: $_" }
            if ($LASTEXITCODE -eq 0) {
                Write-Log "  OK  : npm install completed."
            } else {
                Write-Log "  FAIL: npm install exited with code $LASTEXITCODE"
            }
        } catch {
            Write-Log "  FAIL: Exception during npm install: $_"
        } finally {
            Pop-Location
        }
    } else {
        Write-Log "  SKIP : website-v2.9 package.json not found."
    }
}

# ── 5. Docker ──
Write-Log "[5/5] Checking Docker..."
$dockerOk = $false
try {
    $dockerVer = & docker --version 2>$null
    if ($LASTEXITCODE -eq 0 -and $dockerVer) {
        Write-Log "  OK  : $dockerVer"
        $dockerOk = $true
    }
} catch {}
if (-not $dockerOk) {
    Write-Log "  MISSING: Docker not found."
    Write-Log "  ACTION : Please install Docker Desktop for monitoring stack."
}

# ── Summary ──
Write-Log "--------------------------------------------"
Write-Log "Summary:"
Write-Log "  Rust   : $(if($rustOk){'OK'}else{'MISSING — install https://rustup.rs/'})"
Write-Log "  Node   : $(if($nodeOk){'OK'}else{'MISSING — install https://nodejs.org/'})"
Write-Log "  Docker : $(if($dockerOk){'OK'}else{'MISSING — install Docker Desktop'})"
Write-Log "  Build  : $(if($rustOk){'Attempted (see log above)'}else{'Skipped — Rust required'})"
Write-Log "  Done."
Write-Log "============================================"
