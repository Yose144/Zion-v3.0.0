# Plán kompletního překladu dokumentace (CS / EN)

Tento dokument popisuje **postupné** dorovnání markdown dokumentace ve `public/docs/` do dvou jazykových větví tak, aby výběr jazyka na webu (`/docs`) vždy načetl správný soubor.

## 1) Mechanismus ve webu

- Pro každou položku v navigaci dokumentace je v kódu relativní cesta `file`, např. `v2.9.9/README.md`.
- Při načtení stránka zkusí v tomto pořadí:
  1. `public/docs/cs/<file>` nebo `public/docs/en/<file>` podle aktivního jazyka UI
  2. pokud neexistuje → `public/docs/<file>` (**sdílený fallback**)
- Dokud tedy **neexistují oba** soubory `cs/...` a `en/...`, oba jazyky v UI čtou **stejný** root soubor (často česky nebo smíšeně).

## 2) Inventura (co je v navigaci `/docs`)

Spusť z kořene webu:

```bash
npm run docs:i18n
```

Po dokončení **vlny A** má inventura typicky více položek `cs+en` a méně `root-only` (aktuální čísla vždy ve výstupu příkazu výše).

Volitelně strojový výstup:

```bash
node scripts/docs-i18n-report.mjs --json
```

**Stav k sepsání plánu (cesty odkazované z `src/app/docs/page.tsx` only):**

| Stav | Počet | Význam |
|------|--------|--------|
| **cs+en** | (viz `npm run docs:i18n`) | Oba jazyky mají vlastní soubor |
| **root-only** | (viz výstup) | Jen `public/docs/<cesta>` — sdílený fallback |

**Už dříve hotové páry (cs+en) před vlnou A** zahrnovaly mimo jiné: `index.md`, `whitepaper-lite.md`, `mainnet/README.md`, `architecture/README.md`, `legal/*`.

## 3) Konvence souborů

- **Stejná relativní cesta** pod `cs/` i `en/`, např.:
  - `public/docs/cs/v2.9.9/README.md`
  - `public/docs/en/v2.9.9/README.md`
- Kořenový `public/docs/v2.9.9/README.md` může zůstat jako **kanonický zdroj** pro git historii, nebo po stabilizaci překladů sloužit jen jako redirect poznámka — doporučení: po ověření čitelnosti **nechat root jako EN nebo „neutral“ šablonu** a jazyky držet striktně v `cs/` a `en/`, aby se předešlo omylům. Minimálně dokud nejsou oba překlady hotové, **nemazat** root soubor (fallback pro starší bookmarky a skripty).
- Terminologie: sjednotit s UI (`translations.ts`, názvy CHv3/CHv4, „test mainnet“, názvy uzlů).
- Frontmatter: nepovinný; pokud přidáš `title:` / `description:`, drž je v daném jazyce.

## 4) Postup práce na jednom dokumentu

1. Vyber soubor z reportu (`root-only`).
2. Otevři `public/docs/<cesta>` (aktuální obsah).
3. Vytvoř `public/docs/cs/<cesta>` a `public/docs/en/<cesta>`.
4. Jednu větev vyplň překladem / redakcí druhé (ne kopíruj slepě — zkontroluj technickou přesnost).
5. Lokálně: `/docs`, přepni CS/EN, ověř hash dokladu (např. `#v299-readme`).
6. Commit: ideálně jedna logická sada souborů (jedna kapitola / jedna verze), aby šlo reviewovat.

## 5) Vlny (doporučené pořadí)

### Vlna A — živá provozní osa (nejvyšší priorita)

**Stav: hotovo (2026) — páry `cs/` + `en/` doplněny pro níže uvedené cesty.**

| Cesta | Poznámka |
|-------|----------|
| `v2.9.9/README.md` | Pure Code přehled |
| `v2.9.9/changelog.md` | |
| `v2.9.9/migration.md` | |
| `v2.9.8/README.md` | Ekam runtime |
| `v2.9.8/changelog.md` | |
| `v2.9.8/runtime.md` | |
| `v2.9.7/README.md` | Pre-mainnet gate (CS přeloženo z EN kořene; EN = kanonický původní text) |
| `v2.9.7/changelog.md` | |
| `v2.9.7/mainnet-gate.md` | Checklist |
| `v2.9.6/p2p.md` | |

