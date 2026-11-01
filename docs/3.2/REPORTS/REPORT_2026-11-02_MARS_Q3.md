# REPORT — Mars aréna na Quake 3: pohyb, sestava zbraní a boti v MP (2026-11-01/02)

## Zadání

👤: „poladit hru na Marsu podle Q3, rozšířit tak, jak jsme to udělali na Merkuru".

Tedy dvě věci: **(a)** pohyb a zbraně podle skutečného Quake 3, ne jen
„pocit z Quake", **(b)** rozšíření jako na Merkuru — aréna nesmí být prázdná.

## Odkud čísla jsou

Ne z wiki, ale ze **zdroje**: `id-Software/Quake-III-Arena`,

- `code/game/bg_pmove.c` → `pm_accelerate = 10`, `pm_airaccelerate = 1`,
  `pm_friction = 6`, `pm_stopspeed = 100`, `PM_Accelerate`, `PM_Friction`,
  `PM_AirMove`, `PM_CheckJump` (skok vyžaduje puštění tlačítka),
- `code/game/g_weapon.c` → railgun `damage = 100`, machinegun `damage = 8`,
  `addTime` 1500/100 ms,
- `code/game/g_missile.c` → rocket `damage 100`, `splashDamage 100`,
  `splashRadius 120`,
- `code/game/bg_public.h` → `ARMOR_PROTECTION 0.66`.

Měřítko: Q3 hráč je 56 jednotek ≈ 1,75 m → **1 jednotka = 0,03125 m**.
Z toho `pm_maxspeed` 320 u/s = **10 m/s**, `g_gravity` 800 u/s² = **25 m/s²**,
`JUMP_VELOCITY` 270 u/s = **8,44 m/s**, `pm_stopspeed` = 3,13 m/s.

---

## 1. Pohyb — `core/arena/physics.ts` (sdílený klient+server)

Přepsán na Q3 model. Tři věci, které dělají z Quake Quake:

| v Q3 | v naší hře dřív | teď |
|---|---|---|
| **friction na zemi každý snímek** (`PM_Friction`) | tření jen když **ne**držíš klávesu → hráč klouzal | friction vždy na zemi; pod `stopSpeed` zabírá razem |
| **accelerate proti rychlosti ve směru pohybu** (`PM_Accelerate`: `addspeed = wishspeed − (v·dir)`) | pevný přírůstek + tvrdý strop rychlosti → žádný strafe jump | stejná projekce → **strafe jump funguje**, diagonála není rychlejší |
| **air accel 1 vs ground 10** (`PM_AirMove`) | vzduch = země | vzduch „nese" rychlost |

Navíc:
- **skok vyžaduje puštění** (`PM_CheckJump`/`PMF_JUMP_HELD`) — držený
  mezerník nedělá donekonečna hop,
- **step-up 0,55 m** (Q3 `step`) — schody se vyjdou bez skoku a rychlost se
  při výšlapu neztrácí (jinak hráč na schodech klouzal).

---

## 2. Zbraně — `core/arena/weapons.ts`

| zbraň | Q3 | dřív u nás | teď |
|---|---|---|---|
| railgun | 100 dmg | 55 dmg / 0,75 s | **100 dmg / 1,2 s** |
| rocket | 100 + 100 splash, r=120 u | 85 + 60, r=3,2 m | **100 + 100, r=3,75 m**, 28 m/s |
| machinegun | 8 dmg, 100 ms | neexistovala | **8 dmg / 100 ms / 50 nábojů**, rozptyl 0,035 rad |
| armor | `ARMOR_PROTECTION` 0,66 | 0,60 | **0,66** |

**Sólo aréna přestala používat vlastní čísla** a bere sdílený `WEAPONS`.
Předtím solo rail ubíral 55 a serverový 100 — přesně ta past, kvůli které
vzniklo pravidlo „jeden zdroj pro klienta i server".

---

## 3. Boti v multiplayeru — `core/arena/bot.ts` (nový modul)

**To je ta „rozšíření jako Merkur"**: aréna už není prázdná. Server drží
v místnosti **3 boty** (`NIRVANA_ARENA_BOTS`, default 3), kteří:

- jedou **stejným modulem** jako by měli sólo (pravidlo M2a),
- chodí po BFS cestě z `nav.ts`, drží odstup, strafují, míří s chybou,
- mají **nepopiratelnou přednost před lidmi** (`+1000` ke vzdálenosti
  botů) — bez toho by se tři boti vyraždí mezi sebou a hráč by se jen díval
  (reálně se to stalo: `bot-1 → bot-3`), a **bez lidí** se bias vypíná
  a boti hrají proti sobě,
- **frag limit počítá jen lidi** — bot nesmí vyhrát zápas člověku.

---

## 4. Chyby, které to odhalilo

### 4.1 `lineOfSight` míjel stěny (předexistující bug, opraven)

`lineOfSight` předával `rayBox` **nenormalizovaný** směr, ale `rayBox`
vrací `t` v jednotkách **toho směru**. Porovnání `t < dist − 0,05` pak
pouštělo stěny **za** cílem jako překážku: na 16 m vzdálenost stěna ve
vzdálenosti 28 m „blokovala" viditelnost. Boti odmítali střílet přes
volný prostor a vypadali hloupě. Směr se teď normalizuje.

