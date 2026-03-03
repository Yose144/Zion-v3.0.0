# ZION TerraNova — Unified Roadmap v2.9.7

> **Dokument:** `docs/2.9.7/ROADMAP_2.9.7.md`  
> **Vytvořen:** 2026-03-03  
> **Cíl:** Jediná mapa podle které jedeme — od dnešního dne do `v2.9.7-freeze` tagu a server upgradu.  
> **Stav dnes:** 168h stability PASS ✅ · CHv4 dispatch fixnutý ✅ · Revenue implementováno ✅ · Chain restart + infra oprava ✅ (2026-03-03 večer) · Zbývá: GPU kernel, E2E test, genesis

---

## Kde jsme teď (2026-03-03)

```
✅ HOTOVO                               ⬜ ZBÝVÁ
──────────────────────────────          ──────────────────────────────
168h stability (Helsinki/Usa/Asia)      F-05: GPU OpenCL CHv4 kernel
CHv4 fork height FROZEN (200 000)       F-06: Miner height-aware dispatch
block.rs height-aware dispatch          F-04: CHv4 E2E test (≥ 200k)
pool validator.rs CHv4 dispatch         E-07: 72h canary revenue run (IN PROG)
CHv4 activation policy doc             B-CRIT-03: Genesis ceremony
Phase 1.12 stress test (100 miners)    Server upgrade CHv4 (Helsinki fáze 1+2)
Revenue proxy/scheduler/switcher       CODE_FREEZE sign-off + git tag
CHv3 ASIC hardening + Haraka AES-NI
On-chain time-lock, double-spend fix   ✅ HOTOVO (2026-03-03 večer)
API_ENDPOINTS.md, GENESIS_MESSAGE      ──────────────────────────────
E-06: Produkční wallet adresy          Chain restart (genesis 0742cf6b)
E-08: Multi-algo 50/25/25 aktivace     algorithms_opt.rs sync Usa (1203 ř.)
                                       zion-core:2.9.7-amd64 Usa + Asia
                                       zion-pool:2.9.7 Helsinki (rebuild)
                                       zion-miner:2.9.7-amd64 Usa + Asia
                                       Chain běží ✅ · ~108 ZION payout pending
```

---

## Plán — 5 fází po sobě

### FÁZE 1 — CHv4 dokončení (P0 · cíl: 14. 3. 2026)

**Pořadí:** F-05 → F-06 → F-04 (GPU kernel musí být první, na něm závisí F-06 a E2E test)

| Krok | ID | Úkol | Soubory | Hotový když |
|------|----|------|---------|------------|
| 1 | **F-05** | GPU OpenCL kernel — přidat Phase 5 (NPU Mixing INT8 MLP) | `APP&WEB/desktop-agent/resources/mining/cosmic_harmony_v3_gpu.py` | Kernel se zkompiluje + daný hash odpovídá Rust referenční implementaci |
| 2 | **F-06** | Miner height-aware dispatch — pokud height ≥ 200k → CHv4 path | `L1/miner/src/` + případně `APP&WEB/desktop-agent/resources/mining/cosmic_harmony_native.py` | Miner logguje "CHv4" od výšky 200 000 |
| 3 | **F-04** | CHv4 E2E test — pool + miner, simulovaná výška ≥ 200 000 | `tests/chv4_e2e.rs` (nový) | `cargo test chv4` → share accepted, CHv4 hash ověřen |

**Výsledek fáze 1:** CHv4 je plně funkční — CPU i GPU path, pool akceptuje shares od výšky 200k.

---

### FÁZE 2 — Revenue produkční aktivace (P0 · cíl: 18. 3. 2026)

**Pořadí:** E-06 → E-08 → E-07 (wallet adresy nejdřív, pak scheduler, pak canary run)

