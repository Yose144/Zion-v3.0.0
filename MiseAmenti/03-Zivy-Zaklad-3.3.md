# 03 — Živý základ 3.3
## Věcný baseline L1–L6: co skutečně běží, co se staví a co je pouze horizont

> **Snapshot:** 2026-08-31.  
> **Pravidlo aktualizace:** Tento dokument je kurátorovaný rozcestník, ne live telemetry. Při každém rozporu platí [`StatusV3.md`](../StatusV3.md), [`V31/STATUS.md`](../V31/STATUS.md), on-chain data a aktuální kód.  
> **Verzovací poznámka:** V tomto canon se „3.3 Nirvana“ používá jako plánovací název. Běžící workspace/protocol metadata mají vlastní zdroje pravdy a nesmí se přepisovat narativem.

---

## 1. Proč tento baseline existuje

Kanon bez skutečného baseline se změní v přání. Tento dokument proto nevypisuje pouze ambice 3.3; zapisuje, **od čeho se skutečně odrážíme**. Každá vrstva je rozdělena na:

- **ŽIVÉ** — nasazeno nebo doloženo aktuálními provozními či E2E záznamy;
- **STAVBA** — existuje kód, plán, test nebo aktivní implementace, ale ne produkční důkaz všech deklarovaných vlastností;
- **HORIZONT** — legitimní dlouhodobý směr bez nároku, že je k dispozici dnes;
- **HYPOTÉZA** — výzkumné tvrzení, které může být zcela vyvráceno.

---

## 2. Souhrn L1–L6

| Vrstva | ŽIVÉ | STAVBA | HORIZONT / HYPOTÉZA |
|---|---|---|---|
| **L1 Core** | V31 node/pool/miner, nativní UTXO v2, Ekam Deeksha v3.2, LWMA-60, HTLC a veřejný chain. | Node reward model 1% — kód existuje, aktivace je konfigurací a musí se ověřit na živé síti. | Další konsensuální evoluce až po řádném governance a bezpečnostním procesu. |
| **L2 Multichain & ZIS** | `warpd`, Base + ZION L1 pilot, Base↔ZION E2E bridge round-trip, quote API, ZIS health/session služba. | ZIS-backed wallet, deposit/ledger/withdraw, plně financovaný deposit→swap→withdraw E2E, nezávislá solver síť. | Passkeys/WebAuthn, další EVM sítě, BTC/Lightning a non-EVM chainy — dokud nejsou nasazeny a ověřeny, nejsou „podporované“. |
| **L3 Hiranyagarbha** | `zion-ai-native`, Maestro CLI/orchestration code, health polling, Dharma Validator jako testovaná pomocná logika. | Nasazení Hiran v2.3 inference, propojení s 2.4 Maestro, NCL broker a bezpečný tool runtime. | v2.5 Amitábha/Amṛtabhoja interface a autonomní agenti s omezeným jednáním; žádný autonomní financující nebo produkční agent dnes není kanonicky live. |
| **L4 OASIS** | Rust/Axum backend a samostatný OASIS web/provozní služba. | Veřejný web preview, uživatelské spojení s L1/L2 a prověřený asset pipeline. | UE 5.7 klient, Nanite/Lumen/MetaHuman, WebGPU renderer a Pixel Streaming. |
| **L5 Free World** | Coinbase tracker, API, databázové grant/project workflow a služba na Edge. | Důvěryhodné veřejné UI, projektový katalog, evidence dopadu, grant review a governance UX. | Globální síť projektů pro vodu/půdu/energii; žádný konkrétní dopad se nesmí vydávat za ověřený bez nezávislého reportu. |
| **L6 Issobella** | Coinbase tracker, mission/research proposal API a služba na Edge. | Transparentní DeSci workflow, peer review, open data a reprodukovatelné simulace. | Orbitální program je dlouhý horizont; kvantový/warp motor je hypotéza, nikoli technologie nebo finanční slib. |

---

## 3. L1 — Ararat: co drží archu

### ŽIVÉ

