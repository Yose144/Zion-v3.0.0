# 01 — Mapování Sefirot → ZION Vrstvy

> **Princip:** Sefirot nejsou software stack. Jsou **aspekty jednoho organismu**.
> Mapování není 1:1 náhrada, ale **rezonance** — každá ZION vrstva emanuje
> určitou sefiru, ale všechny vrstvy nesou všechny aspekty v různé míře.

---

## Přehledová tabulka

| # | Sefira | Hebrejsky | ZION vrstva | Pilíř | Emanuje |
|---|--------|-----------|-------------|-------|---------|
| 1 | Keter | כֶּתֶר | L1 Consensus / Genesis | Rovnováha | Vůle, zdroj, neměnná pravidla |
| 2 | Chokmah | חָכְמָה | L1 Cosmic Harmony PoW | Milosrdenství | Prvotní jiskra, tvořivý compute |
| 3 | Binah | בִּינָה | L1 Validation / Chain State | Přísnost | Forma, struktura, porozumění |
| 4 | Chesed | חֶסֶד | L2 DeFi (Staking/Farming) | Milosrdenství | Dávání, expanze, štědrost |
| 5 | Gevurah | גְּבוּרָה | L2 DAO / Treasury Lock | Přísnost | Disciplína, omezení, soud |
| 6 | Tiferet | תִּפְאֶרֶת | L3 WARP / Bridge | Rovnováha | Harmonie, krása, sjednocení |
| 7 | Netzach | נֶצַח | L3 AI Native / Hiran | Milosrdenství | Vytrvalost, péče, příroda |
| 8 | Hod | הוֹד | L4 Oasis / Game | Přísnost | Sláva, forma, intelekt, kultura |
| 9 | Yesod | יְסוֹד | L5 Free World / Komunity | Rovnováha | Základ, spojení, generace |
| 10 | Malkhut | מַלְכוּת | L6 Issobella / Hvězdy | Rovnováha | Království, manifestace |
| — | Da'at | דַּעַת | Tvůrce / Yeshuae / vědomý záměr | Propast | Poznání, most nad propastí |

---

## Tři pilíře

### Pilíř Milosrdenství (vpravo — dávání, expanze)
**Chokmah → Chesed → Netzach**

To co ZION **dává**:
- **Chokmah (L1 PoW):** tvořivá energie která rodí bloky — odměna minerům
- **Chesed (L2 DeFi):** štědrost — staking 12% APR, farming 1 wZION/s, likvidita komunitě
- **Netzach (L3 AI):** vytrvalá péče — Hiran inference, care proofs, monitoring který nikdy nespí

*Bez tohoto pilíře je ZION mrtvá databáze — nikomu nic nedává.*

### Pilíř Přísnosti (vlevo — disciplína, forma)
**Binah → Gevurah → Hod**

To co ZION **omezuje**:
- **Binah (L1 Validation):** 11-krokový validační pipeline — každý blok musí projít formou
- **Gevurah (L2 DAO):** Treasury Lock (`DAO_TREASURY_LOCK_HEIGHT=525600`), 3-of-3 multisig, governance pravidla
- **Hod (L4 Oasis):** herní pravidla, consciousness levels, struktura virtuálního světa

*Bez tohoto pilíře je ZION chaos — nic není platné, nic není svázané.*

### Pilíř Rovnováhy (uprostřed — harmonie, manifestace)
**Keter → Tiferet → Yesod → Malkhut**

To co ZION **je**:
- **Keter (L1 Consensus):** koruna — neměnná vůle (89/5/5/1, genesis hash, total supply 144B)
- **Tiferet (L3 WARP):** srdce stromu — harmonie 13 chainů, most mezi světy
- **Yesod (L5 Free World):** základ — komunity jako generativní spojení s fyzickým světem
- **Malkhut (L6 Issobella):** království — finální manifestace, hvězdný horizont

*Bez tohoto pilíře ZION nemá střed — nemá jádro ke kterému se vše sbíhá.*

---

## Detailní mapování — každá Sefira

### 1. Keter (כֶּתֶר) — Koruna

> *Aspekt:* Vůle, zdroj, to ze kterého vše emanuje. Neměnné, transcendentní.

