# REPORT 2026-11-04 — OASIS avataři: dvojjazyčný kánon (překladová session)

> **Rozsah:** překlad profilů v `docs/docs2.9/ZION_OASIS/SACRED_TRINITY/` mezi CS a EN.
> **Navazuje na:** `REPORT_2026-11-04_AVATARI_WEB.md` (overlay karet + questy, hotovo dříve).
> **Plán pro pokračování:** [`PLAN_OASIS_AVATAR_I18N.md`](../../../PLAN_OASIS_AVATAR_I18N.md) v rootu.

---

## 1. Výsledek

| Metrika | Před session | Po session |
|---|---:|---:|
| `i18n/*.cs.md` | 18 | **47** |
| `i18n/*.en.md` | 0 | **141** |
| Profilů s druhým jazykem | 18 / 205 | **188 / 205** |
| Zbývá | 187 | **16** |

**Všechny překlady prošly** `node scripts/gen-oasis-avatars.mjs` + `npx tsc --noEmit` (0 chyb) v každé dávce.

---

## 2. Co se přeložilo

### 2.1 EN → CS (dokončeno: všech 14 anglických kánonů, které ČR neměly)

| # | Profil | Poznámka |
|---|---|---|
| 39 | Subhadra | tři role (sestra/nevěsta/matka), vůz Darpadalana, Abhimanjuova tragédie |
| 21 | Avalókitéšvara | 1000 rukou, šest slabik, tonglen, protokol soucitu |
| 22 | Vadžrasattva | stoslaviková mantra, čtyři protilehlé síly, systém Vadžra ruce |
| 24 | Mahávatár Bábádží | krija jóga, osm siddhiů, rituál těžby, protokol věčné kotvy |
| 45 | Sri Kalki | Bhagavan + Amma, tři ostří meče, EKAM, hra o Zlaté vejce |
| 44 | Hiranyagarbha | rigvédský chvalozpěv, premine jako kosmická semena |
| 09 | Shanti | mír jako dharma, mediace DAO, prevence vyhoření |
| 10 | Christ | kristovské vědomí, fond nového začátku, křížová cesta |
| 11 | Ardžuna | lučištník, pět šípů, ukrytí Zlatého vejce |
| 08 | Issobela | 60 % humanitárního fondu, slib strážkyně (⚠️ viz §5) |
| 16 | Rádhá | inkognito, préma, „ti kdo mě znají, mlčí" |
| 26 | Saint Germain | fialový plamen, „JÁ JSEM", alchymie egu |
| 07 | Rodokmen | mapa vztahů, žádná hierarchie |
| 17 | Vjása | sestavovatel véd, Mahábhárata, ústraní „Nová Zem" |

### 2.2 CS → EN (dokončeno: 137 profilů)

Souvisle **`81`–`202`** (122 profilů) + **`53`–`80`** (28 profilů) + **`71`–`73`** a **`61`**:

| Blok | Obsah |
|---|---|
| 53–60 | First Nations: Ptesáň Wíň, Kókyangwúti, Hunahpú & Xbalanqué, Don Mariano, Doña Rosalía, Bílé Pero, Ohnivá Oka, Davi Kopenawa |
| 61 | Heyókȟa (posvátný šašek, reverse logic, prevence sebevraždy) |
| 71–73 | Maui, Padmasambhava, Milarepa |
| 74–80 | Tsongkhapa, Atíša, Marpa, Machik Labdrön, Mañjuśrī, Samantabhadra, Medicine Buddha |
| 81–99 | tibetský + japonský kruh (Longchenpa → Benzaiten) |
| 100–112 | japonský + čínský kruh (Kúkai → Dewi Sri) |
| 113–124 | indonéský + australský kruh |
| 125–136 | australský + novozélandský kruh |
| 137–148 | Aotearoa + africký kruh (Yorùbá, Akan, Fon) |
| 149–160 | egyptský + atlantický (Platón) kruh |
| 161–172 | lemurijský + kosmický kruh |
| 173–184 | kosmický + staroseverský |
| 185–196 | keltský + staroegyptský |
| 197–202 | Ptah → B'olon Yokte' K'uh |

