# OASIS — portréty avatarů z herního modelu

Generuje 200 portrétních karet pro `https://app.zionterranova.com/l4-oasis/avatars`.

**Proč takhle:** v repu nejsou žádné 3D modely (0× glb/gltf) a 200 postav nejde
namodelovat ručně. Vzhled se proto **počítá z dat** — a to stejným kódem, jaký
používá hra (`apps/nirvana/src/core/avatars`). Karta na webu je tedy přesně ta
postava, kterou člověk potká v Nirvaně, jen vyrenderovaná do portrétu.

## Jak to funguje

```
apps/nirvana/src/core/avatars/kit.ts   → avatarLook(id)      (co postava je a jak vypadá)
apps/nirvana/src/core/avatars/body.ts  → buildAvatarMesh()   (geometrie: 1–3 draw calls)
apps/nirvana/src/core/avatars/AvatarModel.tsx → <AvatarModel look/>  (používá hra i web)
        │
        ├── hra: apps/nirvana/src/app/avatars, aréna (cizí hráči), šatník Issobella
        └── web: tento skript → public/oasis-assets/game-portraits/*.webp
```

`entry.tsx` je malá stránka, která model vystaví v headless Chromiu; `render.mjs`
projde id 0…202, vyfotí plátno (`canvas.screenshot`, průhledné pozadí) a složí
WebP kartu 448×560 na paprskovou vinětaci podle `ray`.

Kamera se počítá **z bounding boxu konkrétní postavy** — někdo má hůl nebo kopí
přes 2 m, takže pevná kamera by část postav uřízla (stalo se při prvním pokusu).

## Spuštění

```bash
# všech 200 (přeskočí hotové; ~35 s na M1 přes ANGLE/Metal)
node scripts/ops/oasis-avatar-render/render.mjs

# vybrané id, přepsat i existující
node scripts/ops/oasis-avatar-render/render.mjs --ids 0,4,19 --force

# jiné rozměry
node scripts/ops/oasis-avatar-render/render.mjs --width 640 --height 800 --force
```

Výstup:

- `apps/website-v2.9/public/oasis-assets/game-portraits/<id>-<slug>.webp` (200 karet)
- `apps/website-v2.9/public/oasis-assets/game-portraits/manifest.json` (id → cesta, bajty)
- `apps/website-v2.9/src/lib/oasis/game-portraits.json` — statický import pro Next
  (`public/` se importovat nedá; stránka z něj skládá cestu k portrétu)

Kontrola stránky bez deploye:

```bash
cd apps/website-v2.9 && npm run build && npx next start -p 3032
BASE=http://127.0.0.1:3032 node scripts/ops/oasis-avatar-render/inspect-page.mjs
# → .artifacts/render/oasis-avatars-20261101/{page-top,page-roster,page-modal}.png
```

## Až 👤 dodá finální portréty (poslední vlna)

Nic se nepřepisuje v komponentách — portrét se hledá v `game-portraits.json`
a když tam id není (nebo je cesta jiná), použije se `a.art.full` / `a.art.card`
z OASIS kolekce. Postup:

1. Finální portrét ulož jako `public/oasis-assets/final-portraits/<id>.webp`.
2. V `game-portraits.json` přemapuj id na novou cestu (nebo přidej druhou mapu
   `FINAL_PORTRAITS` a v `portraitOf()` dej přednost jí).
3. `npm run build` + deploy; model ani kód postav se nemění.

Dokud finální portréty nejsou, je na kartě i v detailu štítek
**„Herní 3D náhled · procedurální model“**, takže se placeholder nevydává za finál.

## Meze, které se nemají hlásit jako hotové

- Je to **stylizovaný low-poly** model z primitiv (žádné glb, žádný rig, žádné
  animace chůze) — ne AAA charaktery.
- Výraz je odvozený z podtitulu (warrior/sage/royal/…), ne z rešerše konkrétní
  kultury; u citlivých tradic je finální podoba věc 👤 a odborné konzultace.
- Barvy vycházejí z kánonu paprsků (`ray`), takže je roster hodně modrý — to je
  datová vlastnost, ne chyba renderu.
