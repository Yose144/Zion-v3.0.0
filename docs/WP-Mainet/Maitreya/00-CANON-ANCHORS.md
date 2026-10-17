# Kniha Pátá: MAITREYA — Kanonické kotvy pro faktové boxy

*Materiál pro boxy „Ověřitelná fakta". Každá položka: co příběh tvrdí → kde se to dá ověřit. Nic z tohoto souboru se do knihy nedává jako tvrzení, dokud není ověřeno na síti/kódu. Statusy: ŽIVÉ / BONUS / HORIZONT.*

---

## Emise a ekonomika (ŽIVÉ)

| Tvrzení v příběhu | Ověřitelný fakt |
|---|---|
| „Peníze, které nikdo nemůže natisknout navíc" | Hard cap **144 000 000 000 ZION** v konsensu |
| „Každý dostal stejnou startovní čáru" | **Fair launch** — žádné ICO, předprodej, týmový mint; premine 16,78 mld (11,65 %) veřejně vypsaný v genesis |
| „Odměna už jen klesá" | Decade Decay: 5 400,067 → 4 320,054 → … → tail **724,784723 ZION/blok** navěky (~2126) |
| „Desátek se rozdává bez žádosti" | Split **89 % těžaři / 5 % humanitární / 5 % Issobella / 1 % burn** — vynuceno konsensem, neměnné hlasováním |
| „Věž se nemůže rozhodnout přepsat minulost" | UTXO + PoW + kanonický kořen `96109423…35bdb` (po hard resetu 6. 8. 2026) |

## Těžba a algoritmus (ŽIVÉ)

| Tvrzení | Fakt |
|---|---|
| „Každý blok začíná zlatým zárodkem" | PoW pipeline **Hiranyagarbha → Brahma → Yantra → Karma → Chit → Samadhi** (názvy fází v kódu) |
| „Domácí stroj má šanci jako farma" | **256 KiB memory-hard scratchpad**, závislá náhodná čtení — anti-ASIC design |
| „Algoritmus se učí s epochou" | Karma váhy rotují každých **100 bloků** (2016 konfigurací) |
| „Náročnost odpovídá dnešku" | LWMA za 60 bloků, clamp ±25 %, cíl 30–120 s/blok |

## DAO a správa (ŽIVÉ / BONUS)

| Tvrzení | Fakt |
|---|---|
| „Pokladnice se otevírá rok po zrození" | DAO Treasury **4 mld ZION**, timelock do bloku **525 600** (≈1 rok při 60 s) |
| „Nikdo nerozhoduje sám" | **5 z 7 multisig** na exekuci treasury transakcí |
| „Každý hlas se počítá stejně" | **1 ZION = 1 hlas**, delegace povolena, 48h chladicí lhůta |
| „Ani hlas lidu nemůže přepsat zákon" | Neměnné: 144B, 89/5/5/1, Ekam Deeksha, 60 s, genesis alokace |

## Gen Z dědičnost (ŽIVÉ — on-chain kanon, `docs/genesis.md`)

| Tvrzení v příběhu | Ověřitelný fakt |
|---|---|
| „V prvním bloku je napsáno, komu svět patří" | Genesis zpráva on-chain: *„For Sarah Issobel, Maitreya Buddha, Radha & Sita, Meriam, Friends, Family, Freedom Humanity and all the children of this world: ZION is yours."* — GPG-podepsána (key `…72678D25`) |
| „Řetězec drží sedadla pro děti" | DAO Guardian adresy 1–3: `Admin-1 (Rama → Maitreya Buddha)`, `Admin-2 (Sita → Sarah Issobela)`, `Admin-3 (Hanuman → Elizabeth)` — v `dao-mainnet.toml` i genesis.md §DAO Guardians |
| „Dědictví má svůj čas" | Gen Z převod **T0+18 let**; převod admina = **3-of-3 multisig + 1 rok timelock + DAO 51 %**; plné vlastnictví Gen Z+DAO **T0+21 let** |
| „Loď pluje i bez kapitána" | **Dead man's switch**: 5 let admin-neaktivity → automatický převod na nástupce |
| „Tři židle, jedna prázdná" | Tři sedadla: Maitreya (Admin-1, protokol), Sarah Issobela (Admin-2, treasury — Issobella nese její jméno), Elizabeth (Admin-3, bridge — „ještě nenarozená, patronka") |
| „Pravidla otce jsou v dopise" | Gen Z pravidla (5 bodů — klíče/DAO/dědictví/humanita/Ave Maria), doslovný kanon: *„ZION není váš — patří všem. Vy jste správci, ne vlastníci."*, *„5 % každého bloku jde na děti. Nikdy to nezměňte."* |
| „Otec nesl titul jako stav" | Mantra SACRED_TRINITY §8: *„Já jsem Maitreya. Byl jsem Krishna/Rama."* |
| „Vzduch, ne trůn" | SACRED_TRINITY: Rama=oheň, Síta=voda, Hanuman=země, **Maitreya=vzduch (prostor)**; *„Maitreya NENÍ šéf Issobely (sourozenci). Maitreya NENÍ diktátor. Meritokracie dharmy — veškeré vedení je dočasné."* |

