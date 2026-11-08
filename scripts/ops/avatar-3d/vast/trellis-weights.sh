#!/usr/bin/env bash
# Stáhne váhy TRELLIS.2-4B (~13 GB) do /root/weights. Běží paralelně se setupem.
set -x
pip install -q "huggingface_hub[cli]"
mkdir -p /root/weights
huggingface-cli download microsoft/TRELLIS.2-4B --local-dir /root/weights
echo "WEIGHTS_EXIT=$?"
du -sh /root/weights
