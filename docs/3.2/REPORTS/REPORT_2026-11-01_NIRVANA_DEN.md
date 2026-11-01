# REPORT 2026-11-01 — NIRVANA: CELÝ DEN (souhrn)

> **Co to je:** jeden přehled všeho, co se dnes postavilo, nasadilo a ověřilo
> v herní vrstvě Nirvany. Podrobnosti jsou v dílčích reportech (odkazy níže).
> **Výchozí stav dne:** `/mars` a `/venus` sólo proti botům, chat žádný,
> multiplayer žádný, avatary 2D, odkazy na hry nikde.

## 1. Co je dnes hotové (v pořadí, jak vznikalo)

| # | Věc | Commit | Nasazeno | Detail |
|---|---|---|---|---|
| 1 | **Venuše — tři soupeři** (závod místo time-trialu) | `b8e741646` | nirvana `20261101T102417Z` | [VENUS_RIVALS](REPORT_2026-11-01_VENUS_RIVALS.md) |
| 2 | **Realtime služba `zion-nirvana-net`** (M0) | `b5dfe995b` | net `20261101T113159Z` | [NET_M0](REPORT_2026-11-01_NIRVANA_NET_M0.md) |
| 3 | **Chat pro ZIS** + presence (M1) | `a1cbb1972` | net `20261101T120326Z` | [CHAT_M1](REPORT_2026-11-01_NIRVANA_CHAT_M1.md) |
| 4 | **Multiplayer Mars arény** (M2a) | `bd634182c` | net `20261101T124440Z` | [MARS_MP](REPORT_2026-11-01_MARS_MULTIPLAYER.md) |
| 5 | **Multiplayer Venuše** (M2b) | `ab89925af` | net `20261101T131808Z` | [VENUS_MP](REPORT_2026-11-01_VENUS_MULTIPLAYER.md) |
| 6 | **3D avatary z OASIS rosteru** (A1–A4) | `57fcd64b7` | net `20261101T134813Z` + ZIS 14:47 | [AVATARS](REPORT_2026-11-01_AVATARS_3D.md) |
| 7 | **Navigace, vzduch v UI, oprava sluneční soustavy** | `a6f806ef9` | nirvana 15:50 | [NAV_SOLAR](REPORT_2026-11-01_NIRVANA_NAV_SOLAR.md) |
| 8 | **Planety jako vstupy do her** (F1) | `e5fe160c4` (+ část v `d46a45c11`) | nirvana ~16:50 | [NAV_SOLAR §F1](REPORT_2026-11-01_NIRVANA_NAV_SOLAR.md) |
| 9 | **Herní HUD** — hry, ovládání, žetony, online, ZION, ZIS (F2) | `6f4529cb4` | nirvana | [NAV_SOLAR §F2](REPORT_2026-11-01_NIRVANA_NAV_SOLAR.md) |
| 10 | **Issobella** — orbitální observatoř se šatníkem (F3) | `3f720e68a` | nirvana | [NAV_SOLAR §F3](REPORT_2026-11-01_NIRVANA_NAV_SOLAR.md) |
| 11 | **Kingdom vedle oken** (F4) | tento commit | nirvana | viz §4 níže |

## 2. Architektura, na které to stojí

```
prohlížeč
  ├── nirvana.zionterranova.com ............ Next 16 (standalone), port 3010 na EDGE
  │      ├── /            vesmír (scéna, planety, konzole, HUD)
  │      ├── /park /mars /venus /avatars ... hry a šatník
  │      └── /present/*   L5/L6 scény (za ZAP pasem)
  ├── wss://…/net ........................... zion-nirvana-net, port 3011 (Node 22, ws)
  │      ├── chat (ZIS identita z cookie) — kanály park / arena:<room>
  │      └── simulace: aréna (AABB, hitscan) a závod (track + stepCraft)
  └── auth.zionterranova.com ................ ZIS — identita, avatar3d, session
```

**Jedno pravidlo, které se vyplatilo:** server i klient používají **stejné
moduly** (`core/arena/physics.ts`, `core/race/track.ts`, `core/race/physics.ts`,
`core/arena/weapons.ts`). Když se rozejdou čísla, hráč vidí „trefil jsem ho
a nic" — dnes to bylo možné jen díky tomu, že existuje jeden zdroj.

**Druhé pravidlo:** identitu **nikdy neposílá klient**. Jméno, avatar i právo
psát plynou z cookie `zion_session` → ZIS na serveru.