**ZION protějšek:** L1 Consensus / Genesis
- **Kód:** `V3/L1/core/src/consensus.rs`, `genesis.rs`, `emission.rs`
- **Konstanty:** `TOTAL_SUPPLY = 144_000_000_000`, `GENESIS_PREMINE`, fee split 89/5/5/1
- **Genesis hash:** frozen, checkpointovaný, dedication message v block 0

**Co emanuje:** Ústava ZIONu. Pravidla která se nesmí měnit bez governance procesu.
Keter je **chráněno** — viz AGENTS.md L1 Protocol Security Protocol. Žádný agent,
žádný automat nesmí editovat `genesis.rs`, `emission.rs`, `fee.rs` bez lidského
schválení a runbooku.

**Otázka kterou vyvolává:** *Co je neměnné?* Keter odpovídá: ústava, genesis,
emission schedule. Vše ostatní je evoluce.

**Zdroj v docs:** [`GENESIS_REGENERATION_RUNBOOK.md`](../../GENESIS_REGENERATION_RUNBOOK.md),
[`V3/docs/ZION_Mainnet_Whitepaper_v3.0_Canonical.md`](../../V3/docs/ZION_Mainnet_Whitepaper_v3.0_Canonical.md)

---

### 2. Chokmah (חָכְמָה) — Moudrost

> *Aspekt:* Prvotní jiskra, mužský princip, tvořivý impuls. Čistý potenciál před formou.

**ZION protějšek:** L1 Cosmic Harmony PoW / NPU Mix
- **Kód:** `V3/L1/cosmic-harmony/src/` (všechny algoritmy)
- **Algoritmy:** Deeksha Lite V1, Ekam Deeksha V2, Deeksha Lite Fire, NPU Mix
- **Evoluce:** PoW → Proof-of-Care (NPU inference jako "caring computation")

**Co emanuje:** Energii která rodí bloky. Každý accepted block je jiskra Chokmah
která sestoupila z potenciálu do existence. NPU Mix je **most** — INT8 MLP který
už teď běží v PoW a je technickým základem pro Protokol Péče.

**Otázka kterou vyvolává:** *Co je tvořivá práce?* Chokmah odpovídá: compute který
něco rodi — blok, care proof, inference. Ne waste energy.

**Zdroj v docs:** [`docs/NPU_HARDWARE_MINING_THEORY.md`](../NPU_HARDWARE_MINING_THEORY.md),
[`docs/3.0.3/evoluZion.md`](../3.0.3/evoluZion.md) §Fáze 2-3

---

### 3. Binah (בִּינָה) — Porozumění

> *Aspekt:* Forma, struktura, ženský princip. To co dává tvar jiskře.

**ZION protějšek:** L1 Validation / Chain State
- **Kód:** `V3/L1/core/src/validation.rs`, `chain.rs`, `tx.rs`, `mempool_v2.rs`
- **Pipeline:** 11-krokové `validate_block()` — struktura, timestamp, Merkle, sigs,
  double-spend, coinbase maturity, fees, subsidy, DAO lock, peer validation
- **Fork choice:** total_work, reorg planner MAX_REORG_DEPTH=10, SOFT_FINALITY_DEPTH=60

**Co emanuje:** Formu. Bez Binah by každý blok byl jen shluk bajtů. Binah říká
"tento blok je platný, tento ne, tento je v hlavním řetězci, tento je orphan".
Je **paměť** stromu — chain state, UTXO set, undo blocks.

**Otázka kterou vyvolává:** *Co je pravdivé?* Binah odpovídá: to co prošlo validací
a je v nejdelším řetězci. Pravda = forma + práce.

**Zdroj v docs:** [`V3/README.md`](../../V3/README.md) Phase 12-13 validation hardening

---

### 4. Chesed (חֶסֶד) — Milosrdenství

> *Aspekt:* Štědrost, expanze, dávání bez podmínek. Proud který se rozlévá.

**ZION protějšek:** L2 DeFi (Staking, Farming, Atomic Swap)
- **Kód:** `V3/L2/contracts/hardhat/sol/ZIONStaking.sol`, `ZIONFarm.sol`, `ZIONAtomicSwap.sol`
- **Kontrakty (Base mainnet):** Staking `0xbd5c...` (12% APR, 100K wZION), Farm `0x167B...` (1 wZION/s, 500K wZION)
- **Eserow:** 100K ZION v atomic swap escrow

