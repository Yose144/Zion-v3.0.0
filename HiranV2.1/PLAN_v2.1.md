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
| **RAG (min.)** | **V3-realita:** index nad `V3/docs` + `AGENTS.md` + `StatusV3.md`. **TerraNova / knihovna Amenti:** agent musí umět odpovídat **ukotveně** k obsahu digitální knihovny Amenti (portál [Síně Amenti](https://newearth.cz/V2/halls.html) — Kroniky, Amenti Library, PDF knihy atd.) přes **dedikovaný RAG index** (ne masový dump do SFT); při chybě chunku **nepředstírat** citace |
| **Eval** | Minimálně 20 ručně vybraných scénářů (Rust patch, `zion doctor`, deploy otázka, „nevím“ test) — pass/fail log |
| **Provoz** | Dokumentované env pro Docker / server; žádné tajné klíče v gitu |

---

## 2. Závislosti (co musíte mít před startem)

| Zdroj | Poznámka |
|-------|----------|
| **Base model** | Rozhodnutí: např. Llama 3.1 8B / 70B / Qwen — musí sedět s licencí a s VRAM (QLoRA tabulka v `scripts/finetune/README.md`) |
| **GPU** | Vast / vlastní CUDA; SSH + disk pro checkpointy (~10–50 GB záleží na běhu) |
| **`NVIDIA_API_KEY`** | Pro `collect_dataset.py` generování párů (free tier limity) |
| **`VAST_API_KEY`** | Pro `start_hiran_v2_vast.sh` + `gpuVast.md` playbook |
| **TerraNova / Amenti** | Veřejná digitální knihovna včetně [Síní Amenti](https://newearth.cz/V2/halls.html) — pro v2.1 **povinně** přes RAG (snapshot HTML + PDF dle licencí / souhlasu provozovatele), ne přes nekonečné rozšiřování JSONL |
| **`lineage/`** | Nepovinně: zálohy v1 Ollama + v2 LoRA pro regresní srovnání (gitignored) |

---

## 3. Fáze provádění

### Fáze A — Data vrstva (0 GPU, lokálně)

1. Aktualizovat **shard** základ přes orchestrátor (doporučeno jako průběžná doména V3):

   ```bash
   python3 scripts/finetune/build_v3_orchestrator_dataset.py \
     --project . \
     --base scripts/finetune/data/zion_train.jsonl \
     --output scripts/finetune/data/zion_train_hiran_v2.jsonl
   ```

2. (Volitelně) Rozšířit `zion_train.jsonl` přes `collect_dataset.py` dle `scripts/finetune/README.md`.

3. Sloučit do v2.1 curriculum:

   ```bash
   python3 scripts/finetune/merge_hiran_curriculum_v2_1.py
   ```

4. **Zapsat metadatum buildu** (viz `bootstrap_workspace.sh`: soubor **`curriculum/meta/BUILD.txt`** — lokální, gitignored; při releasu zkopíruj řádek `sha256` do poznámek).

**Výstup A:** funkční `hiran_curriculum_v2.1.jsonl`, smysluplné `wc -l` + spot check prvních 50 řádků.

#### Fáze A — rozšíření: vědy + Dharmické linie **přímo ve SFT** (volitelné shardy)

Cílem je doplnit **váhy** o styl a šířku mimo čistě ZION technický koridor — **bez** porušení licencí. Tyto shardy jdou na konec merge řetězce (mají přednost při duplicitách); soubory dáváš lokálně do `HiranV2.1/data/shards/`:

| Shard (soubor) | Obsah |
|----------------|-------|
| `zion_train_oer_sciences.jsonl` | Páry vygenerované z **kurátorovaných** pasáží s jasnou licencí: např. [OpenStax](https://openstax.org), [LibreTexts](https://libretexts.org), [CK-12](https://www.ck12.org), veřejné přehledy (vždy **licence + URL v metadatech** nebo v textu asistenta). Obecné vědní pojmy úroveň gymnázia / intro univerzita. |
| `zion_train_buddhism_guided.jsonl` | **Klasický buddhismus + tibetská linie:** krátké guided páry (terminologie, rozdíly škol, bez fabulovaných přesných kánonických citátů bez chunku). Preferuj generování nad **licencovanými úryvky** ([SuttaCentral](https://suttacentral.net) / edice CC; tibetské **veřejné** překlady; [BDRC](https://www.bdrc.io) metadata; [84000](https://84000.co) **pouze dle jejich licence**). Hlavní náplň zůstává **RAG** (`buddhism-classical`, `buddhism-tibetan`) — viz [`Hiran_v2.1.md`](./Hiran_v2.1.md) § 3.6. |
| `zion_train_vedic_guided.jsonl` | Krátké **guided** konverze (čeština/ENG) k dílům v [Online Vedabase – library](https://vedabase.io/en/library/) |

**⚖️ Vedabase / BBT — povinná právní poznámka:** texty Bhaktivedanty Svámího Prabhupādy a související BBT díla jsou **chráněné**. Oficiální portál používá obsah **[s právy BBT](https://vedabase.io/en/privacy-policy)**. **Nepoužívej hromadné scrapování** ani celé svazky do trénikových dat bez **[přímého oprávnění od Bhaktivedanta Book Trust](https://bbt.info/information/permissions/)** (nebo jiné písemné licence od provozovatele). Do SFT patří pouze:

- vlastní přepisy / **shrnutí** v rozsahu **fair use** s citací zdroje, nebo  
- páry vygenerované teacher modelem odkazující uživatele na **živý** Vedabase odkaz bez kopírování dlouhých pasáží, nebo  
- páry vzniklé po **uděleném** souhlasu pro ML.

**Další rozumné „online“ vstupy do SFT korpusu vědy (pro inspiraci ingestu)** — před stažením zkontroluj licenci jednotlivého titulu!

- [NASA STEM](https://www.nasa.gov/stem-content/) · arXiv pouze kde licence dovolí redistribuci úryvků · veřejné statistiky a **CC** články.

Merge je zapojen automaticky, pokud soubory ve `shards/` existují:

```bash
python3 scripts/finetune/merge_hiran_curriculum_v2_1.py
```

---

### Fáze B — SFT QLoRA (GPU)

1. Ověřit dataset:  

   ```bash
   python3 scripts/finetune/finetune_lora.py --dataset scripts/finetune/data/hiran_curriculum_v2.1.jsonl --dry-run
   ```

2. Spustit trénink (Vast nebo lokálně dle návodu):

   ```bash
   cd scripts/finetune && ./start_hiran_v2_vast.sh
   ```

   nebo čistě lokálně s vlastní instalací PyTorch/transformers podle README.

**Výstup B:** LoRA adaptér + checkpointy uložené pod `outputs/` na hostovi (kopie do `HiranV2.1/lineage/<run-id>/` pro repro).

---

### Fáze C — Merge → GGUF → Ollama

1. Použít `scripts/finetune/merge_export.py` dle README pro sloučení základního GGUF × LoRA.

2. Kvantizace (Q4/Q5…) dle dostupné VRAM inference.

3. `ollama create` s Modelfile; tag konzistentní s prostředím (`LLM_MODEL` / web proxy).

**Výstup C:** lokálně i na cílovém serveru funkční inference `ollama run hiran-v2.1`.

---

### Fáze D — RAG: V3 + knihovna Amenti (TerraNova)

Podle priorit z [`HIRANYAGARBHA_UPGRADE_PLAN.md`](../HIRANYAGARBHA_UPGRADE_PLAN.md) fáze 0–0.3 a § 3.6 v `Hiran_v2.1.md`:

1. **Indexovat** autoritativní stromy projektu (`V3/docs`, klíčové root MD).

2. **Knihovna Amenti (povinná vrstva znalosti):** Hiran v2.1 musí „znát“ obsah portálu [**Síně Amenti / Amenti Library**](https://newearth.cz/V2/halls.html) (digitální kroniky, odkazy na dostupné knihy včetně *Quantové revoluce* a souvisejících materiálů tam uvedených) v tom smyslu, že při uživatelských otázkách k té linii vrací odpovědi **Retrieval-grounded**: stažení nebo crawler snapshot → chunking → samostatný index (např. `amenti-library` ve smyslu § 3.6 routeru), s **citací části dokumentu**.

3. **Připojit** retrieval do cesty k modelu — Rust RAG (`V3/L3/ai-native/src/rag.rs`) a/nebo vrstva web/API; router smí paralelně brát „tech“ (`zion-tech`) × „AMENTI“ index.

**Výstup D:** odpověď na otázku k V3 kódu je ukotřená v tech indexu; otázka k obsahu dostupné přes halls.html je ukotřená v **Amenti/TerraNova indexu**, ne jen z obecné představivosti base modelu. **Vedabase**: pro hloubku bez porušení BBT preferuj **snapshot + RAG** paralelně k lehkému `zion_train_vedic_guided.jsonl` ve SFT. **Buddhismus (klasický + tibetský):** zvedni **dva** dedikované indexy — `buddhism-classical` (páli / raná Mahájāna v dostupných překladech) a `buddhism-tibetan` (tibetské linie dle licencí; katalogy BDRC, překlady 84000 kde smíš). Bez RAG chunku model **neomlouvá** složité doktrinální detaily.

#### D.2 — Buddhism RAG: robustní doručení (ingest → chunky → runtime API)

| Krok | Artefakt / chování |
|------|-------------------|
| **Ingest** | `./HiranV2.1/scripts/rag/autopilot_buddhism_rag.sh` + `write_ingest_manifest.py` → `HiranV2.1/data/rag/INGEST_MANIFEST.json` (SHA-256 audit) |
| **Konfigurace** | `HiranV2.1/data/rag/rag_pipeline_config.json` (cesty manifestů/výstupů; dokumentace env pro API) |
| **Chunkování** | `zion_ai_native::collect_markdown_chunks_from_relative_roots` — stejná logika jako `KnowledgeBase` |
| **API bootstrap** | `zion-ai-native-api`: **`ZION_RAG_BUDDHISM`** = `off` / `classical` / `tibetan` / `all` (pro plný ingest typicky `all`); **`ZION_WORKSPACE_ROOT`** = kořen repa; **`ZION_RAG_CHUNK_DOCS`** = `true` \| `false` chunkuje i markdowny z `ZION_DOCS_PATH` |
| **Další práce** | skutečné embeddingy (Ollama/NIM) místo `MockEmbeddingBackend`; router `buddhism-classical` × `buddhism-tibetan` × `zion-tech`; volitelně perzistence vektorů |

**Výstup D.2:** po ingestu a spuštění API s `ZION_RAG_BUDDHISM=all` naroste počet chunků ve vektorové paměti; endpoint `/config` vrací `zion_workspace_root` a RAG přepínače; `/rag/query` vrací `metadata` včetně `path_repo_relative`.

---

### Fáze E — DPO / preference (volitelné, po MVP)

· Malý preference dataset (správná vs slabá odpověď na ZION scenáře).  
· Drží se **pod** řádkem počtu vah — neřešit před hotovým SFT+RAG.

---

### Fáze F — Produkce, metriky, rollback

1. **Metriky:** latence, error rate, token usage; podle `V3` observability.  
2. **Rollback:** `lineage/v1-ollama-prague` nebo předchozí Ollama tag.  
3. **Dokumentace:** `Servers.md` / interní runbook — URL, port, model tag.

---

## 4. Rozdělení práce (paralelizace)

| Stopa | Owner / role | Artifact |
|-------|----------------|----------|
| **Data** | ML / dataset | shardy + `hiran_curriculum_v2.1.jsonl` |
| **Train** | ML / GPU | LoRA + logy |
| **Infra** | DevOps | Ollama / compose / env |
| **Product** | App | web proxy, multi-turn, UI |
| **RAG / korpusy** | ML + obsah | V3 index + **Amenti Library** index ([Síně Amenti](https://newearth.cz/V2/halls.html)) |
| **Agent** | Rust | ai-native prompt + RAG wiring (router na tech vs. Amenti index) |

---

## 5. Wave 1 — první týden stavby (konkrétní úkoly)

1. [ ] Spustit `./HiranV2.1/bootstrap_workspace.sh` z kořene repa a opravit chybějící shardy.  
2. [ ] Znovu vygenerovat `zion_train_hiran_v2.jsonl` přes `build_v3_orchestrator_dataset.py` (aktuální `V3/`).  
3. [ ] Spustit `merge_hiran_curriculum_v2_1.py` a archivovat `BUILD.txt` do `curriculum/meta/`.  
4. [ ] `finetune_lora.py --dry-run` na curriculum.  
5. [ ] Rezervovat GPU slot (Vast nebo lokální) a **jeden** pilotní běh (3 epochy).  
6. [ ] **Amenti Library:** připravit ingest (snapshot + metadata) z [Síní Amenti](https://newearth.cz/V2/halls.html) a navrhnout chunking + samostatný RAG index + testovací dotazy.  
7. [ ] **Buddhismus:** `./HiranV2.1/scripts/rag/autopilot_buddhism_rag.sh` + zkontrolovat `INGEST_MANIFEST.json`; runtime API s `ZION_RAG_BUDDHISM=all` a `ZION_WORKSPACE_ROOT=<repo>` — viz **oddíl D.2**. Knihovna Rust + Hiranyagarbha index; `zion_train_buddhism_guided.jsonl` v repu.  
8. [ ] Zapsat 10 eval promptů do `HiranV2.1/curriculum/meta/eval_scenarios_v2.1.md` (nový soubor při prvním evalu).

---

## 6. Rizika

| Riziko | Mitigace |
|--------|----------|
| Halucinace čísel / stavu řetězce | RAG + explicitní „nevím“ v system promptu |
| Přehřátí kontextu | Chunking + max tokénů inference |
| Přetahání SFT mimozónu ZION | Držet curriculum doménový; § 3.6 do RAG |
| Git push velkých binárních výstupů | `HiranV2.1/lineage/` gitignored + Releases/ZIP mimo repo |

---

*Tento dokument se aktualizuje při změnách infra (jména modelů, porty).*  
*Začněte příkazem v kořeni repozitáře: `./HiranV2.1/bootstrap_workspace.sh`*
