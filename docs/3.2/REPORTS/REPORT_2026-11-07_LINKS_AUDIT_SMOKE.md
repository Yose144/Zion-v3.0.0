# Redakční fronta 5.B7 / 5.S1 / 5.S2 — odkazy, veřejné povrchy, audit závislostí

> **Datum:** 2026-11-07 (večer)
> **Zadání:** bod 5 z doporučené fronty — `5.B7` (dead links + content gaps), `5.S1` (veřejné povrchy 200 + Playwright smoke), `5.S2` (`npm audit` 0 critical).
> **Režim:** jen dokumentace, testy a skripty. **Žádný deploy, žádná změna produktu, žádný zásah do cizí rozpracované práce** (paralelní session měla otevřené `apps/nirvana*`, `apps/website-v2.9/src/components/Hiran*` — necommitováno, nedotčeno).

## 1. 5.B7 — rozbité odkazy: 478 → 28

`scripts/ops/check-doc-links.py` hlásil **478 rozbitých relativních odkazů v 901 souboru** živého stromu. Starší zápis (24. 10.) tvrdil „basename match: 0 unikátních cílů → žádný bezpečný bulk-rewrite" — to už neplatilo, takže vznikl nástroj na ověřenou mechanickou opravu.

**Nový `scripts/ops/fix-doc-links.py`** (dry-run default, `--write`, `--show-fixes`, `--show-gaps`, `--json`):

- bere **stejný seznam souborů, stejný `LINK_RE` i stejnou definici „rozbitý"** jako `check-doc-links.py` (importuje ho — žádná druhá pravda),
- odkaz řeší proti **živému stromu** (`archive/`, `PUBLIC/`, `docs/docs2.9/`, `apps/*/archive-content/` se záměrně neberou: odkaz do archivu není oprava),
- cíl vybírá podle jména souboru; při shodě jmen rozhoduje **nejdelší shoda koncových segmentů cesty** a musí být **striktně lepší než druhý kandidát**, jinak odkaz zůstává jako content gap,
- přepisuje **jen cíl odkazu**, kotvu (`#…`) i query zachová, odkazy uvnitř fenced code bloků ignoruje,
- při zápisu dělá **sanity kontrolu offsetu** (`text[s:e] == old`), jinak soubor přeskočí — žádné naslepo přepsané řádky.

| Výsledek | Počet |
|---|---|
| mechanicky opraveno | **445** |
| ručně dořešeno (viz níže) | **5** |
| zbývá = content gap | **28** |
| kontrola po zápisu (`check-doc-links.py`) | **478 → 28** |

**Ruční dořešení (5):**

- `Kingdom/apps/desktop/AI_NATIVE_README.md` — odkazy na `../docs/AI_NATIVE_INTEGRATION_GUIDE.md` a `…_BEGINNER_GUIDE.md` vedly do neexistujícího `Kingdom/apps/docs/`; přepsáno na reálné soubory ve stejné složce (`AI_NATIVE_INTEGRATION_README.md`, `AI_NATIVE_UI_GUIDE.md`).
- `docs/3.2/ops/STALE-HOST-REFS-2026-10-31.md` — na tento soubor odkazují dvě README (Kingdom + `apps/desktop-agent`), ale **v celé git historii nikdy neexistoval**. Odkaz změněn na code span s poznámkou, ne na vymyšlený cíl.
- `docs/docs2.9/ZION_OASIS/SACRED_TRINITY/18_MERIAM_ROSE.md` — knihy Miriam a Růže o něm mluvily jako o existujícím textu; v dnešním stromu není. V Miriam je z něj code span, v Růže věta změněna na **„existoval … (v dnešním stromu už není)"** — tvrzení o repozitáři musí odpovídat repozitáři.

**Zbývajících 28** je koncentrovaných: 26 v generovaném prodejním stromu `canon/Kralovstvi_srdce_…_PRODEJ/EDITION/*/CZ/` (odkazy typu `./00-README.md`, `../full.md`, `../../nirvana/`) a 2 v `canon/books/KralovstviSrdce/DeepSeek/*` (`../README.md`). Ty cíle **nikdy nevznikly nebo jsou nejednoznačné** (mnoho shodných jmen) → editorské rozhodnutí „dopsat vs. odlinkovat", ne mechanická oprava. Skript je vypíše (`--show-gaps`).

## 2. 5.S2 — `npm audit`: 0 critical ve všech čtyřech appkách ✅

Next 16 migrace (paralelní session) gate fakticky splnila; ověřeno dnes:

