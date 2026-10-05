#!/bin/bash
# Build the SMOS custom-miner package for the V31 Trinity rig.
#
# The zip is named teamredminer-*.zip so SimpleMining recognizes the miner
# type and polls its sgminer-compatible stats API (127.0.0.1:4028/4029),
# which is served by smos_api.py reading ZION_STATS_FILE.
#
# SMOS requires a top-level folder inside the zip ("No folder found in ZIP"
# otherwise) and runs ./miner inside it.
set -euo pipefail

REPO=/home/zionserver/2.9.6-main
VER=${1:-3.3.0}
NAME="teamredminer-zion-trinity-smos-v${VER}"
STAGE=$(mktemp -d)
trap 'rm -rf "${STAGE}"' EXIT

mkdir -p "${STAGE}/${NAME}"
cp "${REPO}/V31/scripts/smos/wrapper_v31_trinity.sh" "${STAGE}/${NAME}/miner"
cp "${REPO}/V31/scripts/smos/smos_api.py" "${STAGE}/${NAME}/smos_api.py"
chmod +x "${STAGE}/${NAME}/miner" "${STAGE}/${NAME}/smos_api.py"

cd "${STAGE}"
zip -r "${REPO}/${NAME}.zip" "${NAME}" >/dev/null
echo "built: ${REPO}/${NAME}.zip"
unzip -l "${REPO}/${NAME}.zip"
