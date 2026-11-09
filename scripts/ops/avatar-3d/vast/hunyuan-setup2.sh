#!/usr/bin/env bash
# Kompletní setup Hunyuan3D-2.1 na vast.ai (RTX 4090 24 GB, CUDA 12.4 image).
# Zahrnuje opravy, které při prvním běhu chyběly:
#   - pybind11 pro kompilaci mesh_inpaint_processor
#   - bpy==4.2.0 (4.0 nemá wheel pro Python 3.11)
#   - záplata basicsr pro novější torchvision (functional_tensor)
#   - X knihovny pro bpy, Real-ESRGAN na obě očekávané cesty
set -x
export DEBIAN_FRONTEND=noninteractive
apt-get update -qq
apt-get install -y -qq git wget curl tmux build-essential libgl1 libglib2.0-0 ffmpeg \
  libsm6 libxext6 libxrender1 libxi6 libxkbcommon0 libgomp1 >/dev/null 2>&1

cd /root
[ -d Hunyuan3D-2.1 ] || git clone --depth 1 https://github.com/Tencent-Hunyuan/Hunyuan3D-2.1.git
cd Hunyuan3D-2.1

grep -v "^bpy" requirements.txt > /root/req-nobpy.txt
pip install -q -r /root/req-nobpy.txt
pip install -q pybind11 "bpy==4.2.0"
sed -i "s/from torchvision.transforms.functional_tensor import rgb_to_grayscale/from torchvision.transforms.functional import rgb_to_grayscale/" \
  /opt/conda/lib/python3.11/site-packages/basicsr/data/degradations.py

cd hy3dpaint/custom_rasterizer && pip install -q -e . && cd ../..
cd hy3dpaint/DifferentiableRenderer
SUFFIX=$(python -c "import sysconfig; print(sysconfig.get_config_var('EXT_SUFFIX'))")
c++ -O3 -Wall -shared -std=c++11 -fPIC $(python -m pybind11 --includes) \
  mesh_inpaint_processor.cpp -o "mesh_inpaint_processor${SUFFIX}"
cd ../..

mkdir -p hy3dpaint/ckpt ckpt
curl -fsSL -o ckpt/RealESRGAN_x4plus.pth \
  https://github.com/xinntao/Real-ESRGAN/releases/download/v0.1.0/RealESRGAN_x4plus.pth
cp ckpt/RealESRGAN_x4plus.pth hy3dpaint/ckpt/

python - <<'PY'
import importlib
for m in ("trimesh", "pymeshlab", "realesrgan", "basicsr", "bpy", "custom_rasterizer"):
    importlib.import_module(m)
print("DEPS_OK")
PY
echo "SETUP2_EXIT=$?"
