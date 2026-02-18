# ZION v2.9.5 — Rewrite Gaps & Milestones (real‑code aligned)

**Datum:** 2026-01-19  
**Účel:** vytáhnout z dokumentace to, co je potřeba pro rewrite, a zarovnat to s real‑code stavem (bez „wishlist“).  

---

## 1) Kanonické zdroje (source of truth)

- Stav, který má být brán jako real‑code pravda:  
  - [2.9.5/REAL_STATUS_v2.9.5.md](../../2.9.5/REAL_STATUS_v2.9.5.md)
- Přesný „rewrite/parity“ checklist (použitelné jako milestone list):  
  - [2.9.5/REWRITE_PLAN_v2.9.5.md](../../2.9.5/REWRITE_PLAN_v2.9.5.md)

**Poznámka:** Roadmapy a návrhy jsou užitečné, ale nejsou automaticky pravda o implementaci.

---

## 2) Co z dokumentace přímo plyne pro rewrite (bez přání)

### 2.1 Směr architektury

Z dokumentů je vidět, že současně existují 2 paralelní směry:

1) **Rust “zion-native” stack** (core + pool + redis + API) — v real‑statusu popsán jako produkčně/testnet-ready pro klíčové části.  
2) **Python pool/blockchain + CH3 kontroléry** — dokumentované jako plán/části běží, ale obsahují výrazné gapy (multi-chain valid shares mimo ZION, NCL E2E).

**Rewrite rozhodnutí (doporučení):**
- Pro TestNet “source of truth” vyhrává Rust stack (core+pool), Python stack držet jen jako kompatibilní/legacy vrstvu, dokud nepřejdeme komplet.

---

## 3) Dokumentační rozpory / rizika pro rewrite

### 3.1 CHv3 “12/12 algos complete” vs. real integrace

- [2.9.5/CH3_UNIFIED_STATUS.md](../../2.9.5/CH3_UNIFIED_STATUS.md) tvrdí “12 algoritmů implementováno nativně” a že zbývá integrace.
- [2.9.5/COSMIC_HARMONY_V3_ROADMAP.md](../../2.9.5/COSMIC_HARMONY_V3_ROADMAP.md) má milestone „native algo integration COMPLETE“ a „miner integration COMPLETE“.
- [2.9.5/CH3_MULTICHAIN_NATIVE_IMPLEMENTATION.md](../../2.9.5/CH3_MULTICHAIN_NATIVE_IMPLEMENTATION.md) naopak popisuje baseline, kde mimo ZION chybí validní PoW pro cílové chainy (a share submity jsou reject), a uvádí fallback hashery.

**Dopad:**
- Pro rewrite je potřeba sjednotit, co přesně znamená “implementované”:
  - (A) existuje nějaká .dylib + wrapper, nebo
  - (B) máme E2E „valid shares accepted“ pro konkrétní coin/pool, včetně job parsing a submit formátu.

**Pragmatické pravidlo:** za “done” brát pouze (B) + test.

### 3.2 Multi-chain roadmapy jsou často “platform-level”, ne mining-level

- [docs/roadmaps/MULTI_CHAIN_TECHNICAL_ROADMAP.md](../roadmaps/MULTI_CHAIN_TECHNICAL_ROADMAP.md) je spíš bridge/ekosystém roadmapa (Solana/Stellar/…)
- Pro mining rewrite je důležitější multi-chain mining dokument a real‑status.

---

## 4) Největší real gapy (podle aktuálního real‑code stavu)

### 4.1 NCL E2E je hotové (P0 splněno)

- Pool podporuje `ncl.register`, `ncl.get_task`, `ncl.submit`, `ncl.status` (Stratum extension metody).
- Miner má NCL polling loop: `get_task → compute → submit` (+ občas `status`).
- Běží deterministický ověřitelný task (blake3 hash chaining v1) + Prometheus metriky `ncl_*`.

**Aktuální riziko (rewrite-ready formulace):**
- Kontrakt je zatím “minimal v1” a je potřeba ho zafixovat jako stabilní schema (verzování, backward‑compat) před tím, než se přidají další task typy.

### 4.2 Multi-chain “valid shares accepted” mimo ZION není prokázáno

Dokument [2.9.5/CH3_MULTICHAIN_NATIVE_IMPLEMENTATION.md](../../2.9.5/CH3_MULTICHAIN_NATIVE_IMPLEMENTATION.md) explicitně popisuje, že se posílá „intermediate hash“ a cílové pooly rejectují.

---

## 5) Návrh milníků rewrite (P0→P2)

### M0 — Sjednotit kanonické dokumenty (P0, 0.5 dne)

**Cíl:** aby tým neměl 3 navzájem konfliktní “status” soubory.

- Označit kanonické: REAL_STATUS + REWRITE_PLAN.
- Ostatní statusy přepsat na „aspirational/proposal“ nebo doplnit „ověřeno/neověřeno“ box.

