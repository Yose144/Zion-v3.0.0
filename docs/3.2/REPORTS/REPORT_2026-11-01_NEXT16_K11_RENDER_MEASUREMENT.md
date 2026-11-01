# Report 2026-11-01 — Next 16 K1.1 + gate 1b, měření 3D, R6

> **Datum:** 2026-11-01 · **Autor:** agent (autonomní session) · **HEAD při sepsání:** `c6d298eaf`
> **Rozsah:** migrace webů na Next 16, nasazení MarketPlace (security gate 1b), oprava G8 sondy,
> zprůchodnění měření 3D scén, snížení draw calls na rozpočet a R6 (universe).
> **Nic z toho se nedotklo** L1 konsensu, emise, genesis ani money-path logiky (Stripe/Coinbase zůstaly beze změny).

---

## 1. Souhrn

| # | Práce | Výsledek | Stav |
|---|---|---|---|
| 1 | K1.1 — IntroPage na Next 16 | 48 statických stránek, 13/13 rout 200 živě | ✅ nasazeno (apex) |
| 2 | K1.1 — OasisWeb na Next 16.4.3 | 11 stránek 200, assety 200 | ✅ nasazeno |
| 3 | K1.1 gate 1b — MarketPlace na Next 16 | critical CVE pryč, build + deploy + E2E | ✅ nasazeno |
| 4 | G8 sonda — falešná pozitiva | 480 s „výpadku", který nebyl | ✅ nasazeno na EDGE |
| 5 | Měření 3D — reprodukovatelnost | medián, warmup, okamžité fps | ✅ commitnuto |
| 6 | Draw calls — rozpočet §4 (≤250) | 4 scény nad limitem → 13/13 pod | ✅ |
| 7 | R6 — universe | 59,8 fps, čistý WebGPU fallback, přechod portálu | ✅ brána splněna |

**Všech šest webů je na Next 16.4.3 + React 19.** Next 14 v `apps/` skončil.

---

## 2. Next 14 → 16 (K1.1)

### 2.1 IntroPage (apex `zionterranova.com`)

`next` 14.2.30 → **16.4.3**, `react` 18 → **19.2.0**. **Bez jediné změny v kódu.**

- Past s `export const dynamic = 'force-static'` u `robots.ts`/`sitemap.ts` byla **předřešená** — nic nepadlo.
- Synchronní `params` u `blog/[slug]` a `seeds/[slug]` Next 16 se `generateStaticParams` přijme; 27 blog + 5 seed slugů se prerenderovalo správně.
- Build: 48/48 stránek. Lokálně 12/12 rout 200, živě 13/13; **obsah homepage identický s předchozí verzí** (markery `ZION` 66×, `Amenti` 28× — 1:1), `$undefined` jen RSC payload jako dřív.
- Rollback: `/root/web-backups/zion-maintenance-bak-20261101T092603Z/` (472 M) na EDGE2.

### 2.2 OasisWeb

`next` 16.2.12 → **16.4.3**. Build 13 statických rout, 11 stránek 200, assety 200, sada CSS tříd shodná
s předchozí verzí. Záloha `/root/web-backups/oasis-bak-20261101T095645Z/`.

> **Pozor, tohle je poučení:** první tři buildy padaly na `ENOENT` uvnitř `.next`. Příčina nebyla
> konfigurace — v `apps/OasisWeb` běžela **souběžná session s `rm -rf .next dist && next build`
> v cyklu**, která mazala výstup uprostřed buildu. Izolovaný `git worktree` prošel napoprvé.

### 2.3 MarketPlace (security gate 1b) — nejdůležitější část

`next` 14.2.35 → **16.4.3** + React 19. Odstraněna critical CVE z Next 14 (Image Optimization RCE,
Server Actions SSRF) — `npm audit` už `next` nehlásí, zbyly dvě transitivní build-time závislosti
(`nanoid`, `source-map-js`).

**Změny v kódu:**

| Věc | Změna |
|---|---|
| 16 route handlerů | `params` je od Next 15 `Promise` → `await context.params` / `await params` |
| `src/middleware.ts` | → `src/proxy.ts` s exportem `proxy` (Next 16 konvenci `middleware` deprecuje) |
| `next.config.js` | `turbopack.root = apps/` (appka importuje `apps/shared/**`) + vyřešen konflikt s legacy `webpack` blokem |
| eslint | 9 + `eslint-config-next` 16 + **flat config** (Next 16 odebral `next lint`) |
| standalone layout | `scripts/flatten-standalone.mjs` v postbuildu |

**Dvě reálné chyby, které s upgradem nesouvisely:**

