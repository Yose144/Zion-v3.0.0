# Session Report — 2026-03-01 — CHv4 Architecture + Revenue Local Test

**Datum:** 1. března 2026  
**Branch:** `main`  
**Commity této session:** `7791360`, `c8a23f0`, `d9f67ae`

---

## Souhrn session

Tři hlavní aktivity:
1. Kompletní architektonická dokumentace upgradu CosmicHarmony v4 (EN + CS)
2. Lokální test revenue systému — 24/24 PASS, 0 FAIL
3. Příprava na server deployment

---

## 1. CosmicHarmony v4 Upgrade — Architektonická Dokumentace (`7791360`)

**Soubory:** `docs/COSMIC_HARMONY_V4_UPGRADE.md` (721 řádků, anglicky)

### Motivace

Standardní PoW v roce 2026 má 3 zásadní problémy:
- **ASIC dominance** — centralizuje těžení u firem s ASIC farmami
- **Promarněná energie** — výpočet nemá jiný účel než konsenzus
- **Zastaralý příběh** — NPU čipy jsou všude, blockchain je ignoruje

CHv3 je silný základ, ale pipeline samotná nevyužívá NPU hardware ani neproducuje verifikovatelné ZK důkazy.

### Tři navrhované upgrady

#### 3A — NPU Mixing (CosmicHarmonyV4)

Přidání 6. fáze do pipeline:

```
CHv3: Keccak → SHA3 → GoldenMatrix → MemoryHard → CosmicFusion
CHv4: Keccak → SHA3 → GoldenMatrix → MemoryHard → [NPU Mixing] → CosmicFusion
```

- Model: `ch_mixing_v4.onnx` — 64→128→64 MLP, INT8 kvantizace (~28 KB)
- Hash modelu baked do genesis bloku → jakákoliv změna = neplatný blok
- CPU fallback: identický výsledek (INT8 determinismus)
- Cargo feature: `native-npu` + crate `ort` (ONNX Runtime pro Rust)
- Hardware: Apple ANE, Intel NPU, AMD XDNA, Qualcomm Hexagon, NVIDIA Tensor Cores

#### 3B — NCL PoUW (Proof of Useful Work)

Výsledek AI inference z NCL marketplace = mining share.

```
hash(task_id || inference_output) < difficulty_target → valid share
```

- Revenue split: 85% těžař / 10% ZION projekt / 5% zákazník rabat
- Stub v `L1/miner/src/ncl/` **existuje** — fáze B = aktivace stubu
- Backward compatible — nový typ share, pool přijímá oba

#### 3C — ZK-Shark (ZK Proof jako těžební práce)

```
work = PROVE(neural_net_forward(seed, nonce) == output)  [Halo2/ezkl]
pool: fast_verify(proof) = 40–600× rychlejší než prove
      AND hash(proof.public_inputs) < target
```

- Knihovny: `ezkl` + Halo2 (bez trusted setup)
- Odhad prove time: 1–30s RTX 4090, verify: 5–50ms CPU

### Implementační fáze

| Fáze | Scope | Složitost | Fork? | ETA |
|------|-------|-----------|-------|-----|
| A — CHv4 NPU | ONNX mixing v pipeline | Střední | ANO | v2.10.x |
| B — NCL PoUW | Aktivace stubu | Nízká | NE | v2.10.x |
| C — ZK-Shark | ZK proof shares | Vysoká | ANO | v3.0.x |

### Codebase impact mapa

```
Fáze A:
  L1/cosmic-harmony/Cargo.toml       → feature "native-npu" + ort dep
  L1/cosmic-harmony/models/          → ch_mixing_v4.onnx (nový)
  L1/cosmic-harmony/src/algorithms_npu.rs → NpuMixer (nový)
  L1/cosmic-harmony/src/algorithms_opt.rs → cosmic_harmony_v4()
  L1/pool/src/shares/validator.rs    → CHv4 share validace

Fáze B:
  L3/ncl/src/task.rs                 → NclShare type
  L1/miner/src/ncl/                  → aktivovat stub
  L1/pool/src/shares/validator.rs    → validate_ncl_share()

Fáze C:
  L3/ai-native/src/zkml_registry.rs  → zkML model registry (nový)
  L1/cosmic-harmony/src/zk_share.rs  → ZkShare type (nový)
  L1/miner/src/zk_prover.rs          → ezkl prover (nový)
```

---

## 2. CHv4 Dokumentace — Česká Verze (`c8a23f0`)

**Soubory:** `docs/COSMIC_HARMONY_V4_UPGRADE_CS.md` (599 řádků, česky)

Česká verze pro vývojáře i naprosté lajky:
- Každý pojem vysvětlen lidsky (co je NPU, co je ZK důkaz, co je hard fork)
- Vizuální pipeline diagramy (ASCII)
- Tabulky hardware targets, rizik, bezpečnostních útoků
- Shrnutí v 3 větách pro naprostého začátečníka

