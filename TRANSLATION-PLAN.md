# TRANSLATION PLAN — Zion Archive (CZ → EN)

> **Verze:** 2.0 · **Datum:** 2026-11-05 · **Vlastník:** 👤
> **Stav:** 146 / 189 překladatelných kapitol (**77,2 %**), zbývá **43 kapitol** (~0,49 MB zdroje)
> **Poslední report:** [`docs/3.2/REPORTS/REPORT_2026-11-05_ARCHIVE_TRANSLATION_SESSION.md`](docs/3.2/REPORTS/REPORT_2026-11-05_ARCHIVE_TRANSLATION_SESSION.md)
> **Kód:** `apps/website-v2.9` · **Plán archivu:** [`docs/plans/ZION-ARCHIVE-COMPLETION.md`](docs/plans/ZION-ARCHIVE-COMPLETION.md)
> **Poslední report:** [`docs/3.2/REPORTS/REPORT_2026-11-04_ARCHIVE_BATCH_W6_W7_W3.md`](docs/3.2/REPORTS/REPORT_2026-11-04_ARCHIVE_BATCH_W6_W7_W3.md)

---

## 0. Jak tento plán používat

Tento soubor je **jediný vstupní bod pro překladovou práci** v nové session. Obsahuje stav,
pravidla, cesty souborů, pořadí i pasti. Při každé dávce:

1. vyber knihu podle §6 (pořadí),
2. přelož 2–4 kapitoly podle §5 (pravidla),
3. ulož na **správnou cestu** podle §4,
4. spusť build + audit (§7), ověř 100% přírůstek,
5. commitni **jen svoje soubory** a pushni (§7.4).

---

## 1. Cíl a definice „hotovo"

**Cíl:** všech 18 knih archivu má kompletní anglický překlad kapitol, knihovna je označuje
`CZ + EN` a čtenář v EN režimu nikde nespadne na český text (kromě front matter a explicitně
nepřeložených dodatků).

**Kniha je hotová, když:**

