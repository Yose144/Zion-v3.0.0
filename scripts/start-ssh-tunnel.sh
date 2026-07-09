#!/usr/bin/env bash
# ============================================================================
#  ZION V3 — SSH Tunnel to Edge Server (auto-start after reboot)
#  Forwards edge server ports to localhost for dashboard monitoring
# ============================================================================

ssh -fN \
  -o ServerAliveInterval=30 \
  -o ServerAliveCountMax=3 \
  -o ExitOnForwardFailure=yes \
  -L 8443:127.0.0.1:8443 \
  -L 8444:127.0.0.1:8444 \
  -L 8445:127.0.0.1:8445 \
  -L 8448:127.0.0.1:8448 \
  -L 8450:127.0.0.1:8450 \
  -L 8455:127.0.0.1:8455 \
  -L 8094:127.0.0.1:8094 \
  -L 8095:127.0.0.1:8095 \
  -L 8096:127.0.0.1:8096 \
  -L 9100:127.0.0.1:9100 \
  -L 9101:127.0.0.1:9101 \
  -L 9333:127.0.0.1:9333 \
  -R 8446:127.0.0.1:8446 \
  -R 8447:127.0.0.1:8447 \
  zion-new

echo "[OK] SSH tunnel started at $(date)"
