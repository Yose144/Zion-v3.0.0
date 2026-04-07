# Report: PPLNS Multi-Miner Fairness Test

**Datum:** 7. dubna 2026  
**Síť:** Mainnet (Prague node `91.98.122.165`)  
**Chain height:** 490 (po testu)  
**Commit:** `5b4cb7ae` — pool: per-session nonce partitioning  

---

## 1. Cíl testu

Ověřit, že PPLNS (Pay Per Last N Shares) pool správně a spravedlivě rozděluje
odměny mezi více současně těžících minerů — proporcionálně podle počtu odevzdaných
shares.

---

## 2. Testovací sestava

| Miner | Worker | Umístění | Vlákna | Wallet | ~H/s |
|-------|--------|----------|--------|--------|------|
| **pplns-test-a** | Docker Prague | CPU × 1 | 1 | `zion1w4l8q0r8c3e6u0c7v3a5d4j68483t7a664jz5p7` | ~162 |
| **pplns-test-b** | Docker Prague | CPU × 2 | 2 | `zion1r2m47443m8u8q4t3t2a7u7j4y4y664f7x6d0070` | ~440 |
| **pplns-test-c** | Docker Prague | CPU × 1 | 1 | `zion1w0s253m3685475z2u5h3k5c6h4h607x526e00k4` | ~162 |
| **vast-cpu-1** | VAST.ai (Jižní Korea) | CPU × 4 | 4 | `zion1z74527r8e8e5a0y4u262m7f802c0q3w3g5jm2e2` | ~271 |
| **vast-cpu-2** | VAST.ai (Jižní Korea) | CPU × 8 | 8 | `zion1r2m47443m8u8q4t3t2a7u7j4y4y664f7x6d0070` | ~658 |

**Celkový pool hashrate:** ~1 250 H/s  
**VAST.ai kredit:** $4.15, spotřeba ~$0.10 (~$0.05/hr × 2 instance × ~1 hodina)

### Poznámka k GPU

Obě VAST.ai instance měly GPU (GTX 1080 Ti, GTX 1080), ale `nvidia-smi` hlásil
"Driver/library version mismatch" — CUDA 12.4 Docker image vs. host driver 570.x.
Zion-miner se na obou instancích zkompiloval s `gpu-opencl` úspěšně, ale GPU
nebyly dostupné (`/dev/nvidia*` neexistovaly). Použili jsme CPU-only fallback.

---

## 3. Kritický bug: Nonce Overlap

### Problém

Všechny mining session dostávaly **identické nonce rozsahy**:
```
session 1: start_nonce + iteration * stride  → 0..100 000
session 2: start_nonce + iteration * stride  → 0..100 000  (stejné!)
session 3: start_nonce + iteration * stride  → 0..100 000  (stejné!)
```

Výsledek: mineři dělali duplicitní práci, jen nejrychlejší miner kdy našel řešení.
Pool měl 5 sessions ale share produkoval jen jeden.

### Oprava

Přidán `session_id_counter: Arc<AtomicU64>` do `V3/L1/pool/src/bin/server.rs`.
Každá session dostane unikátní offset:

```rust
let session_id = session_id_counter.fetch_add(1, Ordering::Relaxed);
let session_nonce_offset = session_id.wrapping_mul(1_000_000_000);
let start_nonce = config.start_nonce
    .wrapping_add(session_nonce_offset)
    .wrapping_add((iteration as u64).wrapping_mul(config.nonce_stride));
```

Session nonce rozsahy po opravě:
```
session 0: 0..100 000
session 1: 1 000 000 000..1 000 100 000
session 2: 2 000 000 000..2 000 100 000
...
```

**Soubor:** `V3/L1/pool/src/bin/server.rs` (+11 řádků, -1 řádek)  
**Commit:** `5b4cb7ae`

---

## 4. Výsledky PPLNS testu

### 4.1 Blokové výplaty

| Blok | Shares v PPLNS okně | Miner A (1s) | Miner B (variabilně) | Miner D (1s) | Miner C (0s) |
|------|---------------------|-------------|----------------------|-------------|-------------|
| **487** | 1 celkem (A:1) | **100 %** = 4 806,06 ZION | — | — | — |
| **488** | 2 celkem (A:1, B:1) | **50 %** = 2 403,03 ZION | **50 %** = 2 403,03 ZION | — | — |
| **489** | 3 celkem (A:1, B:1, D:1) | **33,3 %** = 1 602,02 ZION | **33,3 %** = 1 602,02 ZION | **33,3 %** = 1 602,02 ZION | — |
| **490** | 4 celkem (A:1, B:2, D:1) | **25 %** = 1 201,51 ZION | **50 %** = 2 403,03 ZION | **25 %** = 1 201,51 ZION | **0 %** |

### 4.2 Klíčová zjištění

