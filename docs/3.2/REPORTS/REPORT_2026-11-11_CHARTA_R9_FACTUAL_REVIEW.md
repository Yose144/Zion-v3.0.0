# REPORT 2026-11-11 — Charta R9: factual review veřejných textů (autonomní část)

> **Rozsah:** release gate **R9** z [`canon/books/MiseAmenti/04-Exekucni-Charta-3.3.md`](../../../canon/books/MiseAmenti/04-Exekucni-Charta-3.3.md) §R9 — *„public copy prošlo factual/legal/cultural review a každé HORIZONT/HYPOTÉZA je viditelně označeno"*. Tato zpráva pokrývá **jen autonomní factual vrstvu**; **legal a cultural review zůstávají 👤-gated** (žádný právník/kulturní konzultant neproběhl). Datum revize: 2026-11-11.

## 1. Metoda

Porovnání veřejných tvrzení proti **kanonickým zdrojům** (`canon/books/`, `V31/` kód, `StatusV3.md`, živé endpointy EDGE1/EDGE2, GitHub). Primární dokumenty pod revizí:

- [`docs/3.2/COINGECKO_FORM_ANSWERS.md`](../COINGECKO_FORM_ANSWERS.md) — hotové odpovědi pro formulář CoinGecko (příprava re-aplikace, roadmap [`COINGECKO_REAPPLY_ROADMAP.md`](../COINGECKO_REAPPLY_ROADMAP.md), cíl early Jan 2027)
- Canon Books EN překlady — konvence statusů a označení HORIZONT/HYPOTÉZA/MÝTUS
- Živé publicly claimované endpointy (`/api/supply/*`, explorer, whitepapers)

## 2. Ověřeno jako fakticky správné

| Tvrzení (veřejný text) | Zdroj pravdy | Výsledek |
|---|---|---|
| Genesis **2026-08-06** „One Love", mainnet-alpha→beta | `StatusV3.md`, V31 lifecycle | ✅ |
| Wire protocol `zion-v3-node/3.1.0-alpha`, verze 3.2.0 Mainnet Beta | `V31/AGENTS.md` lifecycle poznámka | ✅ (formulář uvádí „protocol 3.1.0" — zjednodušení, ne chyba) |
| Max supply **144 mld**, Decade Decay **−20 %/dekádu** + perpetual tail ~724,785 ZION/blok | `v3_compat.rs`, fee/emission kód, kanon | ✅ |
| Fee split **89/5/5/1** (5 % humanitarian + 5 % science/Issobella hardcoded v konsenzu) | `V31/L1/core/src/fee.rs`, `StatusV3.md` fee tabulka | ✅ |
| Premine **16,78 mld v 14 transparentních UTXO** | Tabulka v `COINGECKO_FORM_ANSWERS.md` §9–10 — **aritmetika ověřena**: 2,5+1,5+4,95+3,3+1+1+0,59+1,44+0,4+0,1 = 16,78 mld; % alokace sedí (OASIS 3,44 %, L5 2,29 %, Issobella 1,74 %, DAO 1,04 %, Children 1,00 %, Bridge 0,35 %) | ✅ |
| DAO Treasury **1,5 mld** (sloty 7+8), Issobella **2,5 mld** (slot 6), time-lock do bloku **144 000** | `StatusV3.md` update 2026-09-12, `v3_compat.rs` | ✅ |
| „L5 humanitarian program … dedicated **3,3B ZION** on-chain allocation" | = L5 Free World reserve 1,65 mld + L5 Free World projects 1,65 mld | ✅ (aritmeticky přesně; label „humanitarian" = L5 vrstva, v souladu s kanonem) |
| EkamDeeksha = memory-hard PoW, **512 KiB scratchpad, AES** | `V31/L1` algo kód, kanon | ✅ |
| **AuxPoW merged mining** (ZANO, VRSC/Verus) | `V31/cli/src/commands/auxpow.rs`, `verushash` v `native-ffi`, pool env `ZION_POOL_AUXPOW_COIN2=ZANO` | ✅ |
| wZION ERC-20 na Base, UniV3 pool `0x186b46c2…`, kontrakt `0x0c4937…` | `AGENTS.md` canonical addresses, GeckoTerminal link | ✅ |
| Node reward **1 %** „after the scheduled activation“ | `node_reward_activation_height = u64::MAX` — formulář **poctivě** neuvádí jako aktivní | ✅ |
| **GitHub** `github.com/Zion-TerraNova/v3-Mainnet` | Webfetch 2026-11-11: repo **existuje, public, MIT, „Status: Mainnet Beta"**, 6 472 commitů | ✅ (viz poznámku §4.2) |
| Supply API endpointy `/api/supply/total`, `/api/supply/circulating` | Živé sondy — 200, `144000000000` | ✅ |

