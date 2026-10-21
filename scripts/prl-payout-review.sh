#!/usr/bin/env bash
# PRL payout readiness review — run ON the Edge host (or against a tunneled
# view). Prints a self-contained audit of the dry-run pipeline state needed
# before flipping PRL_PAYOUT_DRY_RUN=0. Read-only: GET previews and SELECTs
# only — the POST drain belongs to the sweeper.
#
#   ./scripts/prl-payout-review.sh            # local edge run
#   POOL_API=http://127.0.0.1:8080 ./…        # override endpoints
set -uo pipefail

POOL_API="${POOL_API:-http://127.0.0.1:8080}"
LEDGER_DB="${LEDGER_DB:-/opt/zion/data/warp_multichain.db}"
ADMIN_KEY="${PRL_ADMIN_KEY:-$(grep -E '^PRL_PAYOUT_ADMIN_KEY=' /etc/zion/edge-environment.sh 2>/dev/null | cut -d= -f2- | tr -d '"')}"
PUBLIC_API="${PUBLIC_API:-https://pool.zionterranova.com/public/v1}"

hr() { printf '\n=== %s ===\n' "$1"; }

hr "1) Pool PRL leg + miner state (public API)"
curl -s --max-time 8 "$PUBLIC_API/coins" | python3 -c '
import json,sys
try:
    d=json.load(sys.stdin)
except Exception:
    print("  (public API unreachable)"); sys.exit(0)
for c in d.get("coins",[]):
    if c.get("ticker")=="PRL":
        print(f"  PRL enabled={c.get(\"enabled\")} payout_mode={c.get(\"payout_mode\")}")
        for leg in c.get("legs",[]):
            print(f"    leg={leg.get(\"leg_id\"):14s} enabled={leg.get(\"enabled\")} connected={leg.get(\"connected\")} job_age_ms={leg.get(\"job_age_ms\")}")
' 2>/dev/null || echo "  (parse failed)"
curl -s --max-time 8 "$PUBLIC_API/coins/prl/stats" | python3 -c '
import json,sys
try: d=json.load(sys.stdin)
except Exception: print("  (prl stats unreachable)"); sys.exit(0)
print(f"  miners_online={d.get(\"miners_online\")} active_miners={d.get(\"active_miners\")} accepted_total={d.get(\"accepted_total\")}")
' 2>/dev/null || true

hr "2) Pending pearl payouts in pool queue (GET preview, non-draining)"
if [ -n "$ADMIN_KEY" ]; then
  curl -s --max-time 8 -H "X-Admin-Key: $ADMIN_KEY" "$POOL_API/admin/external-payouts?chain=pearl" \
    | python3 -m json.tool 2>/dev/null || echo "  (admin endpoint unreachable)"
else
  echo "  (no PRL_PAYOUT_ADMIN_KEY — skipped)"
fi

hr "3) Sweeper ledger — ext_payout_records (chain=pearl)"
if [ -r "$LEDGER_DB" ]; then
  sqlite3 "$LEDGER_DB" "SELECT status, count(*), COALESCE(sum(CAST(amount_native AS INTEGER)),0) FROM ext_payout_records WHERE chain='pearl' GROUP BY status" 2>/dev/null \
    | awk -F'|' '{printf "  status=%-10s count=%s total_native_units=%s\n",$1,$2,$3}' \
    || echo "  (ledger query failed — table may not exist yet)"
  echo "  -- last 10 rows --"
  sqlite3 "$LEDGER_DB" "SELECT id,status,address,amount_native,attempts,substr(error,1,50),datetime(created_at,'unixepoch') FROM ext_payout_records WHERE chain='pearl' ORDER BY created_at DESC LIMIT 10" 2>/dev/null \
    | awk -F'|' '{printf "  %s %s addr=%.18s… units=%s att=%s %s %s\n",$1,$2,$3,$4,$5,$7,$6}' \
    || echo "  (none)"
else
  echo "  (ledger $LEDGER_DB not readable — run on edge or set LEDGER_DB)"
fi

hr "4) Sweeper runtime state (zion-v31-multichain journal, last 2h)"
journalctl -u zion-v31-multichain.service --since "2 hours ago" --no-pager 2>/dev/null \
  | grep -iE "prl|pearl|revenue oracle|sweeper" | tail -8 \
  || echo "  (no matching lines — PRL sweeper is configured (PRL_PAYOUT_ENABLED=1 in env) but has nothing to do until pearl payouts land in the pool queue)"

hr "5) Revenue → treasury wiring"
grep -E '^(ZION_POOL_NATIVE_PAYOUT_COINS|ZION_POOL_MIN_PAYOUT_NATIVE|REVENUE_ORACLE|PRL_PAYOUT_ENABLED|PRL_PAYOUT_DRY_RUN|PRL_RPC_|ZION_POOL_PEARL_UPSTREAM_WALLET)' \
  /etc/zion/edge-environment.sh 2>/dev/null | sed -E 's/(KEY|SECRET|PASS|TOKEN)=.*/\1=<redacted>/; s/(rpcuser|rpcpassword|admin_key)=.*/\1=<redacted>/I' \
  | sed 's/^/  /' || echo "  (edge-environment.sh not readable)"

hr "Verdict checklist before PRL_PAYOUT_DRY_RUN=0"
echo "  [ ] ≥1 PRL miner producing shares (miners_online>0 above)"
echo "  [ ] ≥1 dryrun batch in ledger with sane units + treasury balance"
echo "  [ ] Upstream revenue reaches oyster (prl1pzy8…) — see AGENTS 2026-10-20 item (b)"
echo "  [ ] Operator reviewed first dryrun rows manually"
echo "  [ ] LP tunnel stable (pearl-lp-tunnel not crash-looping)"
