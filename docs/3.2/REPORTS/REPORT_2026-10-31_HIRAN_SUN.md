# REPORT 2026-10-31 — HIRAN NA SLUNCI (Nirvana, S0–S2)

> **Stav:** implementováno, ověřeno lokálně na produkčním buildu (M1 / ANGLE Metal)
> a **nasazeno na EDGE** (deploy `20261031T190057Z`, rollback `nirvana.before-20261031T190057Z`).
> **Rozsah:** jen `apps/nirvana/**` + dokumentace. L1, emise, genesis, výplaty, API
> ani portály se nedotčeny.

## 1. Co to je

Hiranyagarbha — zlaté kosmické vejce — usedá do Slunce, které je v Nirvaně jediný
zlatý, centrální a dosud němý objekt. Fyzická fotosféra a koróna zůstávají; Hiran
je vrstva nad nimi: zlatá pečeť (stylizovaná Śrí jantra), koruna lotosu, dva prstence
a tenké filamenty na okraji. Klik na Slunce (nebo dlaždice v konzoli / drawer / deep-link)
otevře okno s otázkou a odpovědí.

Soubor s plánem: `/Users/yeshuae/.opencode/plan/HIRAN-SUN.md`.

## 2. Architektura

| Soubor | Role |
|---|---|
| `apps/nirvana/src/core/hiran/presence.ts` | `HiranState = idle \| thinking \| offline \| error`, aktivita pro shader, review override |
| `apps/nirvana/src/core/scene/universe/HiranSun.tsx` | pečeť (LineSegments), lotos (instancedMesh, 30), prstence (2× torus), energetické pole (ShaderMaterial) |
| `apps/nirvana/src/core/scene/universe/SolarSystem.tsx` | vnější koróna nahrazena **jednou aditivní plochou** s radiálním přechodem (dřív 2 koule s tvrdým okrajem — zblízka viditelné bandy) |
| `apps/nirvana/src/core/scene/universe/Universe.tsx` | režim fokusu `earth \| sun` (dolly → předání OrbitControls), mount `HiranSun` |
| `apps/nirvana/src/core/scene/SceneRoot.tsx` | předání `focus` + `hiranState` do universe (WebGPU i WebGL2 cesty) |
| `apps/nirvana/src/core/portals/manifest.ts` | portál `hiran` (L3), nový slot `sun` |
| `apps/nirvana/src/core/shell/Shell.tsx` | `SLOT_COLOR.sun`, stav přítomnosti, fokus, mount okna |
| `apps/nirvana/src/portals/hiran/HiranPortal.tsx` | okno: probe, chat, offline/error stavy, „Přiblížit ke Slunci" / „Zpět k Zemi" |
| `apps/nirvana/src/app/api/hiran/route.ts` | `GET` probe + `POST` dotaz; per-IP 20/min; žádné klíče |

**Proxy** jde na veřejné `https://app.zionterranova.com/api/ai-chat` (Nirvana běží na EDGE,
ai-native na EDGE2) — stejná politika jako ostatní portály: veřejné HTTPS, žádná
session, žádné mutace.

## 3. Rozhodnutí, která stojí za zapsání

1. **Pečeť nemůže být uvnitř.** Fotosféra je neprůhledná, takže Śrí jantra je plocha
   ~1,04 R před diskem, billboardovaná k divákovi. Přesná konstrukce (43 trojúhelníků)
   zůstává otevřená jako S5; tenhle tvar je poctivá linka, ne AI ilustrace.
2. **Lotos nemůže ležet v ekliptice.** Divák je v ní. Lotos je proto koruna na kouli:
   tři věnce (12 / 10 / 8 lístků) míří od středu, takže je čitelný z každého úhlu.
3. **Offline je stav, ne chyba.** Živá sonda dnes: `GET` řekne `available:true`
   (ai-native i LLM `/health` odpovídají), ale `POST` vrátí degraded/offline odpověď.
   Okno to řekne (`Hiran teď nemluví — inferenční uzel není dostupný. Slunce svítí dál.`),
   dotaz staví na pravdu odpovědi, ne na `/health`, a Slunce jen ztlumí pečeť.
4. **Model mlčí potichu.** Offline odpověď proxy vrací **200** s `{offline:true}`
   (spící model není selhaný HTTP požadavek) — jinak si prohlížeč zaloguje 503 do konzole.
