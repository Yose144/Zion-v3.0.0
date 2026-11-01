# REPORT 2026-11-01 — 3D AVATARY Z OASIS ROSTERU (A1–A4)

> **Stav:** hotové a **nasazené** (ZIS restart 14:47, net `20261101T134813Z`, web týž den).
> **Live:** `https://nirvana.zionterranova.com/avatars` (veřejné), avatar se
> propisuje do multiplayeru arény.
> **Kde:** `apps/nirvana/src/core/avatars/**`, `apps/nirvana/src/app/avatars/page.tsx`,
> `apps/nirvana-net/src/{arena,race}.ts`, `apps/identity/src/routes/auth.ts`,
> `scripts/ops/gen-avatar-catalog.mjs`.

## 1. Co to je

Výběr avatara z **200 postav OASIS rosteru** a jejich **3D podoba ve hře**.
Data jsou z `V31/L4/oasis/data/avatars.json` (kanonický roster z
`docs/docs2.9/ZION_OASIS/AVATAR_ROSTER.md`), ukládá se do ZIS
(`avatar3d.avatarId`) a v multiplayeru ji vidí ostatní.

| Krok | Co dělá |
|---|---|
| **A1** katalog | `scripts/ops/gen-avatar-catalog.mjs` → `core/avatars/catalog.ts` (200 záznamů: id, jméno, podtitul, paprsek, vzácnost, CL) |
| **A2** kit | `avatarLook(id)` — deterministická postava: 3 těla, výška 1,55–2,1 m, plášť v barvě paprsku, 12 druhů ornamentů, aura a koruna podle vzácní |
| **A3** picker | `/avatars` — hledání, filtr podle 9 paprsků, velký 3D náhled, volací jméno, postava, barva, uložení do ZIS |
| **A4** hra | server posílá `avatarId` ve snapshotu → klient kreslí cizí hráče jejich avatarem |

**Proč procedurálně:** v repu **není jediný model** (0× glb/gltf/fbx), UE5 složky
pro avatary jsou prázdné. 200 postav nejde namodelovat ručně, takže vzhled
počítáme z dat — a kit je navržený tak, aby šel později vyměnit za skutečné
modely bez přepisování zbytku.

## 2. Změna v ZIS (nutná, ne kosmetická)

`avatar3d` je v ZIS Json, ale `UpdateProfileSchema` povoloval jen
`callsign | bodyType | neonColor | augmentation`. **Zod neznámé klíče tiše
zahazuje**, takže `avatarId` by se uložil jako „úspěch" a nikdy by se
nevrátil. Do schématu proto přibylo
`avatarId: z.number().int().min(0).max(202).optional()`.
Deploy: `ZIS_SKIP_NGINX=1 bash apps/identity/deploy/deploy-zis.sh` (nginx se
neměnil), služba restartována, `/health` OK.

## 3. Ověření

**Server (`npm run smoke` / `arena` / `race`):** 34/34, 21/21, 19/19 — snapshoty
nově nesou `avatarId` (host = `null`).

**E2E v prohlížeči (9/9):** katalog má 200 položek, 3D náhled se kreslí, výběr
mění postavu, host nemůže ukládat, filtr paprsků funguje; ve hře (se stub ZIS
`avatarId: 4`) cizí hráč nese **avatarId 4** i jméno ze ZIS.

**Živý ZIS test (`npm run live`, 11/11):** dočasný účet → přihlášení →
`PATCH avatar3d {avatarId: 42, callsign}` → ZIS vrací `avatarId` 42 →
WS `welcome.you.avatarId === 42` → chat pod callsignem → účet smazán.
Tím je doložená celá cesta cookie → ZIS → net služba → klient.

**Live:** `/avatars` 200 položek, náhled, 0 chyb v konzoli.

## 4. Dvě chyby, které to odhalilo

1. **Seznam roztáhl scénu na 6810 px** — `.avatars` neměl pevnou výšku, takže
   200 položek natáhlo grid a kamera koukala dovnitř modelu. Řešení: `100dvh`
   + `overflow: hidden` (na mobilu naopak `height: auto`).
2. **Kamera mířila na počátek (0,0,0)** — hlava byla mimo záběr. Řešení:
   `camera.lookAt(0, 0.9, 0)` v `onCreated`.

## 5. Meze (poctivě)

- **Styl, ne fotoreal.** Je to kit z primitiv; „každý vypadá jinak" ano,
  „každý je umělecké dílo" ne.
- **Bez portrétů.** Roster nemá obrázky; picker ukazuje 3D model, ne malbu.
- **Závod avatara nekreslí** — jezdí se v hovercraftu; `avatarId` se posílá,
  ale scéna ho zatím nepoužívá.
- **Klient neověřuje `avatarId`** proti katalogu při kreslení cizích hráčů —
  neznámé id spadne na `Poutník` (bílý), což je bezpečné.
- **Bez úprav vzhledu nad rámec ZIS** (postava/barva/callsign) — zbytek
  (ornamenty, aura) je odvozený z id.

## 6. Co dál

- Portrétní náhledy (kdyby někdy vznikly) nebo GLB modely — kit je připravený
  na výměnu.
- Avatary v pouti a ve vesmíru (ne jen v aréně).
- Boti do multiplayeru (arény i závodu).
