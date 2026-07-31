# ZION OASIS Web

Next.js 16 herní klient pro ZION OASIS (L4).

## Struktura

- `/` — úvodní 3D scéna (galaxie, strom života, 8 světů)
- `/dashboard` — hráčský profil, XP, level, guild
- `/avatars` — Avatar Codex s vyhledáváním a filtry
- `/quests` — quest log a dostupné questy
- `/leaderboard` — top 100 hráčů
- `/onboarding` — narativní průvodce Sůl této země

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
npm run start
```

## Stack

- Next.js 16 + TypeScript
- React Three Fiber / Three.js
- Tailwind CSS v4
- Framer Motion
- Zustand