## 3. Co se dnes ověřilo (a jak)

| Test | Rozsah | Stav |
|---|---|---|
| `apps/nirvana-net`: `npm run smoke` | chat, presence, rate limity, Origin, úklid | **34/34** |
| `npm run arena` | pohyb, zásah, frag, respawn, úklid (bez prohlížeče) | **21/21** |
| `npm run race` | 3 kola v simulaci + síť (odpočet, plyn, úklid) | **19/19** |
| `npm run live` (živý ZIS) | login → `avatar3d` → WS identita → chat → smazání účtu | **11/11** |
| headless Playwright | chat 10/10, aréna MP 6/6, závod MP 11/11, avatary 9/9, F1 6/6 | vše OK |
| `tsc --noEmit` + `next build` | nirvana, net, identity | čisté |
| live smoke | `/`, `/park`, `/mars`, `/venus`, `/avatars` 200, `/net/health` | OK |

## 4. F4 — Kingdom vedle oken (poslední dnešní kus)

Nirvana okna **zůstala** (rychlý přehled ve scéně), ke každému přibyl odkaz
**„otevřít v Kingdomu ↗"** na `https://kingdom.zionterranova.com/portal/<id>`:

| Nirvana | Kingdom |
|---|---|
| Řetěz | `chain` |
| Těžba | `pool` |
| Trh | `market` |
| Knihy | `books` |
| Účet | `account` |
| Hiran | `hiran` |
| Issobella | `issobella` |
| Přístav | `freeworld` |

Jedno místo pravdy: `core/portals/KingdomLink.tsx` (`KINGDOM_PORTALS`).
Session je společná (cookie `.zionterranova.com`), takže člověk přistane
přihlášený. Ověřeno: v okně Řetěz je odkaz s `href=…/portal/chain`, text
„otevřít v Kingdomu ↗", 0 chyb v konzoli; live `/portal/chain` → 200.

## 5. Chyby, které dnešní práce odhalila (a co z nich plyne)

1. **Produkce jela na Node 18** (Next 16 chce ≥ 20.9) — přepnuto na 22.
2. **K1.2 root workspace rozbil deploy** (standalone layout) — zploštění artefaktu.
3. **`join`/`leave` za každý kanál** → klient počítal členy dvakrát → `presence`.
4. **`getBalance` u UTXO vrací 0** → HUD bere `getUtxos`.
5. **Zod tiše zahazuje `avatar3d.avatarId`** → ZIS schéma rozšířeno.
6. **`SceneLabel`/`KeyLight` mají jiné API** než nirvanské komponenty.
7. **Planeta pod podlahou není vidět** (Issobella) — osa Y je past.
8. **Chip s `pointerEvents: none`** je vidět a nefunguje.
9. **Dva stromy v `SceneRoot`** (XR a non-XR) — nový prop do obou.
10. **Halo jako torus vypadá jako Saturnovy prstence** → billboard.

## 6. Meze (co se nedělalo a ví se o tom)

- **Boti v multiplayeru** nejsou — prázdná aréna i závod jsou prázdné.
- **Zvuk** v multiplayeru chybí (sólo má syntézu); motor na Venuši nemá hlas.
- **VR** je jen v sólo aréně a **není otestované na headsetu**.
- **Duch odpojeného jezdce** se nekoná — jen se odebere.
- **Webový náhled Issobelly** (`/terranova/issobella`) nevznikl.
- Chat i multiplayer mají strop **8 hráčů / místnost** a historii jen v RAM.
- **Turnajový netcode** to není: predikce + srovnání, ne kompenzace zpoždění.

## 7. Kde co bydlí (rychlý rozcestník)

| Co | Soubor |
|---|---|
| Realtime služba | `apps/nirvana-net/src/{index,arena,race,zis}.ts` |
| Protokol | `apps/nirvana/src/core/net/protocol.ts` |
| Chat UI + HUD | `core/net/ChatDock.tsx`, `core/games/GameHud.tsx` |
| Hry | `core/arena/*`, `core/race/*` |
| Avatary | `core/avatars/{catalog,kit,AvatarModel}.tsx` + `scripts/ops/gen-avatar-catalog.mjs` |
| Scény | `apps/shared/scenes/*` (Issobella nová) |
| Deploy | `apps/nirvana/deploy/deploy-nirvana.sh`, `apps/nirvana-net/deploy/…` |
| Testy | `apps/nirvana-net/test/{smoke,arena,race,live-zis}.mjs` |
