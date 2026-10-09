# Hiran v2.2 CLI Integration

## Overview

Hiran v2.2 is fully integrated into ZION CLI with local LLM inference capabilities using llama.cpp backend with GPU acceleration, hybrid RAG integration, and comprehensive monitoring.

## Implementation Date

2026-05-12

## What's New

### 1. New CLI Command: `zion hiran`

Complete inference service management with the following subcommands:

```bash
# Lifecycle management
zion hiran start          # Start Hiran inference service
zion hiran stop           # Stop Hiran inference service  
zion hiran restart        # Restart Hiran inference service
zion hiran status         # Check service health and status
zion hiran logs           # Stream inference logs

# Interactive inference
zion hiran chat           # Interactive REPL with Hiran v2.2
zion hiran ask <question> # Single question query

# Advanced operations
zion hiran inference --model <path> --backend <type> --device <cuda|cpu>
zion hiran evaluate --dataset <path> --metrics <list>
zion hiran quantize --model <path> --format <q4_k_m|q5_k_m|q8_0>
zion hiran deploy --model <path> --platform <vast|runpod|huggingface>

# Configuration
zion hiran config         # Show inference configuration
```

### 2. Docker Service Integration

**New Docker service:** `hiran-inference`

**Location:** `V3/docker/hiran-inference/`

**Features:**
- Based on llama.cpp with CUDA backend
- GPU acceleration support (NVIDIA CUDA 11.0+)
- OpenAI-compatible HTTP API
- Health checks and monitoring
- Volume mounts for models, cache, and logs

**Docker Compose:**
```yaml
services:
  hiran-inference:
    profiles: ["hiran", "mainnet"]
    build: ./hiran-inference
    image: zion-hiran-inference:v2.2
    ports:
      - "8002:8002"
    volumes:
      - hiran-models:/models
      - hiran-cache:/cache
      - hiran-logs:/logs
    deploy:
      resources:
        reservations:
          devices:
            - driver: nvidia
              capabilities: [gpu]
```

**Usage:**
```bash
# Build and start
docker compose -f V3/docker/docker-compose.yml --profile hiran up -d hiran-inference

# With mainnet stack
docker compose -f V3/docker/docker-compose.yml --profile mainnet --profile hiran up -d
```

### 3. Config Schema Extension

**New config section in `~/.zion/zion.toml`:**

```toml
[hiran]
model_path = "/models/hiran-v2.2-q5_k_m.gguf"
backend = "llama_cpp"      # llama_cpp | onnx | tensorrt
device = "cuda"            # cuda | cpu | auto
port = 8002
max_context = 4096
temperature = 0.7
top_p = 0.9
```

**Config management:**
```bash
# Set config values
zion config set hiran.model_path /models/hiran-v2.2-q5_k_m.gguf
zion config set hiran.backend llama_cpp
zion config set hiran.device cuda

# Validate config
zion config validate
```

### 4. Monitoring Integration

**Prometheus scraping:**
```yaml
scrape_configs:
  - job_name: zion-hiran-inference
    metrics_path: /metrics
    static_configs:
      - targets:
          - hiran-inference:8002
```

**Grafana dashboard:** `V3/docker/grafana/dashboards/hiran-inference-overview.json`

**Metrics tracked:**
- Service status and uptime
- Request count and rate
- Inference latency (P50, P95, P99)
- GPU utilization and memory usage
- Token generation rate
- Error rate

**Alerting rules:**
- `HiranInferenceDown` - Service unavailable
- `HiranHighLatency` - P95 latency > 2s
- `HiranHighErrorRate` - Error rate > 5%
- `HiranGpuMemoryHigh` - VRAM > 90%
- `HiranGpuUtilizationLow` - GPU < 10%

### 5. AI-Native Hybrid Integration

**New module:** `V3/L3/ai-native/src/hiran_inference.rs`

**Features:**
- `HiranInferenceClient` - HTTP client for Hiran inference service
- `HybridInferenceBackend` - Automatic fallback between remote and local inference
- RAG context integration for enhanced responses
- Health check and status monitoring

**Usage in AI-Native service:**
```rust
use zion_ai_native::hiran_inference::{HiranInferenceClient, HybridInferenceBackend};

// Create hybrid backend
let backend = HybridInferenceBackend::from_env();

// Generate with RAG context
let response = backend.generate_with_context(prompt, rag_context).await?;
```

**Environment variables:**
```env
HIRAN_INFERENCE_URL=http://localhost:8002
HIRAN_PREFER_LOCAL=true
LLM_BASE_URL=https://api.nvidia.com/v1/chat/completions  # fallback
```

### 6. Service Mapping

**Updated deploy service mapping:**
```rust
fn map_service(service: &str) -> String {
    match service {
        "hiran" | "inference" => "hiran-inference",
        // ... other mappings
    }
}
```

**CLI service control:**
```bash
zion start hiran      # Start via deploy layer
zion stop hiran       # Stop via deploy layer
zion restart hiran    # Restart via deploy layer
zion logs hiran       # Tail logs via deploy layer
```

## File Structure

