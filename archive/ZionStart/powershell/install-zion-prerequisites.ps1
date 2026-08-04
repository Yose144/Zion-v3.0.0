#Requires -RunAsAdministrator
<#
.SYNOPSIS
  Installs core development prerequisites for the Zion TerraNova v3 project on Windows 11.

.DESCRIPTION
  Installs Git, Rust (rustup), Visual Studio 2022 Build Tools with the C++ workload,
  Node.js LTS, Docker Desktop, CMake, and pulls the Redis Docker image used by V3.

  Run this script in an elevated (Administrator) PowerShell terminal.
  After it finishes, log out and log back in (or reboot) so Docker Desktop and PATH
  changes take effect, then run `cargo check --manifest-path V3/Cargo.toml --workspace`.
#>

$ErrorActionPreference = "Stop"

function Test-InstalledWinget {
    param([Parameter(Mandatory)][string]$Id)
    $out = winget list --id $Id -e --accept-source-agreements 2>&1
    return ($out -match [regex]::Escape($Id))
}

function Install-WingetIfMissing {
    param(
        [Parameter(Mandatory)][string]$Id,
        [string]$Scope = "machine",
        [string]$Override = ""
    )
    if (Test-InstalledWinget -Id $Id) {
        Write-Host "[ok] $Id already installed"
        return
    }
    Write-Host "[install] $Id ..."
    $argList = @("install", "--id", $Id, "--scope", $Scope, "--silent", "--accept-package-agreements", "--accept-source-agreements")
    if ($Override) {
        $argList += "--override"
        $argList += $Override
    }
    winget @argList
}

# 1. Git (required by Cargo and for repo operations)
Install-WingetIfMissing -Id Git.Git

# 2. Rust toolchain (rustup, user-local)
Install-WingetIfMissing -Id Rustlang.Rustup -Scope user

# 3. Visual Studio Build Tools with C++ workload (required by many native crates)
#    This is a large install and may take several minutes.
if (-not (Test-InstalledWinget -Id Microsoft.VisualStudio.2022.BuildTools)) {
    Write-Host "[install] Microsoft.VisualStudio.2022.BuildTools (C++ workload) ..."
    winget install --id Microsoft.VisualStudio.2022.BuildTools `
        --silent --accept-package-agreements --accept-source-agreements `
        --override "--wait --add Microsoft.VisualStudio.Workload.VCTools --includeRecommended --passive"
} else {
    Write-Host "[ok] Microsoft.VisualStudio.2022.BuildTools already installed"
}

# 4. Node.js LTS (used by APP&WEB, ZionDex, hardhat contracts, update-server)
Install-WingetIfMissing -Id OpenJS.NodeJS.LTS

# 5. Docker Desktop (runs the V3 service stack and Redis container)
Install-WingetIfMissing -Id Docker.DockerDesktop

# 6. CMake (some native-ffi / native-libs builds need it)
Install-WingetIfMissing -Id Kitware.CMake

# Refresh PATH in this session so rustup / node / cargo can be used immediately.
$env:Path = [System.Environment]::GetEnvironmentVariable("Path", "Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path", "User")

# 7. Configure Rust default stable target for Windows MSVC.
$rustup = "$env:USERPROFILE\.cargo\bin\rustup.exe"
if (Test-Path $rustup) {
    Write-Host "[configure] rustup default stable + x86_64-pc-windows-msvc ..."
    & $rustup default stable
    & $rustup target add x86_64-pc-windows-msvc
} else {
    Write-Host "[warn] rustup not found in $env:USERPROFILE\.cargo\bin - restart terminal and run 'rustup default stable' manually."
}

# 8. Redis image used by the V3 operational stack and WARP Lightning adapter.
if (Get-Command docker -ErrorAction SilentlyContinue) {
    Write-Host "[pull] redis:7-alpine ..."
    docker pull redis:7-alpine
} else {
    Write-Host "[info] docker.exe not in PATH yet; skip Redis pull. Run 'docker pull redis:7-alpine' after Docker Desktop starts."
}

Write-Host "`n[done] Restart terminal (and log out/in or reboot if Docker Desktop was installed)."
Write-Host "        Then verify with: cargo check --manifest-path V3/Cargo.toml --workspace"