| Krok | ID | Úkol | Soubory | Hotový když |
|------|----|------|---------|------------|
| 1 | **E-06** ✅ | Nastavit produkční wallet adresy (BTC/XMR/ZION) + BuyBack limity | `config/ch3_revenue_settings.json` | ✅ `baab947` — BTC wallet potvrzena + `auto_buyback_enabled: true` + risk limity (max 0.05 BTC/day, 2% slippage, 0.005 BTC reserve) |
| 2 | **E-08** ✅ | Multi-algo 50/25/25 scheduler aktivace na Helsinki poolu | `docker/docker-compose.mainnet.yml` | ✅ `11fc008` — `ZION_HAS_GPU=1` + `ZION_SCHEDULER_PERMINER_MIN_MINERS=2` přidáno do mainnet pool service |
| 3 | **E-07** 🔄 | 72h canary revenue run s auditovatelným ledgerem | Helsinki prod | 🔄 **IN PROGRESS** — started `2026-03-03T14:30:09Z`, ends `2026-03-06T14:30:47Z` · Pool: 50/25/25 PerMiner active · xmrig MoneroOcean deployed |

**Výsledek fáze 2:** Revenue systém generuje reálné příjmy, 50/25/25 model ověřen na produkci.

---

### FÁZE 3 — Server upgrade na CHv4 (cíl: 21. 3. 2026)

> Tuto fázi spouštíme až po ✅ FÁZE 1 + ✅ FÁZE 2.  
> Pořadí nasazení: **Helsinki → Usa → Asia** (Helsinki je primární pool, last to fall first to upgrade).

> **⚠️ Poznámka (2026-03-03):** Usa + Asia byly upgradnuty na `zion-core:2.9.7-amd64` + `zion-miner:2.9.7-amd64` v rámci emergency chain restart (oprava algoritmu). Tato fáze se týká finálního upgradu **na CHv4 + Revenue stack** po dokončení Fáze 1+2.

```
Pořadí upgradu:                         Stav 2026-03-03
  1. Helsinki (77.42.31.72)  — pool + miner + revenue stack       🔄 pool:2.9.7 ✅, CHv4 ⬜
  2. Usa      (178.156.240.160) — seed node + miner              ✅ core+miner:2.9.7-amd64
  3. Asia     (5.223.43.93)    — seed node + miner               ✅ core+miner:2.9.7-amd64
```

#### 3a. Helsinki upgrade (CAX21 arm · hlavní pool)

```bash
ssh zion-helsinki

# 1. Stáhnout nový build
docker pull zion-pool:2.9.7-arm64
docker pull zion-core:2.9.7-arm64

# 2. Restart s novým compose (rolling — pool na max 30s downtime)
cd /opt/zion
docker compose -f docker-compose.mainnet.yml up -d --no-build

# 3. Ověřit CHv4 aktivaci
curl -s http://localhost:8080/api/pool/stats | jq '.algorithm_version'
# → "CHv4" nebo "CHv3" (dle aktuální výšky)

# 4. Ověřit revenue streamy
curl -s http://localhost:8080/api/revenue/status | jq '.streams'
# → {"zion": "50%", "revenue": "25%", "ncl": "25%"}

# 5. Sledovat 30 min logy
docker compose logs -f zion-pool | grep -E "(CHv4|share_accepted|revenue)"
```

| Check | Příkaz | Očekávaný výstup |
|-------|--------|-----------------|
| CHv4 dispatch aktivní | `grep CHv4 /var/log/zion-pool.log` | Log entries od height 200k |
| Pool akceptuje shares | `curl /api/pool/stats \| jq .valid_shares` | Rostoucí číslo |
| Revenue streamy | `curl /api/revenue/status` | 3 streamy online |
| P2P mesh intact | `curl /health \| jq .peers` | ≥ 2 peers |

#### 3b. Usa upgrade (CPX11 x86)

```bash
ssh zion-usa
docker pull zion-core:2.9.7-amd64
cd /opt/zion
docker compose -f docker-compose.mainnet.yml up -d --no-build
curl -s http://localhost:8444/jsonrpc -d '{"method":"net_peerCount"}' | jq .result
# → ≥ 2 (Helsinki + Asia)
```

#### 3c. Asia upgrade (CPX12 x86)

```bash
ssh zion-asia
docker pull zion-core:2.9.7-amd64
cd /opt/zion
docker compose -f docker-compose.mainnet.yml up -d --no-build
curl -s http://localhost:8444/jsonrpc -d '{"method":"net_peerCount"}' | jq .result
# → ≥ 2 (Helsinki + Usa)
```

