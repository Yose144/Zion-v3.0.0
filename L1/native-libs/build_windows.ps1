# ZION Native Libraries - Windows Build Script
# ==============================================
# Builds all native DLLs for Windows 11 x64
# 
# Requirements:
#   - MSYS2 with MinGW-w64 (C:\msys64\mingw64\bin\gcc.exe)
#   - OR Visual Studio with MSVC
#
# Usage:
#   .\build_windows.ps1
#   .\build_windows.ps1 -Clean
#   .\build_windows.ps1 -Release
#
# Author: ZION AI Native Team
# Date: January 2026

param(
    [switch]$Clean,
    [switch]$Release,
    [switch]$Debug,
    [string]$OutputDir = "..\..\mining\native"
)

$ErrorActionPreference = "Stop"

# Banner
Write-Host "=" * 60 -ForegroundColor Cyan
Write-Host " ZION Native Libraries Builder - Windows 11 x64" -ForegroundColor Cyan
Write-Host "=" * 60 -ForegroundColor Cyan

# Find compiler
$GCC = $null
$CompilerType = $null

# Check MSYS2/MinGW
$MsysGcc = "C:\msys64\mingw64\bin\gcc.exe"
if (Test-Path $MsysGcc) {
    $GCC = $MsysGcc
    $CompilerType = "MinGW-w64"
    Write-Host "[+] Found MinGW-w64: $GCC" -ForegroundColor Green
}

# Check standalone MinGW
if (-not $GCC) {
    $MinGWGcc = "C:\mingw64\bin\gcc.exe"
    if (Test-Path $MinGWGcc) {
        $GCC = $MinGWGcc
        $CompilerType = "MinGW"
        Write-Host "[+] Found MinGW: $GCC" -ForegroundColor Green
    }
}

# Check PATH
if (-not $GCC) {
    $PathGcc = Get-Command gcc -ErrorAction SilentlyContinue
    if ($PathGcc) {
        $GCC = $PathGcc.Source
        $CompilerType = "GCC (PATH)"
        Write-Host "[+] Found GCC in PATH: $GCC" -ForegroundColor Green
    }
}

if (-not $GCC) {
    Write-Host "[-] No C compiler found!" -ForegroundColor Red
    Write-Host "    Install MSYS2: https://www.msys2.org/" -ForegroundColor Yellow
    Write-Host "    Then run: pacman -S mingw-w64-x86_64-gcc" -ForegroundColor Yellow
    exit 1
}

# Set up paths
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$SourceDir = Join-Path $ScriptDir "all"
$BuildDir = Join-Path $ScriptDir "build_win64"
$OutputPath = Join-Path $ScriptDir $OutputDir

# Create directories
if (-not (Test-Path $BuildDir)) {
    New-Item -ItemType Directory -Path $BuildDir -Force | Out-Null
}
if (-not (Test-Path $OutputPath)) {
    New-Item -ItemType Directory -Path $OutputPath -Force | Out-Null
}

# Clean if requested
if ($Clean) {
    Write-Host "[*] Cleaning build directory..." -ForegroundColor Yellow
    Remove-Item -Path "$BuildDir\*" -Recurse -Force -ErrorAction SilentlyContinue
    Write-Host "[+] Clean complete" -ForegroundColor Green
}

# Compiler flags
$CommonFlags = "-O3 -march=native -shared -fPIC"
if ($Debug) {
    $CommonFlags = "-O0 -g -shared -fPIC -DDEBUG"
}
if ($Release) {
    $CommonFlags = "-O3 -march=native -flto -shared -fPIC -DNDEBUG"
}

Write-Host ""
Write-Host "[*] Compiler: $CompilerType" -ForegroundColor Cyan
Write-Host "[*] Flags: $CommonFlags" -ForegroundColor Cyan
Write-Host "[*] Output: $OutputPath" -ForegroundColor Cyan
Write-Host ""