- audit (`/api/archive/audit`) hlásí `enCoverage: 100` a `missingEn: []`,
- knihovna zobrazuje `CZ + EN` (počítá se z reálných `_EN` souborů),
- kicker/fakta knihy nelžou (odstranit „CZ" nebo „(+EN index)“, pokud už EN je),
- odkazy mezi kapitolami fungují (relativní `./NN-....md`),
- platí QA checklist §5.4.

**Co se nepřekládá:** `00-README` a další `00-*` front matter (nezapočítává se do coverage),
`full.md` (konkatenace), pomocné dokumenty (Onboarding, CHANGELOG) — ty zůstávají CZ nebo mají
vlastní ENindex mimo kapitoly.

---

## 2. Aktuální stav (2026-11-05)

| Kniha | Kapitol (překladatelných) | EN hotovo | Zbývá | Poznámka |
|---|---:|---:|---:|---|
| Maitreya | 19 | **19** | 0 | kompletní |
| Nirvana | 14 | **14** | 0 | kompletní |
| Království srdce | 10 | **10** | 0 | **oficiální EN edice** (klasická) |
| NirvanaCloud | 8 | **8** | 0 | přeloženo 2026-11-05 |
| Sůl této země | 12 | **12** | 0 | přeloženo 2026-11-05 |
| Surta Srdce | 9 | **9** | 0 | **dokončeno 2026-11-05** (CZ + EN) |
| Ekam Deeksha | 10 | **10** | 0 | **dokončeno 2026-11-05** — 401B stuby nahrazeny (CZ + EN) |
| Quantum Revolution | 1 (single-doc) | **1** | 0 | **dokončeno 2026-11-05** — 396B stub nahrazen (CZ + EN) |
| Lumi | 13 | 0 | **13** | |
| Miriam | 13 | **13** | 0 | **dokončeno 2026-11-05** (CZ + EN) |
| BodhiGaia | 13 | 0 | **13** | největší objem (180 kB) |
| MariaCaminho | 12 | **12** | 0 | **dokončeno 2026-11-05** (CZ + EN) |
| Růže | 11 | **11** | 0 | **dokončeno 2026-11-05** (CZ + EN) |
| Na Cestě | 2 | **2** | 0 | **dokončeno 2026-11-05** (CZ + EN) |
| Issobella | 11 | **11** | 0 | **dokončeno 2026-11-05** (CZ + EN) |
| Nabukano | 7 | **7** | 0 | **dokončeno 2026-11-05** (CZ + EN) |
| Kruh Bohyní | 17 | 0 | **17** | |
| Mise Amenti | 8 | **8** | 0 | **dokončeno 2026-11-05** (CZ + EN) |
| **CELKEM** | **189** | **146** | **43** | ~0,49 MB zdroje |

Stav kdykoli zjistíš:

```bash
# produkční/standalone server s ARCHIVE_ADMIN_TOKEN
curl -s -H "Authorization: Bearer $ARCHIVE_ADMIN_TOKEN" \
  http://127.0.0.1:3124/api/archive/audit | python3 -m json.tool
```

---

## 3. Inventář zbývajících kapitol

Formát: `slug (velikost CZ)`. Slugs jsou zároveň cílové názvy EN souborů (viz §4).

### Surta Srdce — hotovo (9/9, 2026-11-05)
Přeloženo 01–09 na `en/books/surta-srdce/kapitoly/`; audit hlásí `enCoverage: 100`, `missingEn: []`.
Kicker i fakt „Jazyky" = `CZ + EN`, knihovní karta bez `czOnly`.

### Nabukano — hotovo (7/7, 2026-11-05)
Korpusová konvence: `<slug>_EN.md` přímo v `korpus/Nabukano/`. Audit `enCoverage: 100`, `missingEn: []`,
fakt „Jazyky" = `CZ + EN` (odvozeno z reálných `_EN` souborů přes `korpusLangs`, bez zásahu do registru).

### Mise Amenti — hotovo (8/8, 2026-11-05)
Korpusová konvence (`korpus/MiseAmenti/<slug>_EN.md`), front matter `README` se nepřekládá (EN index už existoval).
Audit `enCoverage: 100`, `missingEn: []`; kicker = `CZ + EN`. Statusy (`ŽIVÉ/STAVBA/HORIZONT/HYPOTÉZA/MÝTUS`,
`NEDOLOŽENO`, `NEPLATNÝ NÁROK`) překládány doslovně jako `LIVE/BUILDING/HORIZON/HYPOTHESIS/MYTH`,
`UNSUBSTANTIATED`, `INVALID CLAIM`; čísla (89/5/5/1 %, 23 000+ bloků, 60 s, 512 KiB, `u64::MAX`) nezměněna.

### Růže — hotovo (11/11, 2026-11-05)
Korpusová konvence (`korpus/Ruze/<slug>_EN.md`). Audit `enCoverage: 100`, `missingEn: []`, kicker `CZ + EN`,
knihovní karta bez `czOnly`. Celý děj = MÝTUS; kotva příběhu (kap. X) přeložena 1:1 včetně tabulky tvrzení
a smíšených stavů (`LIVE` existence řádku / `BUILDING` metadata / `MYTH` obsah / `UNSUBSTANTIATED` fyzická
růže / `HORIZON / NOT STARTED` pilot).
**Konvence jmen (závazná i pro Miriam/Lumi):** `Sára → Sarah`, `Rádha → Radha`, `Lumi`, `Ana`, `Miriam`
beze změny; `Exupéry` s diakritikou.

### Issobella — hotovo (11/11, 2026-11-05)
Korpusová konvence (`korpus/Issobella/<slug>_EN.md`); front matter `00-README` jede v EN indexu, do coverage nevstupuje.
Audit `enCoverage: 100`, `missingEn: []`, kicker = `CZ + EN`. Statusy doslovně (`ŽIVÉ→LIVE`, `STAVBA→BUILDING`,
`HORIZONT→HORIZON`, `HYPOTÉZA→HYPOTHESIS`, `MÝTUS→MYTH`, `NEPLATNÉ TVRZENÍ→INVALID CLAIM`).
**Nesahat na:** adresy `zion1z4s3a5…` / `zion1f5h5k6t8…`, `ISSOBELLA_PCT = 5`, 2,5 mld ZION, lock 144 000,
3-of-3 multisig, port 8097, 0,38 g / 200 m / ~2 RPM / 1,0 g 20 min / r=12 m / 12 RPM, LEO 400–550 km,
100 kW → 1 MW+. Sanitizované placeholdery (`issobella tracker`, `zion-*-service`, `interní port`) zůstávají placeholdery.

### Na Cestě — hotovo (2/2, 2026-11-05)
Korpusová konvence (`korpus/NaCeste/<slug>_EN.md`). Audit `enCoverage: 100`, `missingEn: []`, kicker `CZ + EN`,
knihovní karta bez `czOnly`. Velká kapitola má **1:1 strukturu s CZ** (429 řádků, 215 neprázdných, 9 sekcí, 9 oddělovačů).
MÝTUS/HORIZONT statusy a hranice (odmítnutá návštěva Raiatea + Uluru, pozastavený převoz semene, FPIC) opisovat doslovně.

### MariaCaminho — hotovo (12/12, 2026-11-05)
Korpusová konvence (`korpus/MariaCaminho/<slug>_EN.md`). Audit `enCoverage: 100`, `missingEn: []`,
kicker `CZ + EN`, knihovní karta bez `czOnly`. Zjevení = `MYTH` na `LIVE` tradici; trup I–II `BUILDING`,
trup III `HORIZON`; rezerva 300M ZION = `LIVE` registry záznam (ne flotila). Neměnit: `48dcc0b2-…` id,
data 2026-10-01, 1917 / 352 / 1676 / 1488 / 2008, Ø~91 cm, ~2 090 m², Blombos 75–100 tis. let.
**Konvence jmen flotily (závazná i pro Lumi/NaCeste/MariaCaminho kříže):** `Poutník → the Pilgrim`,
kapitánky `Inés Varela`, `Teura`, `Anjali`, `Hina`; trupy `Santa María la Mayor` (I), `Nossa Senhora de Fátima` (II),
`María de las Nieves` (III); dítě `Elizabeth` = Lumi = Malý princ / Pražské Jezulátko.

### Ekam Deeksha — hotovo (10/10, 2026-11-05)
Public-docs konvence (`public/docs/books/ekam-deeksha/` → **`public/docs/en/books/ekam-deeksha/`**).
EN soubory byly **401B stuby s „language note"** — překlad je **přepsal** (ne přidal vedle); audit `enCoverage: 100`, `missingEn: []`.
Kicker = `CZ + EN`. Zachovat: `BOOK-FULL-VERSION.md` (126 kB) **není kapitola** a zůstává stub; code blocky v kap. 16
(`seed = BLAKE2b(block_header)` … `return result <= target_difficulty`) opisovat **doslova**, včetně 256 KiB / 100 bloků / 2016 epoch.

### Quantum Revolution — hotovo (1/1, 2026-11-05)
Single-doc: `public/docs/books/quantum-revolution.md` → **`public/docs/en/books/quantum-revolution.md`** (396B stub přepsán).
**Pozor na čtenář:** `QR_BOOK.singleDoc.chapterMatch.re` je `/^(?:Kapitola|Chapter)\s+\d+/i` — bez `Chapter` by EN
reader spadl na jednu kapitolu; stejně `singleDocInfo()` v `/api/archive/audit`. Po fixu audit hlásí `cs 10 / en 10`.
Emoji, tabulky (CL1–CL9, roadmapa 2026–2040+), čísla (144 000, 1B ZION, 108 indicií, 144B/1,44B, `$50M`, 885 řádků)
a tabulka 11 jazykových edic zůstávají doslova.

### Miriam — hotovo (13/13, 2026-11-05)
Korpusová konvence (`korpus/Miriam/<slug>_EN.md`). Audit `enCoverage: 100`, `missingEn: []`, kicker `CZ + EN`,
karta bez `czOnly`. **Tři vrstvy knihy** (`Kámen / Hlína / Sen`) překládány jako **Stone / Clay / Dream** a nikdy
nezaměňovány; statusy `LIVE / UNSUBSTANTIATED / INVALID CLAIM / HYPOTHESIS`. Neměnit: 591 (Řehoř, homilie 33),
1969 + 2016 (dekrety), 1180 / ~1260 (Chrétien, Zlatá legenda), 1896/1955 (BG 8502), `P.Oxy. 3525`, `P.Ryl. 463`,
NHC II, 144 000 / 144 loktů, 12 000 honů, 1260 dní, 9 000 denárů, 1956 / 1993 (Plantard).
**Pozor:** tabulky v CZ mají někde zdvojené `||` (prázdný první sloupec) — v EN normalizováno na `|`.

### Lumi — 13
`01-Dite-na-Pridi` (8k) · `02-Dum-Jmen` (8k) · `03-Mosty-a-Trziste-u-Mostu` (8k) · `04-Zlate-Luno-a-Hlas-Bez-Klice` (8k) · `05-Brana-a-Dve-Knezky` (9k) · `06-Semeno-pod-Domem` (10k) · `07-Pet-Zahrad-Jedne-Zeme` (10k) · `08-Jmeno-Ktere-Uz-Mela` (8k) · `09-Strom-nad-Zemi` (9k) · `10-Kvantovy-Ohen-a-Hlidac` (10k) · `11-Sto-Let-Lucerny` (12k) · `12-Brana-Zustava-Otevrena` (10k) · `13-Kotva-Pravdy-a-Hranice` (16k)

### Kruh Bohyní — 17
`00-LODE-A-LUCERNA` (8k) · `00-OUTLINE` (9k) · `00-PROLOG` (8k) · `01-Dcera-Hliny` (9k) · `02-Strazkyne-Ohne-a-Ticha` (9k) · `03-Dcera-Laguny` (6k) · `04-Strazkyne-Kruhu` (6k) · `05-Strazkyne-Stromu` (6k) · `06-Seste-Sedadlo` (7k) · `07-Ta-Ktera-Drzi-Nebe` (6k) · `08-Studna-Ktera-Prsi` (6k) · `09-Tri-Klice` (5k) · `10-Jak-Se-Kruh-Drzi` (5k) · `11-Kdyz-Zena-Dojde-Cestu` (6k) · `12-Dvanact-Ohnu` (5k) · `13-Kotva-Pravdy` (4k) · `14-Epilog` (4k)

### BodhiGaia — 13
`01-Semeno-a-Sul` (8k) · `02-Tri-Stromy-Jedna-Zahrada` (10k) · `03-Zahrada-Genesis` (11k) · `04-Dharma-Temple-Nova-Bodhi-Gaia` (12k) · `05-Te-Piko-Ora` (13k) · `06-Protokoly-Zeme` (14k) · `07-Zahrada-v-Oasis-a-na-Webu` (13k) · `08-Cesta-Poutnika-Onboarding-L5` (13k) · `09-Kotva-Pravdy-a-Hranice` (**22k**) · `10-Golden-Republic-Bohemia` (18k) · `11-Bodhi-Lanka` (**22k**) · `12-Ruze-v-Zahrade-Genesis` (8k) · `13-Nova-Amerika` (11k)

---

## 4. Kde soubory žijí (kritické — plete se to)

Existují **tři různé konvence** podle typu knihy. Špatná cesta = překlad se v readeru neobjeví
(audit hlásí 0 %).

| Typ knihy | CZ zdroj | EN cíl | Příklad |
|---|---|---|---|
| **Dedikovaný reader** (`maitreya`, `nirvana`, `surta-srdce`, `kralovstvi-srdce`) | `archive-content/books/<id>/kapitoly/<slug>.md` | `archive-content/en/books/<id>/kapitoly/<slug>.md` | `en/books/surta-srdce/kapitoly/02-Gate-Prvni-Brana.md` |
| **Korpus** (`sulzeme`, `lumi`, `miriam`, `bodhigaia`, `mariacaminho`, `ruze`, `naceste`, `nirvanacloud`, `issobella`, `nabukano`, `kruhbohyni`, `miseamenti`) | `archive-content/korpus/<Dir>/<slug>.md` | **stejný adresář**, `<slug>_EN.md` | `korpus/Ruze/01-Prazdna-Nadoba_EN.md` |
| **Public-docs reader** (`ekam`) | `public/docs/books/ekam-deeksha/<slug>.md` | `public/docs/en/books/ekam-deeksha/<slug>.md` | `public/docs/en/books/ekam-deeksha/BOOK-CAST-I.md` |
| **Single-doc** (`quantum-revolution`) | `public/docs/books/quantum-revolution.md` | `public/docs/en/books/quantum-revolution.md` | celý dokument |

> ⚠️ **Surta Srdce je dedikovaný reader**, ne korpus — i když má paralelní kopii v
> `korpus/SurtaSrdce`. Překlad patří do `en/books/surta-srdce/kapitoly/`. (Tato chyba se už
> jednou stala; audit ji odhalil jako 0 %.)

**Front matter:** `00-README` a `00-*` se do coverage nepočítají. U korpusu se `_EN` soubor
front matter ignoruje; u dedikovaných readerů se `00-README` EN nepřekládá (nebo může existovat,
ale do coverage nevstoupí).

---

## 5. Pravidla překladu

### 5.1 Věrnost a tón

- Překlad je **literární, ne doslovný**; zachovává rytmus, obrazy a pointy.
- Neměnit fakta, čísla, data, názvy protokolu, citace Písma a manter.
- Mantry ponechat v původním přepisu (`gate gate pāragate…`, `oṃ maṇi padme hūṃ`), s kurzívou.
- Jména postav a míst: standardní anglický přepis (Krishna, Radha, Sita, Hanuman, Arjuna,
  Avalokiteshvara, Vairochana, Akshobhya, Amitabha…), konzistentně napříč knihami.
- Odborné termíny: viz glosář §5.5.

### 5.2 Markdown a odkazy

- Zachovat **strukturu nadpisů** (`#`, `##`, `###`) a pořadí sekcí.
- Relativní odkazy mezi kapitolami nechat na **stejné české slugy**:
  `[Chapter 3](./03-Bardo-Velkeho-Prechodu.md)` — resolver je mapuje na aktuální jazyk.
- Odkazy na index: u korpusu `./00-README_EN.md`, u dedikovaných readerů `./00-README.md`
  (nebo `00-README_EN.md`, pokud existuje).
- Tabulky: zachovat sloupce; hlavičky přeložit, čísla a adresy ne.
- Blokové citáty (`>`) a oddělovače (`---`) zachovat.
- Interní cesty typu `interní repozitář` překládat jako „the internal repository“;
  `docs/...` a `canon/...` cesty nechat beze změny.

### 5.3 Statusy a poctivost

- Sekce „Kotva pravdy / Anchor of Truth“ musí zůstat **poctivá**: co je kód, co mýtus,
  co HORIZONT. Neměnit statusy ani čísla.
- Kde CZ říká „MÝTUS“, EN musí říkat „MYTH“; kde CZ říká „STAVBA“, EN „BUILDING“.
- Nemazat bezpečnostní a regulatorní věty (MiCA, „not investment advice“).

### 5.4 QA checklist (před commitem)

- [ ] 1:1 struktura nadpisů a tabulek s CZ.
- [ ] Žádný zbytek češtiny v EN textu (kromě jmen/citací, které mají zůstat).
- [ ] Odkazy míří na existující slugy; žádný `404` v readeru.
- [ ] Mantry a jména konzistentní s ostatními knihami.
- [ ] Čísla, data, adresy, fee split, hard cap nezměněné.
- [ ] „Anchor of Truth“ má stejné řádky a statusy.
- [ ] Soubor na **správné cestě** (§4) a se správným názvem.
- [ ] `npm run build` prošel; audit hlásí +N kapitol a 0 chyb CS.

### 5.5 Glosář (základ, rozšiřovat)

| CZ | EN |
|---|---|
| sůl země | salt of the earth |
| rozpuštění | dissolution |
| chuť vody | the taste of water |
| kompas / mapa | compass / map |
| archa | the ark |
| most | bridge |
| brána | gate |
| zlaté vejce / zlaté lůno | golden egg / golden womb |
| probuzení | awakening |
| bódhisattva | bodhisattva |
| dharma | dharma |
| sútra | sūtra |
| mantra | mantra |
| střední cesta | Middle Way |
| nestálost | impermanence |
| soucit | compassion |
| dávání | giving (dāna) |
| ztišení | stillness |
| společenství / guild | community / guild |
| úroveň vědomí | consciousness level |
| kotva pravdy | anchor of truth |
| ověřitelné | verifiable |
| těžba / těžař | mining / miner |
| odměna za blok | block reward |
| obtížnost | difficulty |
| emise | emission |
| lidský desátek | humanitarian tithe |
| peněženka | wallet |
| uzel | node |
| konsensus | consensus |

---

## 6. Pořadí prací (doporučené)

Pořadí je od nejmenších knih k největším, aby bylo brzy vidět „hotovo“ a snižovalo se riziko
únavy z jedné obří knihy.

| Milník | Kniha | Kapitol | Odhad dávek |
|---|---|---:|---:|
| **T1** | Surta Srdce ✅ | 9 | hotovo 2026-11-05 |
| **T2** | Nabukano ✅ | 7 | hotovo 2026-11-05 |
| **T3** | Mise Amenti ✅ | 8 | hotovo 2026-11-05 |
| **T4** | Růže ✅ | 11 | hotovo 2026-11-05 |
| **T5** | Issobella ✅ | 11 | hotovo 2026-11-05 |
| **T6** | Na Cestě ✅ | 2 | hotovo 2026-11-05 |
| **T7** | MariaCaminho ✅ | 12 | hotovo 2026-11-05 |
| **T8** | Ekam Deeksha ✅ | 10 | hotovo 2026-11-05 |
| **T9** | Quantum Revolution ✅ | 1 | hotovo 2026-11-05 |
| **T10** | Miriam ✅ | 13 | hotovo 2026-11-05 |
| **T11** | Lumi | 13 | 4 |
| **T12** | Kruh Bohyní | 17 | 5 |
| **T13** | BodhiGaia | 13 | 5 (největší objem) |

**Tempo:** 2–4 kapitoly na session (podle velikosti); cca **12–19 session-dávek** na zbývajících 43
kapitol. Po každé knize: report + commit + push.

**Alternativní pořadí podle priority 👤:** pokud má být první „hlavní osa“ (Ekam, Quantum
Revolution, Miriam/Lumi), přeskoč na T8/T9/T10 — zbytek se nemění.

---

## 7. Pracovní postup (jedna dávka)

### 7.1 Příprava

```bash
cd apps/website-v2.9
# ověř stav před prací
git status --short
```

### 7.2 Překlad

- Otevři CZ kapitolu, přelož do EN podle §5.
- Ulož na správnou cestu (§4) se správným názvem:
  - korpus: `<slug>_EN.md` ve stejném adresáři,
  - dedikovaný reader: `en/books/<id>/kapitoly/<slug>.md`,
  - ekam: `public/docs/en/books/ekam-deeksha/<slug>.md`,
  - QR: `public/docs/en/books/quantum-revolution.md`.

### 7.3 Build + audit

```bash
cd apps/website-v2.9
npm run build          # regeneruje src/lib/doc-manifest.json
# standalone ověření (volitelné, ale doporučené):
cd .next/standalone/apps/website-v2.9
PORT=3124 ARCHIVE_PASS_CODES=ZAP-TEST-LOCAL-1234 ARCHIVE_ADMIN_TOKEN=test-admin-token \
  node server.js &
sleep 4
curl -s -H 'Authorization: Bearer test-admin-token' \
  http://127.0.0.1:3124/api/archive/audit | python3 -c \
  "import json,sys; d=json.load(sys.stdin); print(d['totals']); [print(b['id'], b.get('enCoverage'), b.get('missingEn')) for b in d['books'] if b.get('missingEn')]"
kill %1
```

### 7.4 Commit + push (hygiena)

```bash
cd /Users/yeshuae/Projects/2.9.6
git add <jen svoje soubory> apps/website-v2.9/src/lib/doc-manifest.json \
  apps/website-v2.9/AGENTS.md docs/plans/ZION-ARCHIVE-COMPLETION.md
git diff --cached --name-status        # zkontroluj, že tam nejsou cizí soubory
git commit -m "feat(archive): <kniha> — kapitoly X–Y anglicky"
git push
```

> **Pravidlo:** pokud se ve staged objeví soubory z paralelní session, proveď
> `git restore --staged -- <cesta>` a commit zopakuj. Nikdy necommituj cizí práci.

### 7.5 Deploy (když má být vidět live)

```bash
bash apps/website-v2.9/deploy/deploy-web2.9.sh
```

---

## 8. Rizika a pasti (zjištěné)

1. **Špatná cesta souboru** — nejčastější chyba. Surta má `en/books/surta-srdce/`, ne korpus.
   Audit je jediný důkaz, že je překlad vidět.
2. **Stub místo překladu** — soubor < 1 500 B s „language note“ se počítá jako chybějící
   (audit i reader to tak berou). Nikdy nevytvářet stuby jako „překlad“.
3. **Manifest** — `src/lib/doc-manifest.json` je generovaný; bez `npm run build` EN soubory
   v korpusu neexistují pro `korpusChapters`. Commituj manifest s sebou.
4. **Front matter** — `00-README`/`00-*` nejsou kapitoly; nepřekládat jako kapitolu a
   nepočítat do coverage.
5. **Paralelní session** — často má staged vlastní soubory; před commitem vždy zkontroluj
   `git diff --cached`.
6. **Deploy** — build z pracovního stromu; když je strom uprostřed cizí práce, build může
   selhat. Před deployem zkontroluj `git status` a build log.
7. **Odkazy** — resolver mapuje české slugy; neměnit názvy souborů ani odkazy na `_EN`.
8. **Kvalita** — nové překlady nejsou oficiální edice (jako Království srdce); u veřejných
   textů doporučit redakční revizi 👤.

---

## 9. Otevřené otázky pro 👤

1. **Redakční revize** nových překladů (Maitreya/Nirvana/… byly přeloženy dříve; nové dávky
   2026-11-05 jsou čerstvé) — chceš je označit jako „EN draft“ do revize, nebo rovnou vydávat?
2. **Oficiální EN edice** — u Království srdce se použila oficiální klasická edice; existují
   další oficiální překlady mimo repo (marketplace, canon), které má smysl napojit místo
   nového překladu?
3. **Priorita** — potvrzuješ pořadí T1–T13, nebo chceš první hlavní osu (Ekam / Quantum
   Revolution / Miriam / Lumi)?
4. **Dodatky** — překládat i `Kotva pravdy` dodatky/glosáře, nebo jen kapitoly?

---

## 10. Handoff prompt pro novou session

> „Pracuj na `TRANSLATION-PLAN.md`. Pokračuj knihou **Surta Srdce** (zbývá 04–09) podle §4 a §5.
> Po každé dávce: build, audit (100 % pro knihu), commit pouze vlastních souborů, push.
> Paralelní session respektuj — nikdy necommituj cizí staged soubory.“

---

## 11. Rychlý přehled příkazů

```bash
# stav
git -C /Users/yeshuae/Projects/2.9.6 status --short

# build + manifest
npm --prefix apps/website-v2.9 run build

# audit (standalone)
cd apps/website-v2.9/.next/standalone/apps/website-v2.9
PORT=3124 ARCHIVE_PASS_CODES=ZAP-TEST-LOCAL-1234 ARCHIVE_ADMIN_TOKEN=test-admin-token node server.js &
curl -s -H 'Authorization: Bearer test-admin-token' http://127.0.0.1:3124/api/archive/audit
kill %1

# deploy
bash apps/website-v2.9/deploy/deploy-web2.9.sh

# commit + push
git add <soubory> && git diff --cached --name-status && git commit -m "..." && git push
```
