#!/usr/bin/env bash
# Build zion-hiran-gateway on EDGE (glibc 2.39 + cargo), install on EDGE2.
#
# Usage:
#   bash scripts/ops/deploy-hiran-gateway.sh
#
# Public path (until api. DNS moves to EDGE2):
#   https://market.zionterranova.com/v1/* → 127.0.0.1:8007
# Free tier works without Stripe; Pro/Team need HIRAN_PRICE_* + webhook.

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
EDGE2="${ZION_EDGE2_HOST:-zion-edge2}"
EDGE_HOST="root@62.171.141.136"
EDGE_RSH="ssh -o BatchMode=yes -o ConnectTimeout=25 -J zion-edge2 -i ${HOME}/.ssh/zion-edge-post-wipe-2026-07-29 -p 2222"
REMOTE_BUILD="/opt/zion/V31"
REMOTE_BIN="${REMOTE_BUILD}/target/release/zion-hiran-gateway"

echo "[hiran-gateway] Syncing crate → EDGE:${REMOTE_BUILD}/L3/hiran-gateway"
rsync -az --delete \
  -e "$EDGE_RSH" \
  --exclude target --exclude .git \
  "${ROOT}/V31/L3/hiran-gateway/" \
  "${EDGE_HOST}:${REMOTE_BUILD}/L3/hiran-gateway/"

echo "[hiran-gateway] Ensuring workspace member on EDGE…"
$EDGE_RSH "$EDGE_HOST" "bash -s" <<'REMOTE'
set -euo pipefail
cd /opt/zion/V31
if ! grep -q 'L3/hiran-gateway' Cargo.toml; then
  python3 - <<'PY'
from pathlib import Path
p = Path("Cargo.toml")
text = p.read_text()
needle = '    "L3/ai-native",'
insert = '    "L3/ai-native",\n    "L3/hiran-gateway",'
if needle in text and "L3/hiran-gateway" not in text:
    p.write_text(text.replace(needle, insert, 1))
    print("Cargo.toml: member added after L3/ai-native")
elif "L3/hiran-gateway" not in text:
    # fallback — append into members array first entry block
    raise SystemExit("Could not locate L3/ai-native member to patch")
else:
    print("Cargo.toml: member already present")
PY
fi
. /root/.cargo/env
cargo build --release -p zion-hiran-gateway -j2
test -x /opt/zion/V31/target/release/zion-hiran-gateway
sha256sum /opt/zion/V31/target/release/zion-hiran-gateway
REMOTE

echo "[hiran-gateway] Copying binary EDGE → EDGE2…"
TMP=$(mktemp)
$EDGE_RSH "$EDGE_HOST" "cat ${REMOTE_BIN}" >"$TMP"
chmod +x "$TMP"
scp -o BatchMode=yes -o ConnectTimeout=20 "$TMP" "${EDGE2}:/tmp/zion-hiran-gateway.new"
rm -f "$TMP"

echo "[hiran-gateway] Installing unit + nginx path on EDGE2…"
scp -o BatchMode=yes \
  "${ROOT}/V31/deploy/systemd/zion-hiran-gateway.service" \
  "${EDGE2}:/tmp/zion-hiran-gateway.service" || true

ssh -o BatchMode=yes -o ConnectTimeout=20 "$EDGE2" "bash -s" <<'REMOTE'
set -euo pipefail
install -d -o zion -g zion -m 755 /opt/zion/data /opt/zion/logs /var/log/zion /etc/zion /opt/zion/V31/target/release
install -m 755 -o zion -g zion /tmp/zion-hiran-gateway.new /opt/zion/V31/target/release/zion-hiran-gateway
rm -f /tmp/zion-hiran-gateway.new

# F1 fabric: ensure mini + coder + trinity mockups (merge, never wipe custom upstreams).
python3 - <<'PY'
import json
from pathlib import Path
p = Path("/etc/zion/hiran-models.json")
builtins = [
  {
    "alias": "hiran-mini",
    "context": 4096,
    "tier": "free",
    "price_1m_usd": 0.6,
    "role": "chat",
    "tags": ["live", "hiran"],
    "upstreams": [
      {"base": "http://127.0.0.1:8004/v1", "degraded": False},
      {"base": "http://127.0.0.1:8002/v1", "degraded": True},
    ],
  },
  {
    "alias": "hiran-coder",
    "context": 8192,
    "tier": "pro",
    "price_1m_usd": 2.5,
    "role": "coder",
    "tags": ["code", "agentic", "hiran"],
    "upstreams": [
      {
        "base": "http://127.0.0.1:8005/v1",
        "degraded": False,
        "model": "qwen2.5-coder-7b-instruct",
      }
    ],
  },
  {
    "alias": "hiran-amitabha",
    "mockup": True,
    "context": 8192,
    "tier": "pro",
    "price_1m_usd": 3.0,
    "role": "thinking",
    "tags": ["trinity", "hiran", "thinking"],
    "upstreams": [],
  },
  {
    "alias": "hiran-issobella",
    "mockup": True,
    "context": 16384,
    "tier": "pro",
    "price_1m_usd": 4.0,
    "role": "agentic",
    "tags": ["trinity", "hiran", "code", "agentic"],
    "upstreams": [],
  },
  {
    "alias": "hiran-maitreya",
    "mockup": True,
    "context": 8192,
    "tier": "pro",
    "price_1m_usd": 3.5,
    "role": "lore",
    "tags": ["trinity", "hiran", "rag", "lore"],
    "upstreams": [],
  },
]
if p.exists():
    data = json.loads(p.read_text())
    if not isinstance(data, list):
        raise SystemExit("hiran-models.json must be a JSON array")
