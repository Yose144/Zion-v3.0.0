# ZION V3 — Start Hiran v2.2 Inference Server (port 8002)
# OpenAI-compatible API: /v1/chat/completions, /health, /status, /metrics, /v1/embeddings
#
# Backend priority:
#   1. llama-server.exe + GGUF (llama.cpp-bin\llama-server.exe) — fastest, no Python needed
#   2. LM Studio server (port 1234) — DirectML / AMD GPU via LM Studio
#   3. Ollama server (port 11434) — fallback if Ollama is running
#   4. serve.py + GGUF (llama-cpp-python) — Python fallback
#
$repoRoot     = "C:\Users\yosef\Desktop\Zion\2.9.6-main"
$logDir       = "$repoRoot\logs"
$llamaServer  = "$repoRoot\llama.cpp-bin\llama-server.exe"
$ggufQ4       = "$repoRoot\HiranV2.2\models\hiran-v2.2-merged\hiran-v2.2.q4_k_m.gguf"
$ggufF16      = "$repoRoot\HiranV2.2\models\hiran-v2.2-merged\hiran-v2.2.f16.gguf"
$servePy      = "$repoRoot\HiranV2.2\inference\serve.py"
$port         = 8002
$host_        = "127.0.0.1"

New-Item -ItemType Directory -Path $logDir -Force | Out-Null

# ── Check if already running ──────────────────────────────────────────────────
try {
    $check = Invoke-WebRequest -Uri "http://${host_}:${port}/health" -TimeoutSec 2 -UseBasicParsing -ErrorAction Stop
    Write-Host "[OK] Hiran Inference already running on port $port"
    exit 0
} catch { }

# ── Pick GGUF file ────────────────────────────────────────────────────────────
$ggufFile = $null
if (Test-Path $ggufQ4) {
    $ggufFile = $ggufQ4
    Write-Host "[OK] GGUF: Q4_K_M ($ggufQ4)"
} elseif (Test-Path $ggufF16) {
    $ggufFile = $ggufF16
    Write-Host "[OK] GGUF: F16 ($ggufF16)"
}

# ── Backend 1: llama-server.exe (preferred — no Python, OpenAI-compatible) ────
if ($ggufFile -and (Test-Path $llamaServer)) {
    Write-Host "[OK] Backend: llama-server.exe (llama.cpp native)"
    Write-Host "     Model:   $ggufFile"
    Write-Host "     Log:     $logDir\hiran-inference.log"

    $llamaArgs = @(
        "--model",   $ggufFile,
        "--host",    $host_,
        "--port",    $port,
        "--ctx-size", "4096",
        "--threads", "8",
        "--n-predict", "-1",
        "--parallel", "2",
        "--log-format", "text"
    )

    # Add GPU offload if available (Vulkan / CUDA layers)
    $gpuLayers = if ($env:HIRAN_GPU_LAYERS) { [int]$env:HIRAN_GPU_LAYERS } else { 0 }
    if ($gpuLayers -gt 0) {
        $llamaArgs += @("--n-gpu-layers", $gpuLayers)
        Write-Host "     GPU layers: $gpuLayers"
    }

    $p = Start-Process -FilePath $llamaServer -ArgumentList $llamaArgs `
        -WorkingDirectory $repoRoot `
        -RedirectStandardOutput "$logDir\hiran-inference.log" `
        -RedirectStandardError  "$logDir\hiran-inference.err" `
        -WindowStyle Hidden -PassThru

    Write-Host "[OK] llama-server.exe PID=$($p.Id) -> http://${host_}:${port}"
    Write-Host "     Waiting for readiness..."

    # Poll until health endpoint responds (max 30s)
    $ready = $false
    for ($i = 0; $i -lt 30; $i++) {
        Start-Sleep -Milliseconds 1000
        try {
            $r = Invoke-WebRequest -Uri "http://${host_}:${port}/health" -TimeoutSec 2 -UseBasicParsing -ErrorAction Stop
            $ready = $true
            break
        } catch { }
    }

    if ($ready) {
        Write-Host "[OK] Hiran Inference READY on http://${host_}:${port}"
    } else {
        Write-Host "[WARN] llama-server did not respond within 30s — check $logDir\hiran-inference.log"
    }
    exit 0
}

# ── Backend 2: LM Studio (port 1234) ─────────────────────────────────────────
$modelPath   = $null
$backendName = $null

try {
    $resp = Invoke-WebRequest -Uri "http://localhost:1234/v1/models" -TimeoutSec 2 -UseBasicParsing -ErrorAction Stop
    $modelPath   = "lmstudio:hiran-v2.2"
    $backendName = "LM Studio (port 1234)"
} catch { }

# ── Backend 3: Ollama (port 11434) ────────────────────────────────────────────
if (-not $modelPath) {
    try {
        $resp = Invoke-WebRequest -Uri "http://localhost:11434/api/tags" -TimeoutSec 2 -UseBasicParsing -ErrorAction Stop
        $modelPath   = "ollama:hiran-v2.2"
        $backendName = "Ollama (port 11434)"
    } catch { }
}

# ── Backend 4: serve.py + GGUF ────────────────────────────────────────────────
if (-not $modelPath -and $ggufFile) {
    $modelPath   = $ggufFile
    $backendName = "serve.py + GGUF llama-cpp-python"
}

if (-not $modelPath) {
    Write-Host ""
    Write-Host "[ERROR] Zadny inference backend neni dostupny!"
    Write-Host ""
    Write-Host "  Moznosti:"
    Write-Host "    A) llama-server.exe bude pouzit automaticky pokud existuje GGUF:"
    Write-Host "       $ggufQ4"
    Write-Host "    B) Spust LM Studio -> nac ti model -> Developer -> Start Server (port 1234)"
    Write-Host "    C) Spust Ollama: ollama serve + ollama pull hiran-v2.2"
    Write-Host "    D) Vytvor GGUF: uv run HiranV2.2\quantization\convert_to_gguf.py"
    Write-Host ""
    exit 1
}

Write-Host "[OK] Backend: $backendName"
Write-Host "[OK] Model:   $modelPath"

# ── Spusti serve.py ───────────────────────────────────────────────────────────
$pythonArgs = @(
    $servePy,
    "--model_path", $modelPath,
    "--host", $host_,
    "--port", $port
)

$uvCmd = Get-Command "uv" -ErrorAction SilentlyContinue
$uvExe = if ($uvCmd) { $uvCmd.Source } else { $null }
if ($uvExe) {
    $allArgs = @("run", "python") + $pythonArgs
    $p = Start-Process -FilePath $uvExe -ArgumentList $allArgs `
        -WorkingDirectory $repoRoot `
        -RedirectStandardOutput "$logDir\hiran-inference.log" `
        -RedirectStandardError  "$logDir\hiran-inference.err" `
        -WindowStyle Hidden -PassThru
} else {
    $p = Start-Process -FilePath "python" -ArgumentList $pythonArgs `
        -WorkingDirectory $repoRoot `
        -RedirectStandardOutput "$logDir\hiran-inference.log" `
        -RedirectStandardError  "$logDir\hiran-inference.err" `
        -WindowStyle Hidden -PassThru
}

Write-Host "[OK] Hiran Inference PID=$($p.Id) -> http://${host_}:${port}"
Write-Host "     Backend: $backendName | Log: $logDir\hiran-inference.log"
