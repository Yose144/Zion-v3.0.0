# Hiran / Hiranyagarbha v2.1 — prováděcí plán

**Účel:** jeden dokument, jak z **aktuálních dat a V3 kanonu** dojít k **„pracovnímu agentovi“**: doménové váhy + RAG + rozumný provoz inference.
**Kontext strategie širší náplně (RAG vrstvy § 3.6):** viz [`Hiran_v2.1.md`](./Hiran_v2.1.md).
**Starší roadmapa řady v1→frontier:** [`HIRANYAGARBHA_UPGRADE_PLAN.md`](../HIRANYAGARBHA_UPGRADE_PLAN.md) — tenhle plán **zužuje** na realistický **v2.1 milestone** v tomto repu.

---

## 1. Definition of Done (v2.1 „MVP agent“)

| Oblast | Kritérium hotovo |
|--------|------------------|
| **Váhy** | QLoRA (nebo full SFT pokud budget) nad zvoleným base; export do GGUF + spuštění v Ollama (nebo ekvivalent) pod tagem typu `hiran-v2.1` |
| **Data** | Kanonický JSONL `HiranV2.1/data/hiran_curriculum_v2.1.jsonl` z documented shardů; verze a hash zapsané v release notes / `curriculum/meta/BUILD.txt` (viz bootstrap) |
| **Runtime** | `V3/L3/ai-native` umí s modelem mluvit přes existující backend (`LLM_MODEL`, `OLLAMA_API_URL` / remote) bez pádu; system prompt odpovídá chování z § 3.4 `Hiran_v2.1.md` |
| **Agent contract** | Odpověď i akce dodržují truth/action/provenance/version/identity kontrakt z `Hiran_v2.1.md` § 1.1; destruktivní/deploy/wallet/key kroky vyžadují explicitní approval |
| **RAG (min.)** | **V3-realita:** index nad `V3/docs` + `AGENTS.md` + `StatusV3.md`. **TerraNova / knihovna Amenti:** agent musí umět odpovídat **ukotveně** k obsahu digitální knihovny Amenti (portál [Síně Amenti](https://newearth.cz/V2/halls.html) — Kroniky, Amenti Library, PDF knihy atd.) přes **dedikovaný RAG index** (ne masový dump do SFT); při chybě chunku **nepředstírat** citace. **Navíc — ZION Oasis / UE5 (doplněk v2.1):** celý Markdown strom `docs/docs2.9/ZION_OASIS/` + textové zápisy v `HiranV2.1/corpus/oasis-ue5/` (router/index `oasis-game`, Rust `ZION_OASIS_GAME_CORPUS_ROOTS` / `index_zion_oasis_game_corpus`); bez vkládání `.uasset` do RAG; při absenci chunku neuvádět vymyšlené lore detaily bez zdroje. |
| **API schema** | Chat/RAG vrací odděleně `answer`, `sources`, `backend_id`, `mode`, `warnings`, `model_version`, `prompt_version`, `dataset_hash`, `rag_index_version` |
| **Eval** | Minimálně 20 ručně vybraných scénářů (Rust patch, `zion doctor`, deploy otázka, „nevím“ test) — pass/fail log; safety/provenance/stale-data scénáře jsou release gate |
| **Provoz** | Dokumentované env pro Docker / server; žádné tajné klíče v gitu; `VAST_API_KEY` není používán jako LLM bearer token |

---

## 2. Závislosti (co musíte mít před startem)

| Zdroj | Poznámka |
|-------|----------|
| **Base model** | Rozhodnutí: např. Llama 3.1 8B / 70B / Qwen — musí sedět s licencí a s VRAM (QLoRA tabulka v `HiranV2.1/finetune/README.md`) |
| **GPU** | Vast / vlastní CUDA; SSH + disk pro checkpointy (~10–50 GB záleží na běhu) |
| **`NVIDIA_API_KEY`** | Pro `collect_dataset.py` generování párů (free tier limity) |
| **`VAST_API_KEY`** | Pro `start_hiran_v2_vast.sh` + `gpuVast.md` playbook |
| **TerraNova / Amenti** | Veřejná digitální knihovna včetně [Síní Amenti](https://newearth.cz/V2/halls.html) — pro v2.1 **povinně** přes RAG (snapshot HTML + PDF dle licencí / souhlasu provozovatele), ne přes nekonečné rozšiřování JSONL |
| **`lineage/`** | Nepovinně: zálohy v1 Ollama + v2 LoRA pro regresní srovnání (gitignored) |

---

## 3. Fáze provádění

#### D.3 — Produkční RAG/API gate

| Gate | Kritérium |
|------|-----------|
| **Embedding backend** | Runtime nepoužívá mock/test embeddingy pro produkční odpovědi; backend je explicitně konfigurovaný. |
| **Vector store** | Zvolená persistentní cesta pro indexy (`zion-tech`, `live-runtime`, `amenti-library`, `buddhism-*`, případně **`oasis-game`** pro herní dokumentaci Zion Oasis) nebo jasně označený in-memory dev režim. |
| **Source contract** | Každá RAG odpověď vrací source metadata: index, path/url, chunk id, licence/provenance kde existuje. |
| **Schema contract** | Chat API nemíchá context/backend/source významy; odpověď je stabilní pro web, CLI i desktop. |
| **Runtime key hygiene** | Vast orchestration klíč je oddělený od LLM provider klíčů; lokální endpointy fungují bez falešného bearer tokenu. |

**Výstup D.3:** Hiran není jen model s přilepeným RAGem, ale jednotný retrieval-grounded runtime.

---

### Fáze E — DPO / preference (volitelné, po MVP)

· Malý preference dataset (správná vs slabá odpověď na ZION scenáře).
· Drží se **pod** řádkem počtu vah — neřešit před hotovým SFT+RAG.

---

### Fáze F — Produkce, metriky, rollback

1. **Metriky:** latence, error rate, token usage, retrieval hit rate, citations coverage, fallback rate; podle `V3` observability.
2. **Verze:** logovat / vracet `model_version`, `prompt_version`, `dataset_hash`, `rag_index_version`.
3. **Rollback:** `lineage/v1-ollama-prague` nebo předchozí Ollama tag; pro API mít degraded/echo mód.
4. **Dokumentace:** `Servers.md` / interní runbook — URL, port, model tag, rebuild indexů, smoke testy.

---

## 4. Rozdělení práce (paralelizace)

| Stopa | Owner / role | Artifact |
|-------|----------------|----------|
| **Data** | ML / dataset | shardy + `hiran_curriculum_v2.1.jsonl` |
| **Train** | ML / GPU | LoRA + logy |
| **Infra** | DevOps | Ollama / compose / env |
| **Product** | App | web proxy, multi-turn, UI přes stejný Hiran API kontrakt |
| **RAG / korpusy** | ML + obsah | V3 index + **Amenti Library** index ([Síně Amenti](https://newearth.cz/V2/halls.html)) + Buddhism/Vedabase/OER metadata + **`oasis-game`** (`docs/docs2.9/ZION_OASIS`, `HiranV2.1/corpus/oasis-ue5`) |
| **Agent** | Rust | ai-native prompt + RAG wiring (router na tech vs. Amenti index) |
| **Safety / legal** | Dev + obsah | action tiers, approval policy, licence manifesty, secret/source denylist |
| **Eval** | Dev + produkt | release gate scénáře: hallucination, stale data, provenance, destructive ops, Rust patch |

---

## 5. Wave 1 — první týden stavby (konkrétní úkoly)

1. [ ] Zafixovat agent operating contract a SOT pořadí z Fáze 0 jako checklist pro každý další běh.
2. [ ] Spustit `./HiranV2.1/bootstrap_workspace.sh` z kořene repa (nahradí chybějící **deterministic** orchestrátor shard `data/shards/zion_train_hiran_v2.jsonl` automaticky přes `build_v3_orchestrator_dataset.py`; volitelné NIM shardy `data/shards/zion_train.jsonl` generovat `collect_dataset.py`, viz `finetune/README.md`).
3. [ ] Znovu vygenerovat `zion_train_hiran_v2.jsonl` přes `build_v3_orchestrator_dataset.py` (aktuální `V3/`).
4. [ ] Spustit `merge_hiran_curriculum_v2_1.py` a archivovat `BUILD.txt` do `curriculum/meta/`.
5. [ ] `finetune_lora.py --dry-run` na curriculum.
6. [ ] Rezervovat GPU slot (Vast nebo lokální) a **jeden** pilotní běh (3 epochy).
7. [ ] **Amenti Library:** připravit ingest (snapshot + metadata) z [Síní Amenti](https://newearth.cz/V2/halls.html) a navrhnout chunking + samostatný RAG index + testovací dotazy.
8. [ ] **Buddhismus:** `./HiranV2.1/scripts/rag/autopilot_buddhism_rag.sh` + zkontrolovat `INGEST_MANIFEST.json`; runtime API s `ZION_RAG_BUDDHISM=all` a `ZION_WORKSPACE_ROOT=<repo>` — viz **oddíl D.2**. Knihovna Rust + Hiranyagarbha index; `zion_train_buddhism_guided.jsonl` v repu.
9. [ ] Rozhodnout produkční embedding/vector-store cestu a označit in-memory/mock jen jako dev režim.
10. [ ] Zapsat 20 eval promptů do `HiranV2.1/curriculum/meta/eval_scenarios_v2.1.md` (nový soubor při prvním evalu): Rust patch, `zion doctor`, deploy, „nevím“, stale data, licence/citace, destructive action.
11. [ ] Ověřit, že web chat nepoužívá separátní osobnost/API mimo Hiran runtime.
12. [ ] *(Doplněk)* **ZION Oasis + UE5:** zajistit RAG index `oasis-game` — celý strom `docs/docs2.9/ZION_OASIS/` + `HiranV2.1/corpus/oasis-ue5/` s `ZION_WORKSPACE_ROOT=<repo>`; ověřit `index_zion_oasis_game_corpus` nebo plný canonical scan; smoke dotazy s očekávanou cestou k `.md` v `SACRED_TRINITY` / `GOLDEN_EGG_GAME`; volitelně `zion_train_oasis_ue5_guided.jsonl`.

---

## 6. Rizika

| Riziko | Mitigace |
|--------|----------|
| Halucinace čísel / stavu řetězce | RAG + explicitní „nevím“ v system promptu |
| Přehřátí kontextu | Chunking + max tokénů inference |
| Přetahání SFT mimozónu ZION | Držet curriculum doménový; § 3.6 do RAG |
| Git push velkých binárních výstupů | `HiranV2.1/lineage/` gitignored + Releases/ZIP mimo repo |
| Mock RAG jako falešný produkční retrieval | Produkční gate vyžaduje reálné embeddingy nebo jasně označený dev režim |
| Web/CLI/Desktop odpovídají jinou osobností | Jeden Hiran API kontrakt a sdílené system prompt/version metadata |
| Staré E2E/generated odpovědi přebijí aktuální stav | SOT pořadí: live endpoint + `StatusV3.md`/`V3/README.md` před archivem; generated výstupy jen test sample |
| Secret/API key leakage do datasetu nebo RAGu | Denylist `.git`, secrets, wallets; scan datasetu před release; oddělit Vast vs LLM provider klíče |
| Dharma tón zakryje technickou nejistotu | Truth/action contract: nejistotu říct nahlas, destruktivní kroky jen po schválení |

---

*Tento dokument se aktualizuje při změnách infra (jména modelů, porty).*
*Začněte příkazem v kořeni repozitáře: `./HiranV2.1/bootstrap_workspace.sh`*
