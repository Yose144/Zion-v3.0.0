# Neděle 1 — herní Nirvana (handoff pro přesun na lokální PC)

> **Napsáno:** 2026-11-01 · **HEAD:** `07d217b60` · **origin/main:** stejný commit
> **Co to je:** plán a stav herní vrstvy Nirvany (`/park`, `/mars`, `/venus`) —
> co běží, co je ověřené, co ne, a co dělat dál. Nepřepisuje `Nedele.md`
> (handoff jiné session); doplňuje ho o hry.

---

## 0. Než vypneš tenhle stroj

```bash
cd ~/Projects/2.9.6
git status --short | head      # má být prázdné
git log --oneline -1           # 07d217b60 nebo novější
git push origin main           # "Everything up-to-date"
```

**Pozor na dvě věci, které jsem při handoffu uložil:**

1. **Snapshot cizí práce** `07d217b60` — commit obsahuje WIP paralelní session
   (Kralovstvi srdce, IntroPage, Navigation, VAST). `tsc --noEmit` v nirvaně
   i na webu prošel, ale **v prohlížeči to ověřené není** a live build to nemá.
2. **Obrázky v `heros/`** — `heros/Hiran` (~22 MB) a dva nové PNG v
   `heros/Kralovstvi srdce` jsou teď v gitu. Repo má podobné assety už dřív,
   ale `git clone` bude kvůli tomu pomalejší.

---

## 1. Na lokálním PC: rozjezd

```bash
git clone https://github.com/Yose144/Zion-v3.0.0.git
cd Zion-v3.0.0
git log --oneline -1           # musí sedět s HEAD výše

cd apps/nirvana
npm install
npm run build                  # MUSÍ projít; když ne, něco je rozbité
npx next start -p 3040
```

Otevři:

| URL | Co to je |
|---|---|
| `http://127.0.0.1:3040/park` | pouť — hry, kolo, žetony, tabule |
| `http://127.0.0.1:3040/mars` | Quake aréna — deathmatch s boty |
| `http://127.0.0.1:3040/venus` | okruh — time trial, 3 kola |

**Pozor na ZAP pass gate:** `/` (vesmír) je od jiné session za pasem
(`/api/pass` → ověřuje se proti `app.zionterranova.com/api/archive/verify`).
Hry jsou schválně **mimo** tenhle gate, takže fungují bez kódu. Když potřebuješ
vesmír lokálně, spusť server s `ARCHIVE_VERIFY_URL` na lokální stub, který
vrací `{"valid":true}`:

```bash
node -e "require('http').createServer((q,s)=>{s.setHeader('content-type','application/json');s.end(JSON.stringify({valid:true}))}).listen(9999)" &
ARCHIVE_VERIFY_URL=http://127.0.0.1:9999/verify npx next start -p 3040
# pak POST /api/pass {"code":"TESTCODE1234"} → cookie → vesmír se otevře
```

---

## 2. Co je hotové a kde to bydlí

### Jupiter Station — pouť (`/park`)

| Věc | Soubor |
|---|---|
| svět (plošina, 4 skříně, kolo, Jupiter jako obloha) | `core/scene/park/ParkScene.tsx` |
| hry: Pong, Breakout, Tetris, Snake | `core/park/games/*.ts` |
| střelnice (3D terče, raycast) | `core/scene/park/ShootingGallery.tsx` |
| žetony, rekordy, denní vstupenka | `core/park/profile.ts` |
| denní výzva (+5 žetonů, zlatá vstupenka) | `core/park/challenge.ts` |
| tabule skóre (top 10, přežije restart) | `app/api/park/scores/route.ts` |
| stránka, HUD, dok s hrou | `app/park/page.tsx` |
| okno ve vesmíru + prstenec u Jupitera | `portals/park/ParkPortal.tsx`, `universe/SolarSystem.tsx` |

**Trik, který drží pohromadě:** hra je jeden canvas 2D, který je zároveň
`CanvasTexture` na obrazovce skříně. Proto ji vidí i hráč ve VR.

### Mars Arena (`/mars`)

| Věc | Soubor |
|---|---|
| mapa jako data (22 AABB krabic) | `core/arena/map.ts` |
| fyzika (posun po osách, ray–box, ray–sphere) | `core/arena/physics.ts` |
| navigace botů (mřížka 40×40 + BFS) | `core/arena/nav.ts` |
| svět, zbraně, boti, pickupy, HUD callbacky | `core/arena/MarsArena.tsx` |
| zvuk zbraní (syntéza, žádné soubory) | `core/arena/audio.ts` |
| stránka, HUD, VR tlačítko | `app/mars/page.tsx` |

Ovládání: WASD, myš (klik = pointer lock), mezerník skok, `1` rail / `2` rakety.
Ve VR: pravý ovladač míří, spoušť střílí, levý thumbstick chodí.

### Venuše (`/venus`)

| Věc | Soubor |
|---|---|
| trať jako funkce + checkpointy + skóre | `core/race/track.ts` |
| hovercraft, fyzika, kamera, HUD callbacky | `core/race/VenusRace.tsx` |
| stránka, HUD | `app/venus/page.tsx` |

Ovládání: `W/S` plyn a brzda, `A/D` zatáčení. Tři kola, měřený čas.

### Společné

- Skóre i žetony jdou přes **jeden profil** (`localStorage`) a **jednu tabuli**
  (`/api/park/scores`, sedm her: pong, breakout, snake, tetris, gallery, arena, race).
- Tabule je perzistentní díky systemd drop-inu na EDGE:
  `NIRVANA_PARK_SCORES_PATH=/opt/zion/data/nirvana-park-scores.json`.
