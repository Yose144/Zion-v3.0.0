#!/usr/bin/env bash
# Instalace Hunyuan3D-2.1 na pronajaté vast.ai instanci (RTX 4090 24 GB, CUDA 12.4).
# Běží v tmuxu. Log: /root/hunyuan-setup.log
set -x
export DEBIAN_FRONTEND=noninteractive
apt-get update -qq
apt-get install -y -qq git wget curl tmux build-essential libgl1 libglib2.0-0 ffmpeg >/dev/null 2>&1

cd /root
[ -d Hunyuan3D-2.1 ] || git clone --depth 1 https://github.com/Tencent-Hunyuan/Hunyuan3D-2.1.git
cd Hunyuan3D-2.1

# torch v image je 2.5.1+cu124, což odpovídá doporučení upstreamu
pip install -q -r requirements.txt

# CUDA rozšíření pro texturování
cd hy3dpaint/custom_rasterizer && pip install -q -e . && cd ../..
cd hy3dpaint/DifferentiableRenderer && bash compile_mesh_painter.sh && cd ../..

# Real-ESRGAN pro závěrečné doostření textur
mkdir -p hy3dpaint/ckpt
wget -q https://github.com/xinntao/Real-ESRGAN/releases/download/v0.1.0/RealESRGAN_x4plus.pth -P hy3dpaint/ckpt || true

echo "SETUP_EXIT=$?"
