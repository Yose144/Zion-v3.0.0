# REPORT 2026-11-01 — HERNÍ NAVIGACE, VZDUCH V UI A SLUNEČNÍ SOUSTAVA

> **Stav:** hotové a **nasazené** (nirvana 15:50). Ověřeno headless (lokálně, vesmír
> je za ZAP pasem) + live na veřejných routách.
> **Kde:** `core/games/{links.ts,GamesDock.tsx}`, `core/shell/Shell.tsx`,
> `core/scene/universe/{SolarSystem,Universe,HiranSun}.tsx`, `app/park/page.tsx`, `app/globals.css`.

## 1. Co 👤 nahlásil

1. „V Nirvaně chybí jasné odkazy na Mars i Venuši a další" — hry nešly najít.
2. „Všechno je dost u sebe" — přeplácané UI, nic nemá vzduch.
3. „Solární systém vůbec nefunguje, jak by měl — i s planetárními osami a pohyby."

## 2. Herní navigace (hlavní oprava)

Hry (`/park`, `/mars`, `/venus`, `/avatars`) jsou **routy, ne portály ve scéně** —
a v konzoli nebyly vůbec. Byly schované za poutí a člověk to musel vědět.

- **`core/games/links.ts`** — jeden seznam her (název, popisek, glyf, barva, odkaz).
  Konzole, pouť i dock ho sdílí, takže nikde nechybí.
- **`GamesDock`** — plovoucí lišta „HRÁT" dole uprostřed vesmíru: čtyři karty
  (Pouť / Mars aréna / Venuše / Avatar) s barevným akcentem, popiskem a `→`.
  Na mobilu se posouvá, labely se zkracují.
- **Konzole (hamburger) rozdělená do sekcí** s explicitním stavem:
  **Hry** (`hrát →`), **Světy** (`otevřít`), **Systém** (`otevřít`),
  **Připravujeme** (`ve výstavbě`, ztlumené). Dřív to byl jeden plochý seznam
  14 položek s tečkou u stubů.
- **Pouť** má místo tří řádků odkazu **tři karty** se stejnou vizualizací.

## 3. Vzduch v UI

- Sekce v konzoli mají nadpisy, vlastní rozestupy a štítky stavu; stuby jsou
  ztlumené a označené „ve výstavbě".
- Herní karty mají jednotnou výšku, hover a barevný akcent; odstraněny zdvojené
  mezery (flex gap + margin).

## 4. Sluneční soustava

Nalezené a opravené chyby:

| Problém | Příčina | Oprava |
|---|---|---|
| Planety nebyly vidět, soustava „nefungovala" | lineární AU: Neptun **903** jednotek daleko, Merkur 0.15 velikost | komprese drah `r = 30·AU^0.55` (Neptun ~197) + větší malé planety (Merkur 0.62, Venuše 0.92, Mars 0.74) |
| Záběr driftoval, Země proplouvala scénou | `OrbitControls` mířily na **Slunce (0,0,0)**, ne na Zemi | target = Země + kamera i cíl **se posouvají s oběhem Země** (počítá se delta), takže záběr drží |
| Slunce vypadalo jako **drátěná koule** | Hiranova vrstva (jantra + lotos) ležela přes fotosféru i z dálky | `HiranSun` má `detail` prop: plný ornament jen při fokusu na Slunce, jinak fade 0.12 a lotos se schová (×0,62) |
| Planety bez popisků | 3D sprite labely jsou při oddálení nečitelné | jména planet jako **DOM popisky** (`Html`) — čitelná v každém přiblížení |
| „Planetární osy" nebyly vidět | — | každá planeta má **nakloněnou rotační osu** (úsečka 1,75× průměr) a skutečný sklon (Venuše 3,09 rad, Uran 1,71) |
| Dráhy málo vidět | opacity 0.12 | 0.2 |

Země zůstává na AU = 1 → **30 jednotek**, takže `EARTH_ORBIT_R` a fokus na Jupiter
se nemění (Jupiter station používá stejnou `orbitRadius()`).

## 5. Ověření

- **Lokálně headless** (vesmír za ZAP pasem, proto stub `ARCHIVE_VERIFY_URL`):
  dock má 4 karty, konzole 4 sekce se štítky, pouť 3 karty, 0 chyb v konzoli;
  screenshoty před/po (planety pojmenované, Slunce bez mřížky, kamera drží Zemi).
- **Live:** `/`, `/park`, `/mars`, `/venus`, `/avatars` → 200; v HTML pouti jsou
  herní karty (`park-game-card`).
- `tsc --noEmit` + `next build` čisté.

## 6. Meze

- Vesmír je za ZAP pasem → **live ho nevyfotím** bez passu; ověřeno lokálně se
  stubem. Kdo má pass, uvidí změny.
- Osa planety je vidět jen zblízka (je 1,75× průměr) — je to orientační pomůcka,
  ne učebnicový diagram.
- Měřítko planet je stylizované (Země je kvůli prstencům a Bráně velká), ne
  fyzikální: kdyby bylo reálné, byly by planety podpixelové.

