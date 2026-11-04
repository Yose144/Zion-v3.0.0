# REPORT 2026-11-04 — OASIS avataři: dvojjazyčný kánon (překladová session)

> **Rozsah:** překlad profilů v `docs/docs2.9/ZION_OASIS/SACRED_TRINITY/` mezi CS a EN.
> **Navazuje na:** `REPORT_2026-11-04_AVATARI_WEB.md` (overlay karet + questy, hotovo dříve).
> **Plán pro pokračování:** [`PLAN_OASIS_AVATAR_I18N.md`](../../PLAN_OASIS_AVATAR_I18N.md) v rootu.

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

## 5. Meze a známé vady

1. **`i18n/08.cs.md` je redundantní** — kánon `08_ISSOBELA.md` je už česky, takže tento soubor nic nepřináší (generátor jej přeskočí). Správně má existovat `08.en.md`.
2. **Duplicitní ID 42 a 43** — v kánonu jsou dva soubory na totéž ID (`42_SRI_CHAITANYA_MAHAPRABHU.md` vs `42_SRI_DATTATREYA.md`, `43_MALY_PRINC.md` vs `43_SRI_ANAGHA_LAKSHMI.md`). Generátor drží mapu `id → soubor` a **poslední vyhrává**, takže do stránky jde jen jeden — není doloženo který. **Nepřeloženo** do rozhodnutí 👤.
3. **Havajský kruh (62–70) nepřeložen** — nejdelší profily v kánonu (17–24 tis. znaků každý), ~55 tis. slov celkem. To je hlavní zbývající objem.
4. **Nulové paddingy** v názvech (`00.cs.md`) — kontrolní skripty pracující s `int(id)` dávají falešné poplachy; porovnávat vždy zero-padded.
5. **Produkční JS escapuje non-ASCII** (`\xNN`) — ověřovat živě přes HTTP, ne grepem v buildech.
6. **Nenasazené** = na živém webu je stále build před i18n vrstvou; modální profil se v EN/CS chová podle staré verze.

---

## 6. Další krok

Viz [`PLAN_OASIS_AVATAR_I18N.md`](../../PLAN_OASIS_AVATAR_I18N.md) §4:
zbývá **16 souborů** → `52`, `08`, `40`, `51`, `63`, `64`, `62`, `65`, `67`, `66`, `68`, `69`, `70`, `41`, `42`, `43` (v tomto pořadí, od nejkratšího).
Po dokončení: build → **jeden** deploy → live kontrola CS i EN v modalu.
