# OASIS — avataři jako herní roster (3D portréty z herního modelu)

**Datum:** 2026-11-01 · **Povrchy:** `app.zionterranova.com/l4-oasis/avatars` (web),
`nirvana.zionterranova.com/avatars` (hra) · **Stav:** lokálně ověřeno, připraveno k deployi

## Zadání

👤: „potřebuji teď zamakat na avatarech … rozšířit postavy ať to vážně vypadá jak ve
hře, klidně použij GPU na render … zatím ještě nemáme obrázky, ale popisky jsou,
takže základ máme, takže můžeš začít rozšiřovat autonomně, portréty dodám později
a podle nich pak uděláme finální vlnu.“

## Co bylo hotové předtím

Roster 200 postav s plnými texty (podtitul, role, místo, quest linie, výuka,
schopnost, esence cs/en, citát, questy) + procedurální konceptové karty
(640×640) a 4 AI portréty. Herní model avatarů existoval ve Nirvaně
(`core/avatars`): `avatarLook(id)` → 18 meshů z primitiv.

## Co je nové

### 1. Model postav je bohatší a sdílený webem i hrou

- `core/avatars/kit.ts` — `AvatarLook` rozšířen o **archetyp** (z podtitulu:
  warrior / sage / royal / artist / healer / mystic / wanderer), **střih vlasů**
  (bald / short / topknot / long / braids / hood / veil), **oděv** (robe / tunic /
  armor / sari), **pokrývku hlavy** (turban / laurel / feathers / mitre / circlet),
  **postoj** (neutral / open / guard / raise), plnovous, plášť, pauldrony,
  svítící oči, kov a barvu vlasů. Vše deterministické z id + dat postavy.
- `core/avatars/body.ts` — nový stavitel geometrie (`buildAvatarMesh`): ~45 dílů
  (hlava s tváří, oči, obočí, nos, ústa, uši, brada, vlasy, zbroj, plášť, boty,
  prsteny, 11 ornamentů) zapečených do **tří bufferů** (tělo / kov / světlo)
  s barvou ve vrcholech. Postava má **1–3 draw calls** místo ~18 — ve hře se
  potká až 8 avatarů, takže je to 8× méně práce pro GPU než dřív.
- `AvatarModel.tsx` — tenký renderer nad `buildAvatarMesh` (stejné props
  `look / animate / opacity`, takže aréna, šatník i picker fungují beze změny).

### 2. Render pipeline (GPU)

`scripts/ops/oasis-avatar-render/` — headless Chromium (ANGLE/Metal, měřeno
`ANGLE Metal Renderer: Apple M1`) + React Three Fiber + WebP přes sharp:

- 200 karet **448×560** za **34–40 s** (≈170–200 ms/karta),
- paprsková vinětace jako pozadí (`ray` → barva), průhledné plátno,
- **kamera z bounding boxu** konkrétní postavy (hůl/kopí přes 2 m jinak uřízne hlavu),
- výstup: `public/oasis-assets/game-portraits/<id>-<slug>.webp` (celkem **1,6 MB**),
  `manifest.json` + statický `src/lib/oasis/game-portraits.json` pro Next.

### 3. Stránka je herní roster

- Karta = **portrét 4:5** s rámečkem, štítky rarity + CL, jménem a podtitulem
  přes gradient, dole paprsek / počet questů / klíč, 2 řádky esence a role.
- Detail (modal) má portrét 176×224 místo 160×160 a štítek
  **„Herní 3D náhled · procedurální model“** — placeholder se nevydává za finál.
- Fallback: když pro id portrét není, použije se koncept z OASIS Collection.
- Roster grid 2 / 3 / 4 / 5 sloupců, lazy loading obrázků.

## Ověření

| Co | Výsledek |
|---|---|
| `apps/nirvana` `tsc --noEmit` | čisté |
| `apps/nirvana` `npm run build` | OK (všechny routy) |
| `apps/website-v2.9` `npm run build` | OK |
| Web `/l4-oasis/avatars` (headless, 1440×1100) | **200 karet**, 204 obrázků, **0 rozbitých**, 0 chyb v konzoli, modal se otevírá |
| Hra `/avatars` (headless, 3033) | model se renderuje, picker + detail OK (jen pre-existing `401` z `/api/auth/me`) |
| Render | 200/200 karet, GPU ANGLE Metal, 34–40 s |
| Kontaktní arch | `.artifacts/render/oasis-avatars-20261101/contact-sheet.webp` (20×10) |
| Screenshoty | `page-top.png`, `page-roster.png`, `page-modal.png`, `game-avatars.png` ve stejné složce |

## Meze (nehlasit jako hotové)

- Je to **stylizovaný low-poly** z primitiv — žádné glb/gltf, žádný rig, žádná
  animace chůze, žádná mimika. Ne AAA charaktery.
- Archetyp se odvozuje z **podtitulu**, ne z rešerše konkrétní tradice; u citlivých
  kultur je finální podoba věc 👤 a konzultace.
- Roster je hodně modrý, protože barvy určuje kanonický `ray` — datová vlastnost.
- Finální portréty nejsou; karty to říkají nahlas.

## Poslední vlna (až 👤 dodá portréty)

1. Portrét do `public/oasis-assets/final-portraits/<id>.webp`.
2. Přemapovat `src/lib/oasis/game-portraits.json` (nebo dát `portraitOf()` jinou mapu).
3. Build + deploy. Herní model se nemění — karty i hra zůstanou konzistentní.

## Reprodukce

```bash
node scripts/ops/oasis-avatar-render/render.mjs            # 200 karet
cd apps/website-v2.9 && npm run build && npx next start -p 3032
BASE=http://127.0.0.1:3032 node scripts/ops/oasis-avatar-render/inspect-page.mjs
```

Detailní popis: `scripts/ops/oasis-avatar-render/README.md`.