- Debug háčky (jen s parametrem v URL): `?arenaDebug=1`, `?raceDebug=1`,
  `?hiran=…` (stav Hirana), `?sceneAudit=1` (měření scén).

---

## 3. Co je ověřené a co ne

**Ověřené (headless Playwright, lokálně i live):**

- Pong / Breakout / Tetris / Snake hratelné, konec → „Hrát znovu", žetony
  a rekordy se počítají, denní výzva se splní jen jednou denně (test funkcí).
- Střelnice: 70 bodů v gridu kliků, HUD a čas, konec → tabule.
- Aréna: rail srazil bota 100 → 0 hp a fragy 0 → 1; boti srazili hráče 100 → 10;
  navigace BFS: tři boti z ~30 m na **0,7–2,8 m** za 12 s.
- Venuše: auto 0 → 14,7 m/s za 1,2 s, okraj tratě zpomalí a nechá klouzat.
- Tabule přežila restart a deploy.

**Neověřené (a proč):**

| Věc | Stav |
|---|---|
| VR na headsetu | **netestováno** — nemám zařízení. Kód je proti `@react-three/xr` 6.6.32. |
| Zvuk | syntéza se spustí bez chyb, ale „jak to zní“ jsem neslyšel. |
| Boti na Venuši | neexistují — je to time trial. |
| Mobil | park ano (390×844), aréna a závod ne. |

---

## 4. Deploy (když bude potřeba)

```bash
# Nirvana → EDGE
bash apps/nirvana/deploy/deploy-nirvana.sh

# Web → EDGE2 (pozor na sharp!)
bash apps/website-v2.9/deploy/deploy-web2.9.sh
```

**Dvě pasti, na které jsem dnes narazil:**

1. **EDGE IPv4 alias je občas zabanovaný fail2banem** (`Connection refused`
   na 2222). Řešení: `ZION_EDGE_HOST=zion-v6 bash apps/nirvana/deploy/deploy-nirvana.sh`
   (IPv6 alias) nebo batchnout SSH.
2. **Paralelní `next build`** v `apps/nirvana` drží `.next/lock` → deploy
   spadne na „Another next build process is already running". Počkej, až lock
   zmizí, pak build znovu.

Web deploy navíc potřebuje linuxový `sharp` v `node_modules/@img`
(`sharp-linux-x64`, `sharp-libvips-linux-x64`), jinak `next/image` na Linuxu
vrátí 500.

Poslední nasazené buildy: nirvana `20261101T081445Z`, web `20261031T211657Z`.

---

## 5. Co dělat dál (v tomhle pořadí)

1. **VR test na headsetu.** Jediná věc, kterou nemůžu tvrdit, že je hotová.
   Otevři `/mars`, klikni **VR** v HUD, zkontroluj: thumbstick = pohyb, hlava =
   směr, spoušť = střela. Když locomotion nesedí, sáhni po
   `useXRControllerLocomotion` (v `@react-three/xr` je) místo ručního čtení os.
2. **Zvuk doladit.** `core/arena/audio.ts` je hotový základ; chybí hlasitosti
   per zbraň, doppler u raket a zvuk motoru na Venuši.
3. ~~**Soupeři na Venuši.**~~ **✅ hotovo 2026-11-01** — tři boti (Jitřenka,
   Fosfor, Vega) na **stejné fyzice** jako hráč, AI = feed-forward na směr
   tratě + korekce odchylky; pořadí, pódium (`+3/+2/+1` žetony), výsledková
   tabulka. Report: `docs/3.2/REPORTS/REPORT_2026-11-01_VENUS_RIVALS.md`.
   Vedlejší nález: čas se měřil hodinami prohlížeče, takže na pomalém stroji
   nafukoval kolo — teď simulované hodiny (stejné na každém fps). **Nenasazeno**,
   čeká na deploy.
4. **Další světy.** `planetPosition()` v `universe/positions.ts` a vzor z pouti
   jsou připravené; Neptun jako kasino by byl další krok (pozor: **jen žetony,
   dokud to operátor nerozhodne jinak** — reálné sázky jsou money-path).
5. **Až bude chuť: multiplayer v aréně.** Dnes je všechno lokální; síť by
   znamenala serverovou autoritu a je to samostatný projekt, ne večerní práce.

---

## 6. Dokumentace, kterou číst

| Soubor | Co v něm je |
|---|---|
| `docs/3.2/REPORTS/REPORT_2026-11-01_PARK_JUPITER_STATION.md` | pouť, žetony, tabule, challenge |
| `docs/3.2/REPORTS/REPORT_2026-11-01_MARS_ARENA.md` | aréna, fyzika, navigace, VR |
| `docs/3.2/REPORTS/REPORT_2026-11-01_VENUS_RACE.md` | okruh, zvuk, VR pohyb |
| `apps/nirvana/AGENTS.md` | pasti, na které jsem narazil (canvas ↔ textura, klamp tratě, XR origin) |
| `OASIS-RENDER-CANON.md` | jak se v tomhle repu kreslí 3D |
| `AGENTS.md` (banner nahoře) | co se dnes nasadilo a proč |

---

## 7. Rychlý test, že všechno žije

```bash
for p in /park /mars /venus; do
  curl -s -o /dev/null -w "$p %{http_code}\n" "https://nirvana.zionterranova.com$p"
done
curl -s https://nirvana.zionterranova.com/api/park/scores | head -c 200
```

Má vrátit `200` třikrát a JSON se sedmi hrami.
