# Report — OASIS avatáři, dávky 04–06: 75 nových 3D modelů (ID 078–152)

**Datum:** 2026-11-16
**Zadání 👤:** „`heros/Avatars` — přišly nám nové 3 balíčky avatarů, které ještě
nejsou v celém ekosystému, a převést do 3D."
**Výsledek:** 3 balíčky zařazeny do repa (Git LFS), **75/75 modelů vygenerováno,
rignuto a nasazeno** do Nirvany. `models.ts` má 149 modelů (dřív 74).

---

## 1. Co přišlo

| Balíček | ID | Portréty vs roster | Integrita ZIP |
|---|---|---|---|
| `ZION_OASIS_3D_PODKLADY_25_DAVKA_04.zip` | 078–102 | 25/25 SHA-256 shodných | 105/105 OK |
| `…_DAVKA_05.zip` | 103–127 | 25/25 | 106/106 OK |
| `…_DAVKA_06.zip` | 128–152 | 25/25 | 106/106 OK |

Ověřeno před jakoukoli prací: vnitřní `SHA256SUMS.txt` (317 souborů, 0 chyb)
a porovnání `*-original.webp` proti `apps/website-v2.9/public/oasis-assets/final_portraits/`
— **všech 75 portrétů je byte-identical**, takže se nic nedohledávalo redakčně.

Balíčky jsou 222 MB, proto jdou do repa přes **Git LFS** (stejně jako 01–03,
`.gitattributes` má `*.zip filter=lfs`).

## 2. Co v ekosystému chybělo

Kontrola pro ID 078–152 ukázala, že **jediná mezera byly 3D modely**:

| Vrstva | Stav před | Stav po |
|---|---|---|
| Roster `V31/L4/oasis/data/avatars.json` | 75/75 | 75/75 |
| Katalog `apps/nirvana/src/core/avatars/catalog.ts` | 75/75 | 75/75 |
| Portréty `public/oasis-assets/final_portraits` | 75/75 | 75/75 |
| **3D modely `public/models/avatars/<id>.glb`** | **0/75** | **75/75** |

## 3. Postup

Prostředí se stavělo od nuly (na stroji nic z pipeline nezbylo):

1. `uv venv` (Python 3.11) + torch 2.15.0 / torchvision, `transformers 4.35`,
   `trimesh 4.0.5`, `rembg`, `xatlas`, `fast_simplification`, `moderngl`…
2. TripoSR (clone) + **tři záplaty z `docs/3.2/AVATAR-3D-PIPELINE.md`**:
   `torchmcubes` → `skimage.marching_cubes`, `query_triplane` přesun pozic na
   zařízení, `bake_texture` `.cpu().numpy()`. (Čtvrtá záplata — výběr zařízení —
   není potřeba, `generate.py` předává `--device` sám.)
3. Váhy `stabilityai/TripoSR` (1,68 GB) — stahují se **bez tokenu** (gated
   licence, ale resolve endpoint vrací 200), ověřeno SHA-256.
4. Blender **5.2.3 LTS** portable (`~/Tools/blender-5.2.3`, 907 MB), SHA-256
   `acc0537…` shodná s dokumentovanou.
5. Generace **MC 320 + textura 2048 + `--max-tris 15000`** (vítězná varianta §9c),
   rig `scripts/ops/avatar-3d/rig.py`, QA render 4 pohledů (Blender headless).

## 4. Naměřená propustnost (M1, 8 GB)

| Fáze | Čas |
|---|---|
| Generování 1 postavy | 171–232 s (medián ~195 s) |
| Rig 1 postavy | ~12 s |
| QA render (4 pohledy) | ~3 s |
| Dávka 25 postav (generace) | 80–90 min |
| **Celkem 75 postav** | **~5 h** (tři dávky sekvenčně) |

## 5. Výsledek

- **75/75 modelů, 0 chyb** (`generate.log` každé dávky: `ok=25`).
- 14 992–15 000 trojúhelníků, **2,4–4,3 MB** na model.
- **17 kloubů, skin (`JOINTS_0`/`WEIGHTS_0`), klip `idle`** u všech 75 nových.
- Ověření všech 149 GLB: každý se parsuje, má ≤ 15 500 tris a ≤ 6 MB.
- `tsc --noEmit` v `apps/nirvana` **exit 0** po regeneraci `models.ts`.
- QA kontaktní listy (25 postav × 4 pohledy) prošly vizuálně — postava stojí,
  drží proporce a paletu, čitelné jsou i nestandardní anatomie (Ganéša 4 paže,
  Garuda křídla, Barong čtyřnohý, Ananse pavouk, Usir zavinuté tělo, had/orli).

## 6. Čtyři pasti při ořezu listů

Tyhle chyby by tiše zničily kvalitu modelu, proto jsou i v pipeline dokumentu (§9e):

1. **Pás rekvizit pod postavou** — lotos/miska/kniha dole rozšíří popředí,
   TripoSR postavu zmenší a vygeneruje blob. Řešení: ořez na nejvyšší vodorovný
   pás obsahu.
2. **Tenká rekvizita spojí pásy** — Šivův trojzubec vede od poprsí k rekvizitám,
   takže rozdělení na pásy selhalo a modelem byl „bust + předměty“ (reálně
   postihlo 082). Řešení: řádek patří postavě, jen když zabírá ≥ 15 % šířky panelu.
3. **Poprsí je někdy první panel** — u 118, 143, 149, 150… je vlevo portrét
   a celá postava až druhý panel; proporcionální ořez vracel bustu. Řešení:
   hledat panely v horních 62 % listu a vzít nejlevější s poměrem výška/šířka > 2.
