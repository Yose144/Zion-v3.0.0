# ZION Web v3.0.0 — Core+Edge Dashboard

Modern Next.js 16 website combining the best features from websitev3-next and webv3.3, with live API integration for real-time blockchain metrics.

## 🚀 Features

### From websitev3-next
- ⚡ Next.js 16 with React 19
- 🎨 Framer Motion animations
- 🌌 3D Starfield background (Canvas API)
- 📱 Responsive design with Tailwind CSS 4
- 🎭 Modern component architecture

### From webv3.3
- 📋 Roadmap Lite (Markdown-based)
- 📊 Clean dashboard layout
- 🎯 Focused content presentation

### New Features
- 🔴 **Live API Integration**
  - Real-time blockchain stats
  - Recent blocks explorer
  - System health monitoring
  - Auto-refresh every 5-15s

- 🎨 **Beautiful Design**
  - Gradient text effects
  - Card glow animations
  - Smooth transitions
  - Dark theme optimized

- 📈 **Real-Time Metrics**
  - Total blocks & supply
  - Transaction count
  - Mining difficulty
  - Latest block info
  - Network uptime
  - Dependency health

## 🛠️ Tech Stack

- **Framework:** Next.js 16.0.1
- **React:** 19.2.0
- **TypeScript:** 5.x
- **Styling:** Tailwind CSS 4
- **Animations:** Framer Motion 12.23.24
- **Icons:** Lucide React
- **Markdown:** react-markdown + remark-gfm

## 📦 Installation

```bash
npm install
```

## 🚀 Development

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

## 🏗️ Build

```bash
npm run build
```

Static export to `out/` directory (ready for deployment)

## 📁 Project Structure

```
website-v3.0.0/
├── src/
│   ├── app/
│   │   ├── layout.tsx           # Root layout with navigation
│   │   ├── page.tsx              # Homepage (Hero + Dashboard + Features)
│   │   ├── dashboard/
│   │   │   └── page.tsx          # Full dashboard with live stats
│   │   ├── roadmap/
│   │   │   └── page.tsx          # Roadmap Lite (Markdown)
│   │   └── globals.css           # Global styles + Tailwind
│   └── components/
│       ├── StarfieldBackground.tsx   # 3D starfield animation
│       ├── Navigation.tsx            # Header navigation
│       ├── Footer.tsx                # Footer with links
│       ├── Hero.tsx                  # Homepage hero section
│       ├── LiveDashboard.tsx         # Real-time blockchain stats
│       ├── SystemHealth.tsx          # API health monitoring
│       ├── RecentBlocks.tsx          # Recent blocks list
│       └── Features.tsx              # Feature cards
├── package.json
├── tsconfig.json
├── tailwind.config.ts
├── next.config.ts
└── postcss.config.mjs
```

## 🌐 API Integration

### Endpoints Used

- `GET /api/blockchain/stats` - Total blocks, supply, transactions, difficulty
- `GET /api/blockchain/blocks?limit=5` - Recent blocks with metadata
- `GET /health` - System health, version, uptime, dependencies

### Base URL
```
https://zionterranova.com
```

### Auto-Refresh Intervals
- Dashboard stats: 10 seconds
- System health: 5 seconds
- Recent blocks: 15 seconds

## 🎨 Design System

### Colors
- **Gold:** `#FFD700` - Primary accent
- **Purple:** `#9333EA` - Secondary accent
- **Cyan:** `#06B6D4` - Tertiary accent
- **Background:** Black with starfield

### Typography
- **Font:** Inter (Google Fonts)
- **Headings:** Bold with gradient text
- **Body:** Gray-300 for readability

### Components
- Card glow effects
- Smooth hover animations
- Responsive grid layouts
- Gradient borders

## 📝 Pages

### Homepage (`/`)
- Hero section with CTA buttons
- Live network stats (4 key metrics)
- Feature showcase (6 cards)

### Dashboard (`/dashboard`)
- Comprehensive blockchain statistics
- System health monitoring
- Recent blocks explorer
- Real-time updates

### Roadmap (`/roadmap`)
- Markdown-rendered roadmap
- Budget breakdown
- Timeline visualization
- Success metrics

## 🚢 Deployment

Build static export:
```bash
npm run build
```

Deploy to server:
```bash
rsync -avz --delete out/ root@www.zionterranova.com:/var/www/zionterranova.com/
```

## 📊 Performance

- **Build time:** ~30-60s
- **Bundle size:** Optimized with Next.js 16
- **Images:** Unoptimized (static export)
- **Fonts:** Preloaded (Inter)

## 🔧 Configuration

### next.config.ts
- Static export enabled
- Trailing slash for compatibility
- React Compiler (experimental)

### tailwind.config.ts
- Custom ZION color palette
- Typography plugin
- Custom animations

## 📄 License

Part of ZION Blockchain v3.0.0 project

## 🔗 Links

- **Main Site:** https://zionterranova.com
- **API:** https://zionterranova.com/api
- **GitHub:** https://github.com/Zion-TerraNova
- **Dashboard:** https://zionterranova.com/dashboard

---

**Version:** v3.0.0  
**Built with:** Next.js 16 + React 19 + TypeScript  
**Status:** Production Ready ✅
