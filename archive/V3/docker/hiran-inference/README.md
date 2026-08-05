# Hiran v2.2 Inference Service

Docker service pro lokální inferenci Hiran v2.2 modelu pomocí llama.cpp s CUDA akcelerací.

## Architektura

- **Base image**: nvidia/cuda:12.1-runtime-ubuntu22.04
- **Backend**: llama.cpp s GGML_CUDA podporou
- **Model format**: GGUF (quantized Llama 3.1 8B)
- **API**: OpenAI-compatible HTTP API (llama-server)

## Environment Variables

| Proměnná | Default | Popis |
|----------|---------|-------|
| `HIRAN_MODEL` | `/models/hiran-v2.2-q5_k_m.gguf` | Cesta k GGUF modelu |
| `HIRAN_BACKEND` | `llama_cpp` | Inference backend |
| `HIRAN_DEVICE` | `cuda` | Computing device (cuda/cpu) |
| `HIRAN_HOST` | `0.0.0.0` | Bind address |
| `HIRAN_PORT` | `8002` | HTTP port |
| `HIRAN_CTX_SIZE` | `4096` | Context window size |
| `HIRAN_N_GPU_LAYERS` | `99` | Počet GPU vrstev (99 = vše) |
| `HIRAN_THREADS` | `4` | CPU threads pro CPU část |
| `HIRAN_EXTRA_ARGS` | | Extra argumenty pro llama-server |

## API Endpoints

### Health Check
```
GET /health
```

### Completions (OpenAI-compatible)
```
POST /v1/chat/completions
POST /v1/completions
```

### Embeddings
```
POST /v1/embeddings
```

### Model Info
```
GET /v1/models
```

## Použití

### Lokální build
```bash
cd V3/docker/hiran-inference
docker build -t zion/hiran-inference:v2.2 .
```

### Spuštění přes Docker Compose
```bash
# S profilem hiran
docker compose -f V3/docker/docker-compose.yml --profile hiran up -d hiran-inference

# S mainnet profile
docker compose -f V3/docker/docker-compose.yml --profile mainnet --profile hiran up -d
```

### Manuální spuštění
```bash
docker run -d \
  --gpus all \
  --name hiran-inference \
  -p 8002:8002 \
  -v /path/to/models:/models \
  -v /path/to/cache:/cache \
  -e HIRAN_MODEL=/models/hiran-v2.2-q5_k_m.gguf \
  -e HIRAN_DEVICE=cuda \
  zion/hiran-inference:v2.2
```

## GPU požadavky

- **Minimální VRAM**: 6 GB (pro Q5_K_M 8B model)
- **Doporučené VRAM**: 8+ GB
- **Podporované GPU**: NVIDIA (CUDA 11.0+), AMD (přes ROCm - vyžaduje úpravu base image)

## Monitoring

Service vystavuje Prometheus metrics přes `/metrics` endpoint (pokud je povoleno v llama-server).

## Integrace se ZION CLI

```bash
# Start Hiran inference service
zion hiran start

# Status
zion hiran status

# Logs
zion hiran logs

# Stop
zion hiran stop
```

## Troubleshooting

### GPU není dostupný
- Ověřte NVIDIA drivers: `nvidia-smi`
- Ověřte Docker GPU access: `docker run --rm --gpus all nvidia/cuda:12.1-base nvidia-smi`

### Model nenalezen
- Ověřte mount volume: `-v /path/to/models:/models`
- Ověřte cestu k modelu: `docker exec hiran-inference ls -la /models/`

### Out of Memory
- Snižte `HIRAN_CTX_SIZE` nebo `HIRAN_N_GPU_LAYERS`
- Použijte menší quantization (Q4_K_M místo Q5_K_M)
- Zvyšte systémovou paměť (swap)