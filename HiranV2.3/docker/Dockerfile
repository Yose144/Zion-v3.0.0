# Hiran v2.3 Inference Server Docker Image
# Supports both CPU and GPU inference
#
# Build:
#   docker build -f HiranV2.3/docker/Dockerfile -t hiran-v2.3:latest .
#
# Run CPU:
#   docker run -p 8000:8000 -v $(pwd)/HiranV2.3/models:/models hiran-v2.3:latest \
#     --model_path /models/hiran-v2.3-q5_k_m.gguf
#
# Run GPU:
#   docker run --gpus all -p 8000:8000 -v $(pwd)/HiranV2.3/models:/models hiran-v2.3:latest \
#     --model_path /models/hiran-v2.3-q5_k_m.gguf --n_gpu_layers -1

FROM nvidia/cuda:12.1-runtime-ubuntu22.04 AS base

ENV DEBIAN_FRONTEND=noninteractive
ENV PYTHONUNBUFFERED=1
ENV HIRAN_MODEL_PATH=/models/hiran-v2.3-q5_k_m.gguf

RUN apt-get update && apt-get install -y \
    python3 python3-pip python3-venv \
    git build-essential cmake \
    libopenblas-dev libomp-dev \
    curl wget \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Install Python dependencies
COPY HiranV2.3/docker/requirements-inference.txt /app/requirements.txt
RUN pip3 install --no-cache-dir -r /app/requirements.txt

# Copy source code
COPY HiranV2.3/inference /app/inference
COPY HiranV2.3/tools /app/tools
COPY HiranV2.3/rag /app/rag
COPY HiranV2.3/config /app/config

# Set Python path
ENV PYTHONPATH=/app:$PYTHONPATH

# Create model directory
RUN mkdir -p /models

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
    CMD curl -f http://localhost:8000/health || exit 1

EXPOSE 8000

ENTRYPOINT ["python3", "-m", "inference.server"]
CMD ["--host", "0.0.0.0", "--port", "8000"]
