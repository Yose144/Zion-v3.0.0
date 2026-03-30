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

## 4) Největší real gapy (podle předchozí E2E reality checku)

### 4.1 NCL je zatím “napůl”

- `ncl.register` funguje, ale `ncl.get_task` v poolu typicky nemá handler → vrací NO_TASK.
- Task JSON kontrakt mezi pool ↔ miner se liší (pool vrací jiné klíče/typy než miner očekává).

**Root cause (rewrite-ready formulace):**
- Není definován jediný stabilní task kontrakt + není end-to-end smyčka: `get_task → execute → submit_result → ack/reward`.

### 4.2 Multi-chain “valid shares accepted” mimo ZION není prokázáno

Dokument [2.9.5/CH3_MULTICHAIN_NATIVE_IMPLEMENTATION.md](../../2.9.5/CH3_MULTICHAIN_NATIVE_IMPLEMENTATION.md) explicitně popisuje, že se posílá „intermediate hash“ a cílové pooly rejectují.

---

## 5) Návrh milníků rewrite (P0→P2)

### M0 — Sjednotit kanonické dokumenty (P0, 0.5 dne)

**Cíl:** aby tým neměl 3 navzájem konfliktní “status” soubory.

- Označit kanonické: REAL_STATUS + REWRITE_PLAN.
- Ostatní statusy přepsat na „aspirational/proposal“ nebo doplnit „ověřeno/neověřeno“ box.

**Done:** 1 místo, kam se všichni dívají pro real stav.

### M1 — NCL Task Contract v1 (P0, 1–2 dny)

**Cíl:** mít stabilní JSON kontrakt + backward-compat pokud už existují klienti.

Navržené minimum:
- `task_id: string`
- `task_type: string` (např. `"inference"`, `"hash_chaining"`, `"embedding"`)
- `payload: object` (explicitní schema per task_type)
- `deadline_ms: number`
- `reward: { zion: number, multiplier?: number }`
- `verification: { method: string, seed: string, expected?: string }` (aby šlo ověřovat výsledky)

**Done:** pool i miner umí parse/validate tentýž formát.

### M2 — NCL E2E v poolu (P0, 1–2 dny)

**Cíl:** `ncl.get_task` vrací tasky a `ncl.submit` je umí přijmout.

- Zapojit handler pro `ncl.get_task`.
- Přidat jednoduchý „task queue“ (i kdyby in-memory) + TTL.
- Vytvořit 1 deterministický task, který se dá ověřit bez GPU (CPU-only).

**Done:** end-to-end přes Stratum extension metody (register/get_task/submit/status).

### M3 — NCL loop v mineru (P1, 1–3 dny)

**Cíl:** miner periodicky:
- volá `ncl.get_task`
- vykoná `execute_task()`
- odešle `ncl.submit`
- reportne `ncl.status` (volitelně)

**Done:** miner umí dlouhodobě běžet bez „busy loop“ a bez mismatchu kontraktu.

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

---

## 6) Co bych dělal jako první (konkrétní next steps)

1) Udělat M1+M2 (task kontrakt + handler) → to přímo odblokuje NCL.
2) Udělat M3 (miner loop) → reálné end-to-end.
3) Teprve potom řešit multi-chain PoW integraci mimo ZION.

---

## 7) Otevřené otázky (potřebuju od tebe 2 rozhodnutí)

1) Chceme NCL v1 navrhnout tak, aby bylo **kompatibilní se současným Python pool** (Stratum extensions), nebo rovnou jako samostatný **HTTP/gRPC gateway** (a Stratum jen jako transport)?
2) Který stack je “primární” pro rewrite milníky: **Python pool** (rychlé iterace) nebo **Rust zion-native pool** (target architektura)?
