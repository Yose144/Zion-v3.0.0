# 07 — Registr důkazů
## Jediná tabulka, která brání tomu, aby se technologická skutečnost, aktivní stavba, hypotéza a příběh smíchaly dohromady

> **Status:** Živý evidence registr.  
> **Pravidlo:** Tato stránka nepřepisuje kód, `StatusV3.md` ani release evidence. Jejím úkolem je ukazovat, co je doloženo, co vyžaduje důkaz a co se smí říkat jen jako horizont či mýtus.

---

## 1. Jak číst registr

| Sloupec | Význam |
|---|---|
| **Nárok** | Co by mohl čtenář pochopit jako tvrzení o projektu. |
| **Stav** | ŽIVÉ / STAVBA / HORIZONT / HYPOTÉZA / MÝTUS podle [`01-Kanon-a-Ustava.md`](./01-Kanon-a-Ustava.md). |
| **Důkaz či zdroj** | Konkrétní zdroj, ze kterého stav vychází. |
| **Co je stále nutné** | Co musí existovat, než se stav smí zvýšit. |

Dvě doplňkové registry značky nejsou stavy produktu: **NEDOLOŽENO** znamená, že v aktuálním corpus není dost evidence a tvrzení se nesmí používat jako fakt; **NEPLATNÝ NÁROK** znamená, že tvrzení odporuje dostupné evidenci nebo bezpečnostnímu/etickému rámci a nesmí se používat vůbec.

---

## 2. Aktuální evidence: L1 a provoz

| Nárok | Stav | Důkaz či zdroj | Co je stále nutné |
|---|---|---|---|
| V31 L1 chain, node, pool a základní provoz jsou aktivní. | **ŽIVÉ** | `StatusV3.md`; `V31/STATUS.md`; přímý live probe 2026-08-31. | Průběžné health evidence; čísla výšky se neberou staticky z marketingu. |
| Ekam Deeksha v3.2 je aktivní konsensus. | **ŽIVÉ** | `V31/L1/cosmic-harmony/src/algorithm/ekam_deeksha.rs`; `StatusV3.md`. | Regression/compatibility tests při každé změně konsensu. |
| LWMA-60 nastavuje cílový block time 60 s s ochrannými limity. | **ŽIVÉ** | `V31/L1/core/src/difficulty.rs`; `AGENTS.md`; `StatusV3.md`. | Živá observabilita, která odliší cílovou hodnotu od aktuálního průměru. |
| UTXO v2 wallet/CLI/SDK cesta funguje. | **ŽIVÉ** | `AGENTS.md` aktualizace 2026-08-22; `StatusV3.md`; `V31/L1/core/src/v3_tx.rs`. | Každý release musí mít E2E send/receive test bez secrets. |
| L1 HTLC lock → claim fungoval na Edge. | **ŽIVÉ** | `NATIVE_L1_HTLC_REPORT.md`; `StatusV3.md` update 2026-08-23. | Opakovatelný test refund / failure mode a release evidence. |
| Trinity mining je produkčně ověřen. | **ŽIVÉ** | `StatusV3.md`, `AGENTS.md`, rig E2E reports. | Oddělit GPU rig evidence od CPU-only Edge stavu v každé komunikaci. |
| 1% coinbase slot jde aktuálně automaticky node operátorům. | **STAVBA** | `V31/L1/core/src/v3_template.rs` má default `node_reward_activation_height = u64::MAX`; `AGENTS.md` popisuje post-activation design. | Konkrétní activation height, on-chain 4-output coinbase a node payout evidence. |
| Síť má stovky nezávislých veřejných node operátorů. | **NEDOLOŽENO** | Existují primary/follower nody a dokumentace, ale současný evidence corpus nedokládá počet stovek. | Veřejná, privacy-respecting node census s metodikou. |

---

## 3. Aktuální evidence: L2, ZIS a DEX