### 4.2 Botí mozek mířil z jiné výšky, než ze které střílí server (opraven)

`stepBot` počítal zaměření z `self.y + 1,2`, ale server střílí z
`body.y + PLAYER.eye` (1,6 m) a testuje zásah proti středu koule
`PLAYER.height · TARGET_EYE_RATIO` (1,05 m). Bot si myslel, že míří
správně, rána vycházela 0,4 m výš. `eyeHeight`/`targetHeight` jsou teď
v `DEFAULT_BOT_OPTIONS` a jsou to **tytéž hodnoty, co server**.

### 4.3 Chyba míření 0,06 rad byla moc velká

Na 10 m to dává 0,62 m odchylky = přesně poloměr zásahové koule → bot
míjel v půlkách. Sníženo na **0,035 rad (≈2°)** — na 10 m 0,35 m
(spolehlivý zásah), na 20 m pořád míjí, takže bot není neomylný.

---

## 5. Protokol

`PROTO_VERSION` **3 → 4**:

- `WeaponId = 0 | 1 | 2` (rail / rakety / MG),
- `ArenaPlayerState.isBot` a `.ammo` — **munici drží server**, klient jen
  zobrazuje (dřív si klient vymýšlel a mohl se rozejít se serverem).

**Deploy pořadí je nutné:** nejdřív `deploy-nirvana-net.sh`, pak
`deploy-nirvana.sh`. Obráceně by nový klient propadl `arena` fallbacku
starého parseru. Obojí nasazeno 2026-11-01 22:58 / 23:59:

- net: release `20261101T225852Z`, rollback `.before-20261101T225852Z`
- app: healthy ~10 s, smoke 200

---

## 6. Testy

Celá sada **5/5 zelená** (`apps/nirvana-net`):

| sada | co | |
|---|---|---|
| `smoke` | handshake, místnosti, presence, rate limit, Origin | OK |
| `arena` | dva klienti, pohyb, zásah, frag, respawn | OK (boti vypnuti) |
| `race` | Venuše | OK |
| `fight` | Merkur | OK |
| **`arena-bots` (NOVÁ)** | **17 kontrol** | OK, **5/5 běžů stabilních** |

`arena-bots` je záměrně **deterministický**: boj běží v čisté simulaci
s jedním botem v místnosti (jinak si boti stínají cíl), síťová část
testuje jen transport (3 boti, `isBot`, jména, pohyb, zbraň, munice,
`match_start`). Dřív síťová část flakovala — to není „oprava testu", ale
nalezení toho, že test testoval náhodu, ne kód.

Ověřuje: sdílený mozek (preferuje člověka, hýbe se, chce střílet),
server je autorita (bot zasadí zásah a zabije), respawn, lidský frag,
MG ubírá po 8 (není one-shot), frag limit jen pro lidi.

**E2E** `apps/nirvana/e2e/mars-arena.mjs`: 9/9 v headless Chromiumu —
klient se připojí přes proto 4, vidí 3 boty s `isBot`, hýbou se, snapshot
nese zbraň i munici, **0 JS chyb**. Screenshot:
`.artifacts/render/mars-q3-20261101/mp-bots.png` (board host-66a +
VALLIS/NOCTIS/ARES).

`tsc --noEmit`: 0 chyb v `src/`.

---

## 7. Živě ověřeno na produkci

- `/mars` 200, `net/health → proto 4`,
- reálné `join arena`: `room arena-1 | hráči 4 | boti: VALLIS,NOCTIS,ARES`,
  člověk `hp 100 | zbraň 0 | munice 12`, boti `isBot: true` a pohybují se,
- **Merkur přežil bump** (sdílí protokol): `join fight` → `host-d47, Stín`.

---

## 8. Meze (nehlasit jako hotové)

- **Sólová aréna má pořád vlastní botí AI** — modul `bot.ts` používá jen
  server. Sóloví boti (VALLIS/NOCTIS/ARES v sólo režimu) jedou starou
  vloženou logikou. Sjednocení je další krok; důvod: `MarsArena.tsx` má
  911 řádků a v té době na něm paralelně pracovala jiná session.
- **MG nemá doplňování munice** — 50 nábojů na respawn, v mapě není
  pickup. Q3 má `ammo_` boxy; tady chybí.
- **MG zvuk** — používá `playHit`, v `audio.ts` není samostatný zvuk MG.
- **Boti nemají úrovně obtížnosti** (Q3 má easy/medium/hard); jen jeden.
- **Žádný zvuk v MP** (pre-existing, z M2a) — zvuky hraje jen sólo.
- **VR** — nedotčeno.
- **Boti se navzájem stínají jen bez lidí** — se člověkem v místnosti
  jdou všichni po něm (záměr, ale znamená to, že 3 boti = 3× stejný cíl).

---

## 9. Poznámka k historii repozitáře

Commit s touto prací přistál uvnitř `1e332d756` („release(W1.4)…"), protože
paralelní session prováděla `git add` přes celý strom a strhla moje
staged soubory — stejně jako dřív `physics.ts`. Kód je v repu správně;
popis je tady a v `AGENTS.md`. Oprava `d885f1013` (výška oka + chyba
míření + deterministický test) už má vlastní commit.
