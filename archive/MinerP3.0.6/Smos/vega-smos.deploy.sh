#!/usr/bin/env bash
# Deploy the v70 miner package to SMOS rig vega-smos (ZionRig).
# Run from the Edge server or adapt for local SMOS API calls.
set -euo pipefail

V="v3.1.9-vega-complete-70"
ZIP="zion-miner-${V}.zip"
FOLDER="zion-miner-${V}"
SMOS_GROUP=1773590
SMOS_RIG=518837

# Reuse the stable v70 binary and the current wrapper
rm -rf /tmp/${FOLDER} /tmp/v70x
mkdir -p /tmp/${FOLDER}
cp /var/www/zion-miner/zion-miner-${V}.zip /tmp/v70.zip
unzip -o /tmp/v70.zip -d /tmp/v70x >/dev/null
cp /tmp/v70x/${FOLDER}/miner /tmp/${FOLDER}/miner
cp /tmp/wrapper_complete.sh /tmp/${FOLDER}/miner
chmod +x /tmp/${FOLDER}/miner
cd /tmp
rm -f /var/www/zion-miner/${ZIP}
zip -r /var/www/zion-miner/${ZIP} ${FOLDER}/
echo "Built /var/www/zion-miner/${ZIP}"

# Update SMOS rig group
echo "Set rig group ${SMOS_GROUP} minerOptions to ${ZIP}"
curl -s -X PUT \
  -H "X-AUTH-TOKEN: ${SMOS_API_TOKEN}" \
  -H "Content-Type: application/json" \
  "https://api.simplemining.net/rig-groups/${SMOS_GROUP}" \
  -d "{\"minerOptions\":\"http://62.171.141.136/zion-miner/${ZIP}\"}"

# Clear old miner cache on the rig
curl -s -X PATCH \
  -H "X-AUTH-TOKEN: ${SMOS_API_TOKEN}" \
  -H "Content-Type: application/merge-patch+json" \
  "https://api.simplemining.net/rigs/execute-command" \
  -d "{\"rigIds\":[${SMOS_RIG}],\"commandId\":7,\"commandOptions\":\"rm -rf /root/miner/zion-miner-v3.1.9-vega-* /var/tmp/miner/zion-miner-v3.1.9-vega-* /root/miner_org/zion-miner-v3.1.9-vega-* ; echo OK\"}"

# Reboot rig to pull and run new package
curl -s -X PUT \
  -H "X-AUTH-TOKEN: ${SMOS_API_TOKEN}" \
  -H "Content-Type: application/json" \
  "https://api.simplemining.net/rigs/${SMOS_RIG}" \
  -d '{"execute":"reboot"}'

echo "Rebooting rig ${SMOS_RIG}. Wait 3-4 minutes for startup."
