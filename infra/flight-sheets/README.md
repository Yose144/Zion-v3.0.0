# Flight sheets — external formats (A5.1) + fleet catalog seeds

Templates so external miners (HiveOS, SimpleMiningOS) can run against
`pool.zionterranova.com`, plus seed presets for our own fleet control
plane (`vastctl` agent desired-state).

## Files

| File | Target | Contents |
|---|---|---|
| `zion-miner.hiveos.json` | HiveOS flight sheet (custom miner) | ZION native miner, v3 trinity, QTU/PRL streams 50/50 |
| `srbminer-dual.hiveos.json` | HiveOS flight sheet (custom miner) | SRBMiner-MULTI — QTU (quantus) + PRL (pearlhash) rows |
| `zion-miner.smos.json` | SimpleMiningOS custom miner | program def + env + hashrate regex |
| `catalog-seed.json` | our fleet CP (`/api/agent/catalog`) | named sheet presets: `zion-dual-5050`, `zion-solo`, `srb-dual-5050`, `xmr-cpu`, `stop-all` |
| `seed-catalog.sh` | our fleet CP | posts all seed entries (needs `VASTCTL_OPS_TOKEN`) |

## HiveOS import

1. Host a miner tarball reachable by rigs (`custom_install_url` — the
   `zionterranova.com/fleet/packages/…` URLs are placeholders until the
   packages endpoint exists; point at a mirror or our release bundle).
2. HiveOS web → **Flight Sheets → Add Flight Sheet** → miner = **custom**
   → paste the `miner_config` block from the matching template.
3. `%WAL%` / `%WORKER_NAME%` are HiveOS placeholders — set the wallet in
   the flight-sheet wallet field, worker name comes from the rig.

## SMOS import

Dashboard → Miner → **Add custom miner**: program path + package URL +
args/env from `zion-miner.smos.json`. SMOS substitutes `%WALLET%`/
`%WORKER%` per rig group.

## Fleet CP seeds (our own sheet system)

```bash
VASTCTL_OPS_TOKEN=… bash seed-catalog.sh            # local CP :8088
# assign preset to a rig group (ops token):
curl -X POST http://127.0.0.1:8088/api/agent/sheet \
  -H "Authorization: Bearer $VASTCTL_OPS_TOKEN" \
  -d '{"group":"gpu-fleet","catalog":"zion-dual-5050"}'
```

The CP sheet format is `{miner, coin?, pool?, wallet?, args?, duty?,
oc?}` — same schema the apply hook consumes; `catalog` assignment
resolves the named preset at set-time.

## Notes

- SOLO port: `zion-solo` preset targets `:8446` (winner-take-all,
  A3.3). PPLNS stays on `:8444`.
- `stop-all` preset = `{miner: "none"}` → apply hook kills all known
  miner sessions — safe fleet-wide stop via bulk ops.