| Nárok | Stav | Důkaz či zdroj | Co je stále nutné |
|---|---|---|---|
| `warpd` / multichain služba a Base + ZION L1 pilot běží. | **ŽIVÉ** | `StatusV3.md`; `V31/STATUS.md`; `warp.example.toml`. | Monitorovat live config a vlastnictví klíčů bez zveřejnění tajemství. |
| Base ↔ ZION L1 bridge round-trip byl proveden. | **ŽIVÉ** | `V31/STATUS.md` update E4: lock → mint → burn → unlock. | Opakovatelný audit a monitoring validator/bridge state. |
| DEX quote/multi-quote API a webový widget fungují. | **ŽIVÉ** | `ZionDexZis.md` update 2026-08-29; `StatusV3.md`. | Nezaměňovat quote za settlement. |
| ZIS auth služba běží. | **ŽIVÉ** | `StatusV3.md`; `AGENTS.md`; ZIS `/health` probe. | Security/privacy testy pro každou změnu auth flow. |
| ZIS multichain deposit/ledger/withdraw path existuje v kódu. | **STAVBA** | `ZionDexZis.md`; `V31/L2/multichain/src/multichain_wallet/`; wallet endpoints. | Funded end-to-end deposit → swap → withdrawal test s on-chain receipts a rollbacky. |
| Skutečný settlement pro jakýkoliv user swap je kompletně hotový. | **STAVBA** | Code exists; test evidence dosud uvádí `insufficient balance` bez funded test wallet. | E2E test s financovaným testovacím účtem, reconciliation a independent review. |
| Nezávislá solver federace běží v produkci. | **STAVBA** | Intent/solver code a testy existují, ale `warp.example.toml` obsahuje `[solver] enabled = false`. | Samostatní solvers, live config, auth/availability test a incident policy. |
| Všechny EVM, Bitcoin, Lightning, Solana, SUI, Aptos a další chainy jsou podporované. | **HORIZONT** | `warp.example.toml` explicitně aktivuje jen `base` a `zion-l1`; další mají `disabled_reason`. | Samostatná evidence pro každý chain před tvrzením „supported“. |
| ZIS Passkeys/WebAuthn/Face ID/Touch ID/Windows Hello/YubiKey jsou funkční. | **HORIZONT** | Audit zdrojového stromu `APP&WEB/identity/src` nenašel WebAuthn/FIDO/passkey implementaci. | Standardní implementace, device/recovery threat model a E2E testy. |
| Zero-knowledge Dharma/reputation proofs existují. | **HORIZONT** | Nenalezen ZK circuit/proof systém. | Protokol, circuit, audit, privacy threat model a validátor. |

---

## 4. Aktuální evidence: L3 agenti a Hiran

| Nárok | Stav | Důkaz či zdroj | Co je stále nutné |
|---|---|---|---|
| Hiran/Hiranyagarbha framework, Maestro CLI a orchestration code existují. | **STAVBA** | `V31/L3/ai-native`; `docs/3.0.6/HIRAN_OVERVIEW.md`; `maestro.rs`. | Nasazený, sandboxovaný inference/runtime podle `05-Autonomie-a-Bezpecnost.md`. |
| Hiran v2.3 je natrénovaný model. | **STAVBA** | `HIRAN_OVERVIEW.md` uvádí Qwen3-32B Q5_K_M artefakt mimo Edge. | Redundantní bezpečné uložení, reproducibility metadata a inference deployment. |
| Hiran inference běží na Edge. | **NEDOLOŽENO** | `HIRAN_OVERVIEW.md` explicitně uvádí, že Edge nemá GGUF ani inference service. | Nasazení, health, ops/security evidence. |
| Dharma Validator je 7-principový model etiky. | **ŽIVÉ jako kód / STAVBA jako bezpečnostní garance** | `hiranyagarbha.rs` enum a unit tests; `validate_text` je keyword heuristic. | Kontextový classifier, red-team tests, policy enforcement mimo LLM a human oversight. |
| Amitábha/Amṛtabhoja natural-language executor a autonomní agenti řídí finance/produkci. | **HORIZONT** | `HIRAN_EVOLUTION_2.3_TO_2.5_AMATHABOJ.md` označuje v2.5 jako vizi; `05-Autonomie-a-Bezpecnost.md` zakazuje neřízené finance/produkci. | Celý agent safety gate M2/M3 z Exekuční charty. |
| AI je prokazatelně vědomá nebo má duchovní autoritu. | **NEPLATNÝ NÁROK** | Žádná ověřitelná metodika ani evidence. | Takové tvrzení se v canonu a veřejné komunikaci nepoužívá. |