5. **Žádný hlas.** `listening` / `speaking` z masterplanu se neimplementují, dokud
   v repu není STT/TTS. Žádný fake waveform.

## 4. Měření (lokální produkční build, Apple M1, ANGLE Metal)

| Scéna | FPS | Draw calls | Trojúhelníky | Invalid vertices |
|---|---|---|---|---|
| Universe (Země, 1440×900) | 43–58 | 63 | 53 468 | 0 |
| Fokus na Slunce | 46–59 | 46–47 | 52 772 | 0 |

Rozpočet canonu: ≤ 600 draw calls (cíl 250), ≤ 450 k trojúhelníků, ≥ 30 fps → **splněno**.
Hiran přidává 8 draw calls (pole, pečeť, 2 prstence, lotos, label, chyták, glow).

Konzole: jediná chyba je **pre-existing** `401` z anonymous probe `/api/auth/me`
(AuthProvider), nesouvisí s Hiranem.

## 5. Ověření (co bylo opravdu spuštěno)

- `npx tsc --noEmit` v `apps/nirvana` — čisté
- `npm run build` — 24 stránek + `ƒ /api/hiran`, bez chyb
- headless prohlídka (Playwright + lokální Chrome, `--use-angle=metal`):
  - `?hiran=idle|thinking|offline` → tři beauty shots, stavy rozlišitelné
  - deep-link `#portal=hiran` → okno + fokus na Slunce
  - drawer → dlaždice „Hiran" (druhá pozice) → fokus + okno
  - „Zpět k Zemi" → kamera zpět na Zemi, tlačítko se překlopí na „Přiblížit ke Slunci"
  - zavření okna → `Zpět k Zemi`, fokus se vrací
  - mobil 390×844 → panel se vejde, tlačítko ne/overflowne
  - `POST /api/hiran` s prázdným promptem → 400; offline → 200 `{offline:true}`
- screenshoty: `.artifacts/render/hiran-20261031/` (universe-earth, hiran-sun,
  state-idle, state-thinking, state-offline, drawer, drawer-to-sun, back-to-earth,
  mobile-390)

## 6. Známé meze

- Vizuální rozdíl idle vs offline je jemný (ztlumení pečeti a prstenců). Záměr: rozdíl
  nemá křičet, stav říká panel.
- Śrí jantra je stylizace; přesná konstrukce = navazující úkol s art review.
- Hiran v Nirvaně neumí nic než odpovědět. Žádné akce, žádné klíče, žádná session.
- Harness `audit-project-scenes.py` universe pořád neměří (soubor má rozpracovanou
  jinou session) → měřeno vlastní sondou přes `?sceneAudit=1`; doplnit řádek
  `universe` do harnessu je samostatný malý úkol.

## 6b. Nasazení (2026-10-31)

- `bash apps/nirvana/deploy/deploy-nirvana.sh` → EDGE, deploy `20261031T190057Z`,
  předchozí build držen v `/opt/zion/APP&WEB/nirvana.before-20261031T190057Z`
- smoke: `/` 200, `textures/milkyway-eso-4k.jpg` 200, `textures/earth-blue-marble.webp` 200,
  `/api/oasis/worlds` 200, lokální `:3010` 200
- live ověřeno: `GET /api/hiran` → `{available:true}`; `POST` → `{offline:true,…}`
  (model dnes nevydá odpověď — přesně ten stav, který okno umí); deep-link
  `#portal=hiran` otevře okno a přiletí ke Slunci, textura Slunce se načítá
- konzole live: jediná chyba `401` (anonymous `/api/auth/me`, pre-existing)


## 7. Změnový log

| Datum | Změna |
|---|---|
| 2026-10-31 | S0 (portál, slot `sun`, okno, proxy, fokus), S1 (orb: pole/pečeť/prstence/lotos, 4 stavy), S2 (stylizovaná jantra) hotové; ověřeno lokálně |

---

# Chrám Hirana — nová L5 scéna `/hiran`

> **Druhá polovina zadání:** „Hiran jako vstup do jiných L5 projektů, 3D model
> zlatého orbu na lotosovém květu, jako v Ekamu nebo Matrixu, a interaktivní."
> Přidáno tentýž den nad rámec S0–S2 (původní okno ve vesmíru zůstává).

## Co to je