## 3. Označení HORIZONT/HYPOTÉZA/MÝTUS (druhá polovina R9)

- **Korpusová konvence vynucená:** statusy se překládají doslovně (`ŽIVÉ→LIVE`, `STAVBA→BUILDING`, `HORIZONT→HORIZON`, `HYPOTÉZA→HYPOTHESIS`, `MÝTUS→MYTH`, `NEDOLOŽENO→UNSUBSTANTIATED`, `NEPLATNÝ NÁROK→INVALID CLAIM`) — `docs/plans/TRANSLATION-PLAN.md` §5.5.
- **Redakční kampaň EN dokončena 2026-11-07** — všech 189 EN kapitol, 29 souborů opraveno, 0 neoznačených draft claims; `NaCeste/02-Kotva-Pravdy` nese čtyřvrstvou klasifikační tabulku (doložená realita / plánované / horizont / MÝTUS) 1:1 s CZ.
- **Spot-audit Na Cestě (2026-11-11, tato revize):** `01-Na-Ceste_EN.md` vs CZ — identické link-sety, 10/10 nadpisů, 9/9 oddělovačů, 192/192 odstavce, **0 českých funkčních slov**, **0 numerických odchylek** (jediný regex-hit `460` byl artefakt lookaheadu — číslo je v CZ i EN). Kvalita idiomatická, hranice (Raiatea/Austrálie jako odmítnutá návštěva, sáček fazolí jako pozastavený převoz) zachovány doslovně.

## 4. Nálezy k řešení (žádná z nich nepřekvapuje canonical docs)

### 4.1 Zastaralé číselné snapshoty — refresh před resubmisí (👤 timing)
- `~181.8M` vytěženo / circulating `16 961 804 055` = snapshot **2026-09-07**. Při re-aplikaci (cíl Jan 2027) **přeměřit** přes `/api/supply/circulating` — číslo denně roste (~5 400 ZION/blok). Dokument sám to datuje, nechyba, ale nesmí se kopírovat slepě.
- `COINGECKO_FORM_ANSWERS.md` uvádí „Last updated: 2026-09-07" — před submitením aktualizovat celý balíček (i TVL/volume v roadmapě).

### 4.2 Veřejný GitHub repo je starší snapshot
- `Zion-TerraNova/v3-Mainnet` (public, na který formulář i web odkazují) má strukturu `V3/`, `docs/`, `Cargo.toml` — **neobsahuje `V31/`**. Pro CoinGecko postačuje jako „existující public repo", ale recenzent si může všimnout, že neodpovídá aktuálnímu kódu. Rozhodnutí o syncu public repo = 👤 (operátor Ownera), není to chyba formuláře.

### 4.3 Známé, záměrně ponechané nejednoznačnosti (již zdokumentované)
- `NaCeste/01` trasa „Pontevedra – Lisbon (Sabacheira)" — Sabacheira je u Tomaru, ne Lisabonu; **ponecháno záměrně** (TRANSLATION-PLAN §5.5 „rozhodnutí autora").
- `SulZeme/10` gloss `anattā (non-clinging)`, `Nabukano/06` „trus pod středem" (pravděpodobně „trup/hub"), `NirvanaCloud/05` obrácená logika — vše zdokumentováno jako known issues, neopraveno záměrně.

### 4.4 Co zůstává mimo autonomní rozsah (👤)
- **Legal review** veřejných textů (disclaimery, token characterization, promissory language).
- **Cultural review** — Ekam temple data, Raiatea/Austrálie/uluru representations, Marian/pilgrim traditions (Na Cestě kotva sama explicitně čeká na cultural consultant + FPIC).
- **Rozhodnutí** o aktualizaci public GitHub mirroru a o konečné podobě formuláře.

## 5. Verdikt

**Factual vrstva R9: SPLNĚNA pro aktuální stav.** Všechny ověřitelné tvrzení v CoinGecko balíčku a ve veřejném copy sedí s kanonem a kódem; premine tabulka je aritmeticky konzistentní; GitHub URL reálný; statusy HORIZONT/HYPOTÉZA/MÝTUS viditelně označeny a EN edice prošla plnou redakční kampaní. **Před samotnou re-aplikací** zbývá jen: refresh číselných snapshotů (👤 timing) + legal/cultural review (👤) — obojí mimo autonomní frontu.

## 6. Související

- [`docs/plans/TRANSLATION-PLAN.md`](../../plans/TRANSLATION-PLAN.md) §5.5 — redakční standard a dokončená kampaň 2026-11-07
- [`NIRVANA-V3.3-CHECKLIST.md`](../../3.3/NIRVANA-V3.3-CHECKLIST.md) — release gates R1–R9
- [`COINGECKO_REAPPLY_ROADMAP.md`](../COINGECKO_REAPPLY_ROADMAP.md) — cíle pillarů (likvidita/maturita/team presence)