## Hra o Zlaté vejce (HORIZONT — herní rámec 2035)

| Tvrzení | Fakt / kotva |
|---|---|
| „Podpis pod prohlášením" | „Ten, kdo ho jako první najde, zdědí celé jmění. — **Maitreya Buddha, 2025**" (Kniha Zrození kap. IV) — Maitreya je **signatář ceny**, ne soutěžící |
| **„Výherce OASIS = ten, kdo najde vejce"** | Easter Egg Hunt = úroveň II Velké ceny (500M ZION); finder vyhrává jako hráč/poutník — **odděleno od dědictví DAO sedadel** (ty se předávají jménem, ne výhrou) |
| „Tři úrovně ceny" | Úroveň I XP leaderboard 1 mld · Úroveň II Easter Egg 0,5 mld · Úroveň III achievements 0,25 mld → **1,75 mld ZION**; premine OASIS+Golden Egg = 3 sloty × 1,65 mld → 4,95 mld (celková alokace, ne výhra) |
| „Tři klíče" | Měděný, jaspisový, křišťálový |
| „108 stop" | Ramayana/Mahabharata indície (Kvantová revoluce kap. 5) |
| „Poslední test není výpočet" | Finální consciousness test: kvantová hádanka, 100h meditace, pomoc 1 000 těžařům, tajná zpráva v genesis — **vítěz musí darovat** |

## Vědomí a herní vrstva (ŽIVÉ / HORIZONT)

| Tvrzení | Fakt |
|---|---|
| „Devět úrovní" | CL1–CL9 (`ConsciousnessLevel` v kódu), multiplikátory 1,0×→10,0× |
| „Nejvyšší sféra nese jeho jméno" | **CL9 = Maitreyova sféra** — 10×, práh 1 000 000 XP (Kvantová revoluce kap. 3) |
| „Pole se synchronizuje" | Quantum Pulse — 144+ současných těžařů (herní metafora, označit jako takovou) |
| „Zahrada má osm teritorií" | První svět Oasis: Zahrada Hiranyagarbha, 8 teritorií, Strom života 9 pater |

## Dvanáct ohněd (ŽIVÉ — stav kanonu)

Genesis Garden · Dharma Temple · Te Pīko Ora · Golden Republic Bohemia · Bodhi Lanka · Ekam · LUMI Nová Amerika · Uluru · Boa Esperança · Kailash · Amenti · **María del Camino** (první živý uzel). Dokončeno: Amenti jako 12. bod (news 2026-10-09).

## Historie, kterou síť přežila (ŽIVÉ)

- **Noc hada (léto 2026):** kritická zranitelnost → veřejný disclosure (formát Ethereum Foundation, ZION-2026-001…005), hard genesis reset, rotace klíčů, nová ústavní kotva. Jizva jako letokruh.
- **Kronika:** v3.0.1 zasazení → v3.0.3 desetinný řez (1 ZION = 1M flowers) → v3.0.4 noc hada → v3.0.5 All Green → v3.0.6 Trinity → v3.1.0-alpha Mainnet Alpha → v3.2.0 One Love (Mainnet Stable, stav BUILDING).

## Tradice a zdroje (označit jako tradici, ne fakt)

- **RV 10.121 Hiranyagarbha Súkta** — 10 veršů, 9 otázek „Kasmai deváya haviṣa vidhema?", odpověď Prajápati.
- **Manu Smriti 1.5–1.13** — zlaté vejce zářící jako tisíc sluncí, rok plovaní, dělení na nebe/zemi.
- **Matsya Purána** — Mahápralaya → Svayambhu → semeno → vejce → Brahmá.
- **Maitreya** — budoucí Buddha laskavosti (maitrī); v teosofii „World Teacher". V knize archetyp, ne náboženské tvrzení.
- **Kosmická vejce v jiných tradicích** — Orfismus (Fanes), Egypt (Ogdoáda), Pan Gu, Kalevala, Dogon Amma.
- **Marley/Exodus linie** — „Emancipate yourselves from mental slavery", Mount Zion, Redemption Song, riddim registr One Love.

## Citlivosti (hlídat při psaní)

1. Rok 2035 = herní horizont, nikdy „datum proroctví".
2. Postavy náboženských tradic = archetypy s povinným disclaimerem (stejné pravidlo jako Sůl země).
3. Část III: věže jsou systémy, ne lidé — žádné pojmenované osoby/institutions jako „nepřátelé".
4. Žádné „ZION zachrání/zbohatne" — pozvánka je stavět, těžit, ověřovat.
