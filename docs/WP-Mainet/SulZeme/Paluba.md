# ZION — Paluba

## Kniha pro každého, kdo slyšel kladivo a přišel se podívat

> *Pokračování knihy Sůl této země. Čte se samostatně — ale kdo četl dvanáct zastavení, ví, kde stojí.*

> **Status:** Mainnet Alpha 3.1 · V31 3.1.0-alpha.2 · veřejný launch 31. 12. 2026
> **Licence:** MIT · **Jazyk:** čeština · **Účel:** pozvat tě na palubu — ne slibem, ale kladivem

---

## Ráno po pizzách

Kovář nespálil ruce. Přestal cítit, kde končí kladivo a začíná dlaň — a to bylo dobře, znamenalo to, že už nemusí přemýšlet, jestli má bušit. Prostě bušil.

Sedlák přinesl prkna. Kupec, který vyprávěl o deseti tisících mincích za dvě placky, odešel před úsvitem — nechal jen větu viset ve vzduchu jako vůni po dešti: *„První kladivo padlo dřív, než začalo pršet."*

A pak přišel někdo nový.

Nebyl to poutník s miskou. Nebyl to král v lese. Nebyl to pastýř s flétnou. Byl to kluk s notebookem pod paží a botami plnými bláta, který se zastavil u rozestavěné archy, podíval se na kováře a řekl jedinou větu:

**„Slyšel jsem, že stavíte. Můžu pomoct?"**

Kovář se zastavil uprostřed úderu. Poprvé za týdny se usmál — ne úsměvem, který by něco sliboval, ale takovým, co říká: *konečně někdo, kdo se neptá, jestli to vyjde, ale jestli máš kladivo navíc.*

„Mám," řekl kovář. „Ale ne kladivo. Něco lepšího. Pojď."

---

## I. Kladivo, které nikdo neviděl

Kovář ho zavedl za archu, tam, kde les přecházel do mýtiny a kde stál nízký dřevěný stůl s jedinou věcí na něm — kovem, který nesvítil, nevoněl a nebyl na pohled ničím zvláštní.

„Tohle je tvé kladivo," řekl kovář. „Nevypadá na much. Ale dělá jedinou věc, kterou žádné jiné kladivo na světě nedělá: **každých šedesát sekund najde kus kovu, který předtím neexistoval.** A ten kus kovu se rozdělí sám — ne proto, že bys byl hodný, ale proto, že je takhle udělaný."

Kluk se podíval na kov. „A co musím umět?"

„Nic, co bys už neuměl," řekl kovář. „Otevřít program. Napsat jednu větu. Čekat."

---

> ### Kladivo — příkaz
>
> ```bash
> # Stáhni ZION CLI z GitHub releases
> # https://github.com/Zion-TerraNova/v3-Mainnet/releases
>
> # Jedna binárka. Interaktivní menu. Žádný diplom z kryptografie.
> zion menu
> ```
>
> Menu tě provede: peněženka, pool, těžba. Šipky a Enter.
>
> Nebo rovnou, pokud víš, co děláš:
>
> ```bash
> # 1. Vytvoř peněženku (adresa, kam ti přijdou odměny)
> zion wallet address --chain zion-l1 --account 0 --index 0
>
> # 2. Spusť těžbu na veřejném poolu
> zion miner start --reward-address zion1TVOJEADRESA --pool-url 62.171.141.136:8444
> ```
>
> **Pool:** `62.171.141.136:8444` (Stratum v1)
> **RPC:** `http://rpc.zionterranova.com:8443`
> **To je vše.** Tvůj počítač teď hledá bloky. Každých 60 sekund někdo v síti jeden najde — a pokud jsi to ty, nebo jsi blízko, dostaneš podíl.

---

## II. Tři proudy jedné řeky

Kovář viděl, že kluk zírá na notebook a přemýšlí, jestli mu ten slabý procesor stačí. Tak mu ukázal ještě něco.

„Vidíš tu řeku?" řekl a ukázal na potok, který se klikatil mýtinou. „Teče jedním směrem. Ale napájí ji tři prameny."

