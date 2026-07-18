FROM nvidia/cuda:12.4.0-runtime-ubuntu22.04

# Install build dependencies + OpenCL runtime
RUN apt-get update && apt-get install -y \
    curl build-essential pkg-config \
    ocl-icd-opencl-dev opencl-headers \
    ocl-icd-libopencl1 \
    libssl-dev \
    git cmake \
    && rm -rf /var/lib/apt/lists/*

# Install Rust
RUN curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y
ENV PATH="/root/.cargo/bin:${PATH}"

# Copy repo (will be mounted at /workspace)
WORKDIR /workspace

# Build script
COPY build.sh /build.sh
RUN chmod +x /build.sh

# Entry point: build + run
CMD ["/bin/bash", "/build.sh"]
