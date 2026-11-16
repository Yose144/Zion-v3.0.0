# Report — OASIS avatáři, dávky 07–08: posledních 52 modelů (ID 153–204)

**Datum:** 2026-11-16 (večer)
**Zadání 👤:** „poslední zip balíčky 7 a 8 přišly … pokud ti bude chybět místo,
máme připojený SD disk pro případné uvolnění, jinak vyčisti macOS atd."
**Výsledek:** 52/52 modelů vygenerováno a nasazeno → **201 z 202 avatarů má 3D
model** (jediná výjimka je 037, viz §5). Pipeline nástroje jsou teď v repu.

---

## 1. Co přišlo

| Balíček | ID | Portréty vs roster | Integrita ZIP |
|---|---|---|---|
| `…_25_DAVKA_07.zip` | 153–177 (25) | 25/25 SHA-256 shodných | 106/106 OK |
| `…_27_DAVKA_08_FINAL.zip` | 178–204 (27) | 27/27 | 113/113 OK |

Dohromady **přesně zbývajících 52 ID** rosteru (poslední dávka je „FINAL", 27
položek). Ověřeno stejně jako minule: vnitřní `SHA256SUMS` + porovnání
`*-original.webp` proti `apps/website-v2.9/public/oasis-assets/final_portraits/`
— **všech 52 byte-identical**, žádné redakční dohledávání.

## 2. Průběh a naměřené časy

| Fáze | Čas |
|---|---|
| Generování 1 postavy | ~3,3 min (stejné jako dávky 04–06) |
| Dávka 07 (25) | ~80 min |
| Dávka 08 (27) | ~90 min |
| Rig 52 postav | ~11 min (12 s/postava) |
| QA render (52 × 4 pohledy) | ~4 min |

**Výsledek:** 50 000 tris limit dodržen (14 992–15 000), 2,4–4,2 MB, 17 kloubů
a klip `idle` u všech 52 nových.

## 3. Dva panely, které heuristika nezvládla

`pick-front.py` (nově v repu, viz §6) si poradil se 50 listy. Dva si vyžádaly
ruční `--box`:

- **162 Lemur Steward** — stojící lemur je široký a krátký, takže poměr
  výška/šířka nesplní podmínku „celá postava" a pásy se slily s rekvizitami.
  Řešení: `--box 0,505,0,690`.
- **203 Anagha Lakshmi** — sedící postava (póza), poměr je ~1,2 a ořez bral
  bust z dolního pásu. Řešení: `--box 0,585,0,510` (doladěno na tři pokusy,
  protože bust měl v rohu přesah).

## 4. Incident: stroj začal swapovat a generace se zastavila

Uprostřed dávky 08 (po 19 postavách) se generace zpomalila z 3,3 min na
**89 min na jednu postavu**. Změřeno: `vm.swapusage` **19,4 z 20,5 GB**,
load average **45**, disk **4,5 GiB (98 %)** — swap soubory narostly do
`/System/Volumes/VM` a vytlačily disk. Session se restartovala a proces
generování se přerušil.

**Řešení:** po restartu (swap i load se srovnaly) se generace pustila znovu —
`generate.py` je opakovatelný a hotové GLB přeskočí, takže se dojely jen
chybějící 4 postavy (197–204, 8 kusů). Před tím se uvolnil disk:

- smazány `.next` buildy ostatních appek (market 703 MB, lumi 494 MB, kingdom
  320 MB, portal 285 MB, onboard 255 MB, ops 140 MB — vše regenerovatelné),
- `git lfs prune --verify-remote` (941 → **780 MB**),
- staré stagingy dávek 04–06 přesunuty na SD (`/Volumes/ZION-Storage/avatar3d-batches`, 1,0 GB),
- macOS cache (Spotify 1,6 GB, Chrome 591 MB) a `npm cache clean` (~780 MB),
- temp extrakce ZIPů.

**Poučení:** u dlouhé MPS dávky kontrolovat `sysctl vm.swapusage` a `df` —
thrashing se neprojeví chybou, jen 25× zpomalením. A `.next` buildy jiných
appek v monorepu umí sežrat 2+ GB, které při dávce chybí.

