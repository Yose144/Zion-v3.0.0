# Report — MOBA: vidění a smrt (F5, 2026-11-03)

> **Zadání:** „f5" — pátá fáze plánu `docs/3.3/MOBA-PRVNI-SVET-PLAN.md`.
> **Kde:** `apps/nirvana` (`core/moba/`) + `apps/nirvana-net`
> **Deployed:** net `20261103T030012Z` (proto 12) · app `20261103T032820Z`

---

## 1. Výchozí stav

Vidění držely jen jednotky, věže, uzly a item Orlí oko — hráč neměl jak
**ověřit mapu**, kam se nedostane (bush, jungle, řeka). Smrt byla jen čekání:
respawn 6 s + 1,2 s/level, bez možnosti cokoli udělat.

## 2. Co F5 přidala

### Ward (spotřební item)

- Cena **150 zlata**, max **3 v zásobě**, **nezabírá slot** (jinak by si hráč
  vyhodil build kvůli vidění).
- Pokládá se klávesou **G** (na dotyku tlačítko 🛡) do **12 m**.
- Vidí **10 m po 90 s**; vidí ho **jen vlastní tým**.
- Vidění jde přes `visionSources`, takže ward funguje i **proti bushům**
  a mlze — nepřítel v keři je s wardem vidět.

### Buyback

- Mrtvý hrdina zaplatí **200 + 50 × level** a vrátí se do hry na **60 % HP**
  do základny.
- **Cooldown 180 s** — brání dvojímu vzkříšení v jednom souboji.
- Cena roste s levelem, aby se buyback nevyplatil pořád.

### Respawn scaling

`5 s + 1,5 s × level` (dřív 6 s + 1,2 s) — pozdní hry trestá víc, jak má.

### UI a vykreslení

- **HUD:** zásoba wardů vedle zlata (`🛡 2`), tlačítko **Buyback** v overlayeru
  smrti (jen když je dostupný), ward v obchodě se zásobou `x/3` a disabled při
  plné zásobě.
- **Scéna:** wardy jako světélkující totemy, na minimapě čtverečky.
- **Dotyk:** tlačítko 🛡 vedle ÚTOKU (stejný trik jako kouzla — syntetický `G`).

## 3. Ověření

| Test | Výsledek |
|---|---|
| `npx tsx apps/nirvana/test/moba-sim.mjs` | **133/133** (14 nových: nákup a limit wardu, položení mimo dosah, vidění skrz bush, expirace 90 s, buyback cena/HP/cooldown, respawn scaling) |
| `npx tsc --noEmit` (app i net) | čistý |
| `e2e/first-world.mjs` proti produkci | **15/15** (obchod nově 15 itemů, runy i boss) |
| živě | `/net/health` → **proto 12**, app `20261103T032820Z`, smoke 200 |

## 4. Co se cestou pokazilo

**Deploy appky spadl na `Connection reset by peer`** při rsync (rate limit
SSH po mnoha spojeních). Net už byl na proto 12, appka ještě na 11 — chvíli
tedy hrozil `proto_mismatch`. Druhý pokus s **`ControlMaster`** (jedno
spojení pro celý deploy) prošel napoprvé. Pro dávkové deploye je to nutnost,
ne volba.

Poznámka do budoucna: `deploy-nirvana.sh` má default `EDGE_HOST=zion-new`
(62.171.141.136:2222), ne `zion-edge2` — `zion-nirvana` na EDGE2 neběží.

## 5. Meze (poctivě)

- **Ward nejde zničit** — nepřítel ho nevidí a nemá sentry; ve hře bez
  neviditelných jednotek to zatím nevadí.
- **Ward nemá UI slot ani odpočet** — jen počet v HUD; expiraci hráč pozná
  podle toho, že zmizí z mapy.
- **Buyback nemá potvrzení** — klik rovnou zaplatí (cena je v tlačítku).
- **Sentry proti neviditelným** nedává smysl, dokud hra nemá neviditelnost.
- **Wardy se nekreslí nepříteli** — je to záměr, ale znamená to, že si hráč
  nemůže „přečíst" mapu soupeře.

## 6. Co dál

- **F6 — meta**: scoreboard (GPM/XPM, damage, healing), pozápasový souhrn,
  obtížnosti botů.
- **Kouzla dál**: aktivní itemy (klávesa navíc), talent strom, ukazatel
  dostřelu při míření.
- **Volitelně**: odpočet wardu v HUD, buyback potvrzení, sentry (až bude
  neviditelnost).

---

**Souvisí:** [`MOBA-PRVNI-SVET-PLAN.md`](../../3.3/MOBA-PRVNI-SVET-PLAN.md) ·
`apps/nirvana/AGENTS.md` § PRVNÍ SVĚT — vidění a smrt · commit `ffcef05e7` (F5)
