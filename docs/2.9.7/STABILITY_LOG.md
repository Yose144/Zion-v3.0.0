# 🧪 ZION 2.9.7 — Stability Test Log (168h)

> **Start:** 2026-02-24 11:48 UTC  
> **End target:** 2026-03-03 11:48 UTC  
> **Duration:** 168 hodin (7 dní)  
> **Status:** 🟡 IN PROGRESS

## Podmínky spuštění

- ✅ Všechny 3 nody plně v P2P meshi (Helsinki ↔ Usa ↔ Asia)
- ✅ SEED_PEERS opraveny na všech nodech (odstraněny mrtvé: SeedDE `46.225.126.243`, Usa1 `5.78.178.227`)
- ✅ Usa + Asia přepnuty na `zion-core:2.9.6-amd64` (nativní image pro x86)
- ✅ Helsinki na `zion-core:2.9.6-fix2` (nativní arm64)
- ✅ IBD syncronizace: všechny nody na height=5209
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
| Bez restartů | 0 neočekávaných restartů | 🟡 Probíhá |
| Sync | Max divergence ≤ 2 bloky | 🟡 Probíhá |
| P2P | Každý node ≥ 2 peers | 🟡 Probíhá |
| blocks_rejected stabilní | ≤ +10/24h po startu | 🟡 Probíhá |
| Pool uptime | Helsinki pool dostupný po 168h | 🟡 Probíhá |

## Checkpointy

### ✅ T+0 — Start (2026-02-24 11:48 UTC)
- Všechny 3 nody online, plný mesh
- Height=5209 na všech nodech
- Root cause P2P fixu: `exec format error` (arm64 image na amd64 host) + mrtvé SEED_PEERS

---

### T+24h (2026-02-25 11:48 UTC)
*Naplnit při kontrole*

| Server | Height | Peers | Uptime | Incident |
|--------|--------|-------|--------|----------|
| Helsinki | — | — | — | — |
| Usa | — | — | — | — |
| Asia | — | — | — | — |

---

### T+48h (2026-02-26 11:48 UTC)
*Naplnit při kontrole*

| Server | Height | Peers | Uptime | Incident |
|--------|--------|-------|--------|----------|
| Helsinki | — | — | — | — |
| Usa | — | — | — | — |
| Asia | — | — | — | — |

---

### T+72h (2026-02-27 11:48 UTC)
*Naplnit při kontrole*

| Server | Height | Peers | Uptime | Incident |
|--------|--------|-------|--------|----------|
| Helsinki | — | — | — | — |
| Usa | — | — | — | — |
| Asia | — | — | — | — |

---

### T+120h (2026-03-01 11:48 UTC)
*Naplnit při kontrole*

| Server | Height | Peers | Uptime | Incident |
|--------|--------|-------|--------|----------|
| Helsinki | — | — | — | — |
| Usa | — | — | — | — |
| Asia | — | — | — | — |

---

### T+168h — Finish (2026-03-03 11:48 UTC)
*Naplnit při dokončení*

| Server | Height | Peers | Uptime | Výsledek |
|--------|--------|-------|--------|----------|
| Helsinki | — | — | — | — |
| Usa | — | — | — | — |
| Asia | — | — | — | — |

**Výsledek stability testu:** ⬜ PASS / ⬜ FAIL

---

## Incidenty

*(prázdný log = dobrý výsledek)*

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
