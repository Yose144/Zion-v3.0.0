# REPORT 2026-10-31 — HIRAN NA SLUNCI (Nirvana, S0–S2)

> **Stav:** implementováno a ověřeno lokálně na produkčním buildu (M1 / ANGLE Metal).
> **Nenasazeno** — deploy na EDGE čeká na 👤 (jedno rozhodnutí, jeden příkaz).
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
- Deploy nenasazen: `apps/nirvana/deploy/deploy-nirvana.sh` na EDGE po 👤 schválení.

## 7. Změnový log

| Datum | Změna |
|---|---|
| 2026-10-31 | S0 (portál, slot `sun`, okno, proxy, fokus), S1 (orb: pole/pečeť/prstence/lotos, 4 stavy), S2 (stylizovaná jantra) hotové; ověřeno lokálně |