### Created Files

**Docker:**
- `V3/docker/hiran-inference/Dockerfile` - Main inference service container
- `V3/docker/hiran-inference/.dockerignore` - Build exclusions
- `V3/docker/hiran-inference/README.md` - Service documentation

**CLI:**
- `V3/cli/src/commands/hiran.rs` - CLI command implementation (300+ lines)
- `V3/cli/src/rpc/hiran_rpc.rs` - HTTP client for inference API (100+ lines)

**Monitoring:**
- `V3/docker/grafana/dashboards/hiran-inference-overview.json` - Grafana dashboard
- `V3/docker/alert_rules.yml` - Updated with Hiran alerts
- `V3/docker/prometheus.yml` - Updated with Hiran scraping

**AI-Native:**
- `V3/L3/ai-native/src/hiran_inference.rs` - Hybrid inference backend (400+ lines)

### Modified Files

**CLI:**
- `V3/cli/src/main.rs` - Added Hiran command to CLI
- `V3/cli/src/commands/mod.rs` - Added hiran module
- `V3/cli/src/rpc/mod.rs` - Added hiran_rpc module
- `V3/cli/src/commands/deploy.rs` - Added hiran service mapping
- `V3/cli/src/config.rs` - Added HiranConfig struct and validation

**Docker:**
- `V3/docker/docker-compose.yml` - Added hiran-inference service
- `V3/docker/.env.example` - Added Hiran environment variables

**AI-Native:**
- `V3/L3/ai-native/src/lib.rs` - Added hiran_inference module exports

**Documentation:**
- `ZION-CLI.md` - Updated command surface and config schema

## GPU Requirements

**Minimum:**
- VRAM: 6 GB (for Q5_K_M 8B model)
- Compute Capability: 7.0+ (CUDA 11.0+)

**Recommended:**
- VRAM: 8+ GB
- GPU: NVIDIA RTX 3060 or better

**Supported backends:**
- `llama_cpp` - Primary backend with CUDA acceleration
- `onnx` - Alternative (future)
- `tensorrt` - High-performance (future)

## Model Formats

**Supported quantization:**
- `Q4_K_M` - Fast/edge deployment (4.5 GB)
- `Q5_K_M` - Balanced (5.4 GB) - **Default**
- `Q8_0` - High quality (8.5 GB)
- `F16` - Full precision (16 GB)

**Model location:**
- Default: `/models/hiran-v2.2-q5_k_m.gguf`
- Configurable via `hiran.model_path`

## API Endpoints

**Health Check:**
```
GET /health
```

**Chat Completions (OpenAI-compatible):**
```
POST /v1/chat/completions
```

**Embeddings:**
```
POST /v1/embeddings
```

**Model Info:**
```
GET /v1/models
```

**Metrics (Prometheus):**
```
GET /metrics
```

## Testing

**Local testing:**
```bash
# Build CLI
cargo build -p zion-cli --release

# Test Hiran commands
./target/release/zion hiran status
./target/release/zion hiran config
```

**Docker testing:**
```bash
# Build image
docker build -t zion-hiran-inference:v2.2 V3/docker/hiran-inference/

# Run container
docker run -d \
  --gpus all \
  --name hiran-test \
  -p 8002:8002 \
  -v /path/to/models:/models \
  zion-hiran-inference:v2.2

# Test API
curl http://localhost:8002/health
```

**Vast.ai deployment:**
```bash
# Deploy to Vast.ai instance
zion hiran deploy --model hiran-v2.2-q5_k_m.gguf --platform vast

# Monitor
zion hiran logs
```

## Troubleshooting

**GPU not detected:**
- Verify NVIDIA drivers: `nvidia-smi`
- Check Docker GPU access: `docker run --rm --gpus all nvidia/cuda:12.1-base nvidia-smi`

**Model not found:**
- Verify volume mount: `-v /path/to/models:/models`
- Check model path in config: `hiran.model_path`

**Out of memory:**
- Reduce `hiran.max_context` or `hiran.n_gpu_layers`
- Use smaller quantization (Q4_K_M instead of Q5_K_M)
- Increase system swap

**Service unreachable:**
- Check service status: `zion hiran status`
- Review logs: `zion hiran logs`
- Verify port availability: `hiran.port`

## Future Enhancements

- [ ] Multi-model support (model variants for different use cases)
- [ ] Auto-scaling based on load
- [ ] Model version management and A/B testing
- [ ] Distributed inference across multiple GPUs
- [ ] ONNX and TensorRT backend support
- [ ] Advanced caching strategies
- [ ] Model fine-tuning integration

## References

- **Hiran v2.1 Plan:** `HiranV2.1/PLAN_v2.1.md`
- **Hiran v2.2 Upgrade:** `HiranV2.1/HIRAN_V2.2_ROBUST_UPGRADE.md`
- **CLI Guide:** `V3/docs/CLI_GUIDE.md`
- **Docker Docs:** `V3/docker/DOCKER.md`

---

**Generated:** 2026-05-12  
**Status:** ✅ Fully Integrated  
**Version:** v2.2