# Define libraries to build
$Libraries = @(
    @{
        Name = "cosmic_harmony_v2"
        Source = "cosmic_harmony_v2_native.c"
        Output = "libcosmic_harmony_v2.dll"
        Flags = "-mavx2"
        Description = "Cosmic Harmony v2 (AVX2)"
    },
    @{
        Name = "autolykos_v2"
        Source = "autolykos_v2_native.c"
        Output = "libautolykos_v2.dll"
        Flags = ""
        Description = "Autolykos v2 (ERG)"
    },
    @{
        Name = "kawpow"
        Source = "kawpow_native.c"
        Output = "libkawpow.dll"
        Flags = ""
        Description = "KawPow (RVN/CLORE)"
    },
    @{
        Name = "ethash"
        Source = "ethash_native.c"
        Output = "libethash.dll"
        Flags = ""
        Description = "Ethash (ETC)"
    },
    @{
        Name = "blake3"
        Source = "blake3_native.c"
        Output = "libblake3.dll"
        Flags = "-mavx2"
        Description = "Blake3 (ALPH)"
    },
    @{
        Name = "kheavyhash"
        Source = "kheavyhash_native.c"
        Output = "libkheavyhash.dll"
        Flags = ""
        Description = "KHeavyHash (KAS)"
    },
    @{
        Name = "equihash"
        Source = "equihash_native.c"
        Output = "libequihash.dll"
        Flags = ""
        Description = "Equihash (ZEC)"
    },
    @{
        Name = "argon2d"
        Source = "argon2d_native.c"
        Output = "libargon2d.dll"
        Flags = ""
        Description = "Argon2d"
    },
    @{
        Name = "progpow"
        Source = "progpow_native.c"
        Output = "libprogpow.dll"
        Flags = ""
        Description = "ProgPow"
    }
)

# Build stats
$Built = 0
$Failed = 0
$Skipped = 0

Write-Host "=" * 60 -ForegroundColor Cyan
Write-Host " Building Libraries" -ForegroundColor Cyan
Write-Host "=" * 60 -ForegroundColor Cyan
Write-Host ""

foreach ($Lib in $Libraries) {
    $SourceFile = Join-Path $SourceDir $Lib.Source
    $OutputFile = Join-Path $BuildDir $Lib.Output
    
    Write-Host "[*] $($Lib.Description)" -ForegroundColor White -NoNewline
    
    # Check if source exists
    if (-not (Test-Path $SourceFile)) {
        Write-Host " [SKIP - no source]" -ForegroundColor Yellow
        $Skipped++
        continue
    }
    
    # Build command
    $BuildCmd = "& `"$GCC`" $CommonFlags $($Lib.Flags) `"$SourceFile`" -o `"$OutputFile`""
    
    try {
        # Execute build
        $Output = Invoke-Expression $BuildCmd 2>&1
        
        if (Test-Path $OutputFile) {
            $FileSize = (Get-Item $OutputFile).Length / 1KB
            Write-Host " [OK - $([math]::Round($FileSize, 1)) KB]" -ForegroundColor Green
            
            # Copy to output directory
            Copy-Item $OutputFile $OutputPath -Force
            $Built++
        } else {
            Write-Host " [FAILED]" -ForegroundColor Red
            if ($Output) {
                Write-Host "    Error: $Output" -ForegroundColor Red
            }
            $Failed++
        }
    } catch {
        Write-Host " [FAILED]" -ForegroundColor Red
        Write-Host "    Error: $_" -ForegroundColor Red
        $Failed++
    }
}

# Build OpenCL libraries (if OpenCL SDK available)
Write-Host ""
Write-Host "[*] Checking for OpenCL SDK..." -ForegroundColor Cyan

$OpenCLInclude = $null
$OpenCLLib = $null

# Check NVIDIA CUDA (includes OpenCL)
$NvidiaCuda = "C:\Program Files\NVIDIA GPU Computing Toolkit\CUDA"
if (Test-Path $NvidiaCuda) {
    $CudaVersions = Get-ChildItem $NvidiaCuda -Directory | Sort-Object Name -Descending
    if ($CudaVersions) {
        $CudaPath = $CudaVersions[0].FullName
        $OpenCLInclude = Join-Path $CudaPath "include"
        $OpenCLLib = Join-Path $CudaPath "lib\x64"
        Write-Host "[+] Found NVIDIA CUDA: $CudaPath" -ForegroundColor Green
    }
}

