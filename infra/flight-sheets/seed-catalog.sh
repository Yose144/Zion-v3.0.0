#!/usr/bin/env bash
# seed-catalog.sh — push catalog-seed.json presets into the fleet CP.
# Usage: VASTCTL_OPS_TOKEN=... bash seed-catalog.sh [base-url]
set -euo pipefail
BASE="${1:-http://127.0.0.1:8088}"
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TOKEN="${VASTCTL_OPS_TOKEN:?set VASTCTL_OPS_TOKEN (VASTCTL_AGENT_TOKEN)}"

python3 - "$HERE/catalog-seed.json" "$BASE" "$TOKEN" <<'PY'
import json, sys, urllib.request
seed, base, token = sys.argv[1], sys.argv[2].rstrip("/"), sys.argv[3]
entries = json.load(open(seed))["entries"]
for name, sheet in entries.items():
    req = urllib.request.Request(
        base + "/api/agent/catalog", method="POST",
        data=json.dumps({"name": name, "sheet": sheet}).encode(),
        headers={"Authorization": f"Bearer {token}"})
    try:
        r = json.load(urllib.request.urlopen(req, timeout=10))
        print(f"{name}: ok hash={r.get('hash')}")
    except Exception as e:
        print(f"{name}: FAILED {e}", file=sys.stderr)
PY
