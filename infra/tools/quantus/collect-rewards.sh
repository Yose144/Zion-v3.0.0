#!/usr/bin/env bash
# Quantus wormhole rewards sweep — exits mined QTC leaves to payout treasury.
# Dest: transparent QTC account (NOT a wormhole addr — those are unspendable).
# Treasury address in /opt/quantus/payout-destination.txt (plain qz... addr).
set -euo pipefail
exec {LOCKFD}>/opt/quantus/.collect-rewards.lock
flock -n ${LOCKFD} || { echo "[collect-rewards] already running"; exit 0; }
DEST_FILE=/opt/quantus/payout-destination.txt
if [[ ! -s "$DEST_FILE" ]]; then
  echo "[collect-rewards] no payout-destination configured — skipping" >&2
  exit 0
fi
DEST=$(tr -d "[:space:]" < "$DEST_FILE")
exec /opt/quantus/bin/quantus wormhole collect-rewards \
  --secret-file /opt/quantus/rewards-spend.secret \
  --destination "$DEST" \
  --subsquid-url https://sqm.quantus.com/v1/graphql --node-url ws://127.0.0.1:9944 \
  --wait-for-transaction
