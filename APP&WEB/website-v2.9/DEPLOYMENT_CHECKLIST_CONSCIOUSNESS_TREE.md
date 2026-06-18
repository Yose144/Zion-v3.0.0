# 🚀 Consciousness Tree Deployment Checklist

## Pre-Deployment

### ✅ Files Created/Modified
- [x] `/src/components/ConsciousnessTreeKabbalah.tsx` - Main SVG tree component
- [x] `/src/components/GuardiansTreeClient.tsx` - Client wrapper with live data
- [x] `/src/app/api/guardians/stats/route.ts` - API endpoint for Guardian data
- [x] `/src/app/dashboard/presale/page.tsx` - Integration into presale dashboard
- [x] `/src/app/globals.css` - Animation styles (fadeIn, pulse-glow)
- [x] `/books/ZION_Consciousness_Tree_Interactive.html` - Standalone demo (already exists)
- [x] `CONSCIOUSNESS_TREE_INTEGRATION.md` - Full documentation

### 🔍 Code Review Checklist
- [ ] All imports resolved (no missing dependencies)
- [ ] TypeScript types are correct (no `any` warnings)
- [ ] ESLint passes without errors
- [ ] Component props properly typed
- [ ] API route returns correct JSON structure
- [ ] Client-side error handling works
- [ ] Loading states display correctly
- [ ] Responsive design on mobile/tablet/desktop

### 🧪 Testing

#### Local Testing
```bash
cd website-v2.9
npm install
npm run build  # Check for build errors
npm run dev    # Test locally
```

#### Browser Testing
- [ ] Chrome (desktop)
- [ ] Safari (macOS)
- [ ] Firefox (desktop)
- [ ] Mobile Safari (iOS)
- [ ] Chrome Mobile (Android)

#### Feature Testing
- [ ] SVG tree renders correctly
- [ ] Hover tooltips appear on desktop
- [ ] Touch interactions work on mobile
- [ ] Auto-refresh every 60s works
- [ ] Manual refresh button updates data
- [ ] Recent guardians list displays
- [ ] Guardian count badges show on nodes
- [ ] Animations smooth (no jank)
- [ ] API endpoint returns JSON
- [ ] Error states handled gracefully

### 📊 Performance
- [ ] Lighthouse score > 90
- [ ] First Contentful Paint < 1.5s
- [ ] Time to Interactive < 3s
- [ ] SVG file size < 100KB
- [ ] No console errors
- [ ] No memory leaks on auto-refresh

## Deployment Steps

### 1. Build & Test
```bash
cd /Users/yeshuae/Desktop/ZION/Zion-2.9-main/website-v2.9
npm run build
npm run start  # Test production build locally
```

### 2. Environment Variables
Check `.env.production`:
```bash
NEXT_PUBLIC_API_URL=https://zionterranova.com
NEXT_PUBLIC_WS_URL=wss://zionterranova.com/ws
NODE_ENV=production
```

### 3. Database Connection (TODO)
Replace mock data in `/api/guardians/stats/route.ts`:

```typescript
// Current: MOCK_GUARDIAN_DATA
// Need: Real DB query

import { pool } from '@/lib/db';

const result = await pool.query(`
  SELECT 
    COUNT(*) FILTER (WHERE status = 'active') as total144k,
    presale_tier,
    COUNT(*) as count
  FROM guardians
  WHERE created_at >= NOW() - INTERVAL '30 days'
  GROUP BY presale_tier
`);
```

### 4. Deploy to Production
```bash
# SSH to server
ssh root@91.98.122.165

# Navigate to deploy workspace
cd /root/zion-web-deploy/website-v2.9

# Pull latest changes
git pull origin main

# Install dependencies
npm install --production

# Build
npm run build

# Restart website container
cd /root/zion-web-deploy
docker compose -f docker/docker-compose.website.yml build website
docker rm -f zion-website || true
docker compose -f docker/docker-compose.website.yml up -d website
```

### 5. Nginx Configuration
Ensure API routes are proxied:

```nginx
# /etc/nginx/sites-available/zionterranova.com
location /api/guardians/ {
    proxy_pass http://localhost:3000/api/guardians/;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection 'upgrade';
    proxy_set_header Host $host;
    proxy_cache_bypass $http_upgrade;
}
```

Reload nginx:
```bash
sudo nginx -t
sudo systemctl reload nginx
```