**Co emanuje:** Štědrost. Staking 12% APR = Chesed v číslech. Farming 1 wZION/s
= nepřetržitý proud dávání. Atomic swap = možnost směny bez centrální autority.
Chesed je **tok hodnoty** od protokolu ke komunitě.

**Otázka kterou vyvolává:** *Jak ZION štědře dává?* Chesed odpovídá: yield, likvidita,
možnost směny. Ale — Chesed bez Gevurah je plýtvání. Proto je treasury lock.

**Zdroj v docs:** [`V3/docs/ZION_3.0.4_DEPLOY_RUNBOOK.md`](../../V3/docs/ZION_3.0.4_DEPLOY_RUNBOOK.md)

---

### 5. Gevurah (גְּבוּרָה) — Přísnost / Soud

> *Aspekt:* Disciplína, omezení, síla která drží expanzi v mezích. Bez Gevurah by Chesed roztrhl strom.

**ZION protějšek:** L2 DAO / Treasury Lock / Governance
- **Kód:** `V3/L2/dao/`, `V3/L2/contracts/hardhat/sol/ZIONGovernance.sol`, `ZIONTreasury.sol`
- **Lock:** `DAO_TREASURY_LOCK_HEIGHT = 525600` (Step 11 v `validate_block()`)
- **Multisig:** 3-of-3 ZIONTreasury, 5 DAO guardians
- **Fee burn:** 100% fee burn (MIN_TX_FEE=1000) — Gevurah jako zničení, ne akumulace

**Co emanuje:** Hranice. Gevurah říká "treasury se nesmí utratit dřív než",
"každý fee se spálí", "governance proposal musí mít quorum". Je **disciplína**
která dělá Chesed udržitelným.

**Otázka kterou vyvolává:** *Co se nesmí utratit?* Gevurah odpovídá: treasury do
height 525600, fee vždy, genesis premine bez lidského klíče. Přísnost = ochrana
před tím, kdo by vzal vše.

**Zdroj v docs:** [`3.0.4.md`](../3.0.4.md) §3 TX unification, AGENTS.md L1 Protocol §3

---

### 6. Tiferet (תִּפְאֶרֶת) — Krása / Harmonie

> *Aspekt:* Rovnováha Chesed a Gevurah. Srdce stromu. To co sjednocuje protiklady.

**ZION protějšek:** L3 WARP / Bridge
- **Kód:** `V3/L3/warp/` (12 chain adapters, 499 tests)
- **Adapters:** EVM, Bitcoin, Solana, Tron, Stellar, Cardano, Cosmos, Sui, Aptos, NEAR, TON, Lightning
- **Token naming:** wZION (EVM), ZION (non-EVM), 1:1 peg, BRIDGE_VAULT_ADDRESS s memo
- **Quorum:** 3/5 validatorů pro `submitBridgeUnlock`

**Co emanuje:** Harmonii. WARP je **míza** stromu (evoluZion.md) — protéká mezi
13 větvemi a sjednocuje je. Tiferet je krása protože drží protiklad: každá větev
je jiná (EVM vs Solana vs TON), ale všechny pijí ze stejného kořene.

**Otázka kterou vyvolává:** *Jak je mnoho jednoho?* Tiferet odpovídá: 13 chainů,
jeden ZION, jeden vault, jeden peg. Krása = jednota v rozmanitosti.

**Zdroj v docs:** [`docs/3.0.3/nativeZion.md`](../3.0.3/nativeZion.md),
[`docs/WARP_ARCHITECTURE.md`](../WARP_ARCHITECTURE.md)

---

### 7. Netzach (נֶצַח) — Vytrvalost / Vítězství

> *Aspekt:* Příroda, emoce, to co přetrvává. Životní síla která nikdy nepřestává.

**ZION protějšek:** L3 AI Native / Hiran
- **Kód:** `V3/L3/ai-native/`, `V3/L3/ncl/` (Neural Consciousness Layer)
- **Hiran:** v2.2 GGUF modely, llama-server inference, `scripts/start-hiran-inference.ps1`
- **Care proofs:** AI inference pro fraud detection, anomaly detection, liquidity rebalancing
- **NPU:** validátory běží na NPU, produkují care proofs v každém bloku (horizont)