**„První pramen je ZION.** To je voda, kterou piješ ty. Tvůj počítač hledá bloky ZIONu — a když najde, odměna je tvoje. Tohle je hlavní proud. Bez něj řeka nevznikne."

**„Druhý pramen je tvá grafická karta.** Pokud máš GPU — třeba starou GTX, co leží v šuplíku — můžeš ji pustit paralelně. Nebude těžit ZION přímo, ale bude pomáhat síti a odměna přijde z vedlejšího proudu. AuxPoW. Jako když nakrmíš dvě úly jedním včelstvem."

**„Třetí pramen je tvůj procesor.** CPU. To, co má každý. I když nemáš GPU, tvůj procesor může přispět — pomalu, tiše, ale poctivě. Jako nosič vody, který nenese vědra, ale aspoň kapku."

„A ty tři se nemusí rušit?"

„Nemusí," řekl kovář. „Jsou to tři proudy jedné řeky. **Trinity.** Každý teče sám, ale do stejného moře."

---

> ### Tři proudy — příkazy
>
> **Stream 1 — ZION (vždy hlavní, CPU i GPU):**
> ```bash
> zion miner start --reward-address zion1TVOJEADRESA --pool-url 62.171.141.136:8444
> ```
>
> **Stream 1 + GPU AuxPoW (Trinity — ZION + externí GPU mince):**
> ```bash
> zion miner start --reward-address zion1TVOJEADRESA \
>   --pool-url 62.171.141.136:8444 \
>   --auxpow-pool EXTERNÍ_POOL
> ```
>
> **Jen GPU AuxPoW (bez ZION streamu — např. ERG, ETC, RVN):**
> ```bash
> zion miner start --reward-address zion1TVOJEADRESA \
>   --no-zion --auxpow-pool EXTERNÍ_POOL --worker tvuj_worker
> ```
>
> **Vypnout GPU nebo CPU stream:**
> ```bash
> --no-gpu   # vypne Stream 2 (GPU AuxPoW)
> --no-cpu   # vypne Stream 3 (CPU AuxPoW)
> ```
>
> > **Realita z kódu:** Triple Stream je implementovaný v `V31/L1/miner/src/config.rs` — `stream1_enabled`, `stream2_enabled`, `stream3_enabled`. Stream 1 je vždy ZION canonical. Streamy 2 a 3 jsou AuxPoW fallback s autonomous profit switchingem.

---

## III. Co se stane každých šedesát sekund

Kluk pustil těžbu. Obrazovka ukázala čísla, která si neuměl vysvětlit — ale kovář mu řekl: „Nevadí, že nerozumíš každému číslu. Rozuměj jednomu: **každých šedesát sekund se někde na světě najde blok.** A v každém bloku je 5 400 ZION. A ty se rozpadnou samy."

Napsal mu to do hlíny u potoka, aby to viděl:

```
5 400,067 ZION  →  každý blok, každých 60 sekund

  89 %  →  těžař (ten, kdo našel blok — nebo pool, který sdílí)
   5 %  →  humanitární fond (děti, pomoc, krize — automaticky)
   5 %  →  fond Issobella (budoucnost, komunity, L5/L6 — automaticky)
   1 %  →  spáleno (navždy zničeno — deflační tlak)
```

„Tohle není slib," řekl kovář. „Je to **matematika zapsaná v konsensu**. Žádný uzel v síti nepřijme blok, který má jiný poměr. Nemůžu to změnit. Zakladatel to nemůže změnit. DAO to nemůže změnit. Je to kámen, na kterém stojí loď."

Kluk se zamyslel. „A ta odměna — 5 400 — to je hodně, nebo málo?"

Kovář pokrčil rameny. „Je to **nejvíc, co protokol kdy vyplatí**. Každou dekádu klesne o pětinu. Za sto let se ustálí na 724 ZION navěky. Ale dnes — dnes je první dekáda. 2026 až 2036. Kdo těží dnes, těží v dekádě s nejvyšší odměnou, jakou tahle síť kdy bude znát."

---