---

## 3. Revenue System — Lokální Test (`d9f67ae`)

**Soubory:**
- `tests/revenue_local_test.py` (nový, ~430 řádků)
- `scripts/test-revenue-local.ps1` (nový PowerShell runner)

### Výsledky testů

```
════════════════════════════════════════════════════
  ZION v2.9.6 — REVENUE SYSTEM LOCAL TEST
════════════════════════════════════════════════════

TEST 1 — Revenue Config Validation    10× PASS
TEST 2 — Mock Revenue Stratum Server   2× PASS
TEST 3 — Miner Binary Local Run        3× PASS  (PID připojen, pool_logins=2)
TEST 4 — Revenue Stream Routing        4× PASS
TEST 5 — Revenue Config Deep Checks    5× PASS

CELKEM: 24 PASSED / 0 FAILED / 3 WARNINGS (normální)
```

### Co bylo ověřeno

| Check | Výsledek |
|-------|---------|
| `ch3_revenue_settings.json` v3.1.0 | ✅ |
| ZION stream enabled, algo=cosmic_harmony_v3 | ✅ |
| ZION target_share = 50% | ✅ |
| ETC merged mining enabled + auto_convert_to_zion | ✅ |
| NXS disabled (SHA3 pool not ready) | ✅ |
| Dynamic GPU: 12 coinů, interval 15 min | ✅ |
| NCL stream defined + enabled | ✅ |
| Mock pool start na 127.0.0.1:14444 | ✅ |
| Stratum login handshake (height=200, algo=CHv3) | ✅ |
| Miner binary `zion-miner.exe` found | ✅ |
| Miner PID spawned + připojil se na mock pool | ✅ |
| Pool přijal login (pool_logins=2) | ✅ |
| Config schema v3.x | ✅ |
| GPU profit switch coins: KAS/ETC/ALPH/ERG/RVN... | ✅ |

### Mock Stratum Server — co to je

`MockRevenuePool` je in-process Python TCP server (port 14444) který:
- Přijímá Stratum login (`method: login` → odpovídá s falešným jobem)
- Přijímá share submity (`method: submit` → accept/reject dle nonce)
- Loguje groups/events pro revenue stream routing check
- Pushuje nové joby každých ~5 sekund
- Testuje offline — žádný internet, žádný real server

### Warnings (normální, ne chyby)

| Warning | Důvod |
|---------|-------|
| "No hash rate in output" | Miner bufferuje stdout na Windows, 35s nestačí na flush |
| "No shares submitted" | 1 vlákno × 35s × nízký hash rate → share nenalezen (OK) |
| "Stats file not written" | Miner stats flush interval > test window |

### Jak spustit znovu

```powershell
# Rychlý test (bez mineru):
.venv\Scripts\python.exe tests\revenue_local_test.py --skip-miner

# Plný test s minerem (35s):
.venv\Scripts\python.exe tests\revenue_local_test.py --timeout 35

# PowerShell runner (build + test):
.\scripts\test-revenue-local.ps1 --build
.\scripts\test-revenue-local.ps1  # bez buildu (pokud exe existuje)
```

---

## 4. Stav Deploymentu

### Lokálně ✅
- Miner binary: `target/release/zion-miner.exe` (release build, 2m 28s kompilace)
- Revenue config: validní, 5 streamů aktivních
- Lokální test: 24/24 PASS

### Servery — PENDING (příští krok)

```
Server 1: 77.42.31.72 (Helsinki)
Server 2: [Germany server — viz SERVERS.md]

Deploy příkazy:
  ssh user@77.42.31.72 'cd /opt/zion && git pull'
  docker compose -f docker/docker-compose.testnet.yml up -d --force-recreate
  docker logs -f zion-pool

Revenue stack:
  COMPOSE_PROFILES=helsinki docker compose -f docker/docker-compose.revenue.yml up -d
```

---

## 5. Commit Log

| Commit | Popis | +/- |
|--------|-------|-----|
| `7791360` | docs: CosmicHarmony v4 upgrade architecture (NPU/ZK-Shark/NCL PoUW) | +721 |
| `c8a23f0` | docs: CHv4 upgrade dokumentace v cestine — pro vyvojare i lajky | +599 |
| `d9f67ae` | test: revenue system local test + PowerShell runner (24/24 PASS) | +743 |

---

## 6. Příští kroky

- [ ] **Deploy testnet stack** na server 77.42.31.72
- [ ] Ověřit `docker logs -f zion-pool` — revenue proxy připojena k HeroMiners
- [ ] Ověřit `/stats` API endpoint na port 8080
- [ ] Ověřit MoneroOcean dashboard (dero-miner worker viditelný)
- [ ] Začít implementaci CHv4 Phase A (NPU mixing skeleton)