- V31 L1 provozuje uzly, veřejný pool a CPU-only miner na Edge; v rámci přímé kontroly 2026-08-31 node RPC odpovídalo zdravě a chain měl **23 000+ bloků**. Aktuální počet se vždy ověřuje přes `getStatus`, ne z této stránky.
- **Ekam Deeksha v3.2** je aktivní konsensus: 512 KiB scratchpad, dva AES průchody, 128 náhodných čtení a Keccak256 finální hash — viz `V31/L1/cosmic-harmony/src/algorithm/ekam_deeksha.rs`.
- **LWMA-60** má cílový block time 60 s a ochrany proti extrémnímu výkyvu doby řešení — viz `V31/L1/core/src/difficulty.rs`.
- **Nativní UTXO v2** používá length-prefixed BLAKE3 domain tag `ZION_TX_V2\0`; wallet SDK a CLI odesílají přes `submitUtxoTransaction`.
- **L1 HTLC lock → claim** má doložený live E2E report a core obsahuje lock/claim/refund validační testy.
- Trinity mining je doložen na referenčních GPU rigech; Edge samotný zůstává CPU-only, protože nemá produkční GPU.

### Důležitá tokenomická přesnost

Emisní konstanty jsou **89 % miner / 5 % humanitarian / 5 % Issobella / 1 % pool-fee slot**. Aktuální design umožňuje, aby se poslední 1 % **po aktivaci `node_reward_activation_height`** mintovalo do node-reward poolu; **před aktivací je tento podíl burned**. Není poctivé tvrdit, že node reward už je aktivní, dokud to nepotvrdí konkrétní aktivní konfigurace a on-chain coinbase výstupy.

### STAVBA

- Node rewards: registrace, heartbeat, scoring a payout code existují; vyžadují zvláštní testnet/mainnet activation evidence.
- Další změna konsensu vyžaduje bezpečnostní review, testy, explicitní upgrade plán a rovněž „bardo guide“ pro operátory — nikdy marketingový nátlak.

---

## 4. L2 — Mosty mají nejpřísnější důkazní laťku

### ŽIVÉ

- `zion-v31-multichain` / `warpd` má health endpoint a provozní instanci.
- **Base + ZION L1** jsou aktuální WARP pilot: E2E report pro 100 ZION lock → 100 wZION mint na Base → burn → L1 unlock je uveden ve `V31/STATUS.md`.
- DEX quote API (`/v1/swap/quote`, `/v1/swap/quote/multi`) a webový widget jsou nasazené; neautorizovaný live quote je ověřený.
- ZIS běží na `auth.zionterranova.com`; health endpoint a session integrace mezi webem a L2 jsou doložené.

### STAVBA

- `ZionDexZis.md` uvádí Fáze 0–7 (wallet derivace, deposit watchery, ledger, execution/withdraw paths) jako implementované v `main`, ale **plnohodnotný finančně podložený E2E deposit → swap → withdraw** vyžaduje následný reálný test s fundingem a evidence settlementu. `insufficient balance` je správné bezpečnostní odmítnutí, nikoli důkaz settlementu.
- Intent/solver architektura a auth existují, ale produkční nezávislá solver federace se nesmí označovat za živou, pokud je ve runtime konfiguraci vypnutá.
- Custodial vs. non-custodial rozhraní musí být pro uživatele jasně označeno. Žádný produkt nesmí zakrývat, kdo spravuje klíče nebo jak funguje recovery.

### HORIZONT

- `warp.example.toml` má dnes aktivní pouze `base` a `zion-l1`; Arbitrum, Optimism, Polygon, Bitcoin, Solana, SUI, Aptos, Lightning a další jsou explicitně disabled s `disabled_reason`.
- **Passkeys/WebAuthn, Face ID/Touch ID/Windows Hello a YubiKey integrace nejsou nalezeny v aktuálním ZIS zdrojovém stromu.** Jsou legitimním workstreamem 3.3, ale nikoli současnou funkcí.
- Zero-knowledge reputation/Dharma proofs jsou výzkumný cíl bez existujícího circuit/proof systému.