#### Post-upgrade síťový check (všechny 3 nody)

```bash
# P2P mesh ověření
for HOST in 77.42.31.72 178.156.240.160 5.223.43.93; do
  echo "=== $HOST ==="
  curl -s --max-time 5 http://$HOST:8444/jsonrpc \
    -d '{"jsonrpc":"2.0","method":"net_peerCount","id":1}' | jq .result
done
# Každý musí mít ≥ 2 peers

# Stratum check (Helsinki)
echo '{"id":1,"method":"mining.subscribe","params":[]}' | nc 77.42.31.72 3333
# → subscription JSON + set_difficulty
```

**Výsledek fáze 3:** Všechny 3 servery běží na v2.9.7 s CHv4 + Revenue stackem. Síť je v mesh.

---

### FÁZE 4 — Genesis ceremony + freeze artefakty (cíl: 28. 3. 2026)

| Krok | ID | Úkol | Poznámka |
|------|----|------|----------|
| 1 | C-01 | `genesis.json` vytvořit OFFLINE na air-gapped stroji | Viz `docs/2.9.7/GENESIS_CEREMONY.md` |
| 2 | C-02 | Ověřit genesis wallet adresy vs `PREMINE_ADDRESSES_PUBLIC.txt` | sha256 cross-check |
| 3 | D-01 | Docker SHA-256 manifesty publishovat | `docs/2.9.7/DOCKER_MANIFEST.md` |
| 4 | D-02 | `MAINNET_CONSTITUTION.md` — status `FROZEN` + SHA-256 | `docs/mainnet/MAINNET_CONSTITUTION.md` |
| 5 | A-03/A-04 | Alertmanager Telegram tokeny + test incident | `.env` na Helsinki |
| 6 | D-03 | `MAINNET_EXIT_CRITERIA.md` — všechny checkboxy | `docs/mainnet/` |

**Výsledek fáze 4:** Všechny freeze artefakty existují a jsou podepsány.

---

### FÁZE 5 — CODE FREEZE sign-off + git tag (cíl: 31. 3. 2026)

| Krok | Akce |
|------|------|
| 1 | CI zelené: `cargo test -p zion-core` (≥ 501), `cargo test -p zion-pool` (≥ 97), Hardhat 96 |
| 2 | `CODE_FREEZE.md` — všechny checkboxy ✅ + podpisová tabulka vyplněna |
| 3 | `git tag -a v2.9.7-freeze -m "ZION TerraNova v2.9.7 Code Freeze"` |
| 4 | `git push origin v2.9.7-freeze` |
| 5 | L1 přechází do **maintenance-only** — přijímány jen hotfixy (patch verze 2.9.7.x) |

---

## Přehled: Co → Kdy → Jak ověřit

```
FÁZE          DATUM       KLÍČOVÉ DELIVERABLE          OVĚŘENÍ
──────────────────────────────────────────────────────────────────
Fáze 1        14. 3.      CHv4 GPU kernel + E2E test    cargo test chv4 PASS
Fáze 2        18. 3.      Revenue canary 72h ✅          audit ledger + pool stats
Fáze 3        21. 3.      Všechny 3 servery na 2.9.7    P2P mesh + CHv4 log entries
Fáze 4        28. 3.      Genesis + freeze artefakty    sha256 + FROZEN status
Fáze 5        31. 3.      v2.9.7-freeze tag             git tag pushed ✅
──────────────────────────────────────────────────────────────────
MainNet       31. 12. 2026   genesis.json spuštěn       v3.0 launch
```

---

## Zbývající P0 — seřazené podle priority

