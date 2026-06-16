# 🌟 Consciousness Tree of Life - 144k Guardians Integration

## Overview

Interaktivní Kabbalah Tree of Life vizualizace pro ZION presale, která mapuje 9 Consciousness Levels na 10 Sefirot a sleduje real-time progress 144,000 Guardians.

## Components

### 1. **ConsciousnessTreeKabbalah.tsx**
Core SVG visualization component with interactive tooltips.

**Path:** `website-v2.9/src/components/ConsciousnessTreeKabbalah.tsx`

**Features:**
- 9 CL levels mapped to 10 Sephirot (Malkuth → Keter + hidden Da'at)
- Interactive hover tooltips with XP, multipliers, presale tiers
- Real-time guardian count per tier
- Lightning Flash path visualization
- Pulse animation on Keter (ON_THE_STAR level)
- Responsive SVG layout

**Props:**
```typescript
guardianData?: {
  total144k: number;
  byTier: Record<string, number>;
}
```

### 2. **GuardiansTreeClient.tsx**
Client component with live data fetching and auto-refresh.

**Path:** `website-v2.9/src/components/GuardiansTreeClient.tsx`

**Features:**
- Auto-refresh every 60 seconds
- Manual refresh button
- Loading states with skeleton
- Error handling with retry
- Recent guardians list
- Live status indicator

### 3. **API Route: /api/guardians/stats**
Real-time Guardian registry data endpoint.

**Path:** `website-v2.9/src/app/api/guardians/stats/route.ts`

**Response:**
```json
{
  "success": true,
  "data": {
    "total144k": 27,
    "limit": 144000,
    "byTier": {
      "✨ Guardian Pack (24 990 Kč)": 3,
      "🚘 LAMBO Pack (12 490 Kč)": 8,
      "🍕 PIZZA Pack (2 490 Kč)": 16
    },
    "byConsciousnessLevel": {
      "CL9": 0,
      "CL8": 3,
      "CL7": 8,
      ...
    },
    "recentGuardians": [...],
    "lastUpdate": "2026-01-15T..."
  }
}
```

## Consciousness Level Mapping

| CL Level | Sephira | Multiplier | XP Threshold | Presale Tier |
|----------|---------|------------|--------------|--------------|
| **CL9** | KETER (Crown) | 10.0× | 1,000,000 XP | ✨ Guardian Pack |
| **CL8** | BINAH + CHOKHMAH | 5.0× | 500,000 XP | ✨ Guardian Pack |
| **CL7.5** | DA'AT (Hidden) | 4.0× | 375,000 XP | Transition |
| **CL7** | CHESED (Mercy) | 3.0× | 250,000 XP | 🚘 LAMBO Pack |
| **CL6** | GEVURAH (Strength) | 2.0× | 100,000 XP | 🚘 LAMBO Pack |
| **CL5** | TIFERET (Beauty) | 1.5× | 40,000 XP | Mid-tier |
| **CL4** | NETZACH (Victory) | 1.25× | 15,000 XP | 🍕 PIZZA Pack |
| **CL3** | HOD (Glory) | 1.1× | 5,000 XP | 🍕 PIZZA Pack |
| **CL2** | YESOD (Foundation) | 1.05× | 1,000 XP | Starter |
| **CL1** | MALKUTH (Kingdom) | 1.0× | 0 XP | Non-holders |

## Presale Packages

### ✨ Guardian Pack (24,990 Kč)
- **324,870 Credits** (249,900 base + 30% bonus)
- **CL8 → CL9** - TRANSCENDENT → ON_THE_STAR
- Premium QR wallet
- Founder role
- Part of 144k Guardians
- Full DAO governance rights
- Exclusive NFT badge
- Forever in blockchain

### 🚘 LAMBO Pack (12,490 Kč)
- **149,880 Credits** (124,900 base + 20% bonus)
- **CL6 → CL7** - COSMIC → ENLIGHTENED
- Lambo Club Discord
- Priority airdrop
- Governance access

### 🍕 PIZZA Pack (2,490 Kč)
- **27,390 Credits** (24,900 base + 10% bonus)
- **CL3 → CL4** - MENTAL → SACRED
- QR wallet
- Bitcoin Pizza memory
- Discord access

## Integration Steps

### 1. Install in Presale Dashboard
Already integrated in `/dashboard/presale` page:

```tsx
import GuardiansTreeClient from "@/components/GuardiansTreeClient";

export default function PresaleDashboardPage() {
  return (
    <section>
      <h2>Kabbalah Tree of Life · 144k Guardians</h2>
      <GuardiansTreeClient />
    </section>
  );
}
```

### 2. Connect to Real Database
Update `/api/guardians/stats/route.ts`:

```typescript
// Replace MOCK_GUARDIAN_DATA with real DB query
const stats = await db.query(`
  SELECT 
    COUNT(*) as total,
    presale_tier,
    consciousness_level
  FROM guardians
  WHERE status = 'active'
  GROUP BY presale_tier, consciousness_level
`);
```

### 3. Add WebSocket for Live Updates (Optional)
For instant updates without polling:

```typescript
// In GuardiansTreeClient.tsx
useEffect(() => {
  const ws = new WebSocket('wss://zionterranova.com/ws/guardians');
  ws.onmessage = (event) => {
    const newData = JSON.parse(event.data);
    setData(newData);
  };
  return () => ws.close();
}, []);
```

## Styling

All animations defined in `globals.css`:

```css
@keyframes fadeIn {
  from { opacity: 0; transform: translateY(-10px); }
  to { opacity: 1; transform: translateY(0); }
}

.animate-fadeIn {
  animation: fadeIn 0.3s ease-out;
}
```

## File Structure

```
website-v2.9/
├── src/
│   ├── components/
│   │   ├── ConsciousnessTreeKabbalah.tsx  ← SVG Tree visualization
│   │   └── GuardiansTreeClient.tsx        ← Client wrapper with API
│   ├── app/
│   │   ├── api/
│   │   │   └── guardians/
│   │   │       └── stats/
│   │   │           └── route.ts           ← API endpoint
│   │   └── dashboard/
│   │       └── presale/
│   │           └── page.tsx               ← Integration page
│   └── globals.css                        ← Animations
└── books/
    └── ZION_Consciousness_Tree_Interactive.html  ← Standalone demo
```

## Testing

### 1. Local Development
```bash
cd website-v2.9
npm install
npm run dev
# Open http://localhost:3000/dashboard/presale
```

### 2. API Testing
```bash
curl http://localhost:3000/api/guardians/stats | jq
```

### 3. Standalone HTML Demo
```bash
open books/ZION_Consciousness_Tree_Interactive.html
```

## Next Steps

### Phase 1: ✅ COMPLETE
- [x] Create ConsciousnessTreeKabbalah component
- [x] Add GuardiansTreeClient with auto-refresh
- [x] Build /api/guardians/stats endpoint
- [x] Integrate into presale dashboard
- [x] Add animations & hover tooltips

### Phase 2: 🚧 TODO
- [ ] Connect to real presale database
- [ ] Add WebSocket for instant updates
- [ ] Create Guardian profile pages (click on node → detail view)
- [ ] Add XP progress bars within each level
- [ ] Implement tier upgrade animations
- [ ] Add sound effects on hover (optional)

### Phase 3: 🔮 FUTURE
- [ ] 3D WebGL version with Three.js
- [ ] AR visualization for mobile (WebXR)
- [ ] Guardian leaderboard
- [ ] Level-up NFT minting integration
- [ ] DAO voting widget per Sephira

## Related Files

- **Core Implementation:** `src/core/consciousness_mining_game.py` (Python)
- **Rust Implementation:** `2.9.5/zion-native/pool/src/consciousness/xp_tracker.rs`
- **Spiritual Content:** `books/ZION_Tree_of_Life_Content.md`
- **Economic Model:** `ECONOMIC_CALCULATIONS_CORRECT.md`

## Support

For issues or questions:
- GitHub: https://github.com/zionterranova/zion-2.9
- Discord: https://discord.gg/zionterranova
- Email: support@zionterranova.com

---

**Created:** 2026-01-15  
**Version:** 2.9.5  
**Status:** Production Ready (with mock data)

🌟 **"Where technology meets spirit"** 🌟
