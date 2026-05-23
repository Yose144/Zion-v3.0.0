# ZION V3 — Start Hiran v2.2 Inference Server (port 8002)
# OpenAI-compatible API: /v1/chat/completions, /health, /status, /metrics, /v1/embeddings
#
# Backendy (v pořadí detekce):
#   1. LM Studio server (port 1234) — doporučeno, AMD GPU přes DirectML
#   2. Ollama server (port 11434) — fallback pokud Ollama běží
#   3. GGUF soubor — pokud existuje HiranV2.2\models\gguf\hiran-v2.2-q4_k_m.gguf
#
$logDir   = "C:\Users\yosef\Desktop\Zion\2.9.6-main\logs"
$repoRoot = "C:\Users\yosef\Desktop\Zion\2.9.6-main"
$servePy  = "$repoRoot\HiranV2.2\inference\serve.py"
$ggufPath = "$repoRoot\HiranV2.2\models\gguf\hiran-v2.2-q4_k_m.gguf"

New-Item -ItemType Directory -Path $logDir -Force | Out-Null

# ── Detekce backendu ─────────────────────────────────────────────────────────
$modelPath = $null
$backendName = $null

# 1. LM Studio (port 1234)
try {
    $resp = Invoke-WebRequest -Uri "http://localhost:1234/v1/models" -TimeoutSec 2 -UseBasicParsing -ErrorAction Stop
    $modelPath = "lmstudio:hiran-v2.2"
    $backendName = "LM Studio (port 1234)"
} catch { }

# 2. Ollama (port 11434)
if (-not $modelPath) {
    try {
        $resp = Invoke-WebRequest -Uri "http://localhost:11434/api/tags" -TimeoutSec 2 -UseBasicParsing -ErrorAction Stop
        $modelPath = "ollama:hiran-v2.2"
        $backendName = "Ollama (port 11434)"
    } catch { }
}

# 3. GGUF soubor
if (-not $modelPath -and (Test-Path $ggufPath)) {
    $modelPath = $ggufPath
    $backendName = "GGUF llama.cpp"
}

if (-not $modelPath) {
    Write-Host "[ERROR] Zadny inference backend neni dostupny!"
    Write-Host ""
    Write-Host "  Moznosti:"
    Write-Host "    A) Spust LM Studio -> nac ti model -> Developer -> Start Server (port 1234)"
    Write-Host "    B) Spust Ollama:  ollama serve  +  ollama pull hiran-v2.2"
    Write-Host "    C) Konvertuj model na GGUF: uv run HiranV2.2\quantization\convert_to_gguf.py"
    exit 1
}

Write-Host "[OK] Backend: $backendName"
Write-Host "[OK] Model:   $modelPath"

# ── Spusti serve.py ───────────────────────────────────────────────────────────
$pythonArgs = @(
    $servePy,
    "--model_path", $modelPath,
    "--host", "127.0.0.1",
    "--port", "8002"
)

# Zkus uv run python (preferovany)
$uvExe = (Get-Command "uv" -ErrorAction SilentlyContinue)?.Source
if ($uvExe) {
    $allArgs = @("run", "python") + $pythonArgs
    $p = Start-Process -FilePath $uvExe -ArgumentList $allArgs `
        -WorkingDirectory $repoRoot `
        -RedirectStandardOutput "$logDir\hiran-inference.log" `
        -RedirectStandardError  "$logDir\hiran-inference.err" `
        -WindowStyle Hidden -PassThru
} else {
    # Fallback na system python
    $p = Start-Process -FilePath "python" -ArgumentList $pythonArgs `
        -WorkingDirectory $repoRoot `
        -RedirectStandardOutput "$logDir\hiran-inference.log" `
        -RedirectStandardError  "$logDir\hiran-inference.err" `
        -WindowStyle Hidden -PassThru
}

Write-Host "Started Hiran Inference PID=$($p.Id) -> http://localhost:8002"
Write-Host "Backend: $backendName | Log: $logDir\hiran-inference.log"