1. **Repo MarketPlace vůbec nebuildil.** `deletedAt` na `ShopOrder` je ve schématu, ale
   `node_modules/.prisma/client` byl starý → `next build` padal na 19 type errorech.
   Po `npx prisma generate` je baseline zelený **ještě na Next 14**. Kdo tu appku buildí, musí
   generovat klienta — jinak si myslí, že rozbil upgrade.
2. **Trivi routy byly nedosažitelné.** `api/admin/trivi/{status,sync}/route.ts` deklarovaly
   `params.id`, ale cesta nemá dynamický segment, zatímco `shop-api.ts` volá `/status/<id>`
   a `/sync/<id>`. Soubory přesunuty do `[id]/` → routy existují (dřív 404). Mrtvá funkce ožila.

**Dvě pasti při nasazení (obě shodily produkci, obě vyřešené):**

- **Rsync `--exclude='node_modules'` není kotvený** → matchuje i `.next/standalone/node_modules`
  a `.next/standalone/.next/node_modules`. Server dostal **nové manifesty se starým Next 14
  runtime** (`TypeError: Cannot read properties of undefined (reading 'canonicalBase')`), podruhé
  `Cannot find module '@prisma/client-<hash>'` (Turbopack alias je symlink v `.next/standalone/.next/node_modules`).
  Fix: `--exclude='/node_modules'` + **pre-restart guard**, který porovná verzi Next lokálně vs.
  remote a radši **nerestartuje**, než aby pustil mix. Ten guard by obě nehody chytil.
- **`outputFileTracingRoot = appka` nejde použít** — Turbopack ho bere jako hranici resoluce
  a `../../../shared/**` přestane existovat. Proto flatten skript, ne tracing root.

**Verifikace na živém povrchu:** 8/8 rout 200 · `/api/health` = `healthy` (DB 2 ms) · `/api/items`
reálná data · `/api/admin/*` = 401 bez klíče · trivi routy 401 (dřív 404) · admin API s `x-api-key`
vrací agregace (Prisma `_count`/`_sum`) · **PDF faktura 200 / `application/pdf` / 358 kB** (puppeteer OK) ·
testovací objednávka `TEST-K11-20261101T104032Z` vznikla, dostala fakturu `FV2026-000051`
a byla zrušena (`pending → cancelled`).

**Zbytková mezera (pre-existing, ne regrese, vedená v auditu od 2026-10-30):** zrušení objednávky
**nevrací sklad** (`soft-002` zůstal na 998, dorovnáno ručně na 999) a faktura zůstala `issued`.
Tohle je samostatný úkol v money-path, ne důsledek upgradu.

---

## 3. G8 sonda — falešná pozitiva pod branou

Run #6 (`g8-20261029T234617Z`, do 28. 11.) měl čtyři služby pod branou 99,9 %:

| Služba | uptime | příčina |
|---|---|---|
| chain_live, pool_stratum | 99,972 % | ✅ nad branou |
| pool_http | 99,887 % | 240 s (30. 10.), reálné |
| dao | 99,802 % | **480 s falešných** |
| multichain, zis | 99,774 % | **480 s falešných** |

Dnešních 6 incidentů 08:02–08:18 UTC u `multichain`/`dao`/`zis` vypadalo jako výpadek.
`systemctl show` ale ukázal **`NRestarts=0`** — multichain běží od 31. 10., dao od 28. 10.,
zis od 02:40, a v journalu pro to okno není nic než rutinní pool debug.

**Root cause:** G8 vzorkuje 1 bod za 60s bucket, takže jediný zmeškaný paket = celých 60 s výpadku.

**Fix:** sonda po prvním kole zopakuje **jen selhané** sondy (`G8_PROBE_CONFIRM_ATTEMPTS`=2,
`_DELAY_MS`=400) a teprve když selžou i tam, hlásí `probe_success=0`. Šum zůstává vidět jako nová
metrika `zion_g8_probe_retried{service}` — jen se nepočítá jako downtime.

Testy **17/17** (4 nové: přechodné selhání se potvrdí pryč, trvalé zůstane selháním se správným
počtem pokusů, zdravé kolo se neopakuje, příznak je v metrikách). Nasazeno na EDGE: `probe_success`
všech 8 služeb = 1, `probe_retried` = 0.

> **Nedotaženo:** nasazení stejné verze na EDGE2 (parita). Branu počítá jen EDGE, ale sladit by se to mělo.

---

## 4. Měření 3D — z neprůchodného udělat reprodukovatelné

### 4.1 Co bylo špatně

`3D-SCENY-PLAN.md` měřil výkon na **softwarovém WebGL** (SwiftShader) a sám to přiznával.
Navíc `final/results.json` obsahoval 24 řádků `status: pass` s **`fps=0`, `calls=0`, `tris=0`** —
prázdné metriky označené jako úspěch. To není důkaz ničeho.