4. **Pruh sousedního panelu** — devět front panelů mělo u okraje kus vedlejší
   postavy; řešeno sloupcovými pásy + ručním `--box` pro pět výjimek (118, 137,
   143, 148, 149).

**Provozní nález:** `.artifacts` v pracovním stromu je symlink na externí volume
(`/Volumes/ZION-Storage/…`). Bez připojeného disku `run-batch.sh` spadne na
`mkdir`, proto dávky běžely v `~/.local/share/zion-avatar3d/batches/<dávka>/`.

## 7. Kvalitativní verdikt (poctivě)

Je to **stejná „proxy“ úroveň jako modely dávek 01–03**: silueta, proporce
a paleta sedí, ale obličej a jemné atributy jsou měkké (single-view TripoSR
na 8 GB — viz §5 pipeline dokumentu). Nové modely **nejsou regresí** proti
nasazenému Krišnovi (`0.glb`), ale ani hrdinskou kvalitou; pro hru slouží jako
náhrada procedurálních postav a základ pro pozdější ruční dočištění.

## 8. Co zůstává otevřené

- **`44.glb` a `55.glb`** (dávky 01–03) nemají skin ani `idle` — jediné dva
  z 149 modelů, které nejsou rignuté. Stojí za opravu při další dávce.
- **Rig je humanoidní pro všechny** — had (123), orel (124), pavouk (148)
  a čtyřnohý Barong (116) dostali stejnou kostru. Vypadá to přijatelně, ale
  není to správný rig pro tyhle anatomie (stejná mez jako u dávek 01–03).
- **Chůze/útok, prsty, oddělené atributy** — bez změny, stále chybí (§7–8 pipeline).
- **Zbývá 50 postav rosteru** (ID 153–204) — balíčky 07–08 nedodány.

## 9. Zapojení do webu (app.zionterranova.com)

Web `/l4-oasis/avatars` kreslí 3D náhled v detailu avatara
(`components/AvatarModel3D.tsx`, GLB z Nirvany), ale jen pro ID, která jsou
v `src/lib/oasis/avatar-models.json`. Ten seznam měl **74 ID (000–077)** a nové
modely by **tiše ignoroval** — přesně ten typ chyby, který se neprojeví chybou,
jen absencí.

Oprava je systémová, ne ruční: nový `scripts/ops/gen-avatar-models.mjs` bere
**jediný zdroj pravdy** (`apps/nirvana/public/models/avatars/<id>.glb`) a píše
seznam; běží v `prebuild` webu, takže build bez něj nejde a seznam se nemůže
rozejít s repem. GLB do buildu kopíruje `deploy-web2.9.sh` (v `apps/website-v2.9/public/`
**nejsou** — žádná druhá kopie v gitu).

Seznam: **74 → 149** ID (000–152).

## 10. Nasazení a ověření

| Co | Release | Ověření |
|---|---|---|
| Nirvana (EDGE, `nirvana.zionterranova.com`) | `20261116T123939Z` | smoke 7/7 OK, rollback `.before-20261116T123939Z`, na serveru 149 GLB |
| Web2.9 (EDGE2, `app.zionterranova.com`) | `20261116T125551Z` | smoke 6/6 OK, rollback `.next/standalone.before-20261116T125551Z`, „avatar GLB: 149" |

Kontrola živých souborů (`Content-Length` proti lokálnímu souboru):
`78.glb` 3 965 324 B, `120.glb` 3 282 392 B, `152.glb` 3 392 356 B, `0.glb`
3 523 852 B — **vše 200 a na bajt shodné**.

Headless kontrola stránky (Chrome, 1440×900):
- **Atlas (152, nový):** detail má `canvas`, v síti `200 152.glb`, 0 chyb → PASS
- **Mestor (160, bez modelu):** žádný `canvas`, žádný request na GLB → PASS
  (tj. chybějící model pořád padá na 2D portrét, nic se nerozbíjí)

**Pozn. k deployi:** první `rsync` do Nirvany spadl na `Connection reset by peer`
u ~500 MB přenosu. Řešení bez opakování buildu: artefakt se postaví ručně
(standalone + `node_modules` + `public` + `.next/static` + `PROTO_VERSION`),
stage se předplní rsyncem s `--partial` a `ServerAliveInterval`, a teprve pak
se pustí `deploy-nirvana.sh --artifact-dir` (swap + restart + smoke).
Pro příště: u velkých deployů předplnit stage, ne spoléhat na jeden rsync.

## 11. Změněné soubory

```
heros/Avatars/ZION_OASIS_3D_PODKLADY_25_DAVKA_0{4,5,6}.zip   (LFS, 222 MB)
apps/nirvana/public/models/avatars/{78..152}.glb             (75 nových, ~250 MB)
apps/nirvana/src/core/avatars/models.ts                      (74 → 149 modelů)
apps/website-v2.9/src/lib/oasis/avatar-models.json           (74 → 149 ID)
apps/website-v2.9/package.json                               (prebuild generátor)
scripts/ops/gen-avatar-models.mjs                            (nový generátor)
docs/3.2/AVATAR-3D-PIPELINE.md                               (§1, §9e, historie)
AGENTS.md · apps/nirvana/AGENTS.md · apps/website-v2.9/AGENTS.md
docs/3.2/REPORTS/REPORT_2026-11-16_AVATARI_DAVKY_04_06.md    (tento report)
```