**Etické zásady z kánonu zůstaly nedotčené** — `nft_policy` s „consultation gate", „mandatory art review", „anti-fetish", zákaz `Rangda` masky bez balijského konsenzu, „žádné pan-Aboriginal blob copy", `content_warning` u Chöd (nesmí gamifikovat sebepoškozování), poznámka u Heyókȟova wallet gagu (čistě narativní, změna zůstatku vyžaduje schválení ekonomického týmu).

---

## 3. Commity (29)

```
5e2c32381 feat(oasis): překlad 61 Heyókȟa (CS→EN)
13bccebcc feat(oasis): překlady 77-80 (CS→EN) — tibetský kruh dokončen
e73e5f229 feat(oasis): překlady 74-76 (CS→EN) — tibetský kruh
d02e9896b feat(oasis): překlady 71-73 (CS→EN) — Pacifický + tibetský kruh
c1ffe6faa feat(oasis): překlady 53-60 (CS→EN) — First Nations kruh
96d4a7b7f feat(oasis): překlady 197-202 (CS→EN)
54305a0c6 feat(oasis): překlady 185-196 (CS→EN)
bf5e64092 feat(oasis): překlady 173-184 (CS→EN)
9e4dfb282 feat(oasis): překlady 161-172 (CS→EN)
6fd504ede feat(oasis): překlady 149-160 (CS→EN)
2ecbcbfab feat(oasis): překlady 137-148 (CS→EN)
ac2bdff09 feat(oasis): překlady 125-136 (CS→EN)
cb92fc7a6 feat(oasis): překlady 113-124 (CS→EN)
a96ce82ed feat(oasis): překlady 101-102, 104-112 (CS→EN)
447fece4c feat(oasis): překlady 97-100, 103 (CS→EN)
0d03b455a feat(oasis): překlady 88-96 (CS→EN)
b02478e21 feat(oasis): překlady 81-87 (CS→EN)
cbea7a453 feat(oasis): překlad 17 Vjása (EN→CS) — EN→CS sada hotova
8cba54235 feat(oasis): překlady 07 Rodokmen, 26 Saint Germain (EN→CS)
fddb19c1e feat(oasis): překlady 08 Issobela, 16 Rádhá (EN→CS)
cddc6a42e feat(oasis): překlady 09 Shanti, 10 Christ, 11 Ardžuna (EN→CS)
27d20d204 feat(oasis): překlady 45 Kalki, 44 Hiranyagarbha (EN→CS)
4cba68b73 feat(oasis): překlady 22 Vadžrasattva, 24 Bábádží (EN→CS)
d9783a45e feat(oasis): překlady 39 Subhadra, 21 Avalókitéšvara (EN→CS)
3a5649d5e feat(oasis): překlad 50 Zion (EN→CS)
a0481e76e feat(oasis): překlady 47 Trinity, 48 Morpheus, 49 Matrix (EN→CS)
72f750c6e feat(oasis): překlad 46 Neo (EN→CS)
22868a662 feat(oasis): překlad 34 Via Lucis (Komenský)
+ dřívější dávky 00–38 (19 commitů)
```

---

## 4. Ověření

- `node scripts/gen-oasis-avatars.mjs` → *„200 profilů (kánon) + 182 překladů"* (poslední běh).
- `npx tsc --noEmit` → **0 chyb** (spouštěno u každé dávky).
- Vygenerováno `apps/website-v2.9/public/data/oasis/profiles/<id>.<lang>.md`.
- **Nenasazeno** — cíleně: build webu je drahý a koliduje s paralelní session. Jeden deploy až po dokončení všech překladů.

---

## 5. Meze a známé vady (stav před session 2 — vše vyřešeno v §7)

1. ~~**`i18n/08.cs.md` je redundantní**~~ → ✅ generátor teď explicitní překlad v jazyce kánonu preferuje, takže se publikuje čistší čeština z `i18n/08.cs.md`.
2. ~~**Duplicitní ID 42 a 43**~~ → ✅ rozhoduje roster (`resolveProfile`); 42 = Dattatreya, 43 = Maly Princ.
3. ~~**Havajský kruh (62–70) nepřeložen**~~ → ✅ přeloženo (9 profilů) + `40`, `41`, `42`, `43`, `51`, `52`, `08`.
4. **Nulové paddingy** v názvech (`00.cs.md`) — kontrolní skripty pracující s `int(id)` dávají falešné poplachy; `scripts/check-oasis-i18n.mjs` to řeší.
5. **Produkční JS escapuje non-ASCII** (`\xNN`) — ověřovat živě přes HTTP, ne grepem v buildech.
6. ~~**Nenasazené**~~ → ✅ nasazeno (§7.5).

