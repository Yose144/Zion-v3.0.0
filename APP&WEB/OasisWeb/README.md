# ZION OASIS Web

Next.js 16 herní klient pro ZION OASIS (L4). Staticky exportovaná 3D vizuální aplikace, která umožňuje procházet galaxii 55 OASIS světů, létat mezi nimi, plnit questy a prozkoumávat jednotlivé světy.

## Struktura

- `/` — hlavní 3D scéna (galaxie, 55 světů, volný let, vybavení lodi)
- `/dashboard` — hráčský profil, XP, level, guild (plánováno)
- `/avatars` — Avatar Codex s vyhledáváním a filtry
- `/quests` — quest log a dostupné questy
- `/leaderboard` — top 100 hráčů
- `/onboarding` — narativní průvodce Sůl této země
- `/golden-egg` — sběratelská nápovědy a stav
- `/guilds` — prohlížeč guild
- `/territories` — mapa teritorií

## Klíčové funkce

- **Galaxy Map**: 55 holografických světů, hvězdné pozadí, hyperlanové spojnice, warp-gate efekty.
- **Free Flight**: WASD + myš / mobilní dual joysticky, fyzika pohybu, přistání k světům.
- **Pilgrim Ship**: 3D model lodi viditelný během letu, vylepšitelný (boost, cargo, scanner) a přebarvitelný.
- **Audio Engine**: syntetický ambient, engine drone s pitch dle rychlosti, boost sweep.
- **Game State**: lokální persistovaný stav (XP, credits, questy, objevené/skanované světy, vajíčka, vybavení lodi) s integrací na `/api/v1/oasis/*`.
- **ZION Wallet Login**: `PlayerSettings` supports `zion1` address validation, mnemonic import, and in-browser wallet generation using Ed25519 + SHA-256/RIPEMD160 (same derivation as desktop agent / V3 core).
- **Quests**: live questy z backendu mapované na světy, generované fallback questy, tlačítko Complete s odměnou.
- **NPC / Avatar Guides**: karta NPC ve WorldPanel a plovoucí hologram ve WorldEnvironment.
- **Leaderboard & Territories**: top 3 poutníci a hot teritoria v `OasisHud`.
- **Golden Egg**: sbírka vajíček ve WorldPanel za 100 Z → +500 XP.
- **Mobile**: detekce touch zařízení, snížené DPR, LOD, virtuální joysticky.

## Lokální vývoj

```bash
npm install
cp .env.example .env.local
npm run dev
```

Výchozí URL: `http://localhost:3000`

API se spouští zvlášť z `V31/L4/oasis`:

```bash
cd V31
cargo build --release -p zion-oasis
cd L4/oasis
../../target/release/zion-oasis
```

API URL: `http://127.0.0.1:8094`

Nebo použij z kořene: `./scripts/run-oasis-local.sh`

## Build

```bash
npm run build
```

Statický export se generuje do `dist/`.

## Deploy na Edge

```bash
bash deploy/deploy-oasis-web.sh
```

Skript:
1. Sestaví aplikaci s relativními API cestami.
2. Synchronizuje `dist/` na `root@62.171.141.136:/var/www/oasis` přes SSH port `2222`.
3. Aktualizuje nginx konfiguraci a reloadne nginx.
4. Provádí health check `https://oasis.zionterranova.com`.

## Stack

- Next.js 16 + TypeScript
- React Three Fiber / Three.js
- Tailwind CSS v4
- Framer Motion
- Zustand
- Web Audio API (syntetický zvuk)

## Dokumentace

- Root roadmap & journal: `OASIS_WEB_JOURNAL.md`
- Universe / world data: `OASIS_UNIVERSE.md`