> ### Ověřitelná fakta — emise a rozdělení
>
> | Parametr | Hodnota | Zdroj v kódu |
> |---|---|---|
> | Celková nabídka | 144 000 000 000 ZION | `emission.rs:12` — `TOTAL_SUPPLY` |
> | Premine | 16 780 000 000 ZION (11,65 %) | `emission.rs:15` — `GENESIS_PREMINE` |
> | Odměna dekáda 1 | 5 400,067 ZION/blok | `emission.rs:39` — `BASE_REWARD` |
> | Decade Decay | ×4/5 každou dekádu (5 256 000 bloků) | `emission.rs:30-33` |
> | Tail emission | 724,784723 ZION/blok od ~2126 | `emission.rs:42` — `TAIL_REWARD` |
> | Čas bloku | 60 sekund | `emission.rs:21` |
> | Split 89/5/5/1 | Vynuceno konsensem, konstituční | `emission.rs:47-57, 64-69` — `fee_split()` |
> | Coinbase zralost | 100 bloků (~100 minut) | `emission.rs:45` |
> | TX poplatky | 100 % spáleny (deflační) | `emission.rs:77-79` |
>
> > **Neměnné parametry (konstituční):** Celková nabídka, genesis alokace, čas bloku, těžební algoritmus, typ konsensu, split 89/5/5/1 — DAO nemůže změnit. Zdroj: technický whitepaper 3.1, kap. 10.3.

---

## IV. Síť, která je malá — a právě proto je vstup jiný

Kluk těžil půl hodiny. Nic nenašel. Začal být netrpělivý.

„To je normální?" zeptal se.

„Je to normální," řekl kovář. „Síť je malá. Málo lidí těží. To znamená dvě věci — jednu špatnou a jednu dobrou."

„Špatná?"

„Špatná je, že síť není tak bezpečná jako bitcoin. Málo uzlů, málo očí. Pokud se něco pokazí, opravuje se veřejně — ale pokazí se. Je to Mainnet Alpha. Ne hotový produkt."

„A dobrá?"

Kovář se usmál. „Dobrá je, že **čím méně lidí těží dnes, tím větší podíl z nalezených bloků připadá na každého, kdo tu už je.** Obtížnost se přepočítává podle toho, kolik strojů hledá právě teď — ne podle toho, kolik jich bude za rok. Dnes je v síti málo kladiv. Zítra jich může být tisíc. A ten, kdo dnes buší sám, má zítra podíl, který by musel sdílet s tisícem."

Kluk se podíval na obrazovku. „Takže čekat?"

„Čekat můžeš vždycky," řekl kovář. „Ale čekání nemá kladivo. **Těžba ano.**"

---

> ### Ověřitelná fakta — současný stav sítě
>
> | Parametr | Hodnota | Zdroj |
> |---|---|---|
> | Status | Mainnet Alpha 3.1 (V31 3.1.0-alpha.2) | `StatusV3.md` |
> | Výška chainu | ~11 270 bloků (2026-08-04) | `StatusV3.md` |
> | Genesis hash | `96109423298542a836edc10b9ba5ff9b29a1970418db543c2ee5cd952fe35bdb` | `StatusV3.md`, `emission.rs` |
> | Pool hashrate | ~1 MH/s, desítky shares/sec | `StatusV3.md` |
> | Algoritmus (height-aware) | `deeksha_lite_fire` (h ≥ 5000, 65 536 thermal iterací) | `cosmic-harmony-v3/src/lib.rs` |
> | DAA | LWMA, okno 60 bloků, ±25 % clamp | technický whitepaper 3.1, kap. 4.4 |
> | P2P | QUIC, porty 8333/8334/8335 | `StatusV3.md` |
> | Uzly | 3 na Edge (V3 node1 + node2 + V31) + lokální backup | `StatusV3.md` |
>
> > **Hard genesis reset (2026-07-20):** Bug v block retention způsobil ztrátu bloků 0–~10913. Síť byla resetována s neomezenou retencí. Bloky od fixu se uchovávají všechny. Zdroj: `AGENTS.md`, BLOCK RETENTION FIX.

---

## V. Za kovárnou — zahrada, která se teprve otevírá

Kluk bušil dál. Druhý den, třetí den. Čtvrtý den našel první share — ne blok, ale podíl, který pool uznal. Na jeho adrese se objevilo číslo, které předtím neexistovalo. Malé. Ale reálné.

