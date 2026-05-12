# Hiran v2.2 Inference Service Dockerfile
# Based on llama.cpp with CUDA backend support

FROM nvidia/cuda:12.1-runtime-ubuntu22.04

LABEL maintainer="ZION Network <dev@zion.network>"
LABEL description="Hiran v2.2 LLM Inference Service with llama.cpp CUDA backend"

# Set working directory
WORKDIR /app

# Install dependencies
RUN apt-get update && apt-get install -y \
    git \
    cmake \
    build-essential \
    wget \
    curl \
    python3 \
    python3-pip \
    && rm -rf /var/lib/apt/lists/*

# Clone and build llama.cpp with CUDA support
RUN git clone https://github.com/ggerganov/llama.cpp.git && \
    cd llama.cpp && \
    git checkout master && \
    cmake -B build -DGGML_CUDA=ON -DCMAKE_BUILD_TYPE=Release && \
    cmake --build build --config Release -j$(nproc) && \
    cmake --install build --prefix /usr/local

# Create model and cache directories
RUN mkdir -p /models /cache /logs

# Copy model (will be mounted or downloaded at runtime)
# COPY hiran-v2.2-q5_k_m.gguf /models/

# Create startup script
RUN echo '#!/bin/bash\n\
set -e\n\
\n\
echo "====================================="\n\
echo "Hiran v2.2 Inference Service"\n\
echo "====================================="\n\
echo "Model: ${HIRAN_MODEL:-/models/hiran-v2.2-q5_k_m.gguf}"\n\
echo "Backend: ${HIRAN_BACKEND:-llama_cpp}"\n\
echo "Device: ${HIRAN_DEVICE:-cuda}"\n\
echo "Port: ${HIRAN_PORT:-8002}"\n\
echo "====================================="\n\
\n\
# Check if model exists\n\
if [ ! -f "${HIRAN_MODEL:-/models/hiran-v2.2-q5_k_m.gguf}" ]; then\n\
    echo "ERROR: Model file not found: ${HIRAN_MODEL:-/models/hiran-v2.2-q5_k_m.gguf}"\n\
    echo "Please mount model to /models or set HIRAN_MODEL env var"\n\
    exit 1\n\
fi\n\
\n\
# Start llama-server with GPU support\n\
llama-server \\\n\
    -m "${HIRAN_MODEL:-/models/hiran-v2.2-q5_k_m.gguf}" \\\n\
    --host "${HIRAN_HOST:-0.0.0.0}" \\\n\
    --port "${HIRAN_PORT:-8002}" \\\n\
    --ctx-size "${HIRAN_CTX_SIZE:-4096}" \\\n\
    --n-gpu-layers "${HIRAN_N_GPU_LAYERS:-99}" \\\n\
    --threads "${HIRAN_THREADS:-4}" \\\n\
    --log-format text \\\n\
    --log-file /logs/inference.log \\\n\
    --embedding \\\n\
    ${HIRAN_EXTRA_ARGS:-}\n\
' > /app/start.sh && chmod +x /app/start.sh

# Health check script
RUN echo '#!/bin/bash\n\
# Health check for Hiran inference service\n\
curl -f http://localhost:${HIRAN_PORT:-8002}/health || exit 1\n\
' > /app/healthcheck.sh && chmod +x /app/healthcheck.sh

# Expose port
EXPOSE 8002

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=5 \
    CMD /app/healthcheck.sh

# Environment variables
ENV HIRAN_MODEL=/models/hiran-v2.2-q5_k_m.gguf
ENV HIRAN_BACKEND=llama_cpp
ENV HIRAN_DEVICE=cuda
ENV HIRAN_HOST=0.0.0.0
ENV HIRAN_PORT=8002
ENV HIRAN_CTX_SIZE=4096
ENV HIRAN_N_GPU_LAYERS=99
ENV HIRAN_THREADS=4
ENV HIRAN_EXTRA_ARGS=

# Volumes
VOLUME ["/models", "/cache", "/logs"]

# Start service
CMD ["/app/start.sh"]