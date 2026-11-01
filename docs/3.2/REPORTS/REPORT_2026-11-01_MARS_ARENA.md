# REPORT 2026-11-01 — MARS ARENA (Quake-style deathmatch)

> **Stav:** hratelné, ověřené lokálně i live; nasazeno na EDGE `20261101T072741Z`.
> **Live ověřeno:** rail srazil bota 100 → 0 hp a fragy 0 → 1 na produkčním buildu;
> navigace botů na produkčním buildu (2,3–6,7 m za 10 s). Deploy `20261101T074715Z`.
> **Route:** `/mars` (veřejná). Vstup z pouti: odkaz „Mars aréna · deathmatch →".
> **Rozsah:** jen `apps/nirvana`. L1, peníze, výplaty ani pass gate se nedotýkají.

## 1. Co to je

Deathmatch v duchu Quake 3, celý procedurální: mapa z krabic, pohyb s kolizemi
a skokem, dvě zbraně (rail a rakety), tři boti, zdraví a armor pickupy, frag
limit 10 nebo tři minuty. Žádné modely, textury ani zvuk — jen fyzika, světlo
a čísla.

## 2. Jak je to postavené

| Soubor | Role |
|---|---|
| `core/arena/map.ts` | mapa jako data: 22 AABB krabic (podlaha, zdi, plošina, schody, lišty, sloupy, kryty), spawny, pickupy, frag limit |
| `core/arena/physics.ts` | AABB fyzika: posun po osách s vytlačením, gravitace, tření, skok; ray–box (slab) a ray–sphere pro zásahy |
| `core/arena/MarsArena.tsx` | svět: render mapy, pointer lock, střelba, boti, rakety, pickupy, HUD callbacky |
| `app/mars/page.tsx` | HUD, intro/odveta, odeslání skóre a žetonů |

**Proč krabice:** každá zeď, schod i sloup je AABB. Fyzika je pak jen „posun →
překryv → vytlačení na líc", a hitscan je průsečík paprsku s intervaly. Za hodinu
práce vznikne mapa, kterou by modeling stál dny — a mainnet to neohrozí ani o bajt.

## 3. Mechaniky

| Věc | Hodnota |
|---|---|
| Pohyb | WASD, skok 7,4 m/s, gravitace 24, zrychlení 60, tření 9 |
| Rail | hitscan, 55 dmg, cooldown 0,75 s, neomezeně |
| Raketa | 26 m/s, 85 direct + 60 splash (r 3,2), 12 ran, cooldown 0,85 s |
| Bot | 100 hp, strafování, dostřel 11–17 dmg s 42% zásahy, respawn 3,2 s |
| Hráč | 100 hp, armor pohlcuje 60 %, respawn 2,4 s |
| Konec | 10 fragů nebo 180 s |
| Skóre | `frags × 100 − deaths × 25` |

Pickupy: dva health (+25, respawn 18 s), jeden armor (+50, respawn 30 s).

## 3b. Navigace botů (doděláno)

`core/arena/nav.ts` staví z krabic **mřížku 40×40 × 1 m**: buňka je průchozí,
když v úrovni těla (0,45–1,6 m) nic nestojí a pod ní je podlaha; výška podlahy
se ukládá per buňku, takže schody a plošiny jsou v mapě vidět i pro boty.

Bot si každých ~0,5 s spočítá cestu **BFS** z vlastní buňky do hráčovy, jde po
waypointech (postup při vzdálenosti < 0,7 m) a když hráče vidí, začne strafovat.
Žádná mesa, žádná knihovna — 1 600 buněk a pár stovek kroků.

## 3c. VR režim (doděláno, netestováno na headsetu)

- `<XR store>` obaluje scénu, tlačítko **VR** v HUD otevře session.
- **Míření:** pravý ovladač (`xr-standard-trigger` + směr z `controller.object`),
  střela letí po paprsku ovladače, ne po pohledu.
- **Střelba:** spoušť (held → opakovaná rána podle cooldownu).
- **Co ve VR není:** pohyb po mapě (hráč stojí a brání se, boti přijdou),
  DOM HUD v headsetu není vidět, žádné teleporty ani thumbstick.

## 4. Ověřeno

| Test | Výsledek |
|---|---|
| Zásah railem (debug háček `?arenaDebug=1`) | bot 100 → 0 hp, fragy 0 → 1 |
| HUD | zdraví, armor, fragy, čas, zbraň i munice se mění live |
| Střelba botů | hráč 100 → 10 hp během pár sekund (boti trefují, když vidí) |
| Přepnutí zbraně | `1`/`2`, munice raket 12 → 6 |
| Pohyb | WASD + skok prošly zdí? ne — kolize drží |
| Konzole | jen pre-existing `401` z `/api/auth/me` |
| **Navigace** | tři boti se za 12 s dostali z ~30 m na **0,7–2,8 m** od hráče (přes sloupy a schody) |
| **VR** | session se otevírá, ovladač míří, spoušť střílí (na headsetu neověřeno) |

Debug háček `?arenaDebug=1` (jen když je v URL) vystaví `aimAt`, `fire`, `state`
— slouží k headless testům zásahů, ne hráči.

## 5. Známé meze (poctivě)

- **Není to Quake 3.** Chybí: animace, zvuk, viewmodel zbraně, rocket jump
  laděný na milimetry, teleporty, jump pady, power-upy, síťová hra, pořadí
  zbraní, bot AI s navigací (boti jdou přímo a občas skočí).
- **VR:** aréna VR-ready není — pohyb a míření jsou na myši a klávesnici,
  pointer lock v headsetu neexistuje. Bude to chtít ovladače (thumbstick +
  paprsek) a vlastní kameru.
- **Pohyb ve VR chybí** — hráč stojí; thumbstick locomotion je další krok
  (a s ním i kolize v XR originu).
- **Boti neumí skákat přes překážky cíleně** — cestu najdou, ale výškové rozdíly
  větší než schod řeší jen náhodným skokem.
- **Bez persistence kromě tabule** — zápas se neukládá, jen skóre.
- Boti se občas zaseknou o sloup (řeší se skokem, ne navigací).

## 6. Napojení na pouť

- Skóre jde do stejné tabule (`/api/park/scores`, hra `arena`) a do stejného
  žetonového profilu (1 žeton za zápas, +2 za rekord).
- `arena` je i v denní výzvě (cíl 500 = 5 fragů).
- Odkaz z panelu pouti vede na `/mars`; zpět vede „← zpět na pouť".

## 7. Změnový log

| Datum | Změna |
|---|---|
| 2026-11-01 | Vznik: mapa, fyzika, dvě zbraně, tři boti, pickupy, HUD, tabule |
| 2026-11-01 | Navigace botů (mřížka + BFS) a VR režim (míření ovladačem, spoušť) |
