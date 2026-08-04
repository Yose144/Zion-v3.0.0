# V31 Chaos Test Plan

> Cíl: ověřit odolnost V31 proti real-world poruchám před 30d continuous run.

---

## 1. Network layer

| Test | Nástroj | Očekávaný výsledek |
|------|---------|-------------------|
| P2P reconnect storm | `for i in {1..100}; do nc -z $NODE 8335; done` | PeerManager zvládne rate limit, node necrashne |
| RPC timeout pod zátěží | `ab -n 10000 -c 50 http://$RPC/` | nginx + token bucket rate limit fungují |
| Stratum packet flood | `hping3 --udp -p 8444 --flood` | pool zůstává dostupný, ban score se zvyšuje |
| Pool reconnect storm | skript 50x connect/disconnect | pool rate limit (10/min) aktivní, ne DoS |

## 2. Process resilience

| Test | Postup | Očekávaný výsledek |
|------|--------|-------------------|
| Kill a restart node | `kill -9 <zion-node-pid>` | systemd restart, sync z P2P do 5 min |
| Kill pool | `kill -9 <zion-pool-pid>` | systemd restart, minery se reconnectují |
| Kill multichain | `kill -9 <multichain-pid>` | restart, /health 200, DB konzistentní |
| Log rotation | `systemctl restart rsyslog` | logy se rotují, služby běží |

## 3. Data integrity

| Test | Postup | Očekávaný výsledek |
|------|--------|-------------------|
| SQLite corruption recovery | `sqlite3 multichain.db "PRAGMA integrity_check;"` | ok, WAL přehrává |
| PPLNS state reset | smazat `pplns-state.json`, restart pool | pool začne nové okno, payouty se pozastaví |
| Checkpoint import | `zion-node --import-v3-checkpoint <dir>` | node dosáhne height, chain state konzistentní |
| Chain reorg | vynutit invalid block | node reorgne na valid chain, pool přepne template |

## 4. Resource exhaustion

| Test | Postup | Očekávaný výsledek |
|------|--------|-------------------|
| Disk full | naplnit /tmp | watchdog upozorní, logy se neztratí |
| Memory pressure | limit `systemd` MemoryMax | OOM killer restart službu, DB konzistentní |
| High CPU | spustit CPU burn vedle mineru | miner přepne na GPU, accept rate zůstává |

## 5. Bridge / L2

| Test | Postup | Očekávaný výsledek |
|------|--------|-------------------|
| WARP Base ↔ ZionL1 roundtrip | lock → mint → burn → release | E2E prochází, HTLC expirace neaktivuje |
| RPC node unreachable | odpojit node od multichain | multichain vrací degraded health, necrashne |
| DEX quote overload | 1000x `/v1/swap/quote/multi` | rate limit, cache odpovídá |

## 6. Acceptance criteria

- Žádný test nezpůsobí nevratnou ztrátu dat (DB, PPLNS, revenue journal).
- Node se vždycky zotaví do sync_lag <= 3 bloky do 10 min.
- Pool zůstává dostupný a akceptuje validní share.
- Multichain `/health` se vrátí do 200 do 5 min.
- Po každém testu `sqlite3 .backup` + `PRAGMA integrity_check` OK.

## 7. Test schedule

| Fáze | Délka | Poznámka |
|------|-------|----------|
| Round 1 — network | 1 den | lokální testnet |
| Round 2 — process | 1 den | Edge staging |
| Round 3 — data | 2 dny | Edge staging s reálným chain state |
| Round 4 — resource | 1 den | Edge staging |
| Round 5 — L2 bridge | 2 dny | Base testnet / mainnet s malými částkami |

Po úspěšném chaos testu může začít 30d continuous run.
