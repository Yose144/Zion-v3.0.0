# OASIS — character sheets, kanonické atributy a prompt pack

**Datum:** 2026-11-01 · **Nadstavba nad** `REPORT_2026-11-01_OASIS_AVATARS_3D.md`
**Povrchy:** `app.zionterranova.com/l4-oasis/avatars`, `nirvana.zionterranova.com/avatars`

## Zadání

👤: „rozšiř se ještě víc, koukni se na nějaké online reference profi her, ať máme 3D
avatary fakt připravené pro GPT portréty a pak reálné dokončení všech postav, počítej
i s infem z web2.9 … jinak `docs/docs2.9/ZION_OASIS/SACRED_TRINITY`“.

## Co říká produkční praxe (rešerše)

Turnaround sheet v AAA pipeline není ilustrace, ale **měřitelný podklad pro modeláře**:
front / three-quarter / side / back na **společné zemi a společných vodicích liniích**,
konzistentní proporce, materiálové popisky, barevné vzorníky, u složité výstroje
detaily (close-up). Minimum pro modelování je front + side + back; 3/4 odhalí, jestli
front a bok popisují stejný objem. Zdroj: Layer.ai, Mimic Cartoon, Nasty Rodent
(AAA concept pipeline), SCAD character sheet guide.

Z toho plyne zadání pro nás: **jeden model → čtyři pohledy → popisky + paleta +
kanonické atributy + hotový prompt**. Přesně to teď pipeline dělá.

## Co je nové

### 1. Kanonický vizuální spec (`scripts/ops/oasis-canon/`)

Generátor čte **čtyři zdroje** a překládá je do zadání:

| Zdroj | Co z něj bere |
|---|---|
| `V31/L4/oasis/data/avatars.json` | role, ability, teaching, quest linie, vzácnost, CL |
| `apps/website-v2.9/scripts/oasis-essence-i18n.json` | esence cs/en (web2.9) |
| `docs/docs2.9/ZION_OASIS/SACRED_TRINITY/*.md` | kulturní kontext, atributy (flétna, trojzubec…) |
| `docs/docs2.9/ZION_OASIS/AVATAR_ROSTER.md` | paprsek, quest linie |

Výsledek pro každou z 200 postav: **atributy, paleta, pleť, pokrývka hlavy,
doprovodná zvířata, kulturní kotva a hotový anglický prompt** (turnaround + art
direction + negativa).

- 137 postav má atributy, 200 paletu, 200 dohledaných v SACRED_TRINITY.
- 45 ikon má **ručně ověřené atributy** (Krišna flétnu a paví pero, Šiva trojzubec
  a kobru, Ganéša sekeru, Sarasvatí vínu, Wukong hůl…), protože v textu nebývají
  doslova.
- 9 postav má **anatomickou poznámku** (Ganéša sloní hlava, Hanumán vanara, Garuda
  ptačí muž…) — model to z primitiv neumí, ale prompt to říká nahlas, aby finální
  portrét nevyšel jako člověk.

Výstupy: `apps/nirvana/src/core/avatars/canon.ts` (kreslení) a
`src/lib/oasis/character-sheets.json` + `public/oasis-assets/character-sheets/specs.json`
(prompt pack; stránka si ho tahá lazy, 330 kB nezatěžuje bundle).

### 2. Model kreslí kánon

- `kit.ts` bere **atributy z kánonu před deterministickou náhodou** a doplňuje je
  jen do počtu podle vzácnosti (max 3 + halo).
- Pleť a pokrývka hlavy jdou z kánonu (`Krišna` modrá pleť, `Šiva` čelenka).
- Nové atributy v `body.ts`: **flétna, trojzubec, čakra, vajra, kříž, srpek, anch,
  zvon, lucerna, paví pero, zrcadlo, kladivo, sekera, kobra**.

### 3. Turnaround sheet (produkční výstup)

`render.mjs --sheets` vyrenderuje pro každou postavu **1600×900 sheet**:
čtyři pohledy (front / 3-4 / bok / záda) na společné zemi, popisky, jméno + ID +
paprsek/vzácnost/CL, paletové vzorníky. 200 sheetů za ~66 s na M1 (ANGLE/Metal).

### 4. Detail na webu

Modal nově obsahuje **turnaround**, **atributy z kánonu** s paletou a **prompt
pro finální portrét** s tlačítkem *Kopírovat*. Tím je celý řetěz uzavřený: hráč vidí
postavu, modelář/grafik dostane sheet, generátor dostane prompt.

## Ověření

| Co | Výsledek |
|---|---|
| `tsc` (nirvana) | čisté |
| Kanonický generátor | 200 postav, 137 s atributy, 200 palet, 200× SACRED_TRINITY |
| Render 200 portrétů + 200 sheetů | ~35 s + 85 s (Metal), 1,8 MB + 7,5 MB |
| Vizuální kontrola | Krišna (modrá pleť, flétna, čakra, koruna), Šiva (trojzubec, kobra), Lakshmi, Ganéša, Súbhadra |
| Opravy z kontroly | vlasy už nesahají na obočí (půlkoule = helma přes oči), plášť zmenšen, závoj má široký přední otvor, atributy drží v dlani |

## Meze

- Model je pořád **stylizovaný low-poly** — sheet je referenční podklad, ne finální
  asset. Anatomické znaky (sloní hlava) jsou jen v promptu.
- Archetyp i atributy plynou z textů; **kulturní citlivost** u tradic, které si to
  vyžádají, zůstává na 👤 a konzultaci (viz `ART_DIRECTION.md` v OASIS kolekci).
- Prompt je **návrh**, ne schválený kánon looku — finální portréty jsou poslední vlna.

## Reprodukce

```bash
node scripts/ops/oasis-canon/build-canon.mjs                      # spec + prompty
node scripts/ops/oasis-avatar-render/render.mjs --force --sheets  # karty + turnaroundy
cd apps/website-v2.9 && npm run build
```