### 4.2 Tři vrstvy opravy (commity `627713dfd`, `c68d547dc`, `82c6623e9`, `e9bd0162f`)

1. **Opakované vzorky + medián.** Dva plné běhy stejné konfigurace se lišily až o **97 %**
   (bodhi-lanka 19,7 vs 38,9 fps). `--repeat 3` + medián + `--max-spread` (15 %); nad rozptyl je
   řádek `unstable: true` a se `--strict-budget` **fail s vysvětlením**, ne tichý pass.
2. **Settle + warmup.** První vzorek je vždy nízký (shader compile): 35,8 / 33,5 / 37,7 / 45,2 fps
   proti 56–59 u dalších. `--settle 4 --warmup 1`; zahozené vzorky se ukládají do `fps_discarded`.
3. **Okamžité fps, ne průměr od mountu.** `__projectScene.fps` je **kumulativní** průměr od mountu,
   takže ho sráží start (dekódování 4k textury oblohy, kompilace shaderů). Universe „naměřeno" 48 fps,
   skutečnost **59,8**. Audit teď měří okno přes `requestAnimationFrame` a kumulativní hodnotu ukládá
   zvlášť jako `cumulative_fps`.

**Jak se na to přišlo:** fps se při zmenšení plátna na čtvrtinu pixelů skoro nezměnilo
(50,8 → 53,0) a CPU profil ukázal **85 % idle** — to nesedí na GPU ani na JS, ale na špatnou metriku.

### 4.3 Prostředí

- Hardware: **AMD RX 5600 XT** (ANGLE gl-egl, 6,4 GB) a **NVIDIA GTX 1070 Ti** (ANGLE Vulkan).
  Obě cesty hardwarového WebGL ověřené (`WEBGL_debug_renderer_info`).
- **Host musí být klidný.** Při loadu ~20/12 jader (xmrig + build druhé session) čísla nesmyslná.
- **Preview z stabilního snímku:** `apps/nirvana` přebudovává druhá session, takže server z `.next`
  padal na chybějících manifestech. Preview se proto servíruje z `/tmp/zion-3d` (kopie standalone
  stromu) přes `zion-3d-nirvana.service` s `Restart=always`.
- **ZAP pas lokálně:** `/` i `/present/*` jsou gate-nuté. Pro audit běží stub ověřovač na
  `127.0.0.1:9099` (`{valid:true}`) a služba má `ARCHIVE_VERIFY_URL` na něj + `ZION_RENDER_AUDIT=1`.

---

## 5. Draw calls — rozpočet §4 (≤250 na scénu)

Na aktuálním kódu byly nad limitem čtyři scény. Opakované prvky šly do `SceneInstances`
(jedna geometrie, matice per instance, barva per instance) nebo do sloučené geometrie.

| Scéna | před | po | co se instancovalo |
|---|---|---|---|
| golden-republic-bohemia | 400 | **177** | 70 keřů + 90 stromů (kmen + koruna) |
| nova-amerika | 338 | **217** | listnáče (kmen + koruna) |
| bodhi-lanka | 491 | **229** | lekníny (plovák, 6 lístků, střed), sloupky mostů, lotosové střechy |
| te-piko-ora | 362 | **242** | doškové latě — 16 na chatu × 14 chat |

**13/13 scén pod 250 draw calls**, 0 chyb, 0 neplatných vrcholů.

Dvě věci, které to naučilo:
- **`mergeParts`** (dřív lokální v `kit/terrain.tsx`) je teď exportovaný. Lotosové plátky **nešly
  instancovat** — rotace skupiny (Y) a plátku (X) nekomutují, takže jedno Euler dá jiný sklon.
  Sloučení do jedné geometrie s per-vertex barvou zachová přesné transformace a udělá jeden draw call.
- **Inventář scény musí filtrovat viditelnost.** `__projectSceneObjects()` vracel i objekty, které se
  nekreslí (univerzum: 957 objektů proti 749 skutečným draw calls), takže atribuce ukazovala na
  špatné vrstvy. Hook teď nese `visible` a `name` (jen s `?sceneAudit=1`).

---

## 6. R6 — universe

| Metrika | Hodnota |
|---|---|
| fps (medián 3 oken po 3 s) | **59,8** |
| draw calls | 120–122 |
| trojúhelníky | 59,1 k |
| textury | 35 |
| invalid vertices | 0 |
| `?gpu=webgpu` | **čistě se demotuje na WebGL2** a vykreslí (badge `WEBGL2`, stejná geometrie) |

> Stará poznámka v `apps/nirvana/AGENTS.md`, že WebGPU cesta rendruje černou scénu, **už neplatí** —
> ověřeno snímkem. Fallback je čistý.

