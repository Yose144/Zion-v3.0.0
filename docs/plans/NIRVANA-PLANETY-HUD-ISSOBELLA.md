# NIRVANA — planety jako vstupy, herní HUD, Issobella, Kingdom

> **Stav:** rozhodnuto 👤 2026-11-01 · **pořadí závazné:** F1 → F2 → F3 → F4
> **Nahrazuje** předchozí „dock jako launcher" — dock se mění na herní HUD,
> odkazy patří **na planety a body ve scéně**.

## Proč to vzniklo

👤: „v nirvaně teď chybí jasné odkazy na mars i venusi… tohle musíme vyladit
u všech herních nástrojů, elegantně, ať je jasně vidět na co jde kliknout a na
co ne… navíc je vše dost u sebe… solární systém vůbec nefunguje, jak by měl,
i s planetárními osami a pohyby."

První pokus (dock dole + sekce v konzoli) byl špatně pochopený: odkazy mají být
**na planetách**, ne v liště.

## F1 · Planety jako vstupy (~1 den)

**Cíl:** Mars, Venuše a Jupiter jsou zřetelně klikatelné; ostatní planety
zřetelně ne.

- **hit-sféra** neviditelná, zvětšená (Mars má 0,74 jednotky — jinak se netrefí)
- **hover**: zjasnění planety + cílový prstenec + kursor `pointer` + zvýrazněný chip
- **chip v DOM** (`<Html>`): `MARS · aréna →` — ne jen „MARS"
- **klik = přiletět** (interpolace kamery jako u fokusu na Slunce) **a otevřít panel**
  s CTA: název, jedna věta, `Hrát`, `Zpět`. Panel je boční karta, ne modal.
- **mrtvé planety** (Merkur, Saturn, Uran, Neptun): tlumené jméno, žádný hover,
  žádný kursor, žádný chip
- fokus `'mars' | 'venus' | 'jupiter'` v `Universe` (stejný mechanismus jako `'sun'`)

**DoD:** klik vede na hru, mrtvé planety se nechovají jako odkazy, ≥ 30 fps.

## F2 · Herní HUD (~1 den)

Spodní pás ve vesmíru i na `/park`, `/mars`, `/venus`, `/avatars`:

| Prvek | Zdroj |
|---|---|
| Přepínání her | `core/games/links.ts` |
| Ovládání (kontextově) | statické podle hry |
| **ZION zůstatek** | `/api/wallet/balance` → node RPC `getUtxos` (NE `getBalance` — u UTXO vrací 0) |
| **ZIS** | `useAuth()` — jméno + avatar |
| Žetony + online | `park/profile` + `useNet().online` |

Na `/mars` a `/venus` běží **pod** jejich HUD.

## F3 · Issobella — plná scéna (~2–3 dny)

- `apps/shared/scenes/Issobella.tsx` podle canonu L5: jen `three` + `@genesis/runtime`,
  žádné `drei`, žádné `three/addons`
- route `/present/issobella`, portál ve vesmíru (stanice na prstenci se napojí)
- **výběr avatara uvnitř scény** (šatník/urna); `/avatars` zůstává jednoduchá cesta
- **strop 32 textur** (každý `SceneLabel` = vlastní CanvasTexture) — nový label = ubrat jinde
- otevřené: scéna jako samostatná stránka (`/present/*`) podle vzoru Kailash/Uluru

## F4 · Kingdom vedle oken (~1 den)

Nirvana okna **zůstanou**, ke každému přibude `otevřít v Kingdomu ↗`
(`https://kingdom.zionterranova.com/portal/<id>`):

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

Session je společná (cookie `.zionterranova.com`) → uživatel přistane přihlášený.

## Co zůstává z předchozí dávky

- Konzole má sekce Hry / Světy / Systém / Připravujeme a štítky (`hrát →`,
  `otevřít`, `ve výstavbě`). Hry v ní **zůstávají** jako druhá cesta.
- `GamesDock` **zůstává**, ale ve F2 se z něj stane herní HUD.
- Sluneční soustava: komprimované dráhy `30·AU^0.55`, kamera sleduje Zemi,
  nakloněné osy, DOM popisky, Hiran ztlumený mimo fokus.

## Rizika

1. **Klikatelnost malých planet** — bez zvětšené hit-sféry to nejde trefit.
2. **Překryv chipů** — chipy jen u 3 interaktivních planet + Jupiteru; ostatní
   jen jméno. Když se překryjí, skrýt chip podle vzdálenosti kamery.
3. **Fokus a oběh** — kamera se posouvá s oběhem Země; při fokusu na Mars/Venuši
   se musí stejnému posunu přizpůsobit, jinak cíl uletí.
4. **ZION zůstatek** — `getBalance` je account-model a u UTXO vrací 0; vždy
   `getUtxos` (součet `total_amount`).
5. **Issobella textury** — strop 32; nový label = ubrat jinde.