Kovář ho ten večer vzal za archu, tam, kde les přecházel v něco, co vypadalo jako zahrada — ale se zamčenou branou a cedulí: *„Otevíráme. Zatím se dívej."*

„To je Oasis," řekl kovář. „Herní vrstva. Příběh, avataři, questy, galaxie. Místo, kde se to, co děláš — bloky, které pomáháš najít, kód, který opravíš, dokumentace, kterou napíšeš — počítá a roste s tebou."

„Můžu vstoupit?"

„Můžeš se podívat," řekl kovář. **„Oasis Web běží — 3D galaxie, 55 světů, avataři, questy. Ale je to preview, ne hotová hra.** Dashboard je raný. Golden Egg je zatím sbírka nápověd, ne aktivní poklad. 108 stop a 8,25 miliardy ZION v odměnových poolech čekají — ale ne dnes."

„A co dnes?"

**„Dnes je kovárna,"** řekl kovář a ukázal zpět na rozestavěnou archu. **„Dnes je kladivo. Dnes je blok, který se najde každých šedesát sekund a rozdělí se sám. Oasis přijde. Ale bez kovárny není loď — a bez lodi není zahrada."**

---

> ### Oasis — co funguje a co čeká
>
> **ŽIVÉ (dnes):**
> - 3D galaxie s 55 generovanými světy, warp intro, volný let
> - REST API `/api/v1/oasis/*`: questy, avataři, mapa teritorií, leaderboard, guildy
> - Přihlášení peněženkou `zion1...`, synchronizace XP
> - Audio engine, mobilní ovládání
> - URL: `https://oasis.zionterranova.com`
>
> **STAVBA (v aktivním vývoji):**
> - Dashboard hráče (XP, level, guild) — raná fáze
> - 8 Genesis Teritorií — definice v kódu, ve hře zatím jen mapa s bonusy
> - 202 avatárů v 17 kruzích — kurátorský obsah, postupně se doplňuje
> - Dharma Credits eShop
>
> **HORIZONT (směr, ne datum):**
> - Golden Egg: 108 stop, 8,25 mld ZION v 5 poolech, plánovaný start 2027
> - L5 Free World: humanitární mise s on-chain auditovatelným dopadem
> - L6 Issobella: orbitální výzkumný horizont
>
> > **Zdroj:** `APP&WEB/OasisWeb/README.md`, `OASIS_WEB_JOURNAL.md`, live API `https://oasis.zionterranova.com/api/v1/oasis/*`. Oasis XP nikdy neovlivňuje konsensus ani odměnu za blok — je to vrstva navrch, ne náhrada PoW.

---

## VI. Co ti tahle kniha neslibuje

Kluk se chystal odejít. Kovář ho zadržel.

„Počkej. Než odejdeš — ať už dnes, nebo za rok — řekni ti nahlas, co jsi slyšel, a co ne."

**Slyšel jsi:**
- Síť běží. Bloky přibývají. Kód je veřejný. Odměna se dělí sama.
- Dnes je první dekáda — nejvyšší odměna, jakou protokol kdy vyplatí.
- Těžba stojí reálnou elektřinu a čas — a nikdo nezaručuje, že ZION bude mít hodnotu.
- Vstup je stejný pro každého: jedna binárka, jeden pool, žádné VIP.

**Neslyšel jsi:**
- Že zbohatneš. Nikdo ti to neslíbil a nikdo ti to nezaručí.
- Že síť je bezpečná jako bitcoin. Není. Je mladá, malá, v Alpha.
- Že Oasis je hotová hra. Není. Je preview s živým backendem a rozestavěným klientem.
- Že musíš věřit. Nemusíš. **Ověř si všechno, co jsem ti řekl.**

---

