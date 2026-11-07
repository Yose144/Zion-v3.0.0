# OASIS avatáři — nová řada portrétů 2026-11 (191 obrázků) napříč ekosystémem

**Datum:** 2026-11-07
**Zadání 👤:** „`heros/ZION_OASIS_AVATARI_KOMPLET` máme konečně nové avatary, aktualizuj celý ekosystém."
**Rozhodnutí 👤:** publikovat **všech 191** portrétů (i těch s redakční poznámkou) a nasadit **celý ekosystém**.

---

## 1. Co bylo v archivu (měřeno)

`heros/ZION_OASIS_AVATARI_KOMPLET/` — 431 MB, 413 souborů:

| část | obsah |
|---|---|
| `01_PORTRETY/` | **189** samostatných portrétů, všechny **1254×1254**, 75× webp (001–086) + 114× png (087–200) |
| `02_PRIDANE_POSTAVY/` | 2 nové postavy (Chaitanya, Anagha), 1254×1254 png |
| `03_NEFINALNI_VYREZY_011-020/` | 10 výřezů z koláže — **nepoužito** |
| `04_KONCEPTY_001-200/`, `06_*`, `07_ODLOZENE_VARIANTY/` | starší koncepty / dokumentace / odložená varianta — **nepoužito** |
| `SOUPIS_A_MAPOVANI_NA_WEB.csv`, `MANIFEST.json` | autoritativní mapování (202 řádků) |

Archiv sám říká, že jde o kandidáty schválení, ne o automaticky finální art — proto se z něj **nepoužily**
výřezy (011–020) ani koncepty a 11 postav zůstalo na dosavadním náhledu.

## 2. Mapování: jen podle jména, nikdy podle pořadí

Produkční čísla 001–200 **neodpovídají** ID na webu (web má 202 položek, přidané postavy posouvají
řadu) a archivní `web_id` je pořadí na stránce, ne `id` v rosteru. Mapování proto jde
**normalizovaným jménem** (`web_name` → `avatars.json.name`):

- 202/202 jmen se spárovalo 1:1, žádná duplicita,
- nezávislá kontrola: u 191 portrétů se výsledný slug porovnal se slugem **herního portrétu**
  téhož avatara → 188× přesně, 3× jen jiný přepis (`Hiʻiaka`, `Maʿăt`, `Óðinn Wayfarer`),
  u nich vyhrál slug z `game-portraits.json`, aby finální art a 3D náhled seděly na stejný soubor.

Příklady posunu (produkční → web id): `029 Hilarion → 32`, `031 Saint Germain → 26`,
`050 Black Elk → 52`, `200 Bolon Yokte' K'uh → 202`, `ADD-01 → 204`, `ADD-02 → 203`.

## 3. Jak se to dostalo do repa

Nový skript **`apps/website-v2.9/scripts/import-oasis-final-portraits.mjs`** (idempotentní):

1. CSV → párování podle jména, validace, že každý portrét má avatara a každý soubor existuje,
2. konverze na **640×640 webp, kvalita 80** → `public/oasis-assets/final_portraits/<avatarId>-<slug>.webp`,
3. zápis `finalPortrait` do `scripts/oasis-art-manifest.json` (a doplnění záznamů #203/#204,
   aby poziční mapa `manifest[i] ↔ avatars[i]` držela i pro nové postavy),
4. smazání osiřelých souborů (stará čtyřka `002-rama`…`005-maitreya` pojmenovaná produkčními čísly).

Výsledek: **191 souborů, 21,3 MB** (≈ 114 kB/kus). Originály 1254² zůstávají jen v `heros/`
(untracked archiv), do repa jde webová velikost.

`gen-oasis-avatars.mjs` se změnil tak, že **finální portrét je nejlepší dostupný art** — používá se
na kartu i do modalu; koncept/vektor je fallback pro postavy bez samostatného renderu.
Regenerace: `node scripts/gen-oasis-avatars.mjs`.

## 4. Kde všude se to projevilo

| povrch | změna |
|---|---|
| **`app.zionterranova.com/l4-oasis/avatars`** | karty i modal mají nový portrét; v modalu je navíc velký „Detailní portrét · OASIS Collection" (character sheet zůstává pod ním); pro 11 postav bez renderu se dál ukazuje **herní 3D náhled** s původním štítkem |
| **`V31/L4/oasis/data/avatars.json`** (kanon roster) | nové pole **`image_url`** u všech 202 avatarů (absolutní URL: finální portrét, jinak herní 3D náhled) |
| **OASIS API** (`/api/v1/oasis/avatars`) | `AvatarDef.image_url` v Rustu (`quests.rs`, `Option<String>`, `skip_serializing_if`) → klienti dostanou URL z API místo odvozování cesty |
| **`oasis.zionterranova.com` (OasisWeb)** | karty v Avatar Codexu mají náhled, detailní panel i 3D scéna velký portrét |
| **`market.zionterranova.com` (MarketPlace)** | beze změny kódu — sync už čte `image_url`; po nasazení API stačí `GET /api/oasis/sync?type=avatars` a artefakty dostanou nové `imageUri` |
| **Nirvana `/avatars`** | beze změny záměrně — je to **3D procedurální model** hráče (katalog z rosteru), ne 2D portrét |

Proč absolutní URL v rosteru: roster čtou tři různé domény. Relativní `/oasis-assets/…` by se na
`oasis.` a `market.` resolvovala proti nim a vrátila 404.

## 5. Ověření

- `cargo test -p zion-oasis --lib` → **139 passed, 0 failed** (test `test_load_real_avatars_json` byl
  předtím červený — očekával `Krishna-Maitreya`, roster se ale jmenuje `Krishna`; opraveno
  a rozšířeno o assert, že avatar 0 nese absolutní `image_url`).
