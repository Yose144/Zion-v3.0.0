# ZION — Kanonický onboarding pro širokou veřejnost
## Vstup do sítě ZION TerraNova · 3.2 „One Love"

> **Status:** KANONICKÝ veřejný onboarding — jeden vstupní bod pro každého nováčka.
> Nahrazuje [`SulZeme/ZION_ONBOARDING.md`](./SulZeme/ZION_ONBOARDING.md) (2026-08-03) jako hlavní veřejný onboarding.
> **Datum:** 2026-08-09
> **Síť:** Mainnet Alpha `3.1.0-beta` / protokol `zion-v3-node/3.1.0-alpha` → cíl **3.2.0 „One Love" (Mainnet Stable)**
> **Veřejný launch:** 31. prosince 2026
> **Jazyk:** čeština — [English version](./ZION_ONBOARDING_PUBLIC_EN.md)

---

## 1. ZION ve třech větách

1. **ZION je blockchain, který si můžeš ověřit, ne jen uvěřit.** Otevřený kód v Rustu pod MIT licencí, nový blok každou minutu, běžící produkční síť — žádný slib na papíře.
2. **Každý blok automaticky dělí odměnu: 89 % těžaři, 5 % humanitárnímu fondu, 5 % fondu vědy a budoucnosti (Issobella), 1 % se spálí.** Toto rozdělení vynucuje sám protokol — nejde vypnout hlasováním ani rozhodnutím firmy.
3. **Nikdo nedostal VIP vstup.** Žádné ICO, žádný předprodej. Genesis alokace je veřejně zdokumentovaná v kódu a vše ostatní vzniká poctivou těžbou.

---

## 2. Ověřený stav sítě (k 2026-08-09)

| Co | Stav |
|---|---|
| Chain | 1000+ bloků od genesis resetu 2026-08-06, ~60 s/blok |
| Testy | `cargo test --workspace` — **2178 pass, 0 failures** |
| Služby | node, pool, miner, multichain, DAO, OASIS, dashboard, web, marketplace — vše `up` |
| Veřejný pool | `62.171.141.136:8444` (Stratum) |
| Veřejný RPC | `rpc.zionterranova.com:8443` |
| Web | `https://zionterranova.com` |
| OASIS preview | `https://oasis.zionterranova.com` |
| Zdrojový kód | `https://github.com/Zion-TerraNova/v3-Mainnet` (MIT) |

---

## 3. Klíčová čísla

| Parametr | Hodnota |
|---|---|
| Celková nabídka | 144 000 000 000 ZION (tvrdý strop) |
| Čas bloku | ~60 sekund |
| Odměna za blok (1. dekáda, 2026–2036) | 5 400,067 ZION — nejvyšší v historii sítě |
| Emisní model | Decade Decay: −20 % každých 10 let, věčný tail ~724,78 ZION/blok od ~2126 |
| Rozdělení odměny | 89 % těžař / 5 % humanitární / 5 % Issobella / 1 % burn |
| Těžební algoritmus | Ekam Deeksha v3.2 — paměťově náročný PoW (CPU/GPU, odolný vůči ASIC) |
| Atomická jednotka | 1 ZION = 1 000 000 flowers (6 desetinných míst) |
| Genesis hash (V3 compat) | `4cf7560f9140deb9376fa6567e76eacaa8bd1b733ca3c91b00830a08f332ef71` |
| Genesis hash (V31 native) | `96109423298542a836edc10b9ba5ff9b29a1970418db543c2ee5cd952fe35bdb` |
| Licence | MIT |

---

## 4. Vyber si cestu

### Pozorovatel — „Nejdřív chci důkaz" (2 minuty)

1. Otevři `https://zionterranova.com` a sleduj živou síť.
2. Prolistuj kód na `https://github.com/Zion-TerraNova/v3-Mainnet` — nic není skryté.
3. Zeptej se komunity na cokoliv. Dobrá komunita umí říct „nevím" a ukázat zdroj.

### Hráč — „Chci to zažít" (5 minut)

1. Vstup do OASIS: `https://oasis.zionterranova.com`.
2. Projdi warp intro, proleť 3D galaxií s 55 světy, prohlédni Avatar Codex.
3. Prozkoumej NFT tržiště na `https://market.zionterranova.com`.

> **Poctivě:** OASIS je **živý preview ve výstavbě** — ne hotová hra. Obsah, questy
> i progrese se mohou během vývoje měnit nebo resetovat. Golden Egg a plná herní
> ekonomika jsou budoucnost, ne dnešní realita. Vstupuješ jako spolutvůrce zahrady,
> ne jako zákazník hotového produktu.

### Těžař — „Chci zapojit svůj stroj" (15 minut)

1. Vytvoř si **vlastní** peněženku — mnemonik nikdy nikomu nedávej.
2. Stáhni nebo přelož `zion-miner`:

