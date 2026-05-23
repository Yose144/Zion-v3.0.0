# ZION V3 — Start Hiranyagarbha AI Native API (port 8001)
# Orchestrator HTTP API + RAG + ConsciousnessEngine + Hiran inference client
$logDir = "C:\Users\yosef\Desktop\Zion\2.9.6-main\logs"
New-Item -ItemType Directory -Path $logDir -Force | Out-Null

# ── Environment ──────────────────────────────────────────────────────────────
[Environment]::SetEnvironmentVariable('HIRANYAGARBHA_BIND',        '0.0.0.0:8001', 'Process')
[Environment]::SetEnvironmentVariable('HIRANYAGARBHA_BACKEND',     'auto',          'Process')
[Environment]::SetEnvironmentVariable('HIRANYAGARBHA_MAX_AGENTS',  '100',           'Process')
[Environment]::SetEnvironmentVariable('ZION_NODE_RPC_ADDR',        '127.0.0.1:8443','Process')
[Environment]::SetEnvironmentVariable('ZION_POOL_API_URL',         'http://127.0.0.1:8080','Process')

# Point Hiranyagarbha at local Hiran inference (port 8002)
[Environment]::SetEnvironmentVariable('LLM_BASE_URL',              'http://127.0.0.1:8002/v1', 'Process')
[Environment]::SetEnvironmentVariable('LLM_MODEL',                 'hiran-v2.2',    'Process')

# RAG — chunk docs from repo root
[Environment]::SetEnvironmentVariable('ZION_WORKSPACE_ROOT',       'C:\Users\yosef\Desktop\Zion\2.9.6-main', 'Process')
[Environment]::SetEnvironmentVariable('ZION_RAG_CHUNK_DOCS',       '1',             'Process')

# ── Binary ───────────────────────────────────────────────────────────────────
$exe = 'C:\Users\yosef\Desktop\Zion\2.9.6-main\V3\target\release\zion-ai-native-api.exe'
if (-not (Test-Path $exe)) {
    Write-Host "[ERROR] Binary not found: $exe"
    Write-Host "        Run: cargo build --release --manifest-path V3/Cargo.toml -p zion-ai-native"
    exit 1
}

$p = Start-Process -FilePath $exe `
    -RedirectStandardOutput "$logDir\hiranyagarbha.log" `
    -RedirectStandardError  "$logDir\hiranyagarbha.err" `
    -WindowStyle Hidden -PassThru
Write-Host "Started Hiranyagarbha PID=$($p.Id) -> http://localhost:8001"