---

# Dodatek — F1: planety jako vstupy (2026-11-01)

👤 upřesnil zadání: odkazy nemají být v liště, ale **přímo na planetách**.
Dock zůstal (bude z něj herní HUD ve F2), planety se staly vstupy.

## Co je hotové

| Věc | Detail |
|---|---|
| Interaktivní planety | **Mars** (→ aréna), **Venuše** (→ okruh), **Jupiter** (→ pouť) |
| Mrtvé planety | Merkur, Saturn, Uran, Neptun: jen tlumené jméno, žádný hover, žádný kursor |
| Hit-sféra | neviditelná koule `max(size·2,6; 2,6)` — Mars má 0,74 jednotky, jinak se netrefí |
| Hover | zjasnění planety + **billboard halo** (ringGeometry natočený ke kameře) + `cursor: pointer` + zvýrazněný chip |
| Chip | `MARS · aréna →` (DOM `<Html>`, klikatelný i klávesou Enter) |
| Klik | **přiletí** (interpolace jako fokus na Slunce) a otevře **panel** s CTA |
| Panel | název, jedna věta, `Hrát`/`Na start`/`Na pouť`, `← zpět k Zemi`; u Jupitera navíc `otevřít okno pouti` |
| Fokus | `Universe` má nově `focus: 'mars' \| 'venus'` (dřív jen `jupiter`); cíl se počítá každý frame stejnou `planetPosition` |

## Dvě chyby, které to odhalilo

1. **Halo jako torus vypadalo jako Saturnovy prstence** — nahrazeno `ringGeometry`
   natočenou ke kameře (`quaternion.copy(camera.quaternion)`).
2. **Chip měl `pointerEvents: none`** → vidět byl, ale nešel kliknout. Teď má
   `pointerEvents: auto` u interaktivních planet (a `role="button"` + Enter).

## Ověřeno

Headless (vesmír za ZAP pasem, stub `ARCHIVE_VERIFY_URL`):
`3 interaktivní chipy + 4 mrtvé labely` → klik na Venuši → **panel se otevřel**
→ `Na start` → **navigace na `/venus`**. 0 chyb v konzoli. `tsc` + `next build` čisté.

## Co zbývá do F1

- Hover ladit na skutečném displeji (headless ověří jen přítomnost a klik).
- Mobil: panel se na `≤ 640 px` posouvá nad dock (CSS hotové, netestováno na zařízení).

---

# Dodatek — F2: herní HUD (2026-11-01)

Bývalý `GamesDock` se změnil na **herní HUD**: přepínání her, ovládání,
žetony, online, ZION zůstatek a ZIS identita.

## Kde běží

| Povrch | Varianta | Kde |
|---|---|---|
| `/` (vesmír) | `is-dock` | dole uprostřed (kde dřív byl dock) |
| `/park`, `/mars`, `/venus`, `/avatars` | `is-compact` | vlevo dole (nekoliduje s HUD hry ani s tabulí vpravo) |

Komponenta je v `app/layout.tsx` a sama se podle `usePathname()` skryje
na `/present/*`, `/hiran` a jinde.

## Co ukazuje

| Prvek | Zdroj |
|---|---|
| 4 taby her | `core/games/links.ts` (aktivní podle cesty) |
| ovládání kontextově | statické podle povrchu (orbita / skříň / WASD+1-2 / W-S-A-D) |
| ◎ žetony | `loadProfile()` (localStorage), obnoví se po návratu do okna |
| ◉ online | `useNet().online` (chat presence) |
| ⬢ ZION | `/api/wallet/balance` → node `getUtxos` |
| jméno / přihlásit | `useAuth()` — callsign → displayName → zkrácená adresa |

## ZION zůstatek — proč nová route

`getBalance` je **account-model** a u UTXO peněženky vrací 0 (známá past).
`GET /api/wallet/balance?address=zion1…` proto volá `getUtxos` s `limit: 0`
(součty bez megabajtů UTXO), primárně `127.0.0.1:9445` (tunel na primární uzel),
fallback `https://rpc.zionterranova.com`; 4s timeout, per-IP 30/min, `BigInt`
kvůli částkám nad 2^53. Když RPC mlčí, vrací **200 s `ok:false`** a HUD ukáže `—`
(hra nesmí vypadat rozbitá).

**Live ověřeno:** `zion 183 826 425,10`, `utxos 96 307`, **`source: "node"`**.

## Ověřeno

- lokálně: HUD na všech 5 površích, aktivní tab odpovídá cestě, mobil 390×844 bez
  vodorovného přesahu, 0 chyb v konzoli
- live: HUD v HTML `/mars`, API vrací zůstatek z uzlu, všech 5 stránek 200

## Meze

- Zůstatek je **jen pro přihlášené** (host vidí `—` a „přihlásit").
- Čísla jsou orientační, ne účetní — HUD není peněženka; posílat ZION jde dál
  přes ZIS/Účet.
- Žetony se čtou z `localStorage`, takže v jiném prohlížeči jsou jiné.