### Vlna B — baseline protokolu v2.9.6

**Stav: hotovo — pro všechny cesty níže existují `cs/v2.9.6/...` a `en/v2.9.6/...` (README: CS redakce + EN z kořene; ostatní CS z kořene u českých textů, EN přeloženo nebo stručně zkonspirováno u velkých spec).**

| Cesta |
|-------|
| `v2.9.6/README.md` |
| `v2.9.6/changelog.md` |
| `v2.9.6/migration.md` |
| `v2.9.6/layer-architecture.md` |
| `v2.9.6/tokenomics.md` |
| `v2.9.6/consensus.md` |
| `v2.9.6/launch-plan.md` |
| `v2.9.6/audit.md` |

### Vlna C — veřejná launch cesta & listing

**Stav: hotovo — `mainnet/genesis-book.md`, `mainnet/coingecko.md` a `architecture/consensus.md` mají páry `cs/` + `en/` (EN checklist CoinGecko je plný překlad; CS `architecture/consensus` je redakce EN originálu).**

| Cesta |
|-------|
| `mainnet/genesis-book.md` |
| `mainnet/coingecko.md` |
| `architecture/consensus.md` |

*( `mainnet/README.md` už má cs+en. )*

### Vlna D — AI Native

**Stav: hotovo — čtyři soubory pod `ai-native/` mají páry `cs/` + `en/` (CS kopie z kořene + úprava relativních odkazů; EN plný překlad).**

| Cesta |
|-------|
| `ai-native/README.md` |
| `ai-native/cuda-x.md` |
| `ai-native/ncl.md` |
| `ai-native/oasis.md` |

### Vlna E — whitepapery a velké manifesty (náročné objemy)

**Stav: hotovo pro položky z navigace — každá cesta má `cs/whitepaper/…` a `en/whitepaper/…`.**  
- **V3 Mainnet:** plný pár CS překlad + EN kopie z kořene.  
- **v2.9.5 FULL:** CS = plný kánon (kopie kořene); EN = **anglický výtah** s odkazem na plné CS a na V3 whitepaper.  
- **v2.8.5 + Cosmic Map Public:** CS = kopie kořene; EN u **Cosmic Map** = **anglický průvodce / obsah**, nikoli plný překlad 14k řádků; u **v2.8.5** sdílená archivní kopie v CS i EN (smíšený zdroj).

Dělit na menší commity; právní review u citlivých pasáží.

| Cesta |
|-------|
| `whitepaper/ZION_V3_Whitepaper.md` |
| `whitepaper/ZION_Whitepaper_v2.9.5_FULL.md` |
| `whitepaper/ZION_Whitepaper_v2.8.5.md` |
| `whitepaper/COSMIC_MAP_2.8.5_PUBLIC_EDITION.md` |

### Vlna F — archivní řady

| Cesta |
|-------|
| `v2.9.5/README.md`, `changelog.md`, `tokenomics.md`, `consensus.md` |
| `v2.9/README.md`, `origins.md` |
| `v2.8.x/README.md` |

## 6) Mimo `page.tsx`

V `public/docs/` je více souborů než zobrazuje strom na `/docs` (knihy, tutoriály, starší stromy). **Druhá fáze:** rozšířit report nebo udržovat ruční seznam pro `cs/getting-started.md`, `en/...`, `tutorials/`, `books/`, atd. — nebo postupně přidávat odkazy do navigace a hned párovat CS/EN.

## 7) Kontrolní seznam před merge

- [ ] `npm run docs:i18n` — daná cesta ukazuje **cs+en** (nebo úmyslně root + nový pár)
- [ ] `npm run build` v `website-v2.9` projde
- [ ] Ručně: `/docs` + přepnutí jazyka na stejný dokument
- [ ] Žádné rozbité relativní odkazy uvnitř MD (cesty k `/docs/...` na webu vs. repo)

## 8) Rychlé metriky „hotovo“

- **Fáze 1 (navigace):** všechny dříve `root-only` cesty z reportu mají `cs/` i `en/` (sleduj `npm run docs:i18n`).
- **Fáze 2:** obsah mimo navigaci podle potřeby produktu.

---

*Aktualizováno: vlna A dokončena; metriky vždy ověř příkazem `npm run docs:i18n`.*
