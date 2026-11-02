#!/usr/bin/env bash
# Pojistka proti rozpadu protokolu Nirvany.
#
# Proč existuje: 2026-11-02 shodil paralelní `git add` proto 5 do commitu,
# který měl být jen o mobilu. Appka se nasadila, net ne → produkce 35 minut
# vracela `proto_mismatch` a chat i multiplayer byly mrtvé. Deploy appky
# musí sám poznat, že net je pozadu, a zastavit se.
#
# Použití:
#   bash scripts/ops/nirvana-proto-check.sh            # varování (exit 0/1)
#   bash scripts/ops/nirvana-proto-check.sh --quiet    # jen exit kód
#
# Exit: 0 = klient a server se shodují, 1 = rozpor, 2 = nedá se zjistit.
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
SITE="${NIRVANA_SITE:-https://nirvana.zionterranova.com}"
PROTOCOL_FILE="$ROOT_DIR/apps/nirvana/src/core/net/protocol.ts"
HEALTH_URL="${SITE%/}/net/health"
QUIET=0
[[ "${1:-}" == "--quiet" ]] && QUIET=1

say() { [[ "$QUIET" -eq 1 ]] || echo "$@"; }

if [[ ! -f "$PROTOCOL_FILE" ]]; then
  say "[proto] CHYBA: nenalezen $PROTOCOL_FILE" >&2
  exit 2
fi

# `export const PROTO_VERSION = 5;`
client_proto="$(grep -m1 -E 'export const PROTO_VERSION[[:space:]]*=' "$PROTOCOL_FILE" \
  | grep -oE '[0-9]+' | head -1)"
if [[ -z "${client_proto:-}" ]]; then
  say "[proto] CHYBA: v protocol.ts není číselný PROTO_VERSION" >&2
  exit 2
fi

if ! health="$(curl -fsS --max-time 10 "$HEALTH_URL" 2>/dev/null)"; then
  say "[proto] CHYBA: $HEALTH_URL neodpovídá — nedá se ověřit verze serveru." >&2
  exit 2
fi

server_proto="$(printf '%s' "$health" | grep -oE '"proto"[[:space:]]*:[[:space:]]*[0-9]+' \
  | grep -oE '[0-9]+' | head -1)"
if [[ -z "${server_proto:-}" ]]; then
  say "[proto] CHYBA: v odpovědi netu chybí \"proto\": $health" >&2
  exit 2
fi

if [[ "$client_proto" == "$server_proto" ]]; then
  say "[proto] OK — klient i server mluví proto $client_proto"
  exit 0
fi

if (( client_proto > server_proto )); then
  {
    echo "[proto] BLOKOVÁNO — klient je proto $client_proto, server (net) je proto $server_proto."
    echo "         Nasazení appky by rozbilo chat i multiplayer (proto_mismatch)."
    echo "         Nejprve nasaď net:  bash apps/nirvana-net/deploy/deploy-nirvana-net.sh"
    echo "         Pak znovu appku.  (Opakuj: bash $0)"
  } >&2
else
  {
    echo "[proto] POZOR — klient je proto $client_proto, server je proto $server_proto."
    echo "         Server je napřed: klienti na starším protokolu dostanou proto_mismatch,"
    echo "         dokud se appka nenasadí. Nasaď appku: bash apps/nirvana/deploy/deploy-nirvana.sh"
  } >&2
fi
exit 1