else:
    data = []
have = {m.get("alias") for m in data if isinstance(m, dict)}
added = []
for b in builtins:
    if b["alias"] not in have:
        data.append(b)
        added.append(b["alias"])
p.parent.mkdir(parents=True, exist_ok=True)
p.write_text(json.dumps(data, indent=2) + "\n")
print("hiran-models.json aliases:", [m.get("alias") for m in data], "added:", added or "none")
PY
chown root:zion /etc/zion/hiran-models.json
chmod 640 /etc/zion/hiran-models.json

if [[ -f /tmp/zion-hiran-gateway.service ]]; then
  install -m 644 /tmp/zion-hiran-gateway.service /etc/systemd/system/zion-hiran-gateway.service
  rm -f /tmp/zion-hiran-gateway.service
fi

DROP=/etc/systemd/system/zion-hiran-gateway.service.d
mkdir -p "$DROP"
if [[ ! -f "$DROP/admin-key.conf" ]]; then
  KEY=$(openssl rand -hex 32)
  umask 077
  cat >"$DROP/admin-key.conf" <<EOF
[Service]
Environment=HIRAN_ADMIN_KEY=${KEY}
EOF
  chmod 600 "$DROP/admin-key.conf"
  echo "[hiran-gateway] Generated HIRAN_ADMIN_KEY (not printed)"
fi

# Optional Stripe webhook secret drop-in — only if operator already set env file
if [[ -f /etc/zion/hiran-gateway-stripe.env ]]; then
  cat >"$DROP/stripe.conf" <<'EOF'
[Service]
EnvironmentFile=/etc/zion/hiran-gateway-stripe.env
EOF
fi

systemctl daemon-reload
systemctl enable zion-hiran-gateway.service
# Always restart — enable --now does not replace a running binary (stale inode).
systemctl restart zion-hiran-gateway.service
sleep 2
systemctl is-active zion-hiran-gateway.service
curl -sf --max-time 5 http://127.0.0.1:8007/health
echo
curl -sf --max-time 5 http://127.0.0.1:8007/v1/models | head -c 500
echo

NGX=""
for c in /etc/nginx/sites-enabled/market.zionterranova.com.conf \
         /etc/nginx/sites-available/market.zionterranova.com.conf; do
  [[ -f "$c" ]] && NGX="$c" && break
done
if [[ -n "$NGX" ]] && ! grep -q '127.0.0.1:8007' "$NGX"; then
  # NEVER leave .bak in sites-enabled — nginx include glob loads them (AGENTS lesson).
  mkdir -p /etc/nginx/backups
  cp -a "$NGX" "/etc/nginx/backups/market.zionterranova.com.conf.bak-hiran-$(date +%Y%m%d%H%M%S)"
  python3 - "$NGX" <<'PY'
import sys
from pathlib import Path
p = Path(sys.argv[1])
text = p.read_text()
snippet = """
    # Hiran API gateway (B2B-3) — OpenAI-compatible /v1/*
    location /v1/ {
        proxy_pass http://127.0.0.1:8007;
        proxy_http_version 1.1;
        proxy_set_header Connection "";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_buffering off;
        proxy_cache off;
        proxy_read_timeout 300s;
        chunked_transfer_encoding on;
    }

"""
idx = text.find("location / {")
if idx < 0:
    raise SystemExit(f"location / not found in {p}")
p.write_text(text[:idx] + snippet + text[idx:])
print(f"patched {p}")
PY
  nginx -t
  systemctl reload nginx
fi

echo -n "public /v1/models: "
curl -s -o /tmp/hiran-models.json -w "%{http_code}" --max-time 10 \
  https://market.zionterranova.com/v1/models || echo fail
echo
head -c 200 /tmp/hiran-models.json 2>/dev/null || true
echo
REMOTE

echo "[hiran-gateway] OK — free tier on https://market.zionterranova.com/v1/"
echo "  Stripe: create products + set MarketPlace HIRAN_PRICE_* + /etc/zion/hiran-gateway-stripe.env"
