#!/usr/bin/env bash
# Instalace TRELLIS.2 na pronajaté vast.ai instanci (RTX 4090, CUDA 12.4 image).
# Běží v tmuxu: přežije odpojení SSH. Log: /root/setup.log
set -x
export DEBIAN_FRONTEND=noninteractive
apt-get update -qq
apt-get install -y -qq git wget curl tmux libgl1 libglib2.0-0 ffmpeg >/dev/null 2>&1

cd /root
[ -d TRELLIS.2 ] || git clone -b main https://github.com/microsoft/TRELLIS.2.git --recursive
cd TRELLIS.2
git submodule update --init --recursive

# TRELLIS.2 potřebuje CUDA toolkit 12.4 (v image je /usr/local/cuda-12.4)
export CUDA_HOME=/usr/local/cuda-12.4
. ./setup.sh --new-env --basic --flash-attn --nvdiffrast --nvdiffrec --cumesh --o-voxel --flexgemm
echo "SETUP_EXIT=$?"