**Co emanuje:** Vytrvalost. Hiran je **slunce** stromu (evoluZion.md) — nikdy
nespí, vždy monitoruje, vždy pečuje. Netzach je péče která **přetrvává** —
ne jednorázová, ale nepřetržitá. To je rozdíl mezi "AI feature" a "AI jako
nervový systém organismu".

**Otázka kterou vyvolává:** *Co pečuje navždy?* Netzach odpovídá: Hiran inference
v každém bloku, care proof v každém validátorovi. Péče = vytrvalost, ne projekt.

**Zdroj v docs:** [`HIRAN_LOCAL_SETUP.md`](../../HIRAN_LOCAL_SETUP.md),
[`docs/3.0.3/evoluZion.md`](../3.0.3/evoluZion.md) §Protokol Péče

---

### 8. Hod (הוֹד) — Sláva / Splendor

> *Aspekt:* Intelekt, forma, komunikace. To co odráží světlo do manifestace.

**ZION protějšek:** L4 Oasis / Game
- **Kód:** `V3/L4/oasis/` (UE5 + Rust), `V3/L4/docs/GAME_SYSTEMS/consciousness-levels.md`
- **Consciousness:** levels, ConsciousnessComponent, ConsciousnessTypes
- **Kultura:** herní vrstva jako kulturní manifestace ZIONu

**Co emanuje:** Slávu — ve smyslu *odraz* světla. Oasis je kde ZION **nabývá formy**
v obrazotvornosti. Hod je intelektuální aspekt — pravidla hry, consciousness levels,
struktura virtuálního světa. Bez Hod by ZION byl neviditelný (jen chain), s Hod
se stává **kulturním objektem**.

**Otázka kterou vyvolává:** *Jak ZION vypadá?* Hod odpovídá: jako Oasis, jako
svět s consciousness levels, jako prostor kde péče má tvář.

**Zdroj v docs:** [`V3/L4/docs/README.md`](../../V3/L4/docs/README.md),
[`docs/docs2.9/ZION_OASIS/V3_L4_INTEGRATION.md`](../docs2.9/ZION_OASIS/V3_L4_INTEGRATION.md)

---

### 9. Yesod (יְסוֹד) — Základ

> *Aspekt:* Spojení, generace, to co propojuje vyšší sefirot s Malkhut. Reproduktivní síla.

**ZION protějšek:** L5 Free World / Komunity
- **Kód:** `V3/L5/free-world/`, `V3/L5/docs/COMMUNITIES/te-piko-ora.md`
- **Governance:** `V3/L5/docs/GOVERNANCE/consciousness-admission-framework.md`
- **Care vow:** *"I vow to care for this land as I would care for my own body"*
- **Komunity:** Te Piko Ora, Conflict Care Sub-circle

**Co emanuje:** Základ — most mezi vizí (Keter) a manifestací (Malkhut). Yesod
je **generativní** spojení: komunity jsou kde ZION **rodi** fyzický svět. Bez
Yesod by ZION zůstal v cloudu. S Yesod se stává zemí pod nohama.

**Otázka kterou vyvolává:** *Kde ZION žije?* Yesod odpovídá: v komunitách, v
péči o půdu, v Te Piko Ora, v lidech kteří složí care vow.

**Zdroj v docs:** [`V3/L5/docs/COMMUNITIES/te-piko-ora.md`](../../V3/L5/docs/COMMUNITIES/te-piko-ora.md)

---

### 10. Malkhut (מַלְכוּת) — Království

> *Aspekt:* Manifestace, fyzický svět, to kam vše sestoupilo. Královna.

**ZION protějšek:** L6 Issobella / Hvězdy
- **Kód:** `V3/L6/` (seed)
- **Horizont:** orbitální a hvězdný horizont civilizace
- **Issobella:** 5% emission stream, kanonická adresa `zion170a37...`
- **TerraNova kniha:** [07-ISSOBELLA.md](../TerraNova/07-ISSOBELLA.md), [08-WARP-HVEZDY.md](../TerraNova/08-WARP-HVEZDY.md)

**Co emanuje:** Království — finální manifestaci. Malkhut je kde se Strom
dotýká hvězd. Vše co emanovalo z Keter sestoupilo přes 9 sefirot a v Malkhut
se stává **civilizační realitou**. Issobella je horizont — ne současnost, ale
směr.