| # | ID | Oblast | Blocker pro | Status |
|---|-----|--------|-------------|--------|
| 1 | F-05 | GPU OpenCL CHv4 kernel | Fáze 1 → vše ostatní | ✅ `14b861c` |
| 2 | F-06 | Miner height-aware dispatch (CPU+GPU) | Fáze 1 | ✅ `15a61d2` |
| 3 | F-04 | CHv4 E2E test | Fáze 1 sign-off | ✅ `14b861c` |
| 4 | E-06 | Produkční wallet adresy | Fáze 2 | ✅ `baab947` |
| 5 | E-08 | Multi-algo 50/25/25 aktivace Helsinki | Fáze 2 | ✅ `11fc008` |
| 6 | E-07 | 72h canary revenue run | Fáze 2 sign-off | 🔄 IN PROGRESS — started 2026-03-03T14:30Z, ends 2026-03-06T14:30Z |
| 7 | — | Server upgrade CHv4 full stack (Helsinki) | Fáze 3 | 🔄 Usa+Asia: `2.9.7-amd64` ✅ · Helsinki CHv4: ⬜ čeká na Fázi 1+2 |
| 8 | C-01 | genesis.json air-gapped tvorba | Fáze 4 | ⬜ TODO |
| 9 | D-01..D-03 | Docker SHA, FROZEN constitution, exit criteria | Fáze 5 | ⬜ TODO |
| 10 | D-06/D-07 | git tag + CODE_FREEZE sign-off | Release | ⬜ TODO |

**Zbývající P1 (neblokuje freeze, ale doporučeno před mainnetem):**

| ID | Úkol |
|----|------|
| A-03/A-04 | Alertmanager Telegram live test |
| B-01 | On-chain time-lock unit test (`assert unlock_height enforced`) |
| Phase 1.11 | Live partition test (potřeba SSH přístup na servery) |

---

## Závislostní graf

```
F-05 (GPU kernel)
  └─► F-06 (miner dispatch)
        └─► F-04 (CHv4 E2E test)
              └─► FÁZE 1 COMPLETE
                    │
                    ├─► E-06 (wallet adresy)
                    │     └─► E-08 (scheduler aktivace)
                    │           └─► E-07 (72h canary)
                    │                 └─► FÁZE 2 COMPLETE
                    │                       │
                    │                       └─► Fáze 3 (server upgrade)
                    │                             └─► Fáze 4 (genesis)
                    │                                   └─► Fáze 5 (freeze tag)
                    │
                    └─► (paralelně) Fáze 4 přípravy (genesis ceremony doc)
```

---

## Co začínáme hned — F-05 GPU kernel

Soubor ke změně: `APP&WEB/desktop-agent/resources/mining/cosmic_harmony_v3_gpu.py`

Aktuální stav kernelu: 5 fází (MatrixMix → MemoryHard → CosmicFusion → WaveCollapse → MerkleWeave)

Co přidat (Phase 5 = NPU Mixing, vložit **mezi MemoryHard a CosmicFusion**):

```
Phase 0 — MatrixMix
Phase 1 — MemoryHard (scratchpad 512 KiB)
Phase 2 — NPU Mixing (INT8 MLP 64→128→64 + LayerNorm + GELU + residual ADD)  ← NOVÉ
Phase 3 — CosmicFusion (AES/Haraka)
Phase 4 — WaveCollapse
Phase 5 — MerkleWeave
```

Referenční implementace: `L1/cosmic-harmony/src/algorithms_npu.rs`  
Konstanta seedu: `CHV4_MLP_GENESIS_SEED = b"ZION_CHv4_mixing_v1_genesis_seed"`  
Aktivace: pouze pokud `height >= 200_000` (podmínka v hosta, ne v kernelu samotném)

---

## Reference dokumentů

| Dokument | Účel |
|----------|------|
| `docs/2.9.7/2.9.7.md` | Plný seznam P0 blokerů skupin A–F |
| `docs/2.9.7/CODE_FREEZE.md` | Sign-off checklist (musí být ✅ před tagem) |
| `docs/2.9.7/MAINNET_READINESS_UNIFIED.md` | B-CRIT-01/02/03 stav |
| `docs/2.9.7/CHV4_ACTIVATION_POLICY.md` | Fork height politika (FROZEN) |
| `docs/2.9.7/GENESIS_CEREMONY.md` | Air-gapped ceremony runbook |
| `docs/2.9.7/MAINNET_CHV3_CUDA_REVENUE.md` | CUDA + revenue detailní plán |
| `SERVERS.md` | Server IP, SSH klíče, porty |
| `docs/ops/STABILITY_LOG.md` | 168h stability test záznamy |
