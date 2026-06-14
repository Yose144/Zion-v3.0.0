# Hiran v2.3 — LM Studio Setup Script
# Run this on your Windows machine AFTER the GGUF model is built on the server.
#
# This script:
#   1. Downloads the GGUF model from Vast AI server
#   2. Places it in the correct LM Studio models folder
#   3. Creates a model config JSON for LM Studio
#
# Prerequisites:
#   - scp in PATH (Git Bash, WSL, or OpenSSH)
#   - LM Studio installed

param(
    [string]$CheckpointStep = "6500",
    [string]$Quantization = "q5_k_m",
    [string]$RemoteHost = "ssh1.vast.ai",
    [int]$RemotePort = 31384,
    [string]$RemoteGGUFPath = "/workspace/hiran-v2.3-${CheckpointStep}-${Quantization}.gguf",
    [string]$LocalModelsDir = "$env:USERPROFILE\.cache\lm-studio\models",
    [string]$ModelName = "Hiran-v2.3-${CheckpointStep}"
)

$ErrorActionPreference = "Stop"

Write-Host "==============================================" -ForegroundColor Cyan
Write-Host " Hiran v2.3 → LM Studio Setup" -ForegroundColor Cyan
Write-Host "==============================================" -ForegroundColor Cyan
Write-Host ""

# Step 1: Check SSH key
$sshKey = "$env:USERPROFILE\.ssh\vast\hiran_v2.4_key"
if (-not (Test-Path $sshKey)) {
    Write-Error "SSH key not found: $sshKey"
    exit 1
}

# Step 2: Create local directory
$modelDir = Join-Path $LocalModelsDir "ZION\Hiran-v2.3-$CheckpointStep"
New-Item -ItemType Directory -Path $modelDir -Force | Out-Null
Write-Host "Local model dir: $modelDir" -ForegroundColor Gray

# Step 3: Download GGUF
$localGGUF = Join-Path $modelDir "model.gguf"
if (Test-Path $localGGUF) {
    $size = (Get-Item $localGGUF).Length / 1GB
    Write-Host "GGUF already exists ($([math]::Round($size,1)) GB). Skipping download." -ForegroundColor Yellow
} else {
    Write-Host "Downloading GGUF from server..." -ForegroundColor Green
    Write-Host "  Remote: $RemoteHost`:$RemotePort`:$RemoteGGUFPath" -ForegroundColor Gray
    Write-Host "  This will take 10-30 minutes depending on your connection." -ForegroundColor Gray
    Write-Host ""

    scp -P $RemotePort -i $sshKey -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null "root@${RemoteHost}:${RemoteGGUFPath}" "$localGGUF"

    if (-not (Test-Path $localGGUF)) {
        Write-Error "Download failed. Check that the GGUF was built on the server first."
        exit 1
    }

    $size = (Get-Item $localGGUF).Length / 1GB
    Write-Host "Downloaded: $([math]::Round($size,1)) GB" -ForegroundColor Green
}

# Step 4: Create LM Studio model config
$configPath = Join-Path $modelDir "config.json"
$config = @{
    name = "Hiran v2.3 (Checkpoint $CheckpointStep)"
    description = "ZION Hiran v2.3 fine-tuned on Qwen3-32B. LoRA checkpoint $CheckpointStep merged and quantized to $Quantization."
    version = "2.3.0"
    author = "ZION Project"
    model = @{
        GGUF = "model.gguf"
        architecture = "Qwen3ForCausalLM"
        parameters = "32B"
        quantization = $Quantization
    }
    context_length = 128000
    chat_format = "ChatML"
} | ConvertTo-Json -Depth 4

Set-Content -Path $configPath -Value $config -Encoding UTF8
Write-Host "Created LM Studio config: $configPath" -ForegroundColor Green

# Step 5: Instructions
Write-Host ""
Write-Host "==============================================" -ForegroundColor Green
Write-Host " SETUP COMPLETE!" -ForegroundColor Green
Write-Host "==============================================" -ForegroundColor Green
Write-Host ""
Write-Host "Model location: $modelDir" -ForegroundColor White
Write-Host ""
Write-Host "Next steps in LM Studio:" -ForegroundColor Cyan
Write-Host "  1. Open LM Studio" -ForegroundColor White
Write-Host "  2. Go to 'My Models' (left sidebar)" -ForegroundColor White
Write-Host "  3. Click 'Add Model' → 'From Folder'" -ForegroundColor White
Write-Host "  4. Select: $modelDir" -ForegroundColor White
Write-Host "  5. The model should appear as: Hiran v2.3 (Checkpoint $CheckpointStep)" -ForegroundColor White
Write-Host ""
Write-Host "Recommended settings:" -ForegroundColor Cyan
Write-Host "  GPU offload: Max layers (if you have 24+ GB VRAM)" -ForegroundColor White
Write-Host "  Context length: 8192 (or 32768 if you have enough VRAM)" -ForegroundColor White
Write-Host "  Temperature: 0.7" -ForegroundColor White
Write-Host "  Top-P: 0.9" -ForegroundColor White
Write-Host ""
Write-Host "If you don't see the model, restart LM Studio." -ForegroundColor Yellow
