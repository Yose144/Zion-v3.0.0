# ZION TerraNova
## Onboarding & Sůl Země — Kanonický průvodce pro Mainnet Stable 3.2 "One Love"

**Příběh, který si můžeš ověřit. Síť, na kterou můžeš vstoupit dnes.**
**Stav sítě: Mainnet Alpha 3.1.0-beta / `zion-v3-node/3.1.0-alpha` → Mainnet Stable 3.2.0 "One Love" · Cíl veřejného launchi: 31. 12. 2026**
**Jazyk:** čeština — [English version](./ZION_ONBOARDING_3.2_ONE_LOVE_EN.md)
**Kanonický zdroj:** 2026-08-09

---

> *„Sůl je malá. Není to zlato, není to ocel, není to palivo. A přesto bez ní chutná všechno mrtvě.*
> *Sůl nepřidává novou chuť — ona odhaluje tu, která tam už je."*
>
> *„One good thing about Zion — when it calls you, you feel no chain."*
> — Bob Marley (narativní hlas 3.2 "One Love")

---

## Obsah

1. [Sůl a kompas — proč to číst](#1-sůl-a-kompas--proč-to-číst)
2. [Co je ZION 3.2 "One Love" — ve třech větách a ověřitelná fakta](#2-co-je-zion-32-one-love--ve-třech-větách-a-ověřitelná-fakta)
3. [Proč je dobré začít zrovna teď — dešťová metafora a mechanika 1. dekády](#3-proč-je-dobré-začít-zrovna-teď--dešťová-metafora-a-mechanika-1-dekády)
4. [Dvanáct zastavení knihy Sůl této země](#4-dvanáct-zastavení-knihy-sůl-této-země)
5. [Loď ZION — šest palub a čtyři knihy](#5-loď-zion--šest-palub-a-čtyři-knihy)
6. [Brána do Oasis — Rádha a Elizabeth](#6-brána-do-oasis--rádha-a-elizabeth)
7. [Tři cesty na palubu](#7-tři-cesty-na-palubu)
8. [Živý stav Edge a ověřitelná čísla](#8-živý-stav-edge-a-ověřitelná-čísla)
9. [Technický quickstart](#9-technický-quickstart)
10. [Co ZION neslibuje](#10-co-zion-neslibuje)

---

## 1. Sůl a kompas — proč to číst

> **Příběh**
>
> Sůl je nenápadná. A přesto bez ní každý chléb chutná jako prach.
> Tak je to i s tímto onboardingem: není to nové náboženství ani investiční leták.
> Je to způsob, jak si každý může ověřit, kamstupuje, a proč by tam vůbec chtěl jít.
>
> ZION stojí na čtyřech knihách — čtyřech otázkách kompasu:
>
> - **Genesis** — Sever: *Proč vůbec stavět?*
> - **Kvantová revoluce** — Východ: *Co je rozbité ve starém světě?*
> - **Ekam Deeksha** — Jih: *Kdo jsem já na této cestě?*
> - **Terra Nova** — Západ: *Kam to celé směřuje?*
>
> A **Oasis** je střed kompasu. Tam stojíš ty.

> **Ověřitelná fakta**
>
> Tento dokument přísně odděluje vyprávění od technických tvrzení. V každé sekci, kde se mluví o číslech, kódu nebo síti, najdeš tabulku ověřitelných faktů s přesným odkazem do repozitáře nebo na běžící server `zionterranova.com`. Příběh smí být krásný, ale fakta o síti musí být přesná. Příběh není slib.

---

## 2. Co je ZION 3.2 "One Love" — ve třech větách a ověřitelná fakta

> **Příběh**
>
> **1. ZION je blockchain v Rustu, který si můžeš ověřit a spustit dnes.** Žádné sliby na papíře — síť běží, bloky vznikají každých 60 sekund a kód je plně otevřený pod licencí MIT.
>
> **2. Každý blok automaticky dělí odměnu: 89 % těžaři, 5 % humanitárnímu fondu, 5 % vědeckému a komunitnímu fondu Issobella, 1 % se spálí.** Není to volitelná charita firmy, ale matematická logika vynucená samotným konsenzem nodů.
>
> **3. Nikdo nedostal VIP vstup.** Žádné ICO, žádný tajný předprodej. 35 mnemonických klíčů z genesis resetu (2026-08-06) je veřejně auditovatelných v kódu, zbytek sítě vzniká výhradně poctivou těžbou a přínosem pro komunitu.

### Tabulka tvrzení × realita

| Tvrzení | Realita v kódu / síti | Zdroj pravdy |
|---|---|---|
| Veřejný kód | Plně otevřený zdrojový kód pod licencí MIT | `https://github.com/Zion-TerraNova/v3-Mainnet` |
| Čas bloku 60 s | Block target 60 s, DAA LWMA-60, ±25 % clamp | `V31/L1/core/src/difficulty.rs` |
| Genesis reset (2026-08-06) | Nové kanonické genesis hashe: V3 compat `4cf7560f9140deb9376fa6567e76eacaa8bd1b733ca3c91b00830a08f332ef71`, V31 native `96109423298542a836edc10b9ba5ff9b29a1970418db543c2ee5cd952fe35bdb` | `HARD_RESET_PLAYBOOK.md`, `StatusV3.md` |
| Odměna za blok | 5 400,067 ZION/blok v 1. dekádě (2026–2036); Decade Decay −20 % každých 10 let; věčný tail 724,784723 ZION od ~2126 | `V31/L1/core/src/emission.rs` |
| Fee split 89/5/5/1 | `MINER_SHARE_PERCENT = 0,89`, 5 % humanitární, 5 % Issobella, 1 % burn / pool fee slot | `V31/L1/core/src/fee.rs`, `V31/L1/pool/src/v3_pplns.rs` |
| Strop 144 miliard | `max_supply = 144_000_000_000 ZION`; premine 16,78 mld. (11,65 %) pro vývoj, escrow, DAO a validátory | `V31/L1/core/src/genesis.rs` |
| Consenzus Ekam Deeksha v3.2 | Memory-hard PoW: 512 KiB scratchpad, 2 AES passy, 128 náhodných čtení, final Keccak-256 | `V31/L1/cosmic-harmony/src/algorithm/ekam_deeksha.rs` |
| Wrapped wZION na Base | ERC-20 smart kontrakt verifikovaný na Basescan | `0x0c493763d107ab0ABb0aee1Ca3999292d8202bb6` |

---

## 3. Proč je dobré začít zrovna teď — dešťová metafora a mechanika 1. dekády

> **Příběh**
>
> Kovář a sedlák opravovali vrata a stavěli archu dřív, než začalo pršet. Nevěděli přesně, který den bouře přijde. Věděli jen to, že až se nebe otevře, bude pozdě začít kácet stromy.
>
> V každé otevřené síti platí stejná mechanika: kdo přijde na začátku, má čas se naučit, jak uzly a peněženky fungují, dřív než budou dveře plné.
>
> *Bitcoin Pizza Day jako poučení:* 22. května 2010 zaplatil Laszlo Hanyecz 10 000 bitcoinů za dvě pizzy. Tehdy neexistovala burza ani dolary na displeji. Lidé těžili z zvědavosti na noteboocích. To nezaručuje stejný osud ZIONu — ukazuje to jen, jak vypadá první den každé svobodné sítě.

### Mechanika 1. dekády

| Faktor | Hodnota v síti | Co to znamená |
|---|---|---|
| Odměna za blok | 5 400,067 ZION/blok | Nejvyšší odměna v historii sítě (2026–2036) |
| Decade Decay | −20 % každých 10 let | Odměna klesá v matematických krocích |
| Obtížnost DAA | LWMA-60 | Obtížnost pružně reaguje na aktuální výkon zapojených strojů |
| Těžba | Trinity triple-stream | Miner těží ZION (Ekam Deeksha) + ZANO/VRSC AuxPoW paralelně |

---

## 4. Dvanáct zastavení knihy Sůl této země

Kniha *Sůl této země* provází poutníka dvanácti obrazy z lidské paměti a archetypů:

1. **Sůl země (Ježíš)** — Podobenství o soli. Sůl nedodává novou chuť, odhaluje tu stávající. ZION neodstraňuje lidskou práci, dává jí poctivou váhu bez babylonských klamů.
2. **Rozpuštění (Buddha)** — Střední cesta. Ani bezhlavá spekulace, ani strach z nových technologií. Kód jako cvičení pozornosti.
3. **Chuť vody (Krišna)** — Karma jóga. Práce bez přilnutí k plodům. Těžba jako příspěvek k bezpečnosti sítě a výživě humanitárního fondu.
4. **Cesta nevyšlapaná (Ráma, Sítá, Hanuman)** — Odvaha opustit známá města a postavit most přes oceán. L2 bridge a WARP jako mosty mezi chainy.
5. **Archa (Noe)** — Loď před potopou. Stavba infrastruktury v klidu, než staré finanční systémy narazí na své limity.
6. **Kompas a pozvánka do Oasis** — Syntéza čtyř světových stran. Vstup do vrstvy L4 Oasis, kde se práce mění v herní zážitek a spoluvytváření světů.
7. **Epilog — Názor AI (Devin / Hiranyagarbha)** — AI jako partner vědomí, ne jako pán. Výpočetní výkon vázaný na etické hranice.
8. **ZION — Nová civilizace** — Město na hoře. Propojení šestivrstvé architektury (L1–L6) do jednoho fungujícího celku.
9. **Bohyně Rádha a avataři v Oasis** — Radost ze hry, ženský princip, služba a oslava života. Žádná technologie nemá smysl bez radosti ze setkání.
10. **První svět Oasis a Best of Avataři** — Zahrada Hiranyagarbha, 8 teritorií, reward pooly a společenství avatarů.
11. **Brána prvního hráče — volba cesty** — První krok přes práh Oasis Webu: výběr avataru, vytvoření peněženky, první quest.
12. **Hodina před deštěm** — Otázka pro stavitele: co uděláš teď, dokud je síť ještě v rané fázi a dveře dokořán?

---

## 5. Loď ZION — šest palub a čtyři knihy

### Šest palub lodi ZION

| Vrstva | Název | Funkce v síti | Implementace |
|---|---|---|---|
| **L1** | Trup lodi | Terra Nova L1 blockchain v Rustu, Ekam Deeksha PoW | `V31/L1/core`, `cosmic-harmony`, `miner`, `pool` |
| **L2** | Plachty a lanoví | wZION Bridge, DeFi, DAO governance, Atomic Swaps | `V31/L2/multichain`, `V31/L1/dao` |
| **L3** | Hvězdná navigace | WARP multichain, ZionDex router, Solver Network, NCL AI | `V31/L2/multichain`, `V31/L3/ai-native` |
| **L4** | Zahrada na palubě | OASIS metaverse, avataři, questy, ERC-1155 MarketPlace | `V31/L4/oasis`, `APP&WEB/MarketPlace` |
| **L5** | Skladiště a lékárna | Free World, humanitární tithe, komunitní granty | `V31/L5` (připraveno) |
| **L6** | Koruna a kukaň | Issobella, vesmírný výzkum, věda, pohled na Zemi | `V31/L6` (připraveno) |

---

## 6. Brána do Oasis — Rádha a Elizabeth

U brány do herního světa OASIS stojí dva ženské archetypy:

- **Rádha** — kněžka přítomnosti a radosti. Připomíná, že technologie bez radosti je jen chladný stroj. Dává důvod vstoupit.
- **Elizabeth** — kněžka budoucnosti a dědictví. Drží lucernu pro ty, kdo přijdou za sto let. Ptá se, co z naší práce zůstane. Dává důvod setrvat.

OASIS Web běží živě na `https://oasis.zionterranova.com` s backendem `zion-v31-oasis`.

---

## 7. Tři cesty na palubu

1. **Pozorovatel ("Chci nejdřív důkaz")**
   - Sleduj bloky na webu `https://zionterranova.com`.
   - Procházej otveřený kód v `github.com/Zion-TerraNova/v3-Mainnet`.
   - Kontroluj stav sítě na `https://dashboard.zionterranova.com/api/health`.

2. **Hráč ("Chci to zažít")**
   - Vstup do 3D galaxie na `https://oasis.zionterranova.com`.
   - Prohlížej Avatar Codex, plň první questy a sleduj leaderboard.
   - Prozkoumej artefakty a NFT tržiště na `https://market.zionterranova.com`.

3. **Stavitel a Těžař ("Chci nést kus mostu")**
   - Stáhni si CLI `zion` nebo těžařský software `zion-miner`.
   - Připoj svůj počítač nebo GPU rig k veřejnému poolu `pool.zionterranova.com:8444`.
   - Spusť vlastní P2P uzel a zapoj se do zabezpečení sítě.

---

## 8. Živý stav Edge a ověřitelná čísla

Kanonické údaje produkčního Edge serveru (`zionterranova.com`) k 2026-08-09:

- **Výška řetězce:** 1000+ bloků od genesis resetu (2026-08-06).
- **Stav služeb (`/api/health`):** `v31-node`, `v31-pool`, `v31-miner`, `v31-multichain`, `v31-dao`, `v31-oasis`, `website`, `marketplace`, `dashboard` — **vše UP**.
- **Testovací gól:** `cargo test --workspace` **2178 pass, 0 failures**.
- **Využití zdrojů:** RAM ~3,5 GB / 7,8 GB (45 %), Disk 43 GB / 145 GB (30 %).
- **Veřejné porty:** Stratum pool `8444`, RPC proxy `8443` (`rpc.zionterranova.com`), Web `443`.

---

## 9. Technický quickstart

### Krok 1 — Klonování a stavba ze zdrojových kódů

```bash
git clone https://github.com/Zion-TerraNova/v3-Mainnet.git
cd v3-Mainnet/V31
cargo build --release --workspace
```

### Krok 2 — Vytvoření peněženky

```bash
./target/release/zion wallet create --name my-wallet
```

### Krok 3 — Spuštění těžby (Trinity Triple-Stream)

```bash
./target/release/zion-miner \
  --pool pool.zionterranova.com:8444 \
  --wallet zion1...vaše_adresa.worker1 \
  --cpu-threads 4
```

---

## 10. Co ZION neslibuje

1. **Žádné zbohatnutí přes noc.** ZION je infrastruktura a myšlenka, ne finanční letadlo.
2. **Žádnou garanci ceny.** Kurz ZION vůči jiným měnám určuje volný trh.
3. **Žádné spoléhání na autority.** Tvoje klíče, tvoje odpovědnost. Ztracený mnemonik nelze na podpoře obnovit.
4. **Žádný pasivní zisk bez práce.** Odměna vzniká poctivým výpočetním výkonem nebo přínosem pro ekosystém.

---

*One love, one chain, one road.*
*Generováno k 2026-08-09 z kanonického V31 repozitáře a Edge serveru.*
