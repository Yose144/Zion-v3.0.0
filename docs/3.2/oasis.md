# OASIS — Status & Roadmap Report

> **Poslední update:** 2026-08-15
> **Aktivní workspace:** `V31/L4/oasis` + `APP&WEB/OasisWeb`
> **Produkční runtime:** `https://oasis.zionterranova.com` (Next.js 16 static export, nginx)
> **OASIS API:** `https://oasis.zionterranova.com/api/v1/oasis` → `zion-oasis` na Edge (`127.0.0.1:8094`)

---

## 1. Co je OASIS

OASIS je L4 herní vrstva ZION TerraNova. Spojuje blockchainový stav (XP, consciousness levels, avataři, teritoria) s 3D webovým klientem postaveným na React Three Fiber.

Hlavní komponenty:

- **Backend:** `zion-oasis` (`V31/L4/oasis`) — Axum server s SQLite perzistencí, WebSocket hubem a auth.
- **Frontend:** `APP&WEB/OasisWeb` — Next.js 16 static export, 3D galaxie, interaktivní světy, HUD.
- **World registry:** `V31/L4/oasis/data/worlds.json` — kanonická data pro 73 světů.
- **Dokumentace vývoje:** `docs/oasis/OASIS_WEB_JOURNAL.md` — deník změn a nasazení.

---

## 2. Stav k 2026-08-15

### 2.1 Backend

- World registry (`src/worlds.rs`) s načítáním z `data/worlds.json` (73 světů).
- API endpointy:
  - `GET /api/v1/oasis/worlds` — seznam světů.
  - `GET /api/v1/oasis/worlds/:id` — detail světa.
  - `POST /api/v1/oasis/player/:address/worlds/:id/scan` — první sken světa, XP odměna.
  - `POST /api/v1/oasis/player/:address/worlds/:id/approach` — přiblížení světa, XP odměna.
  - `POST /api/v1/oasis/player/:address/worlds/:id/clue` — nalezení golden-egg clue (idempotentní).
- WebSocket eventy `WorldScan`, `WorldApproach`, `ClueDiscovered` pro live feed.
- Playerekce: tracking `has_scanned_world`, `has_approached_world`, clue counter.
- Testy: `cargo test -p zion-oasis` — 139 passed.

### 2.2 Frontend

- `gameStore` vlastní `worlds`, načítá z backendu při startu.
- 3D scéna a komponenty (`OasisScene`, `GalaxyMap`, `Hyperlanes`, `MiniMap`, `FlightControls`) používají živý seznam světů.
- HUD a menu (`MainMenu`, `WorldFilter`, `GamePanel`, `PlayerHud`) reflektují aktuální `worlds.length` a filtry.
- `WorldPanel` volá `scanWorld` / `approachWorld` a `discoverWorldClue` pro golden egg.
- Build: `npm run build` — static export do `dist/`.

### 2.3 Deploy

- Frontend nasazen do `/var/www/oasis/` na Edge přes rsync.
- Backend `zion-oasis` rebuild a restart `zion-v31-oasis.service`.
- Ověřeno:
  - `https://oasis.zionterranova.com/` → 200
  - `GET /api/v1/oasis/worlds` → 73 světů
  - `GET /api/v1/oasis/worlds/NOVA_ZEME` → 200
  - `POST .../ALPHA_CENTAURI/clue` → `clue_id: 1, new: true, total_clues: 1`
  - `POST .../NOVA_ZEME/scan` → XP odměna

---

## 3. Klíčové soubory

| Co | Kde |
|---|---|
| Backend crate | [`V31/L4/oasis/`](../../V31/L4/oasis/) |
| World data (JSON) | [`V31/L4/oasis/data/worlds.json`](../../V31/L4/oasis/data/worlds.json) |
| Backend server | [`V31/L4/oasis/src/server.rs`](../../V31/L4/oasis/src/server.rs) |
| WebSocket hub | [`V31/L4/oasis/src/websocket.rs`](../../V31/L4/oasis/src/websocket.rs) |
| World registry modul | [`V31/L4/oasis/src/worlds.rs`](../../V31/L4/oasis/src/worlds.rs) |
| Frontend | [`APP&WEB/OasisWeb/`](../../APP&WEB/OasisWeb/) |
| API client | [`APP&WEB/OasisWeb/src/lib/api.ts`](../../APP&WEB/OasisWeb/src/lib/api.ts) |
| Game store | [`APP&WEB/OasisWeb/src/store/gameStore.ts`](../../APP&WEB/OasisWeb/src/store/gameStore.ts) |
| 3D scéna | [`APP&WEB/OasisWeb/src/components/OasisScene.tsx`](../../APP&WEB/OasisWeb/src/components/OasisScene.tsx) |
| Deník | [`docs/oasis/OASIS_WEB_JOURNAL.md`](../oasis/OASIS_WEB_JOURNAL.md) |
| Archiv (world lore) | [`docs/docs2.9/ZION_OASIS/`](../docs2.9/ZION_OASIS/) |

---

## 4. Další kroky / Roadmap

### 4.1 Rozšíření světů

Aktuálně je 73 světů v `worlds.json`. Archiv obsahuje rozsáhlý lore a seznamy bytostí/míst:

- `docs/docs2.9/ZION_OASIS/COSMIC_MAP_2.8.5_COMPLETE.md` — kompletní kosmická mapa.
- `docs/docs2.9/ZION_OASIS/SACRED_TRINITY/` — 169+ entit (Krishna, Maitreya, Rama, Sita, Hanuman, …).
- `docs/docs2.9/ZION_OASIS/GOLDEN_EGG_GAME/` — návrh hry, indicie, svatá architektura.

Cíl: převést archivní lore do strukturovaných `World` záznamů a rozšířit `worlds.json` o další hvězdné systémy, planety, sektory, dimenze a mýtické bytosti jako interaktivní světy.

### 4.2 Možné technické kroky

- Stránkování `/worlds` s filtrem podle kategorie/vrstvy.
- Vyhledávání světů podle jména/tagů.
- Per-world questy a avataři napojené na backend.
- Guild teritoria v galaxii a jejich vizualizace.
- WebSocket live feed integrovat do `/leaderboard` a `/dashboard`.
- Cache `worlds.json` v nginx / CDN pro rychlejší start frontendu.

---

## 5. Rychlé příkazy

```bash
# Lokální backend
cd V31
cargo run -p zion-oasis

# Lokální frontend
cd APP&WEB/OasisWeb
npm install
npm run build
npm run start

# Testy
cd V31
cargo test -p zion-oasis

# Deploy (frontend)
bash APP&WEB/OasisWeb/deploy/deploy-oasis-web.sh
```

---

*Report vygenerován 2026-08-15. Pro detailní deník viz [`docs/oasis/OASIS_WEB_JOURNAL.md`](../oasis/OASIS_WEB_JOURNAL.md).*
