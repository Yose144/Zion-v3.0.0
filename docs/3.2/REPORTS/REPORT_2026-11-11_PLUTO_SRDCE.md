# Report — Pluto: Srdce na okraji (`/pluto`) — 2026-11-11

**Zadání:** 👤 „mrskni něco na pluto" (po dokončení Neptun — Hlubina).

**Stav před:** `/pluto` byl poslední herní povrch bez hry —`OuterWorldPage`
(dosier + otočná planeta). Stejný stav jako `/neptune` před předchozím
krokem.

**Stav po:** `/pluto` je klidová hra **Srdce na okraji** — devět lamp na
zmrzlé pláni ve tvaru srdce, teplo jako jediná mechanika. Dosier planety
zůstal v menu (6 faktů NASA/JPL + text).

---

## 1. Návrh — protiváha k Neptunu

Neptun je **sestup** (rychlost, tlak, tma). Pluto je **pochůzka**
(trpělivost, teplo, světlo). Záměrně žádná zbraň, žádný soupeř, žádný
časový limit — jediné číslo, které hráč hlídá, je teplo.

| Prvek | Chování |
|---|---|
| Teplo | ubývá podle vzdálenosti od nejbližšího světla (`1,5 + 0,13 × m`, strop 9/s) |
| Soumrak | ztráta roste s časem (`2 + 0,05 × s`) a platí i u modulu |
| U světla | +10/s (minus soumrak) |
| Lampa | stojíš 1,5 s u ní → zapálí se, +20 tepla; od té chvíle hřeje |
| Konec | devět lamp (bonus) nebo zamrznutí |

**Skóre:** `lampy × 100 + teplo × 3 + 300 (celé srdce)`. Maximum 1500.
Denní výzva: 600 (pět lamp a kousek tepla navrch).

### Proč soumrak

První sehrávka odhalila, že **stáním u modulu se hra nikdy neukončí**
(300 s, teplo 100, konec `null`). Soumrak je fyzikální řešení (Slunce nad
Plutem klesá), ne časový limit v HUD, a dělá z pozdní hry skutečný tlak.

---

## 2. Balance (měřeno simulací, ne odhadem)

| Strategie | Lampy | Čas | Teplo | Skóre | Konec |
|---|---|---|---|---|---|
| nejbližší lampa, nezastavovat | 9/9 | 53 s | 20 | 1260 | srdce svítí |
| trpělivý (dobíjí u každé lampy) | 9/9 | 62 s | 67 | 1381 | srdce svítí |
| bez vstupu (stojí u modulu) | 0/9 | 223 s | 0 | 0 | zamrzl |

Vzdálenosti lamp: 22–48 m, nejdelší skok 48 m. Test
`test/pluto-light.mjs` hlídá oba konce (srdce jde dokončit / bez pohybu
se zamrzne).

---

## 3. Soubory

**Nové**

- `apps/nirvana/src/core/pluto/world.ts` — lampy, modul, čísla
- `apps/nirvana/src/core/pluto/light.ts` — čistá simulace (`stepLight`, `scoreOf`, `nextLamp`, `reachOf`)
- `apps/nirvana/src/core/pluto/PlutoScene.tsx` — scéna (pláň, modul, lampy, chodec, sníh, kry)
- `apps/nirvana/src/core/pluto/PlutoMinimap.tsx` — minimapa (srdce + lampy + hráč)
- `apps/nirvana/src/core/pluto/copy.ts` — texty cs/en/es
- `apps/nirvana/test/pluto-light.mjs` — 56 kontrol
- `apps/nirvana/e2e/pluto-audit.mjs` — 30 kontrol v prohlížeči

**Změněné**

- `apps/nirvana/src/app/pluto/page.tsx` — z dosieru na hru
- `apps/nirvana/src/app/globals.css` — blok `.pluto-*` + minimapa + sdílené `.planet-facts`
- registrace hry: `park/games/types.ts`, `park/scores.ts`, `park/challenge.ts`,
  `progress/boards.ts`, `api/park/scores/route.ts`
- `core/games/links.ts`, `core/games/surfaces.ts`, `core/shell/Shell.tsx`
- `apps/nirvana/e2e/mobile-audit.mjs` — `/pluto` do `PAGES`

---

## 4. Ověření

- `npx tsc --noEmit` — 0 chyb
- `npm run build` — OK (`/pluto` v seznamu rout)
- `npx tsx test/pluto-light.mjs` — **56/56**
- `node e2e/pluto-audit.mjs` — **30/30** (menu, chůze, úbytek tepla,
  zapálení lampy, dobíjení, pauza, celé srdce, profil i tabule, dotyk,
  0 chyb v konzoli)
- `node e2e/mobile-audit.mjs` — PASSED na 390×844 i 844×390 (přesah 0 px)
- Screenshoty: `.artifacts/render/pluto/{menu,walk,result,phone}.png`

---

## 5. Pasti, které to odhalilo

1. **Idle neměl konec** → soumrak (`duskAt`), který platí i u modulu.
2. **Kamera na 42 m neukáže tvar srdce** → minimapa kreslí **stejnou**
   parametrickou křivku jako textura pláně (dvě kopie by se rozešly).
3. **Lampy a postava byly z výšky tečky** → vyšší sloupky (glass 4,6 m),
   větší halo, `scale 1.25` na postavě.
4. **Kov bez env mapy je černý** — modul vypadal jako balvan; řeší nižší
   `metalness` + `emissive` + světelný pás.
5. **Měkký okraj srdce** řešen šesti soustřednými průchody, ne `ctx.filter`
   (v headless Chromiu se chová podle verze).
6. **Test narazil na vlastní mapu** — hráč postavený na `(0, −10)` stál
   přesně u lampy 6, omylem ji zapálil a test měřil doplnění místo ztráty.
   Testovací pozice musí být mimo `LAMP_RADIUS`.

---

## 6. Meze

- **Sólo.** Žádný multiplayer.
- **VR jen kód** (`<XR>` + `VrButton`), na headsetu neověřeno.
- **Zvuk je syntéza** ze sdíleného enginu.
- **Mobil emulovaný** headless Chromiem, ne skutečný telefon.