**Done:** 1 místo, kam se všichni dívají pro real stav.

### M1 — NCL Task Contract v1 (P0) ✅ HOTOVO

**Cíl:** mít stabilní JSON kontrakt + backward-compat pokud už existují klienti.

Navržené minimum:
- `task_id: string`
- `task_type: string` (např. `"inference"`, `"hash_chaining"`, `"embedding"`)
- `payload: object` (explicitní schema per task_type)
- `deadline_ms: number`
- `reward: { zion: number, multiplier?: number }`
- `verification: { method: string, seed: string, expected?: string }` (aby šlo ověřovat výsledky)

**Done:** pool i miner mluví jedním kontraktem pro `hash_chaining_v1` a E2E běží.

### M2 — NCL E2E v poolu (P0) ✅ HOTOVO

**Cíl:** `ncl.get_task` vrací tasky a `ncl.submit` je umí přijmout.

- Zapojit handler pro `ncl.get_task`.
- Přidat jednoduchý „task queue“ (i kdyby in-memory) + TTL.
- Vytvořit 1 deterministický task, který se dá ověřit bez GPU (CPU-only).

**Done:** end-to-end přes Stratum extension metody (register/get_task/submit/status).

### M3 — NCL loop v mineru (P1) ✅ HOTOVO

**Cíl:** miner periodicky:
- volá `ncl.get_task`
- vykoná `execute_task()`
- odešle `ncl.submit`
- reportne `ncl.status` (volitelně)

**Done:** miner umí dlouhodobě běžet bez „busy loop“ a bez mismatchu kontraktu.

### M3.1 — NCL kontrakt hardening (P1, 1–2 dny) ✅ HOTOVO (20.1.2026)

**Cíl:** přejít z "minimal v1" na stabilní schema.

Implementováno:
- ✅ `version` field (NCL_PROTOCOL_VERSION = "1.0")
- ✅ `NclTaskType` enum (`hash_chaining_v1`, `embedding`, `llm_inference`, `image_classification`)
- ✅ povinné/volitelné fieldy s `#[serde(default)]` a `#[serde(skip_serializing_if)]`
- ✅ `NclTask::validate()` s version check, task_type validation, UUID format, deadline enforcement
- ✅ `NclSubmitOutcome::Expired` status
- ✅ `NclRetryPolicy` struct (max_retries, retry_delay_ms, allow_reassignment)
- ✅ `cleanup_expired()` pro periodic expiration handling
- ✅ Contract dokumentace: [2.9.5/docs/NCL_CONTRACT_v1.0.md](docs/NCL_CONTRACT_v1.0.md)
- ✅ Miner NCL update matching pool contract

**Done:** schema je dokumentované a miner/pool failují srozumitelně při mismatch.

### M4 — NCL ekonomika + anti-cheat (P1, 2–5 dnů)

**Cíl:** aby reward nebyl jen “goodwill”.

Minimum:
- deterministické ověření výstupu (seeded challenge)
- rate-limit per worker
- basic scoring + leaderboard (pokud už existuje manager)

**Done:** pool má měřitelné metriky NCL (tasks delivered/completed/failed).

### M5 — Multi-chain mining: definovat „done“ per coin (P2, 1+ týdny)

**Cíl:** vyhnout se falešně pozitivnímu “12/12 implemented”.

Pro každý coin/algorithm definovat:
- job parsing (notify fields)
- target/difficulty conversion
- submit payload
- E2E valid share acceptance (na test poolu)

**Done:** tabulka “coin → E2E passing” + automatizovaný integration test.

### M6 — Live stack E2E (P0/P1, 0.5–2 dny)

**Cíl:** miner → pool → core (getBlockTemplate/submitBlock) + block storage + stats.

Minimum:
- lokálně spustit `core+pool+redis` (docker compose nebo native)
- integration test: nalezení bloku v test režimu (snížená obtížnost) a úspěšný `submitBlock`

**Done:** jeden příkaz spustí stack a jeden test prokáže E2E včetně uložení bloku.

---

## 6) Co bych dělal jako první (konkrétní next steps)

1) Udělat M6 (live stack E2E) → to odblokuje reálné “mining → blok → storage → payout”.
2) Udělat M3.1 + M4 (NCL schema hardening + ekonomika/anti‑cheat).
3) Teprve potom řešit M5 (multi‑chain “valid shares accepted” mimo ZION) s jasnou definicí “done”.

---

## 7) Otevřené otázky (potřebuju od tebe 2 rozhodnutí)

1) Chceme NCL v1 navrhnout tak, aby bylo **kompatibilní se současným Python pool** (Stratum extensions), nebo rovnou jako samostatný **HTTP/gRPC gateway** (a Stratum jen jako transport)?
2) Který stack je “primární” pro rewrite milníky: **Python pool** (rychlé iterace) nebo **Rust zion-native pool** (target architektura)?