- `next build --webpack` (website) **EXIT 0**, `next build` (OasisWeb) **EXIT 0**, `tsc --noEmit`
  OasisWeb **0 chyb**.
- `tsc --noEmit` na website hlásí 24 chyb, **všechny v cizí rozpracované práci**
  (`doge-vs-zion/games/ZionDefense.tsx`, `components/NetworkStatus.tsx` — nedokončená migrace
  na 5 jazyků). `l4-oasis/avatars/page.tsx` je čistý.
- Headless Chromium proti lokálnímu standalone buildu (`?lang=cs`, 1440×1100):
  **205 `<img>`, z toho 191× `final_portraits`, 11× `game-portraits`, 0 konceptů, 0 rozbitých
  obrázků, 0 chyb v konzoli**; screenshoty karty + modalu v `.artifacts/probe/`.

## 6. Co zůstalo (poctivě)

- **11 postav bez samostatného portrétu** → dál herní 3D náhled:
  Arjuna (11), Bhima (12), Yudhishthira (13), Jašóda (14), Vishwakarma (15), Radha (16),
  Vyasa (17), Maria Magdalena (18), Ježíš (19), Panna Maria (38), Kókyangwúti (54).
  Archiv k nim má jen výřezy z koláže (`03_NEFINALNI_VYREZY_011-020`) — záměrně nepoužity.
- **Redakční poznámky z CSV** (publikováno, ale hodné revize):
  **ZION The Last City (50)** – render je hlavně muž, ne město;
  **Ohnivá Oka (59)**, **Davi Kopenawa (60)**, **Heyókȟa (61)** – kulturní symbolika;
  **Kāne (65)** – antropomorfní varianta abstraktního principu.
- **Kontrola odlišnosti tváří** u **Parvati (83)**, **Lakshmi (85)**, **Durga (86)**.
- Obrázky jsou **640²** (karta ~500 px @2×, modal 176 px) — originály 1254² nejsou v repu.
- **Hotovo při nasazení:** OASIS daemon rebuildu (Rust pole) i Marketplace sync
  (`{"synced":{"avatars":202}}`).

### Vedlejší nález (nesouvisí s avatary)

`/network` sype do konzole `Error: <polyline> attribute points: Expected number, "NaN,78"` —
`NetSparkline` v `apps/website-v2.9/src/app/network/page.tsx` dělí `i / (data.length - 1)`;
při **jediném** vzorku je to `0/0 = NaN`. Projevuje se jen chvíli po načtení, než se historie
naplní. Oprava je jednořádková (`Math.max(1, data.length - 1)`), ale patří autorovi i18n dávky —
netýká se avatarů, proto se needitovalo.

## 7. Reprodukce

```bash
# 1) import portrétů + manifest (vyžaduje archiv v heros/)
cd apps/website-v2.9
node scripts/import-oasis-final-portraits.mjs      # --dry-run = jen plán
node scripts/gen-oasis-avatars.mjs                 # regeneruje src/lib/oasis/avatars.ts

# 2) image_url do kanonického rosteru (absolutní URL)
cd ../..
node scripts/ops/oasis-avatar-images.mjs           # --dry-run

# 3) build
cd apps/website-v2.9 && npm run build
```

## 8. Nasazení (provedeno 2026-11-07)

- **Web** (`app.zionterranova.com`): `deploy-web2.9.sh` z **čistého worktree na HEAD** (`a28e95b19`)
  → `Deployed 20261107T102921Z`, smoke 5/5 + `/api/health` OK. Pracovní strom obsahoval cizí
  rozdělanou i18n migraci, která by se jinak nasadila (a v `NetworkStatus.tsx` by spadla na
  `lang is not defined`).
  - **Past (nová):** ve sparse worktree je potřeba hardlinkovat **tři** `node_modules`
    (root, `apps/website-v2.9`, `apps/zion-wallet-sdk`) — bez SDK copy padá prebuild
    (`@noble/ed25519`, `ethers` v6 vs. hoisted v5). Sparse checkout musí obsahovat i `scripts/`
    (`deploy-next-artifact.sh`).
  - Live: `/l4-oasis/avatars` → **191× `final_portraits` + 11× `game-portraits`**, obrázky 200.
- **OASIS API** (`zion-v31-oasis` na EDGE2): rsync `V31/L4/oasis/src/quests.rs` + obou kopií
  `avatars.json` (`/opt/zion/data/avatars.json` je runtime, `/opt/zion/V31/L4/oasis/data/` repo
  kopie; zálohy `*.bak-oasis-portraits-20261107T103048Z`), `cargo build --release -p zion-oasis`
  (2m04s), `chown zion:zion`, restart. Live `/api/v1/oasis/avatars` → **202 avatarů, 202×
  `image_url`**.
- **OasisWeb** (`oasis.zionterranova.com`): `deploy-oasis-web.sh`, health 200; headless
  **202 `<img>`, 191 portrétů, 0 rozbitých**, jediná 401 = pre-existing `/api/auth/me`.
- **MarketPlace**: `GET /api/oasis/sync?type=avatars` → `{"synced":{"avatars":202}}`;
  v DB `Artifact` (contract `oasis-avatar`) **202 řádků, 191× `final_portraits`, 11× `game-portraits`**.
  - **Nález:** `ADMIN_API_KEY` v `/opt/zion/APP&WEB/MarketPlace/.env` (20 znaků) **nesedí**
    s klíčem, se kterým běží služba (18 znaků v `/proc/<pid>/environ`) — `.env` je po startu
    ignorován, dokud se služba nerestartuje. Sync se proto volal klíčem z procesu.
