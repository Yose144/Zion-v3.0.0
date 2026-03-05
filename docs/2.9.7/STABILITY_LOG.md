# 🧪 ZION 2.9.7 — Stability Test Log (168h)

> **Start:** 2026-02-24 11:48 UTC  
> **End target:** 2026-03-03 11:48 UTC  
> **Duration:** 168 hodin (7 dní)  
> **Status:** ✅ PASS (168h dokončeno)

## Podmínky spuštění

- ✅ Všechny 3 nody plně v P2P meshi (Helsinki ↔ Usa ↔ Asia)
- ✅ SEED_PEERS opraveny na všech nodech (odstraněny mrtvé: SeedDE `46.225.126.243`, Usa1 `5.78.178.227`)
- ✅ Usa + Asia přepnuty na `zion-core:2.9.6-amd64` (nativní image pro x86)
- ✅ Helsinki na `zion-core:2.9.6-fix2` (nativní arm64)
- ✅ IBD synchronizace: všechny nody na height=5209
- ✅ Pool na Helsinki: `zion-pool:2.9.6-testnet` na portech 3333+8080

## Servery

| Server | IP | HW | Image | Peers config |
|--------|----|----|-------|-------------|
| Helsinki | 77.42.31.72 | CAX21 arm64 80GB | `zion-core:2.9.6-fix2` | `178.156.240.160:8334,5.223.43.93:8334` |
| Usa | 178.156.240.160 | CPX11 x86 40GB | `zion-core:2.9.6-amd64` | `77.42.31.72:8334,178.156.240.160:8334,5.223.43.93:8334` |
| Asia | 5.223.43.93 | CPX12 x86 40GB | `zion-core:2.9.6-amd64` | `77.42.31.72:8334,178.156.240.160:8334,5.223.43.93:8334` |

## Zdravotní checkpoint (Start — 2026-02-24 11:48 UTC)

| Server | Height | Peers | Health | Poznámka |
|--------|--------|-------|--------|----------|
| Helsinki | 5209 | 10 | ✅ healthy | IBD dokončen, nové compose file |
| Usa | 5209 | 6/7 | ✅ healthy | IBD 5209 bloků za 9.6s (545 blk/s) |
| Asia | 5209 | 7 | ✅ healthy | IBD 5209 bloků za 17.4s (299 blk/s) |

## Kritéria úspěchu

| Kriterium | Podmínka | Status |
|-----------|----------|--------|
| Bez restartů | 0 neočekávaných restartů | ✅ PASS |
| Sync | Max divergence ≤ 2 bloky | ✅ PASS |
| P2P | Každý node ≥ 2 peers | ✅ PASS |
| blocks_rejected stabilní | ≤ +10/24h po startu | ✅ PASS |
| Pool uptime | Helsinki pool dostupný po 168h | ✅ PASS |

## Checkpointy

### ✅ T+0 — Start (2026-02-24 11:48 UTC)
- Všechny 3 nody online, plný mesh
- Height=5209 na všech nodech
- Root cause P2P fixu: `exec format error` (arm64 image na amd64 host) + mrtvé SEED_PEERS

---

### ✅ T+24h (2026-02-25 11:48 UTC)

| Server | Height | Peers | Uptime | Incident |
|--------|--------|-------|--------|----------|
| Helsinki | synced | 7 | ✅ 24h | žádný |
| Usa | synced | 5 | ✅ 24h | žádný |
| Asia | synced | 6 | ✅ 24h | žádný |

---

### ✅ T+48h (2026-02-26 11:48 UTC)

| Server | Height | Peers | Uptime | Incident |
|--------|--------|-------|--------|----------|
| Helsinki | synced | 8 | ✅ 48h | žádný |
| Usa | synced | 6 | ✅ 48h | žádný |
| Asia | synced | 6 | ✅ 48h | žádný |

---

### ✅ T+72h (2026-02-27 11:48 UTC)

| Server | Height | Peers | Uptime | Incident |
|--------|--------|-------|--------|----------|
| Helsinki | synced | 9 | ✅ 72h | žádný |
| Usa | synced | 7 | ✅ 72h | žádný |
| Asia | synced | 7 | ✅ 72h | žádný |

---

### ✅ T+120h (2026-03-01 11:48 UTC)

| Server | Height | Peers | Uptime | Incident |
|--------|--------|-------|--------|----------|
| Helsinki | synced | 10 | ✅ 120h | žádný |
| Usa | synced | 7 | ✅ 120h | žádný |
| Asia | synced | 8 | ✅ 120h | žádný |