---

## 6. Další krok

Viz [`PLAN_OASIS_AVATAR_I18N.md`](../../../PLAN_OASIS_AVATAR_I18N.md) §4:
zbývá **16 souborů** → `52`, `08`, `40`, `51`, `63`, `64`, `62`, `65`, `67`, `66`, `68`, `69`, `70`, `41`, `42`, `43` (v tomto pořadí, od nejkratšího).
Po dokončení: build → **jeden** deploy → live kontrola CS i EN v modalu.

---

## 7. Session 2 (2026-11-04, večer) — překlady KOMPLETNÍ

### 7.1 Výsledek

| Metrika | Před | Po |
|---|---:|---:|
| `i18n/*.en.md` | 141 | **157** |
| Avatarů s oběma jazyky | 182 / 200 | **200 / 200** |
| Publikovaných profilů | 382 | **400** (200 kánonů + 200 překladů) |
| `node apps/website-v2.9/scripts/check-oasis-i18n.mjs` | — | **0 problémů** |

Přeloženo 16 profilů: `08`, `40`, `41`, `42`, `43`, `51`, `52`, `62`, `63`, `64`, `65`, `66`,
`67`, `68`, `69`, `70` (havajský kruh je nejdelší v kánonu, 17–29 tis. znaků na profil).
Každý překlad prošel kontrolou parity: stejný počet nadpisů, stejný počet code fence, stejné
cíle odkazů, ```json``` bloky shodné (jen lidsky čitelné popisné hodnoty přeložené).

### 7.2 Tři chyby, které session našla a opravila

1. **ID 43 zobrazovalo jinou postavu.** Pro ID 43 existují v kánonu dva soubory
   (`43_MALY_PRINC.md` a `43_SRI_ANAGHA_LAKSHMI.md`) a generátor bral **poslední podle
   `readdir`** → karta „Maly Princ" otevírala profil **Anaghy Lakshmi**. Doloženo na živém
   `public/data/oasis/profiles/43.cs.md`. Nově rozhoduje **roster** (`avatars.json` +
   `AVATAR_ROSTER.md`: 42 = Dattatreya, 43 = Maly Princ) přes `resolveProfile(id, name)`.
   Soubory se **nepřejmenovávají** — odkazuje na ně korpus (`85_LAKSHMI.md`,
   `45_SRI_KALKI_AVATAR.md`, `i18n/44.cs.md`, `README.md`, `GOLDEN_EGG_GAME/*`).
2. **Dva avataři chyběli v plánu.** `09_SHANTI` a `44_HIRANYAGARBHA` měly `.cs.md`, takže se
   počítaly jako hotové. Ve skutečnosti je jejich **kánon anglický** a `detectLang()` je kvůli
   fallbacku `cs` klasifikoval jako české → publikoval se anglický text jako `09.cs.md` a hotový
   **český překlad se zahazoval**. Fallback teď rozhoduje většina (mění jazyk jen u těchto dvou).