---

## 5. Aktuální evidence: L4, L5 a L6

| Nárok | Stav | Důkaz či zdroj | Co je stále nutné |
|---|---|---|---|
| OASIS backend a samostatný web/provozní služba existují. | **ŽIVÉ** | `V31/L4/oasis`; `StatusV3.md`; live service matrix. | UX/security/privacy evidence pro každou veřejnou schopnost. |
| UE 5.7, Nanite, Lumen, MetaHuman, WebGPU nebo Pixel Streaming klient jsou hotové. | **HORIZONT** | L4 obsahuje Axum API; audit nenalezl skutečný UE/WebGPU/Pixel Streaming klient. | POC, licenční analýza, performance/accessibility/security tests. |
| Free World tracker/API a grant/project workflow existují. | **ŽIVÉ** | `V31/L5/free-world/src/api.rs`; `StatusV3.md`; `V31/STATUS.md`. | Public portal, evidence registry a real pilot impact review. |
| L5 už provozuje doloženou globální síť vody/permakultury. | **HORIZONT** | Code obsahuje records/workflow, nikoliv nezávisle ověřený globální portfolio. | Projektové impact packets a externí ověření. |
| Issobella tracker/API pro mission/research proposals existují. | **ŽIVÉ** | `V31/L6/issobella/src/api.rs`; `StatusV3.md`; `V31/STATUS.md`. | Transparentní DeSci publishing/review/reproduction workflow. |
| L6 má funkční quantum/warp motor, ZPE řešení nebo ověřenou antigravitaci. | **NEPLATNÝ NÁROK** | V kódu ani provozu neexistuje evidence takového zařízení; současný směr je výzkumný horizont. | Reprodukovatelné, nezávislé experimentální důkazy — bez nich se nesmí takový nárok vyslovit. |
| Alcubierre-Ekam, toroidální rezonance a related physics jsou legitimní výzkumné otázky. | **HYPOTÉZA** | `V33_NIRVANA_MASTER_PLAN.md` a Issobella materiály formulují záměr výzkumu. | Literatura review, metodika, open data, falsifikační kritéria a peer review. |

---

## 6. Reconciliation rozhodnutí pro starší 3.3 texty

Tato pravidla nevyžadují mazání předchozího kreativního materiálu. Znamenají, že jeho budoucí čtení se řídí následujícím:

1. Předchozí „canonical plan“ [`V33_NIRVANA_MASTER_PLAN.md`](../V33_NIRVANA_MASTER_PLAN.md) je **technický companion / zdroj práce**, zatímco `MiseAmenti/` je integrační canon a registr pravdy.
2. Všechny formulace „Passkeys“, „plný multichain“, „autonomní agenti“, „UE 5.7“, „WebGPU/Pixel Streaming“ a „quantum/warp engine“ se čtou jako **STAVBA/HORIZONT/HYPOTÉZA**, podle tabulek výše.
3. „Global Assimilation“ znamená pouze **dobrovolnou interoperabilitu a spolupráci**; nikdy ne imperativ, nábor nebo kulturní nadřazenost.
4. Příběhy `nirvana/` a `NirvanaCloud/` zůstávají hodnotnou narativní vrstvou, ale jejich „Kotva pravdy“ se při rozporu aktualizuje na základě tohoto registru.
5. Tokenomické tvrzení o 1 % se vždy doplní podmínkou activation height: **node reward až po aktivaci; jinak burn**.

---

## 7. Povinný důkazní balíček pro změnu stavu

| Přechod | Co musí být vloženo do changelogu / reportu |
|---|---|
| HORIZONT → STAVBA | Design/issue, explicitní owner, threat model, test plán, skutečný kód nebo POC. |
| STAVBA → ŽIVÉ | Commit/tag, test result, deployment evidence, health/E2E evidence, known limitations a rollback plan. |
| HYPOTÉZA → podpořená hypotéza | Metodika, data, reprodukce alespoň nezávislým reviewerem a popis negativních výsledků. |
| ŽIVÉ → omezené/disabled | Incident či změna konfigurace se zveřejní rychleji než marketingová oprava; registry se aktualizuje okamžitě. |

---

*[Zpět na index Mise Amenti → `README.md`](./README.md)*
