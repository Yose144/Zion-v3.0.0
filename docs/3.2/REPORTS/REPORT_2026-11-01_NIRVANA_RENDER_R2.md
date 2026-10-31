# NIRVANA RENDER — R2 (všech 13 scén) + R5 (web previews)

**31. 10. 2026.** Druhá etapa programu [`NIRVANA-RENDER-AAA.md`](../../../NIRVANA-RENDER-AAA.md).
Navazuje na [`REPORT_2026-10-31_NIRVANA_RENDER_R1.md`](REPORT_2026-10-31_NIRVANA_RENDER_R1.md)
(Render Kit + první pětice scén).

## R2 — art pass dokončen na všech 13 scénách

Každá scéna dostala stejnou páteř: shader obloha, IBL z téže oblohy, jedna stínová
key-light, opar, post-processing a cinematic intro. Terén je tam, kde dává smysl;
voda je všude nový Fresnel shader (`SceneWater`).

| Scéna | Co se změnilo v této etapě |
| --- | --- |
| Genesis Garden | Terén s loukou místo sedmi obřích koulí, zklidněná řeka, světlejší obloha, texturovaná zem a plocha. |
| Dharma Temple | Kamenná plošina z `stoneCool` (už ne „dřevěný sud"), jezírka jako `SceneWater`, teplá obloha s oparem. |
| Te Pīko Ora | Písečná pláž s texturou, tropická obloha, key-light; laguna zůstává z `LagoonLandscape`. |
| Golden Republic Bohemia | Displaced louka s kopci až za obzorem (žádný viditelný okraj), teplý backlight. |
| LUMI Nová Amerika | Vulkanický terén s reliefem, soumraková obloha s hvězdami, key-light. |
| Tres Marias | Soumrakové nebe nad oceánem, key-light; oceán je nově laděný do hloubky. |
| Boa Esperança | Bouřková obloha, basaltové útesy, zklidněná příbojová vlna. |
| Matrix · hala | Uzavřený strop, stropní světelné pásy, jasnější interiér, IBL pro sklo, silnější bloom. |

Společná oprava, která se propsala do všech scén: **scénické shadery už neprovádějí
vlastní tonemapping ani sRGB konverzi** (`#include <tonemapping_fragment>` /
`<colorspace_fragment>`). Renderujeme do HDR targetu a tonemapping dělá až composer;
dvojí konverze dělala oceán a oblohu vybledlé.

## R5 — web previews

`apps/website-v2.9/src/components/usePreviewVisibility.ts` — IntersectionObserver
(`rootMargin: 200px`) drží `frameloop="never"`, dokud náhled není na obrazovce, a pauzuje
i při skryté kartě. Dvanáct preview komponent ho používá. Náhled se tak nevykresluje od
načtení stránky, ale až když na něj člověk dojde.

Měřeno na produkčním standalone webu (Metal, Apple M1): náhled Ekamu po odscrollování
**51,7 fps / 204 draw calls** — dřívější čísla 7–18 fps byla z velké části práce
background canvasu a běžícího preview mimo viewport.

Audit harness proto před čekáním na frame odscrolluje **poslední** canvas (web má
i globální hvězdné pozadí) a počká, až existují oba.

## Instancování — draw calls

`ScenePalms` v kitu merguje kmen, sedm listů a ořech do jedné geometrie s vertex colours,
takže celý háj je jeden draw call. Nasazeno v Bodhi Lanka (730 → 489) a LUMI
(561 → 328). Zbylé náklady jsou kapličky, lilie a pódia, ne vegetace.

## Finální akceptace — 13 scén, produkční build

| Scéna | Draw calls | Trojúhelníky | FPS |
| --- | --- | --- | --- |
| Te Pīko Ora | 574 | 85 k | 50,9 |
| Bodhi Lanka | 489 | 90 k | 53,5 |
| Golden Republic Bohemia | 382 | 79 k | 54,1 |
| LUMI Nová Amerika | 328 | 101 k | 51,7 |
| Uluru | 254 | 84 k | 54,4 |
| Amenti | 231 | 77 k | 53,2 |
| Genesis Garden | 227 | 103 k | 52,2 |
| Ekam | 204 | 108 k | 53,0 |
| Boa Esperança | 165 | 36 k | 57,7 |
| Matrix | 156 | 11 k | 54,0 |
| Tres Marias | 141 | 43 k | 57,6 |
| Kailash | 139 | 104 k | 57,3 |
| Dharma Temple | 109 | 139 k | 51,9 |

13/13 `pass`, žádná shaderová ani konzolová chyba, `invalidVertices: 0`.

## Ověření

- `npx tsc --noEmit` čistý v Nirvaně i ve webu.
- Produkční `next build` obou aplikací prošel.
- Náhledy na webu i prezentace v Nirvaně používají stejný kód scény — společná změna
  se projeví na obou površích.
- Akceptace: `scripts/ops/audit-project-scenes.py --app nirvana --shots-only --gpu metal`
  nad produkčním buildem, 13 scén, bez shader a konzolových chyb.

## R3 + R4 (dokončeno v navazujícím kole)

**Jeden oceán.** `apps/shared/scenes/kit/ocean.tsx` — tři překřížené vlnové vlaky počítané
procedurálně (žádné texturové tilingy na 2 km), Fresnel k barvě oblohy, sluneční glint,
volitelná pěna a shoreline. `AtlanticOcean` je odteď tenká vrstva s původním API
(`level`, `coastal`, `lagoon`, `shorelineZ`, `roughSea`), takže Dharma, Boa i Tres Marias
sdílí jednu implementaci.

**Zvuk bez assetů.** `core/shell/ambience.ts` syntetizuje tichý podklad z filtrovaného
šumu a pomalého LFO (profily `surf`, `wind`, `forest`, `desert`, `space`, `temple`).
`SceneSoundToggle` zkusí `/audio/<slug>.mp3`; když soubor není, přepne na ambienci —
tlačítko už není mrtvé. Ověřeno v prohlížeči: `ZVUK → VYPNOUT ZVUK`, `aria-pressed=true`,
žádná chyba v konzoli kromě očekávaného 404 na chybějící track.

**Brána kvality.** Harness má `--strict-budget` (≤600 draw calls, ≤450 k trojúhelníků,
≥30 fps), `--scorecard` (markdown tabulka) a vizuální regresi: `--visual-baseline <dir>`
+ `--visual-gate <%>` porovná 16×16 perceptual hash hero snímku s referencí a při rozdílu
nad práh scénu shodí. Ověřeno: stejný běh proti sobě = 0,0 % delta, brána 6 %.

**Život ve scénách.** `SceneMotes` — jeden `Points` objekt, pohyb celý ve vertex shaderu
(CPU nahraje pozice jednou). Nasazeno: Ekam (pyl), Amenti (prach), Uluru (červený prach),
Kailash (sníh). Mrzne při `prefers-reduced-motion`.

Finální běh: 13/13 `pass` se strict budgetem i s vizuální bránou.

## Otevřené (další vlny)

- **R4** — částice a drobný život v každé scéně (ptáci, prach, listí) nad rámec zvuku.
- **R6** — universe (`/`): první krok hotový (composer, bloom, DPR z tieru, audit háček;
  57 fps / 119 draw calls / 65 k tris na WebGL2). Zbývá: přechody scéna↔portál, HUD,
  Dolby-like grading StarGate a Nové Země.
- **Instancování** — Bodhi Lanka (730), Te Pīko Ora (544) a LUMI (469) draw calls;
  palmy a keře chtějí vlastní instancované průchody.
- **Vizuální regrese** — harness zatím ukládá snímky, ale neporovnává je; chybí
  perceptual diff proti baseline.
