# ZION v2.9.5 — Rewrite & Python Alignment Plan

**Datum:** 15.01.2026

Tento plán je zaměřený na **přepsání klíčových částí** a **sjednocení/port existujícího Python stacku** do reálného Rust core + poolu. Každý krok je ověřitelný a končí měřitelným výsledkem.

---

## 0) Stabilizace základu (hotovo / průběžně)
- ✅ E2E miner↔pool: reálné joby, validace share hashů.
- ✅ PoW validace v core podle algoritmu.
- ✅ Template blob + merkle root z coinbase.
- ✅ Payouty zarovnané s on-chain coinbase.
- ✅ NCL E2E (minimal v1): `ncl.register/get_task/submit/status` + deterministický task + Prometheus metriky.

**Poznámka:** Tento blok je udržován v kódu průběžně při každém fixu.

---

## 1) Roadmap pro rewrite (priorita P0–P1)

### 1.1 P0 — Validace bloků a submit pipeline
**Cíl:** Core akceptuje pouze bloky validní pro daný algoritmus + správný target.

**Kroky:**
1. PoW validace podle algoritmu (RandomX/Yescrypt/Cosmic/Blake3).
2. `submitBlock` přijímá payload `{ block: ... }` i přímý objekt.
3. Template target je generován dle algoritmu výšky.

**Done kritéria:**
- Zátěžový submit z poolu projde a blok je uložen.

---

### 1.2 P0 — Stratum job consistency
**Cíl:** Joby jsou konzistentní s výškou šablony i algoritmem, klient přijímá `algo`.

**Kroky:**
1. `mining.notify` obsahuje `algo`.
2. Miner přepíná algoritmus podle jobu.
3. RandomX hasher se reinituje při změně výšky.

**Done kritéria:**
- Miner přijímá joby s algoritmem dle výšky a nepadá na mismatch.

---

### 1.3 P0 — Wallet validation v poolu (Python parity) ✅
**Cíl:** Stratum autentizace odmítne nevalidní adresy (podle Python verze).

**Kroky:**
1. Najít/portovat Python validaci adresy.
2. Aplikovat v `handle_login` i `handle_authorize`.
3. Metrika + log důvodů odmítnutí.

**Done kritéria:**
- Nevalidní wallet se nedostane do session.

---

## 2) Python parity (P1)

### 2.1 PPLNS + payout pipeline
**Cíl:** Stejné chování jako Python pool (časování, okna, struktura payoutů).

**Kroky:**
1. Porovnat distribuci a storage schéma.
2. Dopsat chybějící fields do Redis/Postgres.
3. Ověřit kompatibilitu metriky a payout ticku.

**Stav:**
- ✅ PPLNS okno je konfigurovatelné (cfg/env) a Redis trim respektuje velikost okna.
- ✅ Payout tick (send/confirm/timeout) + Redis status záznamy a index pending zůstatků.

**Done kritéria:**
- Payouty odpovídají očekávanému Python výstupu.

---

### 2.2 Hashrate tracking ✅
**Cíl:** Reálný výpočet hashrate podle share okna (Python parity).

**Kroky:**
1. Uložit timestamps share do Redis.
2. Spočítat rolling 1m/5m/1h hashrate.
3. Vystavit v API.

**Done kritéria:**
- `hashrate_1h` != 0 pro aktivní minery.

---

### 2.3 Metrics parity
**Cíl:** Pool stats endpoint obsahuje minimálně stejné klíčové metriky jako Python.

**Kroky:**
1. Dopsat agregace: active miners, shares/acceptance, blocks, payouts.
2. Ověřit formát a naming.

**Stav:**
- ✅ /stats doplněno o `connected`, `blocks.pending`, `hashrate.pool`, `payouts.pending_*`.
- ✅ /payouts endpoint s výpisem a agregacemi (Redis).
- ✅ /pool, /miners, /blocks endpointy parity (Redis-based).

**Done kritéria:**
- API `/stats` obsahuje všechny Python klíče.

---

## 3) Rewrite dokumentace (P1)

**Cíl:** Jednotný „real-only“ stav pro 2.9.5 dokumentaci a release poznámky.

**Kroky:**
1. Aktualizovat `REAL_STATUS_v2.9.5.md` po každém milestone.
2. Vyřadit zastaralé status/summary soubory.
3. Přidat „Known gaps“ pro transparentnost.

---

## 4) P2P + Sync (P2)

**Cíl:** Reálná synchronizace bloků s minimální ochrannou logikou.

**Kroky:**
1. Implementovat základní reorg/test harness (minimální).
2. Deterministické testy obtížnosti.
3. Stabilizace seednodes a handshake.

**Stav:**
- ✅ `blockchain::reorg` modul s `cumulative_difficulty`, `is_stronger_chain`, `rollback_to_height`, `find_fork_point`.
- ✅ `storage::lmdb::delete_block_at_height()` pro rollback bloků.
- ✅ Deterministické DAA testy (6 testů: boundary, stability, sequence, targets).
- ✅ Seednode stabilizace: periodické `GetTip` keepalive + `Tip` update peer height + `last_seen` refresh.

---

## 5) Závěrečné E2E (P1/P2)

**Cíl:** Plnohodnotné E2E: miner → pool → core → block storage → payout.

**Kroky:**
1. Spustit lokální stack.
2. Ověřit validní block submit.
3. Ověřit payout record ve storage.

**Stav:**
- ✅ Pool E2E testy: share validation, algorithm parsing, target conversion (4 testů).
- ✅ Core E2E testy: mining workflow, transaction flow, mempool eviction (3 testů).
- ✅ 108 unit testů prochází (72 core + 36 pool).
- ✅ Remote smoke-check (Helsinki + USA): pool `/stats` OK, core RPC `get_block_template` OK.
- ✅ Rust docker stack na Helsinki (core+pool+redis) běží na portech 18090/18181 (ověřeno lokálně na hostu).
- ✅ Miner→pool E2E (Helsinki, `cosmic_harmony`) — valid shares > 0 + active miner.
- ✅ ARM64 native mining knihovny postavené na Helsinki (randomx/yescrypt/cosmic_harmony) + load test OK.
- ⚠️ RandomX share flow vyžaduje inicializaci datasetu (~2GB) — krátký test pouze ověřil load/init.
- ✅ Externí Stratum test: miner → 77.42.31.72:13333 (cosmic_harmony) OK, valid shares > 0.
- ⚠️ RandomX externí test (180s) nedoběhl do share fáze (dataset init stále běžel).
- ⚠️ Externí přístup na 18090/18181 zatím neprochází (pravděpodobně provider firewall).
- ⚠️ Lokální live stack integrace blokována — Docker daemon není spuštěn.

---

## Aktuální další krok
**Hotovo:** Základní rewrite/parity roadmap dokončena. Další kroky:
- Integrace live stack (Redis + Core RPC) pro plné E2E testování.
- Seednode stabilizace a P2P handshake testování.
