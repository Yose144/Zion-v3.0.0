# ZION Web v2.8.9 - Deployment Guide

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
- **Status:** ✅ Ready for deployment

## 🚀 Deployment Commands

### Automated Deploy (recommended)
```bash
cd website-v2.9
./scripts/deploy.sh --host 77.42.31.72 --user root --path /var/www/zionterranova.com
```

### Manual Deploy to Main Domain
```bash
rsync -avz --delete out/ root@www.zionterranova.com:/var/www/zionterranova.com/
```

### Deploy to Subdirectory (v2.8.9)
```bash
rsync -avz --delete out/ root@www.zionterranova.com:/var/www/zionterranova.com/v2.8.9/
```

### Deploy to Test Subdomain
```bash
rsync -avz --delete out/ root@www.zionterranova.com:/var/www/test.zionterranova.com/
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
```

### Test API Integration
```bash
curl -s https://zionterranova.com/health | jq

# Or from the browser console:
fetch('https://zionterranova.com/health')
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
- **Build Directory:** /Users/yeshuae/Desktop/ZION/Zion-2.9/website-v2.8.9

---

**Version:** v2.8.9  
**Build Date:** November 10, 2025  
**Status:** ✅ Ready for Production