1. **Proporcionální férovost ✅** — Blok 490: Miner B měl 2 shares vs. 1 u ostatních
   → dostal přesně 2× více (2 403 029 815 000 000 vs. 1 201 514 907 500 000 flowers).
2. **Nulové shares = nulová výplata ✅** — Miner C s 0 shares nedostal nic v žádném bloku.
3. **Integrita zaokrouhlení ✅** — Třícestný split (blok 489) měl zbytek +2 flowers
   přiřazený jednomu minerovi. Žádné flowers ztraceny.
4. **Dávkové výplaty ✅** — Multi-miner payouty ve stejném bloku sdílejí jedno `tx_id`
   (batch transakce).
5. **Stale shares ✅** — 2 `InvalidJob` reject z VAST.ai (latence Jižní Korea → Praha).
   Správně zamítnuty, nepočítány do PPLNS okna.

### 4.3 Celkové statistiky poolu (po testu)

| Metrika | Hodnota |
|---------|---------|
| Bloky nalezeny (od restartu) | 4 |
| Registrovaní mineři | 5 |
| Validní shares | 4 |
| Nevalidní shares | 2 (InvalidJob — stale) |
| PPLNS payout kol | 4 |
| Celkem vyplaceno | 19 224 238 520 000 000 flowers (~19 224 ZION) |
| Accept rate | 66,7 % |

---

## 5. Zjištěné problémy a plán oprav

### 5.1 KRITICKÉ — Již opraveno

| # | Problém | Stav | Commit |
|---|---------|------|--------|
| 1 | **Nonce overlap** — všechny session totožné nonce | ✅ Opraveno | `5b4cb7ae` |

### 5.2 VYSOKÁ PRIORITA — Fee split nekonfigurován

Pool aktuálně vyplácí **100 % minerům** (všechny fee env proměnné = 0 %).
Podle konstituce (`MAINNET_CONSTITUTION.md`) by mělo být:

| Účel | Očekávaný % | Aktuální % | Env proměnná |
|------|-------------|------------|--------------|
| Miner | 89 % | 100 % | — |
| Humanitarian tithe | 5 % | 0 % | `ZION_HUMANITARIAN_TITHE_PCT` |
| Issobella fund | 5 % | 0 % | `ZION_ISSOBELLA_FUND_PCT` |
| Pool fee | 1 % | 0 % | `ZION_POOL_FEE_PCT` |

**Akce:**
- [ ] Vygenerovat dedikované wallet adresy pro humanitarian, issobella a pool fee
- [ ] Nastavit env proměnné v Docker compose / `.env`
- [ ] Ověřit, že pool správně rozděluje odměny s nenulovou fee konfigurací

### 5.3 STŘEDNÍ PRIORITA — Provozní vylepšení

| # | Problém | Popis | Akce |
|---|---------|-------|------|
| 3 | **RPC SSL nestabilní** | `SSL_ERROR_SYSCALL` při dotazech na `https://127.0.0.1:8443` pod zátěží | Prozkoumat TLS buffer / connection limit v zion-core |
| 4 | **VAST.ai GPU driver mismatch** | CUDA 12.4 image vs. host driver 570.x | Použít image s odpovídající CUDA verzí, nebo starší driver |
| 5 | **Nonce prostor limit** | Při >4 miliardách session (u64 × 1B) dojde k přetečení | Pro produkci zvážit dynamické přidělování nonce rozsahů |
| 6 | **Miner C nikdy nenašel share** | 162 H/s, ~23 min běhu = ~224k hashů vs. difficulty | Normální — nízký hashrate, potřeba více času |

### 5.4 NÍZKÁ PRIORITA — Dokumentace

| # | Akce |
|---|------|
| 7 | Aktualizovat `V3/README.md` o nonce partitioning mechanismus |
| 8 | Přidat pool admin guide — jak konfigurovat fee split, PPLNS window |
| 9 | Zdokumentovat postup VAST.ai miner deploy do `docs/Miners/` |

---

## 6. Závěr

**PPLNS vyplácí všem spravedlivě.** Test potvrdil matematicky korektní
proporcionální distribuci odměn ve všech testovaných scénářích:

- 1 miner → 100 %
- 2 mineři (1:1) → 50:50
- 3 mineři (1:1:1) → 33:33:33
- 3 mineři (1:2:1) → 25:50:25

Kritický bug s nonce overlap byl objeven a opraven. Fee split konfigurace
je jediný zbývající vysokoprioritní problém.

---

## 7. Soubory změněné v tomto testu

| Soubor | Popis |
|--------|-------|
| `V3/L1/pool/src/bin/server.rs` | Per-session nonce partitioning |
| `scripts/gen_test_wallets.py` | Generátor testovacích Zion adres |
| `scripts/vast_build.sh` | Build script pro VAST.ai instance |
| `docs/reports/REPORT_2026-04-07_PPLNS_MULTI_MINER_TEST.md` | Tento report |
