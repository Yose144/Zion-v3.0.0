# ZION Web v3.0.0 — Deployment Guide

> Last verified production deploy: 20. dubna 2026

## Current Production Status

- Local `npm run build` passes cleanly on the current tree.
- Production deploy target is **Edge** (Hetzner VPS): `77.42.71.94`.
- Canonical remote paths:
  - source: `/root/zion-2.9.6-main/APP&WEB/website-v2.9`
  - compose: `/root/zion-2.9.6-main/docker`
- Website bridge status now reaches the host-networked bridge via `host.docker.internal:9101` from `docker-compose.website.yml`.
- Verified live after deploy on 2026-04-20:
  - `https://zionterranova.com/api/health`
  - `https://zionterranova.com/api/bridge/status`

## 📦 Build Summary

- **Build Size:** 1.8 MB
- **Pages:** 7 total
  - Homepage (/)
  - Dashboard (/dashboard)
  - Mining (/mining)
  - Documentation (/docs)
  - Roadmap (/roadmap)
  - 404 page
  
- **Documentation:** 19 markdown files from webv3.3
- **Build Time:** ~3-4 seconds
- **Status:** ✅ Buildable and deployed on Edge (Hetzner)

## 🚀 Deployment Commands

### Automated Deploy (recommended)
```bash
cd APP\&WEB/website-v2.9
bash ./scripts/deploy.sh --host 77.42.71.94 --user root
```

Default production paths are now:

- remote source: /root/zion-2.9.6-main/APP&WEB/website-v2.9
- remote compose: /root/zion-2.9.6-main/docker

If you need a different remote layout, use:

```bash
bash ./scripts/deploy.sh \
  --host your-host \
  --user root \
  --remote-src /absolute/remote/source/path \
  --remote-compose /absolute/remote/compose/path
```

### Manual Deploy to Main Domain
```bash
rsync -avz --delete \
  -e "ssh -i ~/.ssh/ssh-key-zion-edge" \
  ./ root@77.42.71.94:/root/zion-2.9.6-main/APP\&WEB/website-v2.9/ \
  --exclude node_modules --exclude .next --exclude out --exclude .env.local

rsync -avz \
  -e "ssh -i ~/.ssh/ssh-key-zion-edge" \
  ./docker/docker-compose.website.yml \
  root@77.42.71.94:/root/zion-2.9.6-main/docker/

ssh -i ~/.ssh/ssh-key-zion-edge root@77.42.71.94 \
  "cd /root/zion-2.9.6-main/docker && docker compose -f docker-compose.website.yml build --no-cache website && docker compose -f docker-compose.website.yml up -d website"
```

## 📋 Pre-Deployment Checklist

- [x] Next.js build successful
- [x] Static export generated (out/ directory)
- [x] All pages rendering correctly
- [x] Live API integration working
- [x] Documentation files included
- [x] Navigation links functional
- [x] Responsive design tested
- [x] Tailwind CSS optimized
- [x] Framer Motion animations working
- [x] React Markdown rendering docs

## 🌐 Live Features

### API Integration
- **Endpoint:** https://zionterranova.com (API mounted under `/api`, health at `/health`)
- **Auto-refresh:**
  - Dashboard stats: 10s
  - System health: 5s
  - Recent blocks: 15s

### Pages

#### Homepage (/)
- Hero section with CTA
- Live network statistics (4 metrics)
- Feature showcase (6 cards)
- Animated starfield background

#### Dashboard (/dashboard)
- Real-time blockchain stats
- System health monitoring
- Recent blocks explorer
- Dependency status

#### Mining (/mining)
- Quick start guide
- Pool connection info
- Algorithm selection
- Links to full documentation

#### Documentation (/docs)
- Interactive sidebar navigation
- 12 documentation topics
- Markdown rendering with syntax highlighting
- Responsive layout

#### Roadmap (/roadmap)
- Full v2.9.0 roadmap
- Budget breakdown
- Timeline visualization
- Success metrics

## 🎨 Design Features

### Components
- StarfieldBackground (Canvas animation)
- Navigation (responsive with mobile menu)
- LiveDashboard (real-time API data)
- SystemHealth (health monitoring)
- RecentBlocks (block explorer)
- Features (feature cards)
- Footer (site links)

### Styling
- **Colors:** Gold (#FFD700), Purple (#9333EA), Cyan (#06B6D4)
- **Typography:** Inter font family
- **Effects:** Gradient text, glow, card shadows
- **Animations:** Framer Motion (fade, slide, scale)
- **Theme:** Dark mode optimized

## 📊 Performance

- **Bundle Size:** Optimized with Next.js 16
- **Images:** Unoptimized (static export compatible)
- **Fonts:** Preloaded Google Fonts
- **CSS:** Tailwind CSS 4 (minimal output)
- **JavaScript:** React 19 with automatic runtime

## 🔧 Post-Deployment

### Verify Deployment
```bash
curl -I https://zionterranova.com/
curl -I https://zionterranova.com/dashboard/
curl -I https://zionterranova.com/docs/
curl -s https://zionterranova.com/api/health | jq
curl -s https://zionterranova.com/api/bridge/status | jq
```

### Test API Integration
```bash
curl -s https://zionterranova.com/api/health | jq
curl -s https://zionterranova.com/api/bridge/status | jq

# Or from the browser console:
fetch('https://zionterranova.com/api/health')
  .then(r => r.json())
  .then(console.log)
```

### Monitor
- Check browser console for errors
- Verify all navigation links work
- Test responsive design on mobile
- Confirm API auto-refresh working

## 📝 Notes

### From websitev3-next
- ✅ Next.js 16 + React 19
- ✅ Framer Motion animations
- ✅ 3D starfield background
- ✅ Tailwind CSS 4
- ✅ Modern component architecture

### From webv3.3
- ✅ Roadmap Lite (full markdown)
- ✅ 12 documentation files
- ✅ Clean dashboard layout
- ✅ Simple navigation structure

### New Features
- ✅ Live API integration
- ✅ Real-time metrics
- ✅ System health monitoring
- ✅ Interactive documentation browser
- ✅ Mining quick start guide

## 🔗 Links

- **Main Site:** https://zionterranova.com
- **API:** https://zionterranova.com/api
- **GitHub:** https://github.com/Zion-TerraNova
- **Production Host:** 77.42.71.94 (Edge · Hetzner)

---

**Version:** v3.0.0  
**Build Date:** 20. dubna 2026  
**Status:** ✅ Deployed and verified on Edge
