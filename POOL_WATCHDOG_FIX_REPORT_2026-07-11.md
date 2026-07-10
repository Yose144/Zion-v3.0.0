# Pool Watchdog Restart Loop — Fix Report (2026-07-11)

## Souhrn

Pool server na Edge serveru (`62.171.141.136`) byl **restartován každé 2 minuty** watchdog timerem, což způsobovalo přerušení všech miner sessions, ztrátu in-memory share dat a reconnect storm. Root cause byl bug v watchdog skriptu.

## Root cause

Watchdog skript `/usr/local/bin/zion-watchdog.sh` měl **dva bugy**:

### Bug 1: TCP check — špatný separátor v `/dev/tcp/`

```bash
# BUG: bash /dev/tcp používá '/' ne ':' jako separátor
if ! timeout 3 bash -c "echo > /dev/tcp/127.0.0.1:8444" 2>/dev/null; then
    # Tento branch se spouštěl VŽDY (TCP check vždy selhal)
    systemctl restart zion-pool
fi
```

Bash builtin `/dev/tcp/` vyžaduje formát `/dev/tcp/HOST/PORT` (lomítko), ne `/dev/tcp/HOST:PORT` (dvojtečka). Zápis `127.0.0.1:8444` bash interpretuje jako hostname `127.0.0.1:8444`, které neexistuje → TCP check **vždy selže** → pool se restartuje každý watchdog cycle (2 minuty).

### Bug 2: Neexistující JSON-RPC metoda

```bash
# BUG: "getHeight" neexistuje na L1 node
HEIGHT=$(curl ... -d '{"method":"getHeight",...}' | jq -r '.result.height // empty')
# HEIGHT vždy prázdné → height check nikdy nenahlásí stuck node
```

Správná metoda je `getChainInfo`, která vrací `result.chain_height`.

## Dopad

- Pool restartován **~30x za hodinu** (každé 2 minuty)
- Při každém restartu: všechny aktivní miner sessions přerušeny
- PPLNS state ztracen v paměti (obnoven z disk snapshotu, ale s 10s intervalem → až 10s ztráta)
- Reconnect storm po každém restartu (18+ minerů se najednou připojuje)
- Falešné alerty v watchdog logu: `"Pool TCP down, restarting zion-pool"`
- Pool přesto fungoval (minoval bloky), ale s výpadky každé 2 minuty

## Oprava

### Na serveru (`/usr/local/bin/zion-watchdog.sh`)

```bash
# TCP check: nc -z (netcat, robustní)
if ! nc -z -w3 "$POOL_HOST" "$POOL_PORT" 2>/dev/null; then
    logger -t zion-watchdog "Pool TCP down, restarting zion-pool"
    systemctl restart zion-pool
fi

# Height check: getChainInfo → chain_height
HEIGHT=$(curl -s --max-time 5 "$NODE_RPC/jsonrpc" \
    -d '{"jsonrpc":"2.0","method":"getChainInfo","params":[],"id":1}' \
    | jq -r '.result.chain_height // empty' 2>/dev/null)
```

### V repu (`edge-deploy/watchdog.sh`)

- Přidány `NODE_SERVICE`/`POOL_SERVICE` proměnné (podpora old/new edge deploy)
- Přidán height check se správnou `getChainInfo` metodou
- Service names parametrizovány místo hardcodovaných `zion-edge-node1`/`zion-edge-pool`
- Uložena kopie i v `V3/deploy/new-server/zion-watchdog.sh` (gitignored, pro referenci)

## Verifikace

| Čas | Watchdog běh | Pool restart? | Pool uptime |
|-----|-------------|---------------|-------------|
| 00:30 | `Pool TCP down, restarting` | ✅ ano (bug) | reset |
| 00:34 | `Pool TCP down, restarting` | ✅ ano (bug) | reset |
| 00:36 | `Pool TCP down, restarting` | ✅ ano (bug) | reset |
| 00:38 | `Pool TCP down, restarting` | ✅ ano (bug) | reset |
| 00:42 | `Pool TCP down, restarting` | ✅ ano (bug, poslední) | reset |
| **00:48** | **success (no output)** | **❌ ne** | **5+ min** |
| **00:50** | **success (no output)** | **❌ ne** | **7+ min** |

- Pool status: `active`, uptime rostoucí
- Miners: 18+ aktivních, shares accepted
- Blocks found po opravě: height 2046, 2052 (pool minuje normálně)

## Commity

- `7da0219fb` — `fix(watchdog): fix pool restart loop caused by /dev/tcp separator bug`

## Následující krok

Pool je nyní stabilní. Další fáze: **performance improvements pro 1000+ minerů** — viz `POOL_PERFORMANCE_PLAN_2026-07-11.md`.