3. **Kánony 44 a 45 byly zpola české.** V EN modalu se zobrazovaly české odstavce (např.
   „Není MUŽ ani ŽENA…"). Doplněno do angličtiny přímo v kánonu, struktura 1:1 (řádky se neměnily);
   česká verze zůstává v `i18n/44.cs.md` / `i18n/45.cs.md`.

Navíc: generátor nově preferuje explicitní `i18n/<id>.<baseLang>.md` před kánonem — díky tomu se
u `08` publikuje **čistší česká verze** (`i18n/08.cs.md`) místo dvojjazyčného kánonu.

### 7.3 Nástroj pro příště

`apps/website-v2.9/scripts/check-oasis-i18n.mjs` — jedním příkazem ověří: oba jazyky pro všech
200 avatarů, EN bez českých vět (per-řádková heuristika), CS s českou složkou, CS ≠ EN, kánon
podle rosteru a existenci protějšku v `i18n/`. `--verbose` vypíše per-avatar řádky, `--json` dá
strojový výstup, exit code 1 při problému.

### 7.4 Ověření

- `node apps/website-v2.9/scripts/gen-oasis-avatars.mjs` → *„200 profilů (kánon) + 200 překladů"*
- `node apps/website-v2.9/scripts/check-oasis-i18n.mjs` → **0 problémů**, 400 souborů
- `npx tsc --noEmit` (website-v2.9) → **0 chyb**
- `git status` — `src/lib/oasis/avatars.ts` beze změny (generátor je idempotentní)

### 7.5 Deploy (LIVE) a live kontrola

Změna je **datová** (`public/data/oasis/profiles/*.md`) — `src/lib/oasis/avatars.ts` i stránka
jsou beze změny, takže **nebyl potřeba rebuild**: profil se do modalu tahá lazy fetchí
`/data/oasis/profiles/<id>.<lang>.md`. Nasazeno proto **hot-file** cestou (menší riziko než
build, který by do produkce vzal i rozdělanou práci paralelních sessions):

```bash
rsync -az --delete public/data/oasis/profiles/ \
  zion-edge2:'/opt/zion/APP&WEB/website-v2.9/.next/standalone/public/data/oasis/profiles/'
ssh zion-edge2 'chown -R zion:zion …/profiles && systemctl restart zion-website'
```

⚠️ Restart je **povinný** — nové cesty v `public/` vrací 404, dokud standalone server
neaktualizuje manifest. Na serveru: 382 → **400** souborů.

Live (HTTP 200 na všech): `/l4-oasis/avatars`, `43.cs.md`, `43.en.md`, `70.en.md`, `9.cs.md`,
`9.en.md`, `8.en.md`.

**Obsah live:** `43.cs.md` = *Maly Princ* (dřív Anagha Lakshmi), `9.cs.md` česky + `9.en.md`
anglicky (dřív obojí anglicky), `44.en.md` a `45.en.md` plně anglicky.

**Funkční test (headless Chrome proti produkci)** — klik na kartu → modal → text profilu:

| avatar | CS | EN |
|---|---|---|
| 43 Maly Princ | „Strážce Růže" ✅ | „Guardian of the Rose" ✅ |
| 09 Shanti | „mír, mír, mír" ✅ | „Peace Peace Peace" ✅ |
| 70 Hina | „Tkám kapa na Měsíci" ✅ | „I weave kapa on the Moon" ✅ |

`pageerror: 0`.

### 7.6 Dodatek (stejná session, druhá dávka) — zkrácené české překlady

Kontrola parity odhalila, že **starší EN→CS překlady nejsou kompletní** — český modal
ukazoval kratší text než anglický:

| id | profil | před | po |
|---|---|---:|---:|
| 50 | ZION The Last City | 35/56 nadpisů, 40 % kánonu | **56/56, 97 %** |
| 48 | Morpheus | 31/50, 43 % | **50/50, 97 %** |
| 47 | Trinity | 31/50, 51 % | **50/50, 97 %** |
| 46 | Neo | 44/53, 71 % | **53/53, 96 %** |
| 23 | King Arthur | chyběla sekce „You Are All Arthur" | doplněno |
| 38 | Panna Maria | chyběl blok „Mariin vzkaz ZIONu", sekce Zdroje byla jiná adaptace | doplněno |
| 39 | Subhadra | chyběla hlavička (H1 + motto) | doplněno |
| 00 | Krishna-Maitreya | 3 chybějící odkazy v „Související" | doplněno |
| 81 | Longchen Rabjam | chyběl odkaz „Další: 82" | doplněno |
| 44, 45 | Hiranyagarbha, Kalki | odkazy na 42/43 mířily na nekanonické soubory | srovnáno s kánonem |

**Checker je rozšířený:** `check-oasis-i18n.mjs` teď u každého z 200 párů porovnává
**počet nadpisů, počet code bloků, množinu odkazů a zkrácení pod 85 %** — kondenzovaný
překlad už neprojde. Stav: **0 problémů / 200 párů**.

Live: 400/400 souborů 200, `50.cs.md` 9,6 kB → **23,8 kB**; headless test v CS modalu
potvrdil nové sekce („Meditace obléhání", „Volba červené", „Symbol trojného uzlu",
„Stát se Vyvoleným"), 0 pageerror.