---

## 5. L3 — Hiranyagarbha: pomocník, ne autorita

### ŽIVÉ

- `zion-ai-native` obsahuje Hiran/Hiranyagarbha model, Maestro CLI, task graph, tool registry, message bus, health polling, RAG/memory abstractions a rozsáhlé unit testy.
- `DharmaValidator` existuje jako **heuristická keyword-based kontrola** a testy čistého, škodlivého a manipulativního textu. Je to užitečná zábrana, ale **není důkazem, že AI dokáže vyřešit etiku, kontext nebo bezpečnost**.

### STAVBA

- Hiran v2.3 je natrénovaný modelový artefakt uložený mimo Edge; `docs/3.0.6/HIRAN_OVERVIEW.md` explicitně uvádí, že na Edge není GGUF model ani inference služba.
- Hiran v2.4 Maestro je MVP orchestration code. K produkčnímu použití potřebuje sandboxované nástroje, audit log, důvěryhodnou inference infrastrukturu, load/security tests a lidský approval model.
- NCL crate a související schedulery existují; live marketplace nebo on-chain odměny pro AI práci doloženy nejsou.

### HORIZONT

- Hiran v2.5 **Amṛtabhoja** a jeho veřejná narativní tvář „Amitábha“ jsou vývojová vize pro přirozené intent rozhraní a omezené agenty. Jakýkoliv budoucí agent může fungovat jedině podle [`05-Autonomie-a-Bezpecnost.md`](./05-Autonomie-a-Bezpecnost.md).

---

## 6. L4–L6 — svět, péče a výzkum

### L4 OASIS

**ŽIVÉ:** backend `zion-oasis` a OASIS web se v provozních zdrojích uvádějí jako aktivní.  
**STAVBA:** UX, příběh, avatary, marketplace propojení a web preview vyžadují samostatná E2E kritéria.  
**HORIZONT:** Unreal Engine 5.7, Nanite, Lumen, MetaHuman, WebGPU a Pixel Streaming nejsou v současném stromu implementovány. Jediný odkaz „UE5 client“ v API dokumentaci není důkazem klienta.

### L5 Free World

**ŽIVÉ:** daemon skenuje L1 coinbase, API obsahuje granty, projekty, stav fondu a DAO submission workflow.  
**STAVBA:** veřejně srozumitelný portal, mapy, review, audity příjemců, reporting výsledků.  
**HORIZONT:** globální síť humanitárních programů; samostatný projekt může být prezentován jako „ověřený dopad“ až s veřejným rozpočtem, příjemcem, on-chain souvislostí a nezávislým výsledkovým reportem.

### L6 Issobella

**ŽIVÉ:** daemon skenuje coinbase, API eviduje mission a research proposal workflow.  
**STAVBA:** DeSci publikační pravidla, otevřená data, peer-review, replikace simulací a transparentní grantové rozhodování.  
**HORIZONT / HYPOTÉZA:** kosmický výzkum, orbitální observatoř a kvalifikované fyzikální experimenty. Návrhy kolem Alcubierre metrik, toroidálních polí, ZPE nebo „quantum/warp engine“ jsou **výzkumné hypotézy** a nesmí být vydávány za ověřené mechanismy, funkční motory nebo řešení energie.

---

## 7. Výchozí závazek pro 3.3

V3.3 nezačíná přidáním dalších velkých slov. Začíná tím, že každý horizont dostane:

1. **vlastní boundary** — co není hotové;
2. **vlastní evidence** — jak se pozná, že hotové je;
3. **vlastní bezpečnostní model** — co se nemůže stát bez souhlasu;
4. **vlastní lidskou hodnotu** — komu a jak konkrétně slouží;
5. **vlastní možnost přiznat neúspěch** — protože hypotéza, kterou nejde vyvrátit, není věda ani dobré inženýrství.

Praktický překlad tohoto závazku je v [`04-Exekucni-Charta-3.3.md`](./04-Exekucni-Charta-3.3.md).

---

*[Zpět na index Mise Amenti → `README.md`](./README.md)*