```bash
git clone https://github.com/Zion-TerraNova/v3-Mainnet.git
cd v3-Mainnet/V31
cargo build --release --bin zion-miner
./target/release/zion-miner \
  --pool 62.171.141.136:8444 \
  --wallet zion1...tvoje_adresa \
  --worker muj-prvni-stroj
```

3. Sleduj přijaté share a teploty; začni konzervativně.

> **Proč začít brzy:** první dekáda nese nejvyšší naplánovanou odměnu za blok
> a malá síť znamená, že se naučíš peněženku, rig i bezpečnost dřív, než přijde
> dav. To není slib zisku — skutečný výnos závisí na tvém hashratu, difficulty,
> nákladech a tržní ceně. Je to popis emisního plánu, který si ověříš v kódu.

### Stavitel — „Chci nést kus mostu"

1. Přelož workspace, spusť testy, otevři issue nebo pull request.
2. Zlepši dokumentaci, přidej test, oprav chybu, navrhni lepší UX.
3. Přines dovednost, kterou už máš — design, překlad, bezpečnost, hudbu, komunitu.

---

## 5. Příběh pro ty, kdo chtějí víc než čísla

ZION stojí na čtyřech knihách — čtyřech otázkách kompasu:

| Kniha | Směr | Otázka |
|---|---|---|
| **Genesis** | Sever | Proč vůbec stavět? |
| **Kvantová revoluce** | Východ | Co je rozbité ve starém světě? |
| **Ekam Deeksha** | Jih | Kdo jsem já na této cestě? |
| **Terra Nova** | Západ | Kam to celé směřuje? |

A **Oasis** je střed kompasu. Tam stojíš ty.

- **Kniha Sůl této země** — 12 zastavení na cestě k Oasis: [`SulZeme/00-README.md`](./SulZeme/00-README.md)
- **Rasta příběh u ohně** — poutavá pozvánka: [`marketing/RASTA_ONBOARD_3.2_ONE_LOVE_CZ.md`](./marketing/RASTA_ONBOARD_3.2_ONE_LOVE_CZ.md)
- **Road to Zion** — čtyři knihy, jak by je zpíval Bob Marley: [`marketing/ROAD_TO_ZION_CZ.md`](./marketing/ROAD_TO_ZION_CZ.md)

Příběh smí být krásný, ale fakta o síti musí být přesná. **Příběh není slib.**

---

## 6. Bezpečnost především

- **Mnemonik a privátní klíče nikdy nikomu neposílej.** Žádná podpora, admin ani „výhra" je nikdy nepotřebuje.
- Ztracený klíč = ztracené ZION. Neexistuje reset hesla.
- Oficiální domény: `zionterranova.com` a subdomény (`app.`, `oasis.`, `market.`, `dashboard.`, `rpc.`). Vše ostatní ověřuj.
- Oficiální kód: `github.com/Zion-TerraNova/v3-Mainnet`. Binárky ověřuj proti SHA256SUMS z GitHub release.
- Nikdo z projektu tě nebude kontaktovat první s nabídkou investice.

---

## 7. Co ZION neslibuje

1. **Žádné zbohatnutí přes noc.** ZION je infrastruktura a myšlenka, ne finanční letadlo.
2. **Žádnou garanci ceny.** Kurz určuje volný trh; nic v tomto dokumentu není investiční doporučení.
3. **Žádnou hotovou AAA hru.** OASIS je preview ve výstavbě.
4. **Žádný pasivní zisk bez práce.** Těžba má náklady, rizika a odpovědnost za vlastní hardware.
5. **Žádné náboženské tvrzení.** Příběhové postavy jsou archetypy, ne teologie.

---

## 8. Kanonické zdroje pravdy

| Dokument | Účel |
|---|---|
| [`ZION_MASTER_WHITEPAPER_3.2_ONE_LOVE_CZ.md`](./ZION_MASTER_WHITEPAPER_3.2_ONE_LOVE_CZ.md) | Kanonický whitepaper 3.2 „One Love" |
| [`ZION_ONBOARDING_3.2_ONE_LOVE_CZ.md`](./ZION_ONBOARDING_3.2_ONE_LOVE_CZ.md) | Hloubkový onboarding (technický + narativní) |
| [`SulZeme/00-README.md`](./SulZeme/00-README.md) | Kniha Sůl této země — 12 zastavení |
| [`ZION_Technical_Whitepaper_v3.1_CZ.md`](./ZION_Technical_Whitepaper_v3.1_CZ.md) | Technická reference (konsensus, emise, architektura) |
| [`../../V31/PLAN_TO_3.2.md`](../../V31/PLAN_TO_3.2.md) | Technický plán cesty k Mainnet Stable |
| [`../../StatusV3.md`](../../StatusV3.md) | Živý stav sítě a topologie |

---

*One love, one chain, one road.*
*Kanonizováno 2026-08-09 z běžící sítě a V31 repozitáře.*