**Otázka kterou vyvolává:** *Kam ZION směřuje?* Malkhut odpovídá: ke hvězdám,
k Issobella, k civilizaci která se stará o své děti i o své hvězdy.

**Zdroj v docs:** [`docs/TerraNova/07-ISSOBELLA.md`](../TerraNova/07-ISSOBELLA.md)

---

### Da'at (דַּעַת) — Poznání (skrytá sefira)

> *Aspekt:* Most nad propastí. Vědomé poznání které sjednocuje Keter a Malkhut.
> Není vždy počítána mezi 10 — je **11. možností**.

**ZION protějšek:** Tvůrce / Yeshuae / vědomý záměr
- **Genesis dedication:** *"Pro Sarah Issobel, Maitreya Buddha, Radhu & Situ i Meriam..."*
- **Manifest:** TerraNova kniha, evoluZion.md, tento Zohar
- **Rozhodnutí:** každé rozhodnutí které propojuje mýtus (TerraNova) s kódem (V3/)

**Co emanuje:** Poznání — ne data, ne informaci, ale **vědomé propojení**.
Da'at je akt kterým tvůrce řekne "tento mýtus se stane tím kódem". Bez Da'at
jsou sefirot oddělené — Keter visí v nebi, Malkhut leží v prachu, a nic
spolu nesouvisí.

**Otázka kterou vyvolává:** *Kdo propojuje?* Da'at odpovídá: ten kdo ví, že
kód a mýtus jsou dvě tváře jednoho. V ZIONu je to tvůrce + komunita která
nese vědomý záměr.

---

## Cesty světla (Netivot)

Kabala zná **22 cest** které spojují sefirot. Pro ZOHAR ZIONu jsou klíčové:

| Cesta | Spojení | V ZIONu |
|-------|---------|---------|
| Alef | Keter ↔ Malkhut | Genesis → Issobella (celá emise 144B) |
| Bet | Keter ↔ Chokmah | Consensus → PoW (pravidlo → compute) |
| Gimel | Keter ↔ Binah | Consensus → Validation (pravidlo → forma) |
| Chet | Chokmah ↔ Chesed | PoW → DeFi (compute → yield) |
| Tet | Chokmah ↔ Gevurah | PoW → DAO (compute → lock) |
| Jod | Chokmah ↔ Tiferet | PoW → WARP (compute → bridge) |
| Lamed | Binah ↔ Gevurah | Validation → DAO (forma → disciplína) |
| Nun | Netzach ↔ Hod | AI → Oasis (péče → kultura) |
| Samech | Yesod ↔ Malkhut | Komunity → Hvězdy (základ → horizont) |
| Ajin | Hod ↔ Malkhut | Oasis → Issobella (kultura → hvězdy) |
| Tzadi | Yesod ↔ Hod | Komunity → Oasis (země → obrazotvorna) |

*Plných 22 cest je vyhrazeno pro budoucí rozšíření (Fáze 2+).*

---

## Závěr mapování

**Strom života ZIONu není metafora. Je to diagnostický nástroj.**

Když se ZION rozrůstá, zeptej se:
- *Máme Keter?* — ústava je neměnná, genesis zamrzlý ✓
- *Máme Chokmah?* — PoW běží, NPU Mix implementován ✓
- *Máme Binah?* — 11-kroková validace, fork choice ✓
- *Máme Chesed?* — staking 12%, farming 1 wZION/s ✓
- *Máme Gevurah?* — treasury lock, multisig, fee burn ✓
- *Máme Tiferet?* — WARP 12 chainů, 1:1 peg ✓
- *Máme Netzach?* — Hiran v2.2 inference, care proofs (horizont) ◐
- *Máme Hod?* — Oasis UE5 + Rust, consciousness levels ◐
- *Máme Yesod?* — L5 komunity, care vow, Te Piko Ora ◐
- *Máme Malkhut?* — L6 Issobella seed, hvězdný horizont ◐
- *Máme Da'at?* — TerraNova kniha, evoluZion, Zohar (tento dokument) ✓

**✓ = emanuje v runtime · ◐ = emanuje v docs/vizi, čeká na manifestaci**

Zohar roadmap (další soubor) popisuje jak ◐ → ✓.

---

*01-SEFIROT-VRSTVY.md · ZION Zohar · 2026-07-03*