**Přechod scéna ↔ portál doplněn** (chyběl úplně, portály se přepínaly skokem): `.portal-veil`
v `Shell` — jeden závoj na každou změnu portálu (otevření, zavření, přepnutí), 340 ms,
`pointer-events: none`, respektuje `prefers-reduced-motion`. `key={portal ?? 'home'}` ho remountuje,
takže animace startuje znovu. Ověřeno headless: opacity 0,59 po 60 ms od otevření, 0,54 po zavření,
portál se otevře i zavře, 0 chyb.

**Zbývá z R6:** art sjednocení 12 komponent universe na kit (`StarGate`, `NewEarth`, `SolarSystem`,
`Issobella*`, `HoloConsole`, `SpaceBackdrop` dnes jedou na surových `three` materiálech bez IBL).
To je **designové rozhodnutí**, ne mechanická oprava — `StarGate` je záměrná replika brány
z IntroPage (22 rotujících kopií `2.png`), takže přebarvení by rozbilo tu vazbu.

---

## 7. Pasti, na které jsme dnes narazili (ať se nešlapou znovu)

1. **Dvě agentní session v jednom stromu = tichá korupce měření i buildů.** Souběžný
   `rm -rf .next && next build` zabil build OasisWebu i audit nirvany (mid-run `BUILD_ID` 13:03).
   Recept: izolovaný `git worktree`, nebo stabilní snímek buildu mimo `.next`. Vždy zkontroluj
   `ps -eo args | grep next-build` **před** měřením.
2. **`pkill -f` matchuje i vlastní příkazovou řádku** — zabil jsem si tím shell (vzor byl v cmdline).
   Zabíjet podle PID z `ps`, ne podle vzoru.
3. **`__projectScene.fps` je průměr od mountu** — na číslech záleží, měř okno.
4. **`curl` 200 není důkaz vykreslení.** Statický export s prázdnou scénou vrací 200. Měř
   `pageerror` + `canvas` v prohlížeči.
5. **Next 16.4 `reactBrowserBailout`** (nález druhé session): `next/dynamic { ssr: false }` pod
   veřejným Reactem 19.2.0 spadne na React #438 a stránka je prázdná. Fix `experimental: { reactBrowserBailout: false }`.
6. **K1.2 (root workspace) mění standalone layout** na `.next/standalone/apps/<app>/` a statika se
   musí stageovat ručně — deploy skripty to musí zplošťovat.
7. **Zastaralý release checkout je horší než žádný.** `.artifacts/3d-tuning/release` (`cdd205e69`)
   neobsahoval `apps/shared/scenes/kit/`, takže se z něj nedalo buildit a všechna čísla v
   `3D-SCENY-PLAN.md` byla měřená proti kódu, který se už neposílá.

---

## 8. Otevřené položky

| # | Věc | Poznámka |
|---|---|---|
| 1 | G8 parita na EDGE2 | fix nasazen jen na EDGE (branu počítá jen EDGE) |
| 2 | Re-baseline 3D měření | všechna čísla v `3D-SCENY-PLAN.md` jsou proti starému kódu; potřeba přeměřit z izolovaného worktree |
| 3 | R6 art sjednocení universe | designové rozhodnutí (Brana = replika IntroPage) |
| 4 | MarketPlace cancel nevrací sklad | pre-existing, money-path úkol |
| 5 | R7 akceptace + deploy | blokováno K1.3 (deploy skripty vs. nový standalone layout) |
| 6 | Web previews (R5) | 24 náhledů proti novému kódu neověřeno |

---

## 9. Změnový log

| Commit | Co |
|---|---|
| `179b2e083` | K1.1: IntroPage na Next 16 + React 19 |
| `0e9365fdc` | K1.1: OasisWeb na 16.4.3 + srovnání nirvany |
| `67e3d240b` | K1.1 gate 1b: MarketPlace na 16.4.3 + React 19 |
| `f493bb5ab` | fix: rsync exclude nesmí mazat vnořené node_modules |
| `627713dfd` | fix(3d audit): opakované vzorky + medián + detekce nestability |
| `c68d547dc` | fix(3d audit): settle + warmup |
| `82c6623e9` | feat(3d audit): inventář scény rozlišuje, co se kreslí |
| `2d081aac3` | perf(3d): instancing ve čtyřech scénách |
| `b5b2d3664` | perf(3d): bodhi-lanka pod rozpočet — `mergeParts` |
| `e9bd0162f` | fix(3d audit): fps jako okno, ne průměr od mountu |
| `1adb29802` | feat(3d R6): přechod scéna ↔ portál |
| `c6d298eaf` | fix(g8): potvrzovací retry sondy |