## 5. Stav rosteru: 201 z 202

| | |
|---|---|
| Avatarů v rosteru | 202 (ID 0–204, mezery 7/34/49) |
| **S 3D modelem** | **201** |
| Bez modelu | **037 Mahátma Gándhí** |

**Proč 037 chybí:** v balíčku 02 k němu **neexistuje modelovací list** — jen
portrét, rešerše a vlastní poznámka dodavatele:
„*Nový obrazový list nebyl vytvořen: generátor požadavek odmítl. (…)
Žádné chybějící pohledy nejsou vydávány za hotové.*" Bez listu (front/bok/záda)
se nedá udělat stejná pipeline; z portrétu by vznikla busta, což dokument
`AVATAR-3D-PIPELINE.md` §4 výslovně nedoporučuje. **Zůstává procedurální**
a je to poctivý stav, ne opomenutí.

## 6. Nástroje jsou teď v repu

Dřív žily ořezové a QA skripty mimo git (v tempu) — po restartu stroje zmizely.
Nově v `scripts/ops/avatar-3d/`:

| Skript | Co dělá |
|---|---|
| `pick-front.py` | vybere a ohne přední panel (čtyři pasti z §9e) + `--box` pro ruční případ |
| `render-views.py` | Blender headless, 4 ortografické pohledy (QA) |
| `qa-sheet.py` | kontaktní list z renderů (dávka na jednom obrázku) |

A `scripts/ops/gen-avatar-models.mjs` nově generuje **oba** seznamy z disku:
`apps/nirvana/src/core/avatars/models.ts` (hra) i
`apps/website-v2.9/src/lib/oasis/avatar-models.json` (web). Ruční editace
seznamu už není potřeba a nemůže vzniknout rozpor.

## 7. Nález u dvou starých modelů (44, 55)

Původní report je vedl jako „nerignuté, stojí za opravu". Ukázalo se, že
**rig nepotřebují** — nejsou humanoidní:

- **044 Hiranyagarbha** = kosmické vejce (zlaté semeno na lotosu),
- **055 Hunahpú & Xbalanqué** = mayská dvojčata (dvě postavy v jednom modelu).

Rig pokus (17 kloubů přes vejce) byl vrácen; modely zůstávají bez skeletu
a hra je kreslí staticky — kód chybějící akci `idle` zvládá. **Otevřený bod
z minulého reportu je tím uzavřený, ne odložený.**

## 8. Nasazení

| Co | Release | Ověření |
|---|---|---|
| Nirvana | viz commit | 201 GLB na serveru, smoke OK |
| Web2.9 | viz commit | 201 ID v `avatar-models.json`, smoke OK |

Ověřeno na živém webu (headless Chrome): nový avatar (**204 Chaitanya**) →
canvas + `200 204.glb`; avatar bez modelu (**037 Gándhí**) → žádný canvas,
žádný request; starý (**0 Krišna**) → beze změny.

## 9. Změněné soubory

```
heros/Avatars/ZION_OASIS_3D_PODKLADY_25_DAVKA_07.zip          (LFS, 70 MB)
heros/Avatars/ZION_OASIS_3D_PODKLADY_27_DAVKA_08_FINAL.zip    (LFS, 77 MB)
apps/nirvana/public/models/avatars/{153..204}.glb             (52 nových, ~190 MB)
apps/nirvana/src/core/avatars/models.ts                       (149 → 201)
apps/website-v2.9/src/lib/oasis/avatar-models.json            (149 → 201)
scripts/ops/avatar-3d/pick-front.py                           (nový, z tempu do gitu)
scripts/ops/avatar-3d/render-views.py                         (nový)
scripts/ops/avatar-3d/qa-sheet.py                             (nový)
scripts/ops/gen-avatar-models.mjs                             (generuje i models.ts)
docs/3.2/AVATAR-3D-PIPELINE.md · AGENTS.md · */AGENTS.md      (stav 201/202)
docs/3.2/REPORTS/REPORT_2026-11-16_AVATARI_DAVKY_07_08.md     (tento report)
```
