# Payout runtime checklist (Pool v2.9)

This checklist is meant to answer two questions quickly:

1. Are blocks being *accepted on-chain* (not just detected locally as "BLOCK FOUND")?
2. Is the payout loop *actually sending* transactions and recording them in `payouts_v2`?

## 1) Public API checks (no SSH needed)

These run against the pool Stats API (default `:8080`).

### One-shot summary (recommended)

Use the helper:

```bash
python tools/verify_pool_payout_api.py \
  --pool http://77.42.31.72:8080 \
  --pool http://5.78.138.238:8080 \
  --pool http://5.223.56.122:8080 \
  --miner zion1YOUR_MINER_ADDRESS
```

### Manual curl checks

```bash
curl -s http://HOST:8080/health
curl -s http://HOST:8080/stats
curl -s http://HOST:8080/pool
curl -s http://HOST:8080/blocks
curl -s http://HOST:8080/payouts?limit=20
curl -s http://HOST:8080/miner/zion1YOUR_MINER_ADDRESS
```

Interpretation shortcuts:
- If `/miner/<addr>` shows `balance.pending > 0` but `/payouts` stays empty: payouts are blocked (wallet/balance) or blocks are not actually accepted on-chain.
- If `/stats` says `blocks.found > 0` but pool logs show frequent `Block rejected`, prioritize fixing chain acceptance.

## 2) Container log checks (SSH)

### Pool container (look for these)

```bash
# payout loop alive
docker logs --tail 500 zion-pool-usa | grep -E "Payout manager started|Payouts blocked|Payout sent|Payout confirmed|Payout failed"

# block acceptance vs reject
docker logs --tail 500 zion-pool-usa | grep -E "BLOCK FOUND|Block submitted|Block rejected|BLOCK SUBMISSION FAILED"
```

What “good” looks like:
- `Payout manager started...`
- `Payout sent: ... tx_id=...`
- later: `Payout confirmed: ... block=...`

What “bad” looks like:
- `Payouts blocked: pool wallet not configured`
- `Payouts waiting: no spendable pool balance ...`
- `Block rejected by blockchain ...`

## 3) DB spot-check (inside pool container)

```bash
python - << 'PY'
import sqlite3
con = sqlite3.connect('data/pool.db')
cur = con.cursor()
for t in ['reward_events','miner_balances','payouts_v2']:
    cur.execute(f'SELECT COUNT(*) FROM {t}')
    print(t, cur.fetchone()[0])
cur.execute('SELECT COALESCE(SUM(pending),0), COALESCE(SUM(locked),0), COALESCE(SUM(paid),0) FROM miner_balances')
print('sum(pending,locked,paid)=', cur.fetchone())
PY
```

Interpretation:
- `reward_events > 0` + large `sum(pending)` but `payouts_v2 = 0` strongly suggests “payout loop is blocked” (wallet/balance) rather than missing accrual logic.

## 4) Chain RPC spot-check (if reachable)

From a host that can reach the chain RPC:

```bash
curl -s -X POST http://HOST:18081/json_rpc \
  -H 'content-type: application/json' \
  -d '{"jsonrpc":"2.0","id":1,"method":"getblockcount","params":{}}'

curl -s -X POST http://HOST:18081/json_rpc \
  -H 'content-type: application/json' \
  -d '{"jsonrpc":"2.0","id":1,"method":"getbalance","params":{"address":"zion1POOL_WALLET"}}'
```

If pool wallet balance is `0`, payouts cannot send (by design).