> ### Ověř si to sám
>
> ```bash
> # 1. Podívej se na živou síť — bloky přibývají?
> curl -X POST http://rpc.zionterranova.com:8443 \
>   -H "Content-Type: application/json" \
>   -d '{"jsonrpc":"2.0","id":1,"method":"getChainInfo","params":[]}'
>
> # 2. Prolistuj kód — MIT licence, nic skrytého
> # https://github.com/Zion-TerraNova/v3-Mainnet
>
> # 3. Zkontroluj emisi — 5 400,067 ZION/blok, split 89/5/5/1
> # V31/L1/core/src/emission.rs — řádky 39, 47-57, 64-69
>
> # 4. Spusť doctor — ověř konfiguraci a konektivitu
> zion doctor
>
> # 5. Podívej se na Oasis Web
> # https://oasis.zionterranova.com
> ```
>
> > **Genesis hash:** `96109423298542a836edc10b9ba5ff9b29a1970418db543c2ee5cd952fe35bdb`
> > **wZION na Base:** `0x0c493763d107ab0ABb0aee1Ca3999292d8202bb6` (verifikováno na Basescan)
> > **GitHub:** `https://github.com/Zion-TerraNova/v3-Mainnet` (MIT)

---

## VII. První krok — dnes, za pět minut

Kluk zavřel notebook. Otevřel ho znovu. Napsal:

```bash
zion miner start --reward-address zion1TVOJEADRESA --pool-url 62.171.141.136:8444
```

Obrazovka se pohnula. Čísla, která nerozuměl. A pak — poprvé — jedno slovo, kterému rozuměl:

```
share accepted
```

Kovář se nepodíval. Bušil dál. Ale kluk věděl, že slyšel — protože kladivo kováře na okamžik zrychlilo, jako by chtěl říct: *„Vítej na palubě. Drž kladivo oběma rukama. A buš, dokud nepřijde déšť — nebo dokud nezbude z tebe kovář, který ho nepotřebuje."*

---

> ### Tři cesty na palubu
>
> **🔍 Pozorovatel — „Nejdřív důkaz"**
> - Explorer: `https://zionterranova.com`
> - Kód: `https://github.com/Zion-TerraNova/v3-Mainnet`
> - Oasis Web: `https://oasis.zionterranova.com`
> - Nic neinstaluj. Jen se dívej.
>
> **⚒️ Stavitel — „Chci nést kus mostu"**
> ```bash
> # Stáhni CLI z GitHub releases
> zion menu                    # interaktivní menu
> zion wallet address --chain zion-l1
> zion miner start --reward-address zion1... --pool-url 62.171.141.136:8444
> zion doctor                  # ověř, že vše běží
> zion pool status             # kolik share ses podílel
> ```
>
> **🖥️ Desktop app — pro začátečníky**
> - GitHub release `v3.1.0-desktop`
> - Windows 11 (x64), macOS (arm64 + Intel), Linux (.AppImage / .deb)
> - Jedno kliknutí: peněženka, pool, těžba. Žádný terminál.
>
> > **Pool:** `62.171.141.136:8444` · **RPC:** `http://rpc.zionterranova.com:8443`

---

## Závěr — kovář, který zůstal

Kovář neodešel, když kluk přišel. Neodešel, když kluk odešel. Neodešel, když přišel další — žena s dcerou, důchodce s starým PC, student s pronajatým GPU.

Bušil dál. Ne proto, že by věděl, kdy přijde déšť. Protože **kladivo, které buší, ať prší nebo ne, je jediná věc, kterou člověk může držet v ruce, když voda přijde — a jediná věc, která z něj dělá stavitele, ne čekajícího.**

Síť je malá. Dveře jsou otevřené. Kladivo je tady.

> **ZION není slib. Je to kladivo.**
> **Vezmi si ho — a buš, dokud neuslyšíš kov, který zazní zpět.**

---

*Pokračování příběhu najdeš v knize [Sůl této země](./00-README.md) — dvanáct zastavení s Ježíšem, Buddhou, Krišnou, Rámou, Sítou, Hanumanem a Noem.*

*Čísla a architekturu najdeš v [Technickém whitepaperu 3.1](../ZION_Technical_Whitepaper_v3.1_CZ.md).*

*Prostor pro otázky: Discord, GitHub Issues. Dobrá komunita se pozná podle toho, že umí říct „nevím" a ukázat zdroj.*

*Gate, Gate, Paragate, Parasamgate, Bodhi Svaha.*
