# 📋 WORK REPORT — 8. února 2026

**Datum:** 8. února 2026 (sobota)
**Session:** Ranní sprint (06:30 – 07:10 UTC)
**Focus:** Bug fix, IBD reset, Emission Schedule

---

## ✅ Dokončené úkoly

### 1. 🔴 CRITICAL: Oprava algoritmu — 9 hardcoded "randomx" → "cosmic_harmony"
**Problém:** USA a SG minéři dostávali RandomX joby (9 H/s) místo Cosmic Harmony (300+ kH/s).
Pool měl 9 míst kde defaultoval na `"randomx"` místo `"cosmic_harmony"`.

**Opravené soubory:**
- `zion-native/pool/src/stratum/server_v2.rs` — 9 míst opraveno
- `zion-native/pool/src/main.rs` — 1 místo opraveno (StreamScheduler)

**Commit:** `633580f` — `fix(pool): cosmic_harmony algo - 9 hardcoded randomx defaults fixed`

**Výsledek:** Hashrate na všech serverech skokem z 9 H/s na 300+ kH/s (35,000× zrychlení!)

---

### 2. 🔴 IBD Reset — Řešení blockchain forku
**Problém:** Po opravě algoritmu servery nemohly synchronizovat — každý minoval vlastní fork
s jinými bloky (randomx vs cosmic_harmony hashe).

**P2P banning problém:** Core agresivně banoval peery za "Invalid prev_hash" (900s ban).
Při fork situaci nemohl žádný nod resynchronizovat.

**Řešení:**
1. Zastavit všechny 3 servery
2. Smazat `zion-core-data-2.9.5` volume na všech
3. Spustit Helsinki jako první (seed node) 
4. Počkat na narostlý chain (282 bloků)
5. Spustit USA/SG core BEZ pool/miner — čistý IBD sync
6. Po IBD completion spustit pool a miner

**IBD výsledky:**
- USA: 319 bloků za 1.2s (265 bloků/s) ✅
- SG: 1,026 bloků za 3.8s (269 bloků/s) ✅

---

### 3. 🟡 Difficulty zvýšena na 500,000
**Problém:** S difficulty 1000 a hashrate ~800 kH/s síť produkovala ~15 bloků/10s,
což způsobovalo neustálé forky.

**Řešení:** Použit `dev.set_difficulty` RPC na všech 3 serverech:
```
curl -X POST http://127.0.0.1:8444/jsonrpc -d '{"method":"dev.set_difficulty","params":[500000]}'
```

**Výsledek:** Block rate stabilizován na ~1 blok/minutu, žádné forky.

⚠️ **Poznámka:** Dočasné — po restartu core se vrátí na 1000. Trvalé řešení:
zvýšit `MIN_DIFFICULTY` v `consensus.rs` a rebuildit core.

---

### 4. 🟢 Emission Schedule implementován
**Commit:** `f914d03` — `feat(core): emission schedule - Bitcoin-style halving`

**Model:**
| Era | Bloky | Reward | Trvání |
|-----|-------|--------|--------|
| 1 | 0 – 2,099,999 | 50 ZION | ~4 roky |
| 2 | 2,100,000 – 4,199,999 | 25 ZION | ~4 roky |
| 3 | 4,200,000 – 6,299,999 | 12.5 ZION | ~4 roky |
| 4 | 6,300,000 – 8,399,999 | 6.25 ZION | ~4 roky |
| ... | ... | ... | ... |
| 64+ | 134,400,000+ | 0 ZION | — |

**Konstant:**
- `BASE_BLOCK_REWARD_ATOMIC = 50,000,000` (50 ZION @ 1e6 atomic units)
- `HALVING_INTERVAL = 2,100,000` bloků
- `MAX_HALVINGS = 64`
- **Max mining supply: ~210M ZION**

**Upravené soubory:**
- `core/src/blockchain/reward.rs` — hlavní halving logika + 8 unit testů
- `core/src/blockchain/validation.rs` — `calculate_block_reward()` nyní volá `reward::calculate(height)` + 30% consciousness bonus allowance

**Testy:** 81 core testů OK, pool kompilace OK.

---

## 📊 Aktuální stav sítě

| Server | Height | Hashrate | Difficulty | Fork Errors | Status |
|--------|--------|----------|-----------|-------------|--------|
| **Helsinki** | 1,046 | 27 kH/s | 500,000 | 0 | ✅ Stable |
| **USA** | 1,048 | 38 kH/s | 500,000 | 0 | ✅ Stable |
| **Singapore** | 1,048 | 74 kH/s | 500,000 | 0 | ✅ Stable |

**Block rate:** ~1 blok/minutu
**Synchronizace:** Perfektní — všechny nody sdílejí stejný prev_hash
**Total blocks found:** 3,000+ (od genesis resetu)

---

## 🐛 Identifikované problémy (pro budoucí řešení)

### 1. P2P Chain Reorg chybí
**Popis:** Když se dva nody dostanou na fork, nemůžou se resynchronizovat na delší chain.
P2P security banning (900s) zhoršuje situaci — nody se navzájem banují.

**Dopad:** Vyžaduje manuální IBD reset při forku.

**Řešení:** Implementovat chain reorganization v `blockchain/reorg.rs` — 
přijmout delší chain a unwind kratší fork.

### 2. Atomic unit nesoulad
**Popis:** 3 různé atomic unit systémy v codebase:
- Core: 1e6 (6 decimals)
- Validation: 1e9 ("zatoshis") — OPRAVENO
- Pool consciousness/rewards: 1e12

**Dopad:** Potenciální nesoulad v reward výpočtech mezi core a pool.

**Řešení:** Sjednotit na 1e6 v celém codebase.

### 3. Difficulty není persistentní
**Popis:** `dev.set_difficulty` RPC je dočasné — po restartu core se vrátí na 1000.

**Řešení:** Zvýšit `MIN_DIFFICULTY` v `consensus.rs` na 500,000+ a rebuildit core.

---

## 📝 Další kroky (Plán)

1. ~~PRIO 1: Opravit block submit~~ ✅ DONE
2. ~~PRIO 2: Deploy native pool~~ ✅ DONE
3. ~~PRIO 3: IBD stress test~~ ✅ DONE (proveden jako součást fork resetu)
4. ~~PRIO 4: Emission Schedule~~ ✅ DONE
5. **PRIO 5: Wallet Send** — CLI příkaz pro ZION transakce (UTXO selection + Ed25519)
6. **Chain Reorg** — P2P fork resolution
7. **Persist difficulty** — zvýšit MIN_DIFFICULTY v consensus
8. **Deploy emission schedule** — rebuildit core + pool na všech serverech

---

## 📎 Commity

| Commit | Popis |
|--------|-------|
| `633580f` | fix(pool): cosmic_harmony algo fix |
| `f914d03` | feat(core): emission schedule halving |

---

**Celkový čas:** ~40 minut
**Stav:** Síť stabilní, emission schedule implementován, ready pro deploy ✨