| App | critical | high | moderate | low |
|---|---|---|---|---|
| website-v2.9 | **0** | 3 | 17 | 19 |
| MarketPlace | **0** | 28 | 20 | 0 |
| OasisWeb | **0** | 0 | 0 | 0 |
| pool-ui | **0** | 0 | 0 | 0 |

Gate zní „0 critical" → **splněno**. Zbylé `high` (zejména MarketPlace) nejsou critical a nejsou součástí gate; `npm audit fix --force` by znamenal major bumpy — samostatné rozhodnutí, teď se nedělalo.

## 3. 5.S1 — veřejné povrchy a Playwright smoke

**HTTP sweep (zvenčí, dnes):** 200 = apex, www, app, app `/api/health`, market, market `/api/health`, oasis, pool, rpc, freeworld, nirvana, nirvana `/api/health`, nirvana `/net/health`, api `/health`, dex `/health`, explorer, `/zion-archive`; `dashboard.` = **401** (Basic Auth, očekáváno), `kingdom.` = **503** (plánovaná maintenance). `auth.` má health na `/health` = 200 (`/api/health` je 404 — moje chyba v první sondě, ne regrese).

**Playwright proti produkci** (`E2E_BASE_URL=https://app.zionterranova.com`):

| Suite | Výsledek |
|---|---|
| `zion-archive-lock.spec.ts` | **23/23** |
| `oasis-avatars.spec.ts` | **3/3** |
| `miner-stats.spec.ts` | **3/3** |
| `home-shell.spec.ts` test „a" | **1/1** |
| `home-shell.spec.ts` testy b–j | **nepouštět proti produkci** — `stubApis()` na řádku 28 abortuje všechny requesty mimo `127.0.0.1`/`localhost`; je to offline/localhost suite |
| `maitreya-hub.spec.ts` | skip **by design** (archiv je zamčený) |

**Tři skutečné chyby v testech, které to odhalilo (všechny opraveny):**

1. **Hydration race** (`zion-archive-lock`): `fill()` proběhl dřív, než React hydratoval → controlled input se vrátil na prázdnou hodnotu a tlačítko Unlock zůstalo `disabled` navěky (naměřeno: `disabled=true`, `value=''`). Test teď čeká, až se hodnota „chytí" (`expect(async () => { fill; toHaveValue; toBeEnabled }).toPass()`), místo sleepu.
2. **Strict mode violation** (`zion-archive-lock`): `getByRole('alert')` matchoval i Next route announcer (`#__next-route-announcer__` s `role="alert"`); hledá se `#archive-unlock [role="alert"]`.
3. **CSS timing** (`home-shell` test „a"): měřeno `domcontentloaded` vs `load` — `getComputedStyle(html).backgroundColor` je v tu chvíli ještě `rgba(0,0,0,0)`; po `load` je `rgb(5,5,5)`. Test navíc vyžadoval `gradient` na `body`, který tam dnes není (pozadí řeší `html`). Nově čeká na **skutečně temné a neprůhledné pozadí** (luminance < 60) — což je i původní záměr testu.
4. `miner-stats.spec.ts` navíc používal **bundled Chromium**, které v tomto prostředí není nainstalované → `npx playwright install` by stahoval ~150 MB; sjednoceno na `channel: 'chrome'` (stejná konvence jako `home-shell`).

> **Pozn. k „release buildu":** bod 5.S1 chce smoke „na release buildu". B–J home-shell testy běží jen proti localhostu; v tomto stromu by build kolidoval s cizí rozpracovanou prací i s běžícím dev serverem paralelní session (past popsaná v `apps/website-v2.9/AGENTS.md`), takže se nepouštěly. Až bude čistý strom, stačí `npm run build` + `next start` a `E2E_BASE_URL=http://127.0.0.1:<port>`.

## 4. Změny v repu

- **nový** `scripts/ops/fix-doc-links.py` (dry-run + `--write` + `--json`)
- **62 souborů** s opravenými odkazy (`canon/**`, `docs/3.2/REPORTS/**`, `Kingdom/**`, `apps/desktop-agent/**`)
- `apps/website-v2.9/e2e/{zion-archive-lock,miner-stats,home-shell}.spec.ts` — opravy výše
- `docs/3.2/3.2.1-3.2.9_PLAN.md` — stav 5.B7 / 5.S1 / 5.S2

## 5. Co zůstává

- **28 content gaps** v generovaném prodejním edičním stromu — rozhodnout, zda soubory doplnit, nebo odkazy odlinkovat.
- **`npm audit` high** (MarketPlace 28, website 3) — mimo gate, ale při Stable review se na to bude chtít podívat.
- **home-shell b–j** — spustit na čistém release buildu (nejde na produkci kvůli offline stubu).