`apps/shared/scenes/Hiran.tsx` — čtrnáctá scéna rodiny (12 misí + Matrix + Hiran),
postavená stejným render kitem jako Ekam: mramorová kruhová terasa, tmavá kamenná
podlaha se zlatými vlysy, **lotos z dvaceti perleťových plátků**, v něm zlatá miska
a nad ní **zlaté vejce** (jádro, energie, Śrí jantra, skleněná blanka, dva prstence,
aditivní záře) a kolem **třináct bran** do světů Království srdce.

Interakce:
- **klik na orb** → otevře se chat Hirana (stav jde do scény: idle → thinking → offline),
- **klik na bránu** v 3D (nebo na dlaždici v pásu dole) → `router.push` do `/present/<svět>`,
- **hover** na orb i bránu mění kurzor a orb mírně roste,
- pás bran dole je zároveň přístupná varianta pro mobil a klávesnici.

`apps/shared/scenes/kit/yantra.ts` — Śrí jantra jako jedna zlatá linka (devět
trojúhelníků + tři kružnice + bindu). Jeden zdroj pro chrám i pro orb ve vesmíru
(`HiranSun.tsx` ho teď taky používá, ~45 řádků duplikace zmizelo).

`ProjectPresentation` dostal slot **`overlay`** — DOM vrstva nad plátnem (chat,
pás bran). Scény samy zůstávají bez DOM.

## Naměřeno (produkční build, M1 / ANGLE Metal, 1440×900)

| Metrika | Hodnota | Brána canonu |
|---|---|---|
| FPS | **59,3** | ≥ 30 |
| Draw calls | **159** | ≤ 250 |
| Trojúhelníky | **46 090** | ≤ 400 k |
| Textury | **32** | ≤ 32 (přesně na stropě) |
| Invalid vertices | **0** | 0 |
| `budgetOk` | **true** | true |

Chování ověřeno headless prohlídkou: klik na orb otevře chat, pás bran naviguje
(`/present/ekam`), z okna ve vesmíru vede „Vstoupit do chrámu" na `/hiran`.

## Web

`apps/website-v2.9/src/components/HiranPreview.tsx` (+`Lazy`) — stejná scéna v malém
plátně, brány jako dekorace (bez navigace), sekce „Hiran v prostoru" na `/l3-hiran`
s CTA do Nirvany. `tsc --noEmit` i `next build` čisté.

## Kde to je a proč veřejně

Chrám je na **`/hiran`**, ne pod `/present/*`. Důvod je věcný: souběžná session
zavřela všechny `/present/*` deep-linky za ZAP pass (`app/present/layout.tsx`,
server-side redirect). Chrám je rozcestí — veřejné, aby na něj šlo dojít z webu —
a **brány za ním vedou do gated scén** (`/present/ekam` → 307 na `/` bez pasu).
Ověřeno live: `/hiran` 200, `/present/hiran` 404, `/present/ekam` 307.

## Nasazení

| Povrch | Deploy | Rollback |
|---|---|---|
| Nirvana (EDGE) | `20261031T205858Z` | `/opt/zion/APP&WEB/nirvana.before-20261031T205858Z` |
| Web (EDGE2) | `20261031T210216Z` | `.next/standalone.before-20261031T210216Z` |

Web build potřeboval linuxový `sharp` (`sharp-linux-x64` + `sharp-libvips-linux-x64`)
zkopírovaný z EDGE2 do `node_modules/@img/` před buildem — jinak by `next/image`
na Linuxu vracelo 500 (macOS build obsahuje jen `sharp-darwin-arm64`). Smoke po
deployi: `/images/home/hero.webp` 200, takže ostré obrázky žijí.

## Známé meze

- **Textury jsou přesně na stropě 32.** Přidání dalšího `SceneLabel` nebo nového
  mramorového variantu (`repeat`) bránu rozbije — nová výzdoba musí nejdřív ubrat
  jinde (nejvíc jich spotřebují popisky: každý je vlastní CanvasTexture).
- **`/audio/hiran.mp3` neexistuje** → 404 v konzoli, zvuk jde ze syntetizované
  ambience (`SceneSoundToggle`). Track dodá operátor, kód se nemění.
- `401` z `/api/auth/me` je pre-existing (anonymous session probe).
- Śrí jantra v chrámu je stejná **stylizace** jako na Slunci; přesná konstrukce
  zůstává otevřená (S5).
- Brány jsou vizuálně „markery" (sloupek + prstenec + klenot), ne architektura —
  každý svět má vlastní scénu až za branou, tady jde o rozcestí.
