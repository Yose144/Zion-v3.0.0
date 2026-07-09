# ZION Web v3.7 — TerraNova Website

Next.js 16 website for the ZION blockchain project. Live at **https://zionterranova.com**.

## Tech Stack

- **Framework:** Next.js 16.2.9 (webpack build mode — Turbopack has path resolution issues with local `.tgz` deps)
- **React:** 19
- **TypeScript:** 5.x
- **Styling:** Tailwind CSS 4 + custom ZION theme classes
- **Animations:** Framer Motion
- **Icons:** Lucide React
- **Markdown:** react-markdown + remark-gfm

## Build

```bash
npm install
npm run build          # uses Turbopack by default (may fail on local .tgz deps)
npx next build --webpack   # ← use this for production builds
```

> **Important:** Next.js 16 defaults to Turbopack which cannot resolve the local `zion-wallet-sdk` `.tgz` dependency. Always use `--webpack` flag for production builds.

## Development

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

## Theme System

### ZION Rainbow Card

Two CSS classes defined in `src/app/globals.css`:

- `.zion-rainbow-card` — main section cards. Set `style={{ '--rc': 'R, G, B' } as React.CSSProperties}` inline. Features: top glow line, hover border glow, corner accent.
- `.zion-rainbow-sub` — sub-cards inside a section. Same `--rc` pattern, smaller.

Each page has its own accent color:

| Page group | Color | RGB |
|---|---|---|
| Network, Explorer | cyan / gold | `6, 182, 212` / `251, 191, 36` |
| DeFi | emerald / green / lime / violet | `16, 185, 129` / `34, 197, 94` / `132, 204, 22` / `139, 92, 246` |
| Terranova | emerald / rose | `16, 185, 129` / `244, 63, 94` |
| Quantum Revolution | gold | `251, 191, 36` |
| Genesis | gold | `251, 191, 36` |
| L3 Hiran | violet | `139, 92, 246` |
| L4 Oasis | orange | `249, 115, 22` |
| L5 Free World | sky | `14, 165, 233` |
| L6 Issobella | rose | `244, 63, 94` |
| Bridge | blue | `59, 130, 246` |
| Wallet | pink | `236, 72, 153` |
| Dashboard | indigo | `99, 102, 241` |
| Warp | fuchsia | `217, 70, 239` |
| DAO | violet | `139, 92, 246` |
| Mining | amber | `245, 158, 11` |
| Docs | teal | `20, 184, 166` |
| Roadmap | indigo | `99, 102, 241` |
| Download | cyan | `6, 182, 212` |
| News | sky | `56, 189, 248` |
| Resonance | fuchsia | `217, 70, 239` |
| Wiki | emerald | `16, 185, 129` |
| Monitoring | rose | `244, 63, 94` |

## Pages

50+ pages including:

- `/` — Homepage (Hero, MainnetCountdown, HolographicEarth, HomeQuickLinks, StoryTriptych)
- `/network` — Network status, charts, infrastructure
- `/explorer` — Block explorer (blocks, tx, addresses, miners, supply, mempool, richlist, consensus, bridge tracker)
- `/pool` — Mining pool dashboard
- `/mining` — Mining unified client (CPU/GPU/Pool/Solo guides)
- `/defi` — DeFi hub (bridge vault, staking, farming, DAO)
- `/bridge` — Bridge documentation
- `/wallet` — Wallet interface
- `/dao` — DAO governance
- `/docs` — Documentation reader
- `/roadmap` — Full roadmap with timeline
- `/download` — Desktop agent download
- `/news` — News archive
- `/genesis` — Genesis book (9 chapters)
- `/terranova` — Terra Nova book reader (17 chapters + appendices)
- `/quantum-revolution` — Quantum Revolution book page (mock — data pending)
- `/l3-hiran` — AI Native layer
- `/l4-oasis` — OASIS game layer
- `/l5-free-world` — Free World humanitarian fund
- `/l6-issobella` — Issobella orbital station
- `/warp` — WARP bridges
- `/dashboard` — User dashboard
- `/monitoring` — Infrastructure monitoring
- `/kompas` — Golden Compass (redirects to /terranova)
- `/resonance` — Resonance frequencies
- `/wiki` — Wiki
- `/doge-vs-zion` — Doge vs ZION mini-games

## Project Structure

```
website-v2.9/
├── src/
│   ├── app/
│   │   ├── layout.tsx              # Root layout
│   │   ├── page.tsx                # Homepage
│   │   ├── globals.css             # Global styles + ZION theme classes
│   │   ├── quantum-revolution/     # Quantum Revolution page
│   │   ├── terranova/              # Terra Nova book reader
│   │   ├── genesis/                # Genesis book
│   │   ├── explorer/               # Block explorer + subpages
│   │   ├── defi/                   # DeFi hub + subpages
│   │   ├── network/                # Network status
│   │   ├── ...                     # 40+ more pages
│   ├── components/
│   │   ├── Navigation.tsx          # Two-tier nav with mini icons
│   │   ├── Hero.tsx                # Homepage hero
│   │   ├── StoryTriptych.tsx       # 3-card story portal
│   │   ├── MainnetCountdown.tsx    # Countdown timer
│   │   ├── HomeQuickLinks.tsx      # 6 quick link cards
│   │   ├── NewsFeed.tsx            # News data + articles
│   │   ├── ...                     # 30+ more components
│   ├── lib/
│   │   ├── translations.ts         # CS/EN translations
│   │   ├── defi-contracts.ts       # Seed price, bridge contracts
│   │   ├── constants.ts            # Network constants
│   │   └── ...
│   └── contexts/
│       ├── LanguageContext.tsx     # CS/EN language toggle
│       └── ...
├── Dockerfile                      # Legacy (uses ../zion-wallet-sdk COPY)
├── Dockerfile.production           # Self-contained (npm ci)
├── next.config.ts                  # Webpack + Turbopack config
└── package.json
```

## Deployment

See [DEPLOYMENT.md](./DEPLOYMENT.md) for the full guide.

Quick summary:

```bash
# On Edge server (via SSH):
ssh deploy@edge-server
cd /opt/zion/web
git pull origin main
npm install
npx next build --webpack          # ← MUST use --webpack
# Build Docker image from host artifacts:
docker build -t zion-website:<version> -f - . <<'EOF'
FROM node:20-alpine
WORKDIR /app
COPY .next .next
COPY node_modules node_modules
COPY package.json package.json
COPY public public
ENV NODE_ENV=production
ENV PORT=3000
EXPOSE 3000
CMD ["node", "node_modules/.bin/next", "start"]
EOF
# Restart container:
docker compose -f /opt/zion/docker/docker-compose.yml up -d
```

Or use the automated script:

```bash
bash scripts/deploy-edge-web.sh <version>
```

## License

Part of ZION Blockchain v3.0 project

## Links

- **Live Site:** https://zionterranova.com
- **GitHub:** https://github.com/Yose144/Zion-v3.0.0
- **Production Host:** Edge server (cloud VPS)

---

**Version:** v3.7.5  
**Last updated:** 27 June 2026  
**Status:** Production Ready ✅