### 6. SSL Certificate
```bash
# If not already configured
sudo certbot --nginx -d zionterranova.com
```

## Post-Deployment

### ✅ Smoke Tests
Visit these URLs and verify:

1. **Dashboard Page**
   - https://zionterranova.com/dashboard/presale
   - [ ] Consciousness Tree visible
   - [ ] Guardian counts display
   - [ ] Hover tooltips work
   - [ ] No console errors

2. **API Endpoint**
   - https://zionterranova.com/api/guardians/stats
   - [ ] Returns valid JSON
   - [ ] Status 200 OK
   - [ ] Data structure correct

3. **Standalone Demo**
   - https://zionterranova.com/books/ZION_Consciousness_Tree_Interactive.html
   - [ ] Tree renders
   - [ ] All 10 Sephirot visible

### 🔔 Monitoring Setup

#### Add to Monitoring Dashboard
```bash
# Check API response time
curl -w "@curl-format.txt" -o /dev/null -s https://zionterranova.com/api/guardians/stats

# Monitor with Grafana/Prometheus
# Add endpoint: /api/guardians/stats
# Alert if response time > 2s
```

#### Error Tracking
```typescript
// In GuardiansTreeClient.tsx
useEffect(() => {
  if (error) {
    // Send to Sentry/LogRocket
    console.error('Guardian stats fetch failed:', error);
    // Sentry.captureException(error);
  }
}, [error]);
```

### 📢 Announcement

Once deployed, announce to community:

**Discord:**
```
🌟 **NEW FEATURE: Consciousness Tree of Life is LIVE!**

Visit https://zionterranova.com/dashboard/presale to see:
✨ Interactive Kabbalah Tree visualization
⭐ Real-time 144k Guardians tracking
🔮 9 Consciousness Levels mapped to presale tiers
💎 Live updates every 60 seconds

Check your position on the Tree! Are you CL4 (PIZZA) or CL8 (Guardian)? 🚀

React with ⭐ if you see your tier on the Tree!
```

**Twitter/X:**
```
🌟 ZION Consciousness Tree is LIVE! 

Track your journey from Physical (CL1) to On The Star (CL9) 
144,000 Guardians · 10 Sephirot · Real-time visualization

https://zionterranova.com/dashboard/presale

#blockchain #consciousness #web3
```

## Rollback Plan

If issues occur:

### Quick Rollback
```bash
# SSH to server
ssh root@91.98.122.165

# Revert to previous version
cd /root/zion-web-deploy/website-v2.9
git log --oneline  # Find last good commit
git reset --hard <commit-hash>
npm run build
cd /root/zion-web-deploy
docker compose -f docker/docker-compose.website.yml up -d --build website
```

### Partial Disable
Comment out component in `/dashboard/presale/page.tsx`:
```tsx
{/* Temporarily disabled
<section>
  <GuardiansTreeClient />
</section>
*/}
```

## Known Issues & Solutions

### Issue: SVG not rendering on Safari
**Solution:** Add explicit width/height to SVG:
```tsx
<svg viewBox="0 0 800 850" width="800" height="850">
```

### Issue: Auto-refresh causing memory leak
**Solution:** Cleanup interval in useEffect:
```tsx
useEffect(() => {
  const interval = setInterval(fetchGuardianStats, 60000);
  return () => clearInterval(interval);  // ← Cleanup!
}, []);
```

### Issue: API rate limiting
**Solution:** Add caching:
```typescript
export const revalidate = 60; // Cache for 60s
```

## Future Enhancements

### Phase 2 (Next Sprint)
- [ ] Connect to real presale database
- [ ] Add Guardian profile modal (click on Sephira)
- [ ] WebSocket for instant updates
- [ ] XP progress bars

### Phase 3 (Q2 2026)
- [ ] 3D WebGL version with Three.js
- [ ] Guardian leaderboard
- [ ] Level-up NFT minting
- [ ] DAO voting per Sephira

## Support Contacts

**Developer:** @yeshuae  
**Project Lead:** TBD  
**DevOps:** TBD  

**Emergency Hotline:** TBD  

---

**Deployment Date:** 2026-01-15  
**Version:** v3.0.0  
**Status:** ✅ READY FOR DEPLOYMENT (with mock data)

🚀 **Ready to launch!** 🚀