# Check AMD APP SDK
if (-not $OpenCLInclude) {
    $AmdSdk = "C:\Program Files (x86)\AMD APP SDK"
    if (Test-Path $AmdSdk) {
        $OpenCLInclude = Join-Path $AmdSdk "include"
        $OpenCLLib = Join-Path $AmdSdk "lib\x86_64"
        Write-Host "[+] Found AMD APP SDK: $AmdSdk" -ForegroundColor Green
    }
}

# Check Intel OpenCL
if (-not $OpenCLInclude) {
    $IntelOcl = "C:\Program Files (x86)\Intel\OpenCL SDK"
    if (Test-Path $IntelOcl) {
        $OpenCLInclude = Join-Path $IntelOcl "include"
        $OpenCLLib = Join-Path $IntelOcl "lib\x64"
        Write-Host "[+] Found Intel OpenCL SDK: $IntelOcl" -ForegroundColor Green
    }
}

if ($OpenCLInclude -and (Test-Path $OpenCLInclude)) {
    Write-Host "[*] Building OpenCL libraries..." -ForegroundColor Cyan
    
    $OpenCLLibraries = @(
        @{
            Name = "autolykos_v2_opencl"
            Source = "autolykos_v2_opencl.c"
            Output = "libautolykos_v2_opencl.dll"
            Description = "Autolykos v2 (OpenCL GPU)"
        },
        @{
            Name = "kawpow_gpu"
            Source = "kawpow_gpu_native.c"
            Output = "libkawpow_gpu.dll"
            Description = "KawPow (OpenCL GPU)"
        }
    )
    
    foreach ($Lib in $OpenCLLibraries) {
        $SourceFile = Join-Path $SourceDir $Lib.Source
        $OutputFile = Join-Path $BuildDir $Lib.Output
        
        Write-Host "[*] $($Lib.Description)" -ForegroundColor White -NoNewline
        
        if (-not (Test-Path $SourceFile)) {
            Write-Host " [SKIP - no source]" -ForegroundColor Yellow
            $Skipped++
            continue
        }
        
        $BuildCmd = "& `"$GCC`" $CommonFlags -I`"$OpenCLInclude`" -L`"$OpenCLLib`" `"$SourceFile`" -lOpenCL -o `"$OutputFile`""
        
        try {
            $Output = Invoke-Expression $BuildCmd 2>&1
            
            if (Test-Path $OutputFile) {
                $FileSize = (Get-Item $OutputFile).Length / 1KB
                Write-Host " [OK - $([math]::Round($FileSize, 1)) KB]" -ForegroundColor Green
                Copy-Item $OutputFile $OutputPath -Force
                $Built++
            } else {
                Write-Host " [FAILED]" -ForegroundColor Red
                $Failed++
            }
        } catch {
            Write-Host " [FAILED]" -ForegroundColor Red
            $Failed++
        }
    }
} else {
    Write-Host "[-] OpenCL SDK not found - GPU libraries skipped" -ForegroundColor Yellow
}

# Summary
Write-Host ""
Write-Host "=" * 60 -ForegroundColor Cyan
Write-Host " Build Summary" -ForegroundColor Cyan
Write-Host "=" * 60 -ForegroundColor Cyan
Write-Host ""
Write-Host "  Built:   $Built" -ForegroundColor Green
Write-Host "  Failed:  $Failed" -ForegroundColor $(if ($Failed -gt 0) { "Red" } else { "Green" })
Write-Host "  Skipped: $Skipped" -ForegroundColor Yellow
Write-Host ""
Write-Host "  Output:  $OutputPath" -ForegroundColor Cyan
Write-Host ""

# List built DLLs
if ($Built -gt 0) {
    Write-Host "Built DLLs:" -ForegroundColor Green
    Get-ChildItem $BuildDir -Filter "*.dll" | ForEach-Object {
        $Size = [math]::Round($_.Length / 1KB, 1)
        Write-Host "  $($_.Name) ($Size KB)" -ForegroundColor White
    }
}

Write-Host ""
Write-Host "[+] Build complete!" -ForegroundColor Green
