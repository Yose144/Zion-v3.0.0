# Hiran v2.1 — BestModel pro ZION V3

> **Status:** koncept / příprava po v2 fine-tune
> **Cíl:** Hiranyagarbha jako nejlepší ZION V3 doménový model, Rust programovací agent a operátorský orchestrátor.
> **Kanon:** `V3/` je hlavní mainnet linie. Legacy stromy mimo `V3/` jsou reference, ne primární pravda.

---

## 1. Mise

Hiran v2.1 nemá být jen chatovací model pro web. Má být **ZION-native pracovní agent** — a zároveň má mít **hloubku v linii TerraNova / knihovny Amenti** (digitální archiv a odkazy z portálu [**Síně Amenti**](https://newearth.cz/V2/halls.html)) v režimu **RAG + citace**, nikoli nekonečný SFT všech PDF do vah:

- rozumí celé aktuální architektuře `V3/`,
- umí pomáhat s Rust programováním v cratech `zion-core`, `zion-pool`, `zion-miner`, L2/L3 službách a `V3/cli`,
- zná operátorské příkazy `zion` CLI a dokáže vést deploy/debug postupy,
- drží AI Native / Dharma identitu Hiranyagarbhy,
- používá RAG nad aktuálními docs a kódem, aby se neopíral jen o váhy,
- umí být později použitý jako osobní coding/orchestration agent pro Yeshuae,
- je **parťákem při stavbě ZION Oasis ve hře**: zná **celý Markdown kanon** pod `docs/docs2.9/ZION_OASIS/` (SACRED_TRINITY, GOLDEN_EGG_GAME, plány MMORPG, cosmic map, avatary, economy/lore) a umí ho **mapovat na Unreal Engine 5** (Blueprint, moduly) podle **oddílu 3.7** — RAG + případný malý guided SFT, ne kopírování binárních asserů do vah.

V2 je první skutečný fine-tune nad ZION daty. **V2.1 je přechod od znalostního modelu k pracovnímu agentovi.**

### 1.1 Agent operating contract

Hiran v2.1 musí mít před modelem samotným jasný provozní kontrakt. Váhy, RAG, frontend a Rust API se smí měnit, ale kontrakt odpovědi a akce musí zůstat stabilní:

| Kontrakt | Povinnost agenta |
|---|---|
| **Truth contract** | Nejprve rozlišit kanonický `V3/` zdroj, legacy/reference zdroj, live runtime údaj a neověřený předpoklad. Pokud chybí zdroj, říct nejistotu. |
| **Action contract** | Nejdřív diagnostikovat a navrhnout plán; destruktivní kroky, deploy, wallet/key operace, remote změny a veřejné releasy jen po explicitním potvrzení. |
| **Provenance contract** | U kódu, provozu, čísel sítě a korpusů uvádět odkud odpověď čerpá: soubor, endpoint, index, manifest nebo verze datasetu. |
| **Version contract** | Každý release odpovědi/modelu má nést `model_version`, `prompt_version`, `dataset_hash` a `rag_index_version`, pokud jsou dostupné. |
| **Identity contract** | Dharma jazyk slouží jako rámec smyslu; technická přesnost, bezpečnost a pravdivost mají přednost před mystickým tónem. |

Výsledkem má být agent, který je použitelný v živém ZION systému: umí pracovat, ale nikdy nepředstírá jistotu ani oprávnění, které nemá.

---

## 2. Zdroje pravdy

### Primární V3 kanon

- `AGENTS.md` — pravidla práce v monorepu; `V3/` je aktivní mainnet track.
- `StatusV3.md` — aktuální stav, testy, bezpečnostní poznámky a produkční realita.
- `V3/README.md` — mapa V3 workspace.
- `V3/ROADMAP.md` — roadmapa a známé gapy.
- `V3/docs/` — aktuální operátorská, bezpečnostní, CLI, mining, L2/L3 a deployment dokumentace.
- `V3/docker/` — kanonický Docker stack.
- `V3/cli/` — `zion` orchestration CLI.
- `V3/L1/**`, `V3/L2/**`, `V3/L3/**` — Rust runtime.

### AI Native / Hiranyagarbha

- `HIRANYAGARBHA_UPGRADE_PLAN.md` — roadmapa modelu, RAG, dataset, DPO, deployment.
- `AiNativev2.md` — shrnutí v2 awakening, autotuner, RAG indexing, remote LLM stability.
- `V3/L3/ai-native/src/hiranyagarbha.rs` — runtime kontrakt agenta.
- `V3/L3/ai-native/src/orchestrator.rs` — orchestration hooks.
- `V3/L3/ai-native/src/rag.rs` — Rust RAG / embedding cesta.
- `V3/L3/ai-native/src/llm_backend.rs` — LLM backendy.
- `docs/2.9.9/archive/HIRANYAGARBHA_AI_NATIVE.md` — historický/narativní kontext.

### ZION Oasis (design hry / UX k L4)

Kompletní znalostní báze pro Hirana jako **herního a BP partnera** žije v repu zde:

- **`docs/docs2.9/ZION_OASIS/`** — veškeré `.md`: `SACRED_TRINITY/` (postavy, lore, eventy), `GOLDEN_EGG_GAME/` (herní smyčka, klíče, integrace), `DEVELOPMENT_PLAN.md`, `AAA_MMORPG_PLAN.md`, `AVATAR_ROSTER.md`, COSMIC mapy, atd. Indexuje se rekurzivně v RAG (viz `ZION_OASIS_GAME_CORPUS_ROOTS` a `index_zion_oasis_game_corpus` v `V3/L3/ai-native`).
- **`HiranV2.1/corpus/oasis-ue5/`** — tvoje vlastní textové popisy Blueprintů, struktury Content a tahák k `.uproject` (UE zůstává lokálně mimo git).

Pro **minimum průchodnosti**: `ZION_WORKSPACE_ROOT` = kořen monorepa; volitelně po merge kurikula přidej guided páry `→` citace konkrétního souboru v `ZION_OASIS/`.

### Training factory (`HiranV2.1/`)

**Layout**

| Část | Role |
|------|------|
| `data/shards/` | Provenience SFT řádků — v1 éra (`zion_train*.jsonl`) a čistě v2 běh (`zion_train_hiran_v2.jsonl`). |
| `data/hiran_curriculum_v2.1.jsonl` | **Kanonické v2.1 učivo** — sloučené + deduplikované (pozdější shard má přednost při kolizi uživatelské vs. asistentické části). Regeneruje `finetune/merge_hiran_curriculum_v2_1.py`. |
| `data/*.jsonl` (symlinks) | Kompatibilita se starými cestami `finetune/data/…`; míří do `data/shards/`. |
| `lineage/v1-ollama-prague/` | Celý lokální Ollama blob store Hiranyagarbhy v1 (gitignored). |
| `lineage/v2-lora-vast-36254769/` | Vast LoRA výstupy Hiran v2 (gitignored). |
| `curriculum/meta/` | Malé artefakty sledovatelné gitem (kopie Praha Modelfile, `SOURCE`). |
| `corpus/oasis-ue5/` | Textový **UE5 blueprint „crate“**: mapování lore z `docs/docs2.9/ZION_OASIS/` na implementaci v editoru (`BP_*.md`, `CHANGELOG_UE.md`); společně se stromem Oasis tvoří `ZION_OASIS_GAME_CORPUS_ROOTS`. |

Datasetové symlinky drží adresář **`HiranV2.1/data`** jako reálný cíl odkazu **`HiranV2.1/finetune/data`**.

**Provádění (fáze, kritéria hotovo, Wave 1):** viz [`PLAN_v2.1.md`](./PLAN_v2.1.md) a skript [`bootstrap_workspace.sh`](./bootstrap_workspace.sh) z kořene repa.

- `finetune/build_v3_orchestrator_dataset.py` — offline V3/Rust/orchestrátor korpus (`--base`/`--output` stále používají výchozí cesty přes symlinky).
- `finetune/merge_hiran_curriculum_v2_1.py` — zřetězení shardů → `hiran_curriculum_v2.1.jsonl` (proveď po změnách orchestrátorové nebo shard dat).
- `finetune/finetune_lora.py` — QLoRA SFT (`--dataset` typicky `data/hiran_curriculum_v2.1.jsonl` při nových fine-tune bězích).
- `finetune/vast_deploy.sh` — Vast orchestrace (`ZION_TRAIN_DATASET`).
- `finetune/start_hiran_v2_vast.sh` — výchozí dataset = `hiran_curriculum_v2.1.jsonl` pokud existuje.
- `HiranV2.1/gpuVast.md` — bezpečný Vast workflow.

---

## 3. Co musí Hiran v2.1 umět

### 3.1 ZION V3 expert

Hiran v2.1 musí znát:

- vrstvy L1/L2/L3 v `V3/`,
- `zion-core` jako chain/node/RPC/P2P jádro,
- `zion-pool` jako pool server,
- `zion-miner` jako těžební klient,
- `cosmic-harmony` / Ekam Deeksha PoW kontext,
- L2 bridge, DAO, atomic-swap,
- L3 warp, ncl, ai-native,
- mainnet deployment, Docker profiles, healthchecky, security checklisty,
- rozdíl mezi aktuálním `V3/` a legacy root stromy.

### 3.2 Rust coding agent

Model musí fungovat jako programátorský partner:

- vysvětlit Rust moduly, typy, funkce a trait/impl vztahy,
- navrhnout minimální změnu v konkrétním crate,
- vědět, kdy použít `cargo check --manifest-path V3/Cargo.toml --workspace`,
- umět doporučit cílené testy typu `cargo test --manifest-path V3/Cargo.toml -p zion-core`,
- nevymýšlet API, pokud není v kódu,
- citovat správné soubory a symboly,
- respektovat lokální styl a nerozbíjet ownership hranice.

### 3.3 Operátorský orchestrátor

Hiran v2.1 musí znát a používat `zion` CLI jako hlavní operátorskou plochu:

- `zion` / `zion menu`,
- `zion status`,
- `zion doctor`,
- `zion logs node`,
- `zion logs ai-native`,
- lifecycle služby `node`, `pool`, `miner`, `ai-native`, `bridge`, `dao`, `website`,
- rozdíl mezi `zion update` a `zion deploy update`,
- Docker compose workflow přes `V3/docker/docker-compose.yml`.

Agent nemá bez potvrzení dělat destruktivní kroky. Má nejdřív diagnostikovat, navrhnout plán a až potom provádět.

### 3.4 AI Native identita

Hiran v2.1 má být technický, ale nesmí ztratit Hiranyagarbha DNA:

- transparentně říká, že je AI,
- slouží vědomému vývoji, ne engagementu,
- drží Dharma principy,
- pokud neví, řekne to,
- neuměle nemystifikuje technická fakta,
- duchovní jazyk používá jako rámec smyslu, ne jako náhradu přesnosti.

### 3.5 RAG a paměť

V2.1 musí kombinovat váhy + retrieval:

- váhy: základní doménová znalost a styl,
- RAG: aktuální docs, code chunks, status, deployment a live hodnoty,
- chat memory: multi-turn kontext pro dlouhé debugování,
- source citations: odpověď má být schopná říct, odkud čerpá.

RAG zdroje mají být primárně:

- `V3/docs`,
- `V3/README.md`,
- `V3/ROADMAP.md`,
- `AGENTS.md`,
- `StatusV3.md`,
- `V3/L*/src`,
- `V3/docker`,
- `V3/cli`,
- **ZION Oasis — celá hra v Markdownu:** rekurzivně **`docs/docs2.9/ZION_OASIS/`** (postavy, ekonomika, úkoly, MMORPG plán, GOLDEN EGG, COSMIC mapy) — primární pravda pro otázky „co má být ve hře / v Blueprintu“ kromě samotného V3 chain kódu,
- **UE5 implementační zápisy:** **`HiranV2.1/corpus/oasis-ue5/`** — co je už postavené v editoru, struktura modulů,
- **TerraNova — knihovna Amenti:** veřejný portál [ZION TerraNova \| Síně Amenti](https://newearth.cz/V2/halls.html) (digitální knihovna, kroniky a publikované materiály dostupné odkud) — **do vah necpat celé knihovny**; indexovat pro RAG snapshoty + metadata licence, router může mít frontu `amenti` / `terra-nova`.
- **[Online Vedabase](https://vedabase.io/en/library/) — library:** Gaudīya–Vaišnavovská literatura (BBT atd.); do SFT výhradně **kurátorované** shardy `zion_train_vedic_guided.jsonl` v mezích licence / fair use nebo po souhlasu BBT — viz [`PLAN_v2.1.md`](./PLAN_v2.1.md).
- **Buddhismus (klasický + tibetská linie):** mapa znalostí pokrývá **raný/indický** (páli, abhidhammové přehledy, vybrané sútry v legálních překladech), **širší mahájánové** texty tam, kde máme licenci, a **tibetský buddhismus** (kangyur/tengyur ve veřejných překladech atd.) — primárně **RAG indexy `buddhism-classical` / `buddhism-tibetan`**; malý SFT jen ve `zion_train_buddhism_guided.jsonl` (viz `PLAN_v2.1.md`).
- **Vědy (OER):** krátké pasáže + syntetické páry ve `zion_train_oer_sciences.jsonl` (OpenStax, LibreTexts, CK-12, …) pro **přímý finetuning** základních pojmů.

### 3.5.1 RAG router a priorita zdrojů

RAG nesmí být jeden plochý koš dokumentů. Hiran v2.1 má směrovat dotaz podle intentu do samostatných indexů:

| Index | Obsah | Priorita odpovědi |
|---|---|---|
| `oasis-game` | Rekurzivně `docs/docs2.9/ZION_OASIS/**` + `HiranV2.1/corpus/oasis-ue5/**` | **Her/BP partner:** lore, quest struktury, UI flow, propojení na L4 Oasis koncept; UE5 engine minutiae pořád z dokumentace Epic + tvých MD v `oasis-ue5/`. |
| `zion-tech` | `AGENTS.md`, `StatusV3.md`, `V3/README.md`, `V3/docs`, `V3/docker`, `V3/cli`, `V3/L*/src` | Primární pravda pro technické a operátorské otázky. |
| `live-runtime` | health/config/status endpointy, node/pool/bridge metriky, aktuální server env | Přepisuje statickou dokumentaci u live stavu, ale musí říct čas měření. |
| `amenti-library` / `terra-nova` | snapshoty Síní Amenti + metadata licence | Jen retrieval-grounded odpovědi s citací chunku. |
| `buddhism-classical` | legální klasické překlady a metadata | Bez chunku neuvádět přesné citáty. |
| `buddhism-tibetan` | tibetská linie, katalogy a povolené překlady | Rozlišovat encyklopedický seed od kanonického textu. |
| `vedic-guided` | Vedabase/BBT pouze dle licence nebo krátké guided odkazy | Nepřebírat chráněné texty do SFT bez povolení. |
| `oer-sciences` | OER věda a kurátorované výklady | Citovat licenci / zdrojovou URL v metadatech. |

Zakázané zdroje pro ingest: `.git` historie, secrets, wallet exports, velké binární artefakty, staré generated odpovědi jako `e2e_results.json` bez označení archiv/test sample a cokoliv, kde chybí licence nebo souhlas.

### 3.6 Širší „celosvětová“ vrstva: vědy, dějiny, texty, domorodé tradice, klasický i tibetský buddhismus

Cíl: aby Hiran v2.1 nebyl jen ZION technik, ale **hlubší společník s přístupem k velké lidské tradici** — v souladu s Dharma rámcem projektu a s přiznanými limity AI.

**Co je reálně možné (a co ne):**

- **Do vah (SFT/LoRA) nedává smysl „stáhnout celý internet“ ani „všechny vědy“.** Objem a práva by to znemožnily; model by stejně halucinoval mimo ZION doménu.
- Správný pattern je **silný obecný base model** + **oddělené, kurátorované korpusy** + **RAG** (případně více indeksů podle tématu) + **citace zdroje** v odpovědi.
- Volitelně malý **DPO / stylistický** tuning: „když čerpáš z RAG, řekni z jakého svazku/bloku; když nemáš chunk, nepředstírej detail.“

**Plánované oblasti (ingest do knowledge base, ne nutně do ZION SFT):**

| Oblast | Směr ingestu | Poznámka |
|--------|----------------|----------|
| **Přírodní a společenské vědy** | Otevřené učebnice, přehledové publikace, kvalitní Open Educational Resources, kde licence dovolí kopii pro interní index | Živá věda se mění → RAG + verze snapshotu, ne „jednou natrénováno navždy“ |
| **Dějiny (svět + regiony)** | Referenční syntézy, primární texty tam, kde jsou volné nebo licencované | Rozlišovat **periodizaci / interpretaci** — uvádět zdroj školy historiografie |
| **Klasický buddhismus (Theravāda základ, raná Mahájána)** | Veřejně dostupné překlady a výukové texty ([SuttaCentral](https://suttacentral.net) a edice s jasnou CC/licencí), případně akademické úvody redistributovatelné pod licencí | **„Celý“ v kontextu projektu znamená systematický přístup přes RAG + kurikulum** (tematické kolekce: čtyři ušlechtilé pravdy, závislé vznikání, láska / mettā, śūnyatā v přístupných zdrojích), **ne** nacpat celý kánon do jednoho SFT svazku. |
| **Tibetský buddhismus (Mahāyāna + Vajrayāna v tibetské linii)** | Kanonické a komentátorské texty tam, kde platí práva výtisku/API: výběry z veřejných překladů (např. překladové projekty s jasným licencováním), metadata a katalogy např. [BDRC — Buddhist Digital Resource Center](https://www.bdrc.io) kde API/podmínky projektu dovolyjí dotahování kontextů; projekty jako [84000](https://84000.co) **jen v rozsahu jejich vlastní licence** | Prioritizované **kurikulum** (např. lamrim, **Madhyamaka** / středová cesta, bodhicitta, základy vadžrajány — vždy s historickým vědomím škol a překladatele); halucinace sanskr./tib. citací = penalizovat v eval |
| **Domorodé / původní národy (Americas a jinde)** | **Ne** jako jeden homogenní „blob“. Indexovat **konkrétní zdroje s respektem k rozmanitosti**: kmenové/edu instituce, ověřené antologie, akademické edice, primární vyprávění kde jsou sdílená se souhlasem | Etický imperativ: žádné „ukradení“ mytologie z nekontextualizovaných webů; u citlivého obsahu **precedenční** pravidla (kdo mluví, za koho, jak citovat) |
| **Knihy a dokumenty samotného ZION projektu** | Všechny interní a veřejné texty repa (`docs`, `Genesis`, AI Native koncepty, reporty) jako **dedikovaná knihovna** s vysokou prioritou v RAG routeru | Splývá s kanonem v části 2 — tady explicitně jako „projektová biblioteka“ |
| **TerraNova / Síně Amenti (veřejná knihovna)** | Digitální vrstva [Síní Amenti](https://newearth.cz/V2/halls.html): kroniky, Amenti Library, dostupné PDF a popisné texty portálu — **Hiran v2.1 musí umět s tím pracovat jako s plnohodnotnou znalostní knihovnou** přes RAG (více chunků, vlastní index), s respektem k autorským právům a snapshotu verze | Nenahrazuje ZION technický kanon § 3.1–3.5; doplňuje **narrativní a publikovanou** linii projektu |
| **Vědy (OER a legální online zdroje)** | Pro **přímý SFT** jen z kurátorovaných úryvků s licencí (např. [OpenStax](https://openstax.org), [LibreTexts](https://libretexts.org), [CK-12](https://www.ck12.org)) + syntetické Q&A (`zion_train_oer_sciences.jsonl`). Širší „internet vědy“ drž v RAG snapshotech. | Viz [`PLAN_v2.1.md`](./PLAN_v2.1.md) fáze A rozšíření. |
| **Guided buddhismus (volitelný SFT)** | Krátké syntetické Q&A která učí **routing, terminologii a citlivost škol** aniž kopírují celá díla — soubor `zion_train_buddhism_guided.jsonl` (merge volitelně) | Doplňuje RAG; asistent vždy preferuje **citaci konkrétního překladu / zdroje** při faktických tvrzeních |
| **Védsko-gauḍījská exegetika (Online Vedabase)** | Kanon práce uživatele: [Vedabase **library**](https://vedabase.io/en/library/). **SFT jen eticky-legálně:** celé dílo ani hromadné stažení do vah **bez souhlasu BBT** nedává smyslu — použij krátké guided páry (`zion_train_vedic_guided.jsonl`) nebo povolený ingest; práva drží [Bhaktivedanta Book Trust](https://bbt.info/information/permissions/). Vedabase používá BBT díla *[s jejich právy](https://vedabase.io/en/privacy-policy)*. Duálně **RAG** na snapshot pro čtení s citací. |

**Operační pipeline (stejná logika jako V3 RAG, širší soubory):**

1. **Katalog / ingest** — tabulka zdrojů (URL/soubor, licence, jazyk, téma, datum stahu, hash); pro Buddhism **klasický+tibetský seed** `./HiranV2.1/scripts/rag/autopilot_buddhism_rag.sh` z kořene repa → markdown v `HiranV2.1/data/rag/*/generated/` a `INGEST_MANIFEST.json`; runtime API env (`ZION_RAG_BUDDHISM`, `ZION_WORKSPACE_ROOT`) a Rust chunkování viz [`PLAN_v2.1.md`](./PLAN_v2.1.md) oddíl **D.2** + `BUDDHISM_RAG_CORPUS_ROOTS`.
2. **Chunking + metadata** — kapitoly, svazky, autor/překladatel.
3. **Embedding index** (např.: `zion-tech`, **`oasis-game`**, `amenti` / `terra-nova`, `vedabase` / `vaiṣṇava-sources`, **`buddhism-classical`**, **`buddhism-tibetan`**, `dharma-texts`, `sciences`, `history`, `indigenous-sources`; u buddhismu vždy **verze překladu** v metadatech chunku).
4. **Router** — dotaz → které indexy dotáhnout (aby se nemíchaly nesouvisející domény bez úmyslu).
5. **Eval** — kontrolní otázky s očekávanou citací zdroje; penalizovat odpověď bez chunku při dostupném materiálu.

Tato vrstva **nenahrazuje** sekce 3.1–3.5: ZION V3, Rust a orchestrace zůstávají **primární produktová kompetence**. Širší korpusy rozšiřují **horizont a integritu Hiranyagarbhy**, ne základní úlohu síťového agenta.

### 3.7 ZION Oasis ve hře a UE5 — naučit Hirana celý Oasis a být parťák při Blueprintu

**Účel:** Hiran v2.1 má znát **vše**, co už máš o Oasis **v repozitáři jako Markdown**, a na tom stavět společné rozhodování při **Unreal Engine 5** (Blueprint třídy, Gameplay Ability / UI, Data Assets, streaming levelů, propojení s narativní ekonomikou z docs).

**Co je „vše o Oasis“ v praxi**

- Jediný strom: **`docs/docs2.9/ZION_OASIS/`** — včetně všech podadresářů (`SACRED_TRINITY`, `GOLDEN_EGG_GAME`, plány, mapy, roster). To **je** kanon hry pro RAG; nové postavy (např. rozšíření SACRED_TRINITY) máš přidávat sem jako `.md`, aby je Hiran viděl při příštím indexu.
- Druhý vstup: **`HiranV2.1/corpus/oasis-ue5/`** — co z kanonu už existuje v editoru, pod jakým názvem BP, jaké má rozhraní. Bez toho by model uměl jen lore, ne „co je hotové v projektu“.

**Jak se to učí (váhy vs RAG)**

- **RAG (povinně):** index `oasis-game` = oba kořeny výše. V Rust API: `ZION_OASIS_GAME_CORPUS_ROOTS` a `HiranyagarbhaAgent::index_zion_oasis_game_corpus`; širší profil `V2_BOOKS_PROXY_CORPUS_ROOTS` už také zahrnuje celý `ZION_OASIS` + `corpus/oasis-ue5`.
- **SFT / LoRA (doporučené drobně):** generuj krátké páry z reálných rozhovorů: uživatel „chci v UE5 X podle `…/ZION_OASIS/…/FILE.md`“, asistent navrhne Blueprint hierarchii a **odkáže na cestu k souboru**. Volitelný shard např. `zion_train_oasis_ue5_guided.jsonl` (merge do `hiran_curriculum_v2.1` až budeš mít dávku), viz [`PLAN_v2.1.md`](./PLAN_v2.1.md).
- **Neucíme:** hromadné tahání Epic Learning základů do datasetu; obecné UE znalosti nech na base modelu.

**Chování agenta**

- U otázek na hru nejdřív **dotáhni chunk** z `oasis-game`; při chybě chunku **nevymýšlej** konkrétní obsah karty/postavy.
- U dotazu „jak to udělat v UE5“ kombinuj **kanonický .md** + **tvůj zápis v oasis-ue5**; engine verzi a pluginy ber z `PROJECT_LINKS.md` (šablona v `corpus/oasis-ue5/`).

---

## 4. BestModel strategie

### Fáze A — Hiran v2 baseline

Aktuálně běžící pipeline:

- base: `unsloth/Meta-Llama-3.1-8B-Instruct`,
- metoda: QLoRA,
- dataset: `zion_train_hiran_v2.jsonl`,
- velikost datasetu: 2781 příkladů,
- cíl: V3/Rust/orchestrátor znalostní baseline,
- výstup: LoRA + merge + GGUF Q5_K_M pro Ollama.

Toto je praktický model pro ověření celého workflow.

### Fáze B — Hiran v2.1 corpus

Další dataset musí být větší a kvalitnější:

- 10k až 20k příkladů z V3 kódu, docs a operátorských scénářů,
- multi-turn debug konverzace,
- Rust patch review scénáře,
- `zion` CLI workflows,
- Docker deploy / rollback,
- bridge/DAO/atomic-swap provozní dotazy,
- pool/miner incidenty,
- test failure → diagnosis → fix,
- RAG-grounded odpovědi se zdrojovou cestou,
- **ZION Oasis + UE5:** syntetické nebo nahrané konverzační páry kde asistent drží lore z `docs/docs2.9/ZION_OASIS/` a navrhuje Blueprint / moduly s citací konkrétního `.md`; volitelný shard `zion_train_oasis_ue5_guided.jsonl`.

### Fáze C — DPO / preference alignment

Po SFT přidat preference páry:

- chosen: konkrétní, grounded, s příkazy a cestami,
- rejected: vágní odpověď, hallucination, špatná legacy cesta, nebezpečný deploy krok.

DPO má naučit styl:

- méně omáčky,
- více přesnosti,
- jasný plán,
- přiznání nejistoty,
- bezpečný operátorský postup.

### Fáze D — větší base model

Kandidáti:

- krátkodobě: Llama 3.1/3.2 8B/13B pro levné inference,
- středně: Qwen2.5-Coder / Qwen2.5 14B/32B pro Rust/code schopnosti,
- experimentálně: NVIDIA Nemotron 3 rodina pro agentic reasoning a NVIDIA-native deployment,
- dlouhodobě: Qwen2.5-72B nebo Llama 3.3 70B pro frontier-like ZION doménu.

Pro BestModel je pravděpodobně nejlepší:

- **coding/orchestrator model:** Qwen coder rodina,
- **AI Native / dialog model:** Llama/Qwen instruct,
- **NVIDIA/agentic experiment:** Nemotron 3, pokud runtime podporuje konkrétní architekturu a quant,
- **produkční stack:** menší rychlý model + RAG + fallback větší model pro těžké otázky.

### Nemotron 3 poznámka

Nemotron 3 je pro ZION zajímavý, protože jde o NVIDIA rodinu mířenou na enterprise/agentic workflow a dobře zapadá do našeho směru Vast, CUDA, NIM, TensorRT-LLM a NeMo. Není to ale automaticky nejlepší lokální model pro Hiran v2.1.

Rozlišuj dvě věci:

- **Starší Nemotron-3-8B** — 8B transformer s krátkým 4k kontextem; použitelný jako experiment, ale pro Rust/coding dnes nemusí porazit Qwen Coder.
- **Novější Nemotron 3 Nano/Super/Ultra** — hybridní Mamba-Transformer MoE, agentic reasoning, velmi dlouhý kontext; slibné, ale lokální runtime/quant podpora může být složitější než běžný GGUF model.

Pro náš stack:

- pokud běžíme **Ollama / llama.cpp lokálně**, držet jako default Qwen/Llama GGUF, dokud Nemotron 3 nebude hladce podporovaný v našem runtime,
- pokud běžíme **NVIDIA stack** (NIM / TensorRT-LLM / NeMo / Blackwell), Nemotron 3 je velmi dobrý kandidát na experiment,
- pro **Hiran v2.1 coding agenta** zatím vede `Qwen2.5-Coder-14B/32B`; Nemotron 3 testovat jako agentic reasoning fallback.

Verdikt: **Nemotron 3 zařadit do eval, ne rovnou jako hlavní lokální model.** Pokud vyhraje na ZION V3 eval suite (Rust patching, CLI orchestration, RAG grounded odpovědi), povýšíme ho.

### Fáze E — obecné znalosti vs. ZION specializace

Hiran v2.1 má mít **všeobecné znalosti**, ale nesmí se je učit primárně z našeho datasetu. Ten má učit ZION, V3, Rust a orchestration. Obecná inteligence musí přijít z dobrého base modelu.

Princip:

- **base model** = obecné znalosti, programování, reasoning, čeština/angličtina,
- **SFT / LoRA** = ZION V3 identita, přesné cesty, Rust workspace, `zion` CLI, AI Native,
- **RAG** = aktuální dokumentace, živý stav sítě, nové změny po tréninku,
- **RAG (rozšířeně)** = kurátorované korpusy z oddílu 3.6 (vědy, dějiny, texty, projektová biblioteka) **a herní kanon + UE5 zápisy z oddílu 3.7** — **ne** masové „dostahování” do vah,
- **DPO** = styl: přesnost, méně halucinací, bezpečný operátorský postup.

Do datasetu tedy nepatří generické otázky typu „co je HTTP“ nebo „co je Rust ownership“, pokud nejsou navázané na ZION. Lepší příklad je: „Jak se ownership projeví při úpravě mempoolu v `V3/L1/core`?“

---

## 4.1 Lokální stroj — GPU a model sizing

Chceme model, který poběží lokálně rychle, nebude stát high-end peníze a pořád bude použitelný jako programovací agent.

### Doporučení podle VRAM

| GPU třída | VRAM | Co čekat | Doporučený lokální model |
|---|---:|---|---|
| RTX 5060 Ti 16GB | 16 GB | levnější vstup, dobré pro 8B/14B quant | `Qwen2.5-Coder-7B/14B` Q4/Q5 + RAG |
| **RTX 5070** | **12 GB** | rychlá, ale VRAM limituje větší modely | 7B/8B Q5/Q6, 14B jen opatrně Q4 |
| **RTX 5070 Ti** | **16 GB** | nejlepší ne-high-end kompromis | 14B coder Q4/Q5, 8B Q8, solidní RAG |
| RTX 5080 | 16 GB | rychlejší 5070 Ti, pořád 16GB limit | 14B Q5, 32B Q3/Q4 experimentálně |
| RTX 5090 | 32 GB | high-end lokální agent | 32B Q4/Q5, 70B Q2/Q3 experimentálně |

### Verdikt pro nákup

Pokud nechceme high-end:

1. **RTX 5070 Ti 16GB** — nejlepší volba. Má dost VRAM pro 14B coder model a nebude tolik limitovat jako 12GB karta.
2. **RTX 5060 Ti 16GB** — rozumná budget volba, pokud je cena výrazně nižší. Pomalejší, ale 16GB VRAM je pro LLM důležitější než hrubý gaming výkon.
3. **RTX 5070 12GB** — dobrá karta, ale pro Hiran v2.1 bych ji bral jen tehdy, pokud je výrazně levná. 12GB bude častý limit.

Pro lokálního coding agenta je VRAM často důležitější než FPS výkon. Raději pomalejší **16GB** kartu než rychlejší **12GB** kartu.

### Doporučený lokální model stack

**První produkční lokální stack:**

- `Qwen2.5-Coder-14B-Instruct` v Q4_K_M / Q5_K_M pro Rust/programování,
- Hiran LoRA / ZION dataset, pokud bude kompatibilní s base modelem,
- RAG nad `V3/` přes lokální index,
- Ollama nebo llama.cpp server s OpenAI-compatible API.

**Lehčí fallback:**

- `Llama-3.1-8B-Instruct` / `Qwen2.5-Coder-7B-Instruct`,
- náš Hiran v2 LoRA/GGUF,
- rychlé odpovědi, web chat, nízká spotřeba.

**Těžký fallback mimo lokální stroj:**

- 32B/70B model na Vast/RunPod/reserved GPU,
- jen pro složité refaktory, dlouhé reasoning úlohy, DPO eval a dataset generation.

### Co z toho plyne

Pro Hiran v2.1 bych nekupoval jen podle názvu karty. Rozhodovací pravidlo:

- minimum: **12GB VRAM** pro 8B,
- praktické optimum mimo high-end: **16GB VRAM**,
- ideál pro lokální BestModel: **32GB VRAM**, pokud rozpočet dovolí,
- pro 70B nepoužívat consumer midrange; tam dává smysl cloud/reserved GPU.

### 2× RTX 5060 Ti 16GB a 70B kvantovaný „centrální mozek“

Krátká odpověď: **jako primární architektura pro pohodlný 70B inference ne — jako kompromis s výhradami částečně ano.**

**Proč:**

- Dvě karty **nesčítají VRAM pro jednu kopii vrstvy jako 32 GB volného RAM**, ale inference stack (llama.cpp / Ollama / TensorRT-LLM) **rozděluje váhy přes tensor / pipeline parallel**. Důležitý je **součet dostupné VRAM** na všech GPU pro daný model + KV cache.
- Typický **70B v rozumné kvantizaci (Q4_K / Q4_K_M)** má jen samotné váhy řádově **~40–44 GB** v GGUF; s KV cache a rozumným kontextem se často pohybuješ **nad ~38–48 GB** podle implementace a délky kontextu.
- **2× 16 GB = 32 GB celkem** — to je **pod** běžným komfortním rozsahem pro 70B Q4. Může to **někdy** jít jen s **agresivnější kvantizací** (Q3, IQ4/XS apod.), **kratším kontextem** a často s **částečným offloadem** částí modelu na CPU/RAM — což u 70B znamená **nižší rychlost** a vyšší citlivost na latenci RAM.

**Praktický verdikt pro Hiran v2.1:**

| Cíl | S 2× 5060 Ti 16GB |
|---|---|
| „Centrální mozek“ = **spolehlivý coding agent** (Rust, dlouhé soubory) | Spíš **14B–32B** v dobré kvantizaci + RAG; 70B jen jako **experiment** nebo fallback do cloudu. |
| 70B Q4 jako denní driver | **Nedoporučeno** — chybí ~8–12+ GB headroom proti typickému Q4 70B. |
| 70B silně zmenšená kvantizace + offload | **Technicky možné**, ale kvalita a rychlost často nesedí na roli hlavního orchestrátora. |

**Kdy dává smysl dvě střední karty jinak než kvůli 70B:**

- **32B třída** v Q4/Q5 na **32 GB** bývá reálnější než spokojený 70B,
- nebo **jedna karta s 24–32 GB** často zjednoduší software stack (méně NUMA/PCIe šílenství než nutně u ka všech desek).

**Shrnutí:** Dvě RTX 5060 Ti 16GB jsou rozumný **lokální střed** pro Hiran v2.1 v režimu **7B–14B (ideálně) až ~32B s kompromisy**, ne jako bezproblémový **70B Q4 centrální mozek**. Na 70B typicky potřebuješ **≥ ~40–48 GB efektivního GPU poolu** nebo akceptovat horší kvant / offload / cloud.

### Jetson Nano / Orin Nano jako „AI Raspberry Pi“

Upřesnění: když mluvíme o „NVIDIA nano jako RP5“, nejde primárně o samostatnou NPU, ale o **Jetson** mini počítače — ARM CPU + NVIDIA GPU/Tensor Cores + unified memory v malém boardu.

Nejzajímavější aktuální směr:

- **Jetson Orin Nano Super Developer Kit**,
- cca **8 GB LPDDR5 unified memory**,
- až cca **67 TOPS INT8**,
- nízká spotřeba v řádu jednotek až desítek wattů,
- NVMe disk silně doporučený,
- vhodné pro JetPack / CUDA / TensorRT / edge AI.

Co od toho realisticky čekat:

- skvělé pro malý lokální Hiran **edge node**,
- dobré pro embeddingy, RAG index, telemetry, hlas, senzory,
- použitelné pro malé LLM/SLM cca **1B–4B**, někdy menší 7B v agresivní kvantizaci,
- nečekat pohodlný 14B coding model jako na RTX 5070 Ti.

#### Role v ZION síti

Jetson Nano/Orin Nano může být:

- domácí **AI Native sentinel**,
- lokální RAG cache pro node,
- hlasové/terminálové rozhraní k Hiranovi,
- edge inference pro Medical Table / senzory,
- lehký agent pro monitoring `zion node`, poolu a Docker stacku,
- offline komunitní asistent s malým modelem,
- orchestrátor, který těžké otázky přeposílá na RTX stroj nebo cloud fallback.

#### Doporučená architektura s Jetsonem

```text
Jetson Orin Nano
  → always-on Hiran edge agent
  → embeddings / RAG cache / telemetry
  → malý model 1B–4B pro rychlé lokální odpovědi
  → router dotazů

RTX 5070 Ti / desktop GPU
  → hlavní Hiran v2.1 coding model (7B/14B)
  → Rust reasoning, patch planning, dlouhé odpovědi

Vast / reserved GPU
  → fine-tune, DPO, 32B/70B fallback
```

Verdikt: **Jetson Orin Nano Super je výborný doplněk k lokálnímu ZION node**, ale ne náhrada za desktop GPU pro hlavní Hiran v2.1 coding model.

### NPU / edge AI jednotky obecně

NPU myšlenka je správná, ale je potřeba rozlišit marketingové „AI TOPS“ od reálného LLM provozu.

U NVIDIA lokální AI dnes typicky nestojí na samostatné NPU jako v telefonech, ale na:

- **Tensor Cores v RTX GPU** — nejlepší poměr pro lokální LLM na PC,
- **Jetson / embedded platformách** — edge AI, senzory, robotika, nízká spotřeba,
- **DGX Spark / GB10** — desktop AI supercomputer s unified memory,
- **NIM / TensorRT-LLM / TensorRT for RTX** — optimalizační software pro lokální inference.

#### Kdy NPU/edge dává smysl

NPU/edge jednotka je vhodná pro:

- always-on lokální asistenci,
- wake-word / hlasové rozhraní,
- embeddingy pro RAG,
- klasifikaci dotazů,
- malé 1B–4B modely,
- senzory, robotiku, Medical Table, domácí node telemetry,
- nízkou spotřebu 24/7.

Není ideální jako hlavní mozek pro Hiran v2.1 coding agenta, pokud chceme 14B+ model a Rust reasoning. Tam pořád vede GPU s dost VRAM.

#### Možná architektura lokálního Hiran node

```text
NPU / edge akcelerátor
  → wake word, voice, embeddings, telemetry, router dotazů

RTX GPU
  → hlavní LLM inference: Hiran v2.1 / Qwen Coder / RAG reasoning

CPU + SSD
  → vector DB, repo index, logs, long-term memory

Cloud / Vast fallback
  → 32B/70B model pro těžké úlohy, fine-tune, eval, DPO
```

#### Doporučení

Pro Hiran v2.1 nekupovat NPU místo GPU. Lepší je:

1. **RTX 5070 Ti 16GB** jako hlavní lokální inference karta,
2. volitelně edge/NPU jednotka pro always-on služby a RAG embeddingy,
3. později DGX Spark / Jetson Thor styl platformy pro komunitní node, robotiku nebo Medical Table.

Pokud by se objevil levný desktop NPU s dobrým LLM runtime, 32GB+ sdílenou pamětí a podporou GGUF/ONNX/TensorRT-LLM, může být kandidát. Pro teď je ale bezpečnější stavět BestModel runtime na RTX Tensor Cores.

---

## 5. Eval sada pro v2.1

Model nesmí být hodnocen jen loss/perplexity. Potřebuje ZION-specific eval:

### Rust eval

- vysvětli konkrétní soubor ve `V3/L1/core/src`,
- navrhni opravu testu,
- napiš patch pro malou funkci,
- rozliš legacy `L1/` vs `V3/L1/`,
- doporuč správný cargo příkaz.

### Orchestrator eval

- node nejede → diagnostika přes `zion doctor`, `zion logs node`,
- pool rejectuje share → postup,
- bridge staging vs production config,
- Docker profile mainnet,
- rozdíl CLI update vs deploy update.

### AI Native eval

- co je HiranyagarbhaAgent,
- jak funguje Dharma validator,
- co je RAG v `V3/L3/ai-native`,
- kdy použít remote LLM backend,
- jaké jsou consciousness/XP hranice.

### Hallucination eval

Zakázat/penalizovat:

- vymyšlené porty,
- vymyšlené env vars,
- staré docker cesty jako primární,
- tvrzení, že legacy root je aktuální,
- tvrzení, že model má živá data bez RAG.

---

## 6. Deployment v2.1

### Runtime

- Ollama / OpenAI-compatible endpoint pro GGUF model,
- `zion-expert-v2` jako stabilní tag,
- později `hiran-v2.1` jako nový tag,
- web `/api/ai-chat` má používat nový system prompt a multi-turn historii,
- AI Native Rust backend má mít stejný model identity prompt.

### Produkce

- Vast spot je tréninková dílna, ne dlouhodobý domov,
- produkční inference má běžet na vlastním GPU nebo reserved hostu,
- model musí mít fallback na v1/v2 v případě výpadku,
- logovat model version, prompt version, dataset version.

### Artefakty

Každý release modelu musí mít:

- dataset hash,
- base model,
- LoRA config,
- epochs,
- eval výsledky,
- GGUF quant,
- Modelfile,
- smoke test odpovědi,
- deployment poznámky.

---

## 7. Známé gapy

- NCL inference backendy jsou podle roadmapy stále nedokončené / stubované.
- RAG architektura není sjednocená: plán mluví o Chroma/LlamaIndex, Rust crate má vlastní RAG.
- Dharma validator je zatím heuristický; agentické operace potřebují explicitní risk tiers a approval policy.

---

## 8. Roadmapa příprav

- [ ] Nahradit mock RAG embeddingy reálným backendem a zvolit persistentní vector store.
- [ ] Přidat RAG router `zion-tech` × `live-runtime` × `amenti` × `buddhism-*`.
- [ ] Převést eval scénáře na release gate.

### Další iterace

- [ ] Rozšířit dataset na 10k+ příkladů.
- [ ] Přidat multi-turn programovací konverzace.
- [ ] Přidat eval suite pro Rust/V3/CLI.
- [ ] Přidat DPO preference pairs.
- [ ] Sjednotit RAG plán: Rust RAG vs Python Chroma.
- [ ] Připravit `hiran-v2.1` Modelfile a release manifest.

### BestModel fáze

- [ ] Vyzkoušet coder base model (Qwen Coder rodina).
- [ ] Porovnat proti Llama instruct baseline.
- [ ] Změřit přesnost na ZION V3 eval suite.
- [ ] Nasadit nejlepší model jako `hiran-v2.1`.

---

## 9. Definice úspěchu

Hiran v2.1 je úspěšný, pokud:

- odpovídá správně na V3 architekturu,
- používá správné soubory a příkazy,
- umí pomoci s Rust změnou bez hallucination,
- navrhne bezpečný operátorský postup,
- rozlišuje aktuální V3 od legacy,
- při nejistotě řekne „nevím / potřebuji ověřit“,
- uvádí zdroje/citace pro technická fakta, live stav a korpusové odpovědi,
- má jasný action policy pro destruktivní/deploy/wallet/key kroky,
- projde eval release gate včetně hallucination, stale-data, legal/provenance a safety scénářů,
- loguje nebo vrací verzi modelu, promptu, datasetu a RAG indexu,
- funguje jako praktický coding agent pro ZION, ne jen jako filozofický chatbot.

---

*"Hiran v2.1 není jen větší odpověď. Je to schopnost jednat správně v živém ZION V3 systému."*
