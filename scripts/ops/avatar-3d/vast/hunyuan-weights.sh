#!/usr/bin/env bash
# Stáhne váhy Hunyuan3D-2.1 (shape + paint) do /root/weights.
set -x
/opt/conda/bin/pip install -q huggingface_hub
/opt/conda/bin/python - <<'PY'
from huggingface_hub import snapshot_download
p = snapshot_download(
    "tencent/Hunyuan3D-2.1",
    local_dir="/root/weights",
    max_workers=8,
    allow_patterns=["hunyuan3d-dit-v2-1/*", "hunyuan3d-paintpbr-v2-1/*"],
)
print("DOWNLOADED", p)
PY
echo "WEIGHTS_EXIT=$?"
du -sh /root/weights
