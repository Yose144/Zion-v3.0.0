#!/usr/bin/env bash
# Texturování po jedné postavě — každá v samostatném procesu, aby se VRAM
# uvolnila (paint pipeline potřebuje ~21 GB z 24 GB a v jednom procesu leakuje).
set -x
cd /root/Hunyuan3D-2.1
for id in "$@"; do
  /opt/conda/bin/python /root/hunyuan-paint.py "$id" || echo "PAINT_FAIL $id"
done
echo "PAINT_ALL_EXIT=$?"
ls -lh /root/work/out/*-hunyuan.glb 2>/dev/null
