#!/bin/bash
# Zion SMOS wrapper - auto-sets algorithm for DeekshaLite v1
export ZION_MINER_ALGORITHM=deeksha_lite_v1
export ZION_GPU_BACKEND=opencl
cd "$(dirname "$0")"
exec ./miner "$@"
