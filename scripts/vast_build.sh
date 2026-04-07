#!/bin/bash
set -e

# Extract the full source
cd /root
rm -rf zion
mkdir -p zion
cd zion
tar xzf /root/v3-miner-full.tar.gz

# Strip workspace to only L1 crates we have
cat > /root/zion/V3/Cargo.toml << 'CARGO_EOF'
[workspace]
members = [
    "L1/cosmic-harmony",
    "L1/core",
    "L1/pool",
    "L1/miner",
]
resolver = "2"

[workspace.package]
version = "3.0.0"
edition = "2021"
license = "MIT"
authors = ["Yose144"]

[workspace.dependencies]
anyhow = "1"
cc = "1.0"
blake3 = "1"
ed25519-dalek = { version = "2", features = ["rand_core"] }
heed = "0.22"
rand = "0.8"
ripemd = "0.1"
serde = { version = "1", features = ["derive"] }
serde_json = "1"
sha2 = "0.10"
k256 = { version = "0.13", features = ["ecdsa"] }
hex = "0.4"
tempfile = "3"
ctrlc = { version = "3", features = ["termination"] }
thiserror = "2"
tracing = "0.1"
zeroize = { version = "1", features = ["derive"] }

[profile.release]
opt-level = 3
lto = "fat"
codegen-units = 1
strip = "symbols"
CARGO_EOF

export PATH="/root/.cargo/bin:$PATH"

# Try building with OpenCL
echo "Starting build with gpu-opencl..."
cd /root/zion/V3
if cargo build --release -p zion-miner --features gpu-opencl 2>&1; then
    echo "BUILD_SUCCESS_GPU"
else
    echo "GPU build failed, trying CPU-only..."
    if cargo build --release -p zion-miner 2>&1; then
        echo "BUILD_SUCCESS_CPU"
    else
        echo "BUILD_FAILED"
        exit 1
    fi
fi

echo "Binary size:"
ls -lh /root/zion/V3/target/release/zion-miner
