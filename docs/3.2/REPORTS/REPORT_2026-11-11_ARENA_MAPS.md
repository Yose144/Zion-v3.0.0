# Aréna — víc map: Mars, Q3DM3 a Q3DM6

**Datum:** 2026-11-11
**App:** `apps/nirvana` (`/mars`)
**Commity:** `4fe57fb8c` (mapy), `a3d182e67` (vyvýšené spawny a detail),
`80987db20` (multiplayer na mapách)
**Deploy:** app `20261111T072654Z` (sólo mapy, proto 37) → net
`20261111T080256Z` + app `20261111T080331Z` (proto 38, multiplayer mapy)
**Protokol:** 38 — `join` nese `map`, snapshot vrací mapu místnosti

## Zadání

> „pokracuj a pridej i vic map ! hlavne q3dm3 a 6 z q3 areny !"

## Co je hotové

- `core/arena/map.ts` je teď **katalog `ARENA_MAPS`** (`mars`, `q3dm3`,
  `q3dm6`): každá mapa má `boxes`, `playerSpawn`, `botSpawns`, `pickups`
  a **`palette`** (barvy povrchů, oblohy, mlhy i světel). Staré exporty
  (`ARENA_BOXES`, `PLAYER_SPAWN`, `BOT_SPAWNS`, `ARENA_PICKUPS`) zůstávají
  jako alias na `mars`, takže server ani starší komponenty se nemění.
- **Q3DM3 „Toxicity"** — centrální most (top 2) s třemi schody z každé
  strany, severní komora (mega) a jižní (armor), vyvýšené lišty po stranách,
  pylony a bedny. Start hráče je **na mostě**.
- **Q3DM6 „Camping Grounds"** — třípatrová věž, dvě křídla (top 2,5),
  mostky, schodiště na severu i jihu. Start hráče je **na křídle**.
- **Sólo výběr mapy** v úvodu (`arena-map` karty s názvem a poznámkou),
  volba se ukládá (`nirvana.arena.map`) a scéna se remountuje `key={mapId}`,
  takže se stav hry nikdy nemíchá mezi mapami.
- **Paleta mapy řídí i světlo:** Mars je pískově oranžový, Q3DM3 studená
  industriální zeleň, Q3DM6 soumrak s teplou lucernou. Dřív by každá mapa
  vypadala jako Mars.

## Pravidla, která to odhalilo

- **Navigace (`buildNavGrid`) je 2,5D.** Krabice s `maxY > 1,6` je zeď
  a `minY < 1,6` v pruhu těla ji blokuje. První návrhy Q3 map měly most
  /lišt spojené až ke krajnici → mapa se **rozpůlila** a boti se na druhou
  stranu nedostali. Řešení: most končí dřív (ulička ≥ 2 m) a vyvýšené lišty
  začínají ve výšce ≥ 2 (nad pruhem těla).
- **Pickup musí ležet na podlaze.** Původní `ha1`/`h1` u Q3DM6 byly uvnitř
  krycí krabice (střed `y + 0,7` v pevné hmotě).
- **Pickup nesmí ležet na spawnu** — hráč na mostě by jinak sebral Quad
  hned při vstupu (Q3DM3 má Quad posunutý na `x −5`).
- **Vyvýšený spawn** (`playerSpawn.y`) musí být o kousek výš než horní hrana
  plošiny (trim), jinak tělo začne uvnitř desky.

## Ověření

- `npx tsx test/arena-maps.mjs` — katalog, spawny mimo zdi, **BFS průchodnost**
  ze spawnu hráče do všech botích spawnů, **reálný pohyb bota**
  (`stepBot` + `driveBot`, za 6 s ujde ≥ 4 m), pickupy na podlaze, respawny,
  rozdílnost půdorysů. **OK.**
- `test/arena-weapons.mjs`, `test/arena-settings.mjs` — **OK** (parita MP, čísla).
- `tsc --noEmit` a `next build` v čistém worktree na commitu — čisté.
- Headless screenshot `.artifacts/probe/arena-maps-shot.mjs`
  (3 mapy + úvod, GPU Metal): debug stav hlásí správnou mapu, žádné chyby
  v konzoli. Snímky: `.artifacts/render/arena-maps-20261111/`.
- **Live:** `/api/health` → `proto 37 = net 37`, `proto_match: true`;
  v produkčním bundlu je chunk s „Q3DM6" i CSS `.arena-map`.

## Multiplayer na mapách (protokol 38, nasazeno)

- **Mapa je vlastnost místnosti.** `join` nese `map`; server vybírá místnost
  podle ní (do místnosti s jinou mapou hráče nepustí) a `Room.map` drží
  volbu. Snapshot nese `map` jako autoritu — když se klient rozejde se
  serverem, přepne svět a predikce se postaví na spawn té mapy.
- **Simulace jede ze stejných dat jako sólo** (`ARENA_MAPS`), takže pickupy,
  spawny i kolize sedí; neznámá mapa padá na Mars.
- **Paleta platí i v multiplayeru** — `MarsMultiplayer` dřív kreslil vlastní
  oranžové barvy a světla, takže Q3 mapy vypadaly jako Mars.
- **Ověřeno:** `apps/nirvana-net/test/arena-maps.mjs` (simulace + místnosti
  podle mapy: dvě mapy = dvě místnosti, stejná mapa = stejná místnost) a
  `.artifacts/probe/arena-map-online.mjs` (klient vybere Q3DM3, připojí se,
  `__mpDebug().map === 'q3dm3'`, start na vyvýšeném spawnu).

## Víceúrovňová navigace (2026-11-11, po mapách)

- **`buildNavGrid` je 2,5D**: buňka má podlahu = nejvyšší plocha s volnem
  do výšky těla. Most/věž jsou podlaha, ne zeď. Tenké `trim` desky se
  ignorují (fyzika je přeskakuje), střechy zdí (> 6 m) podlaha nejsou.
- **BFS je směrová**: nahoru do `NAV_CLIMB` 1,0 m (dosah skoku), dolů
  libovolně. Bot skáče, když další buňka cesty stoupá (`mustClimb`).
- **Boti jdou po waypointech a míří na cíl** (`BotIntent.moveYaw`), takže
  obcházejí plošiny místo aby se do nich opřeli. Při cestě strafují jen
  0,25× — plný strafe je shazoval z úzkých schodů.
- **Mapy se srovnaly s fyzikou:** Mars měl obrácené schody a 0,6 m mezeru
  k plošině (nešlo vyjít), lišty 3,2 m (víc než skok) → 3,0 m + lávky;
  Q3DM3 dostala schody na lišty a širší stupně; Q3DM6 šest 0,5 m stupňů
  na věž, pětistupňové schody na křídla a sloupy přesunuté ze spawnu.
- **Testy:** `arena-maps` ověřuje dosažitelnost **všech pickupů** a že se
  bot na vyvýšené místo opravdu vyškrábe (mars/q3dm3/q3dm6); `arena`,
  `arena-bots`, `arena-maps` (net) a E2E `arena-map-online` prošly.

## Meze

- Q3DM3/Q3DM6 jsou **stylizované půdorysy**, ne kopie `.bsp` — originální
  mapy nejsou v GPL zdroji a repo nemá mapové assety.
- Boti dál chodí po zemi (2,5D navigace) — na plošiny skáčou jen náhodou
  z pronásledování; víceúrovňová navigace je samostatný krok.
- VR netestováno, mobil emulovaný.