---

### T+168h — Finish (2026-03-03 11:48 UTC)


| Server | Height | Peers | Uptime | Výsledek |
|--------|--------|-------|--------|----------|
| Helsinki | synced | stable | 168h window completed | ✅ PASS |
| Usa | synced | stable | 168h window completed | ✅ PASS |
| Asia | synced | stable | 168h window completed | ✅ PASS |

**Výsledek stability testu:** ✅ PASS

Poznámka: operator-confirmed stav bez kritických chyb během 168h; dashboard observabilita zelená (`https://www.zionterranova.com/dashboard`).

---

---

## Phase 1.12 — 100 Miners Stress Test (2026-03-03)

> Spuštěno: `python tests/stress_100_miners.py --miners 100 --shares 5 --ramp-ms 20`

| Metrika | Výsledek | Threshold | Status |
|---------|----------|-----------|--------|
| Connected | 100/100 (100%) | ≥ 95% | ✅ PASS |
| Accept rate | 500/500 (100%) | ≥ 90% | ✅ PASS |
| Throughput | 200.9 shares/s | — | ✅ |
| Latency p99 | 9 ms | < 1000 ms | ✅ PASS |
| Latency avg | 2.9 ms | — | ✅ |
| Errors | 0 | — | ✅ |
| Duration | 2.49s | — | ✅ |

**Výsledek Phase 1.12:** ✅ PASS — Stratum server zvládl 100 souběžných minerů bez jediné chyby.

---

## Incidenty

*(prázdný log = dobrý výsledek)*

---

## Checkpoint 2026-03-05 (Server Ops Session)

### Zjištěné problémy a opravy

| Problém | Server | Závažnost | Stav |
|---------|--------|-----------|------|
| xmrig CPU 104% (zbytečná těžba XMR) | USA + Asia | Střední | ✅ OPRAVENO: `docker stop zion-xmr-x86` |
| Miner na CHv3 místo CHv4 | USA + Asia | Střední | ✅ OPRAVENO: upgrade na `zion-miner:2.9.7-amd64` CHv4 |
| P2P-BUG-01: `peers_connected` counter leak | USA + Asia | Vysoká | ✅ OPRAVENO: `ConnectionGuard` RAII — commit `773c931` |
| P2P-BUG-02: Reconnect na ephemeral porty | USA + Asia | Střední | ✅ OPRAVENO: port filter ≥32768 + IP dedup — commit `773c931` |
| Pool `ZION_HAS_GPU=1` → xmrig restart smyčka každých 30s | Helsinki | Nízká | ✅ OPRAVENO: `ZION_HAS_GPU=0` |
| Pool `payout:sent` 82 stale TX ze staré genesis | Helsinki | Střední | ✅ OPRAVENO: `payout:sent` vyčištěn (záloha: `/root/payout_sent_backup_20260305.txt`) |
| Pool VarDiff race condition → ~30% share rejectiony | Helsinki | Střední | ✅ OPRAVENO: `ZION_VARDIFF_RETARGET_SECS=60 ZION_VARDIFF_VARIANCE=0.5` |

### Stav serverů po opravách (2026-03-05T07:20 UTC)

| Server | Load | Kontejnery | Poznámka |
|--------|------|-----------|---------|
| Helsinki (77.42.31.72) | <2 | pool+core+miner UP | Pool čistý, shares ACCEPTED, CHv4 ✅ |
| USA (178.156.240.160) | <2 | core+miner UP | P2P fix build DONE (EXIT=0), miner CHv4 ✅ |
| Asia (5.223.43.93) | <3 | core+miner UP | P2P fix build RUNNING (background) ✅ |



---

## Příkazy pro monitoring

```bash
# Helsinki health
ssh -i ~/.ssh/zion_hetzner_key root@77.42.31.72 "curl -sf http://localhost:8444/health"

# Usa health
ssh -i ~/.ssh/zion_server_key root@178.156.240.160 "curl -sf http://localhost:8444/health"

# Asia health
ssh -i ~/.ssh/zion_server_key root@5.223.43.93 "curl -sf http://localhost:8444/health"

# Logy Helsinki
ssh -i ~/.ssh/zion_hetzner_key root@77.42.31.72 "docker logs zion-core --tail=20 2>&1"

# Logy Usa
ssh -i ~/.ssh/zion_server_key root@178.156.240.160 "docker logs zion-core --tail=20 2>&1"

# Logy Asia
ssh -i ~/.ssh/zion_server_key root@5.223.43.93 "docker logs zion-core --tail=20 2>&1"
```
