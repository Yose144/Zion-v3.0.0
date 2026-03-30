# 🎛️ ZION Pool Algorithm Manager - Návrh Systému

**Verze**: 1.0  
**Datum**: 2026-01-19  
**Status**: PROPOSAL

---

## 📊 Executive Summary

Tento dokument popisuje návrh **Pool Algorithm Manager** systému, který umožní:
1. Dynamické přepínání mezi mining algoritmy podle profitability
2. Admin UI pro správu algoritmů přímo z webu
3. Automatické nebo manuální přepínání poolů
4. Real-time monitoring profitability všech podporovaných coinů

---

## 🏗️ Architektura

```
┌─────────────────────────────────────────────────────────────────────┐
│                    POOL ALGORITHM MANAGER                            │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  ┌──────────────────┐    ┌──────────────────┐    ┌───────────────┐  │
│  │   ADMIN WEB UI   │───▶│   CONFIG API     │───▶│  POOL NODES   │  │
│  │  (website-v2.9)  │    │  (FastAPI)       │    │  (SG + HEL)   │  │
│  └──────────────────┘    └──────────────────┘    └───────────────┘  │
│          │                        │                      │          │
│          ▼                        ▼                      ▼          │
│  ┌──────────────────┐    ┌──────────────────┐    ┌───────────────┐  │
│  │  PROFIT MONITOR  │◀───│   REDIS STATE    │───▶│    MINERS     │  │
│  │  (WhatToMine)    │    │  (real-time)     │    │  (connected)  │  │
│  └──────────────────┘    └──────────────────┘    └───────────────┘  │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 🎯 Podporované Algoritmy

### GPU Algoritmy (Switchable Slot - 20%)

| Algoritmus | Coin | Pool URL | Status | Priority |
|------------|------|----------|--------|----------|
| **Autolykos2** | ERG | `erg.2miners.com:8888` | ✅ Active | 🥇 High |
| **KawPow** | RVN | `rvn.2miners.com:6060` | ✅ Active | 🥇 High |
| **kHeavyHash** | KAS | `kas.2miners.com:2020` | ✅ Active | 🥇 High |
| **Blake3** | ALPH | `alph.2miners.com:1199` | ✅ Active | 🥈 Medium |
| **Ethash** | ETC | `etc.2miners.com:1010` | ⚠️ Backup | 🥉 Low |
| **Equihash 144,5** | ZEC | `zec.2miners.com:1010` | ⚠️ Backup | 🥉 Low |

### CPU Algoritmy (NCL Expanded Slot - 20%)

| Algoritmus | Coin | Pool URL | Status | Priority |
|------------|------|----------|--------|----------|
| **RandomX** | XMR | `xmr.2miners.com:2222` | ✅ Active | 🥇 High |
| **Yescrypt** | YTN | TBD | ⚠️ Optional | 🥉 Low |

### Native Algoritmy (Fixed Slots)

| Slot | Algoritmus | Alokace | Output |
|------|------------|---------|--------|
| Primary | Cosmic Fusion | 50% | ZION |
| Merged 1 | Keccak-256 | 5% | NiceHash BTC |
| Merged 2 | SHA3-512 | 5% | Nexus/0xBTC |

---

## 🖥️ Admin UI Specifikace

### Umístění
```
website-v2.9/src/app/admin/
├── page.tsx                    # Admin dashboard
├── algo-manager/
│   ├── page.tsx               # Algorithm management
│   └── components/
│       ├── AlgoCard.tsx       # Single algo card
│       ├── ProfitChart.tsx    # Profitability chart
│       └── SwitchControl.tsx  # Manual switch button
├── pool-status/
│   └── page.tsx               # Pool health monitoring
└── layout.tsx                 # Admin layout with auth
```

### UI Komponenty

#### 1. Algorithm Dashboard
```
┌─────────────────────────────────────────────────────────────────┐
│  🎛️ ZION Pool Algorithm Manager                    [Auto: ON]   │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  CURRENT MODE: ⚡ AUTO-SWITCH (based on profitability)          │
│  Active Algo:  🟢 KawPow (RVN) - $2.45/day/GPU                  │
│  Next Check:   2 min 34 sec                                      │
│                                                                  │
├─────────────────────────────────────────────────────────────────┤
│  📊 LIVE PROFITABILITY (per GPU, RTX 4090 baseline)             │
│                                                                  │
│  ┌─────────┬──────────┬──────────┬────────┬─────────────────┐   │
│  │ Algo    │ Coin     │ $/day    │ Trend  │ Action          │   │
│  ├─────────┼──────────┼──────────┼────────┼─────────────────┤   │
│  │ kHeavy  │ KAS      │ $3.12    │ 📈 +5% │ [Switch Now]    │   │
│  │ KawPow  │ RVN      │ $2.45    │ 📊 0%  │ 🟢 ACTIVE       │   │
│  │ Autoly  │ ERG      │ $2.21    │ 📉 -3% │ [Switch Now]    │   │
│  │ Blake3  │ ALPH     │ $1.89    │ 📈 +2% │ [Switch Now]    │   │
│  │ Ethash  │ ETC      │ $1.45    │ 📉 -8% │ [Switch Now]    │   │
│  └─────────┴──────────┴──────────┴────────┴─────────────────┘   │
│                                                                  │
├─────────────────────────────────────────────────────────────────┤
│  ⚙️ SETTINGS                                                     │
│                                                                  │
│  Switch Threshold:  [===|====] 10%   (min profit diff to switch)│
│  Check Interval:    [====|===] 5 min                             │
│  Min Time on Algo:  [==|=====] 15 min (prevent rapid switching) │
│                                                                  │
│  [Save Settings]                                                 │
└─────────────────────────────────────────────────────────────────┘
```

#### 2. Pool Configuration
```
┌─────────────────────────────────────────────────────────────────┐
│  🔧 POOL CONFIGURATION                                           │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  GPU SLOT (Switchable - 20% allocation)                         │
│  ─────────────────────────────────────                          │
│                                                                  │
│  ☑️ ERG (Autolykos2)                                             │
│     Pool: [erg.2miners.com:8888____________] ✅                  │
│     Wallet: [9f4QF8AD1nQ3..._______________] ✅                  │
│                                                                  │
│  ☑️ RVN (KawPow)                                                 │
│     Pool: [rvn.2miners.com:6060____________] ✅                  │
│     Wallet: [RVNxxxxxxxxxxxxxxxxxx_________] ✅                  │
│                                                                  │
│  ☑️ KAS (kHeavyHash)                                             │
│     Pool: [kas.2miners.com:2020____________] ✅                  │
│     Wallet: [kaspa:qzxxxxxxxxxxxxxxx_______] ✅                  │
│                                                                  │
│  ☐ ALPH (Blake3) [Enable]                                       │
│  ☐ ETC (Ethash) [Enable]                                        │
│  ☐ ZEC (Equihash) [Enable]                                      │
│                                                                  │
│  [Test All Connections]  [Save Configuration]                    │
└─────────────────────────────────────────────────────────────────┘
```

---

## 🔌 API Endpoints

### Config API (`/api/admin/algo-manager/`)

```typescript
// GET /api/admin/algo-manager/status
interface AlgoManagerStatus {
  mode: "auto" | "manual";
  activeAlgo: string;
  activeCoin: string;
  profitPerDay: number;
  nextCheckIn: number; // seconds
  connectedMiners: number;
  totalHashrate: string;
}

// GET /api/admin/algo-manager/profitability
interface ProfitabilityData {
  algorithms: {
    algo: string;
    coin: string;
    profitPerDay: number;
    trend24h: number; // percentage
    hashrate: string;
    difficulty: number;
    price: number;
  }[];
  lastUpdate: string;
}

// POST /api/admin/algo-manager/switch
interface SwitchRequest {
  targetAlgo: string;
  reason?: string;
}

// POST /api/admin/algo-manager/settings
interface SettingsUpdate {
  mode: "auto" | "manual";
  switchThreshold: number; // percentage
  checkInterval: number; // seconds
  minTimeOnAlgo: number; // seconds
}

// GET /api/admin/algo-manager/config
// POST /api/admin/algo-manager/config
interface PoolConfig {
  algorithms: {
    algo: string;
    coin: string;
    enabled: boolean;
    poolUrl: string;
    wallet: string;
    priority: number;
  }[];
}
```

---

## 🔄 Switching Logic

### Auto-Switch Algorithm

```python
class AlgoSwitcher:
    """Automatic algorithm switching based on profitability."""
    
    def __init__(self):
        self.switch_threshold = 0.10  # 10% minimum difference
        self.check_interval = 300     # 5 minutes
        self.min_time_on_algo = 900   # 15 minutes
        self.last_switch = time.time()
    
    async def check_and_switch(self):
        """Main switching logic."""
        
        # 1. Get current profitability data
        profits = await self.get_profitability()
        
        # 2. Find best algorithm
        best = max(profits, key=lambda x: x['profit_per_day'])
        current = self.get_active_algo()
        
        # 3. Check if switch is warranted
        if best['algo'] == current['algo']:
            return  # Already on best
        
        # 4. Check minimum time constraint
        time_on_current = time.time() - self.last_switch
        if time_on_current < self.min_time_on_algo:
            return  # Too soon to switch
        
        # 5. Check threshold
        improvement = (best['profit'] - current['profit']) / current['profit']
        if improvement < self.switch_threshold:
            return  # Not enough improvement
        
        # 6. Execute switch
        await self.execute_switch(best['algo'])
        self.last_switch = time.time()
        
        # 7. Log and notify
        await self.log_switch(current, best, improvement)
        await self.notify_admin(f"Switched from {current['coin']} to {best['coin']}")
```

### Manual Override

```python
@router.post("/api/admin/algo-manager/switch")
async def manual_switch(request: SwitchRequest, admin: Admin = Depends(verify_admin)):
    """Admin-initiated manual switch."""
    
    # Validate target algorithm
    if request.targetAlgo not in SUPPORTED_ALGOS:
        raise HTTPException(400, "Unsupported algorithm")
    
    # Execute immediate switch
    await switcher.execute_switch(
        algo=request.targetAlgo,
        reason=request.reason or "Manual admin override"
    )
    
    # Pause auto-switching for configured time
    switcher.pause_auto(duration=1800)  # 30 minutes
    
    return {"status": "switched", "algo": request.targetAlgo}
```

---

## 📁 Konfigurace

### Redis State Keys

```
algo:current          = "kawpow"
algo:current:coin     = "RVN"
algo:current:since    = 1737295200
algo:mode            = "auto"
algo:settings:threshold = 0.10
algo:settings:interval  = 300
algo:settings:min_time  = 900
algo:profitability     = { JSON blob }
algo:history           = [ list of switches ]
```

### Config File (`config/algo_manager.json`)

```json
{
  "version": "1.0",
  "mode": "auto",
  "settings": {
    "switch_threshold": 0.10,
    "check_interval_seconds": 300,
    "min_time_on_algo_seconds": 900,
    "profitability_source": "whattomine"
  },
  "algorithms": {
    "gpu": [
      {
        "algo": "autolykos2",
        "coin": "ERG",
        "enabled": true,
        "priority": 1,
        "pool": "erg.2miners.com:8888",
        "wallet": "9f4QF8AD1nQ3nMqVbNUgA5vmRiYPF3UBjx7sHJxhJJnWiZH6q",
        "worker_prefix": "zion"
      },
      {
        "algo": "kawpow",
        "coin": "RVN",
        "enabled": true,
        "priority": 1,
        "pool": "rvn.2miners.com:6060",
        "wallet": "RVN_WALLET_ADDRESS",
        "worker_prefix": "zion"
      },
      {
        "algo": "kheavyhash",
        "coin": "KAS",
        "enabled": true,
        "priority": 1,
        "pool": "kas.2miners.com:2020",
        "wallet": "kaspa:WALLET_ADDRESS",
        "worker_prefix": "zion"
      },
      {
        "algo": "blake3",
        "coin": "ALPH",
        "enabled": true,
        "priority": 2,
        "pool": "alph.2miners.com:1199",
        "wallet": "ALPH_WALLET_ADDRESS",
        "worker_prefix": "zion"
      },
      {
        "algo": "ethash",
        "coin": "ETC",
        "enabled": false,
        "priority": 3,
        "pool": "etc.2miners.com:1010",
        "wallet": "ETC_WALLET_ADDRESS",
        "worker_prefix": "zion"
      }
    ],
    "cpu": [
      {
        "algo": "randomx",
        "coin": "XMR",
        "enabled": true,
        "priority": 1,
        "pool": "xmr.2miners.com:2222",
        "wallet": "XMR_WALLET_ADDRESS",
        "worker_prefix": "zion"
      }
    ]
  }
}
```

---

## 🔐 Security

### Admin Authentication

```typescript
// middleware/adminAuth.ts
export async function verifyAdmin(req: NextRequest) {
  const token = req.headers.get('Authorization')?.replace('Bearer ', '');
  
  if (!token) {
    throw new UnauthorizedError('Missing auth token');
  }
  
  // Verify JWT
  const payload = await verifyJWT(token, process.env.ADMIN_JWT_SECRET);
  
  // Check admin role
  if (payload.role !== 'admin') {
    throw new ForbiddenError('Admin access required');
  }
  
  return payload;
}
```

### Access Control

- Admin UI accessible only from whitelisted IPs or with valid JWT
- All config changes logged with timestamp and admin ID
- Rate limiting on API endpoints
- Sensitive wallet addresses encrypted at rest

---

## 📅 Implementation Roadmap

### Phase 1: Core Backend (Week 1)
- [ ] Profitability fetcher (WhatToMine API integration)
- [ ] Switching logic implementation
- [ ] Redis state management
- [ ] Config file parser

### Phase 2: Pool Integration (Week 2)
- [ ] Pool stratum connection manager
- [ ] Graceful algo switching (drain shares before switch)
- [ ] Multi-pool failover

### Phase 3: Admin UI (Week 3)
- [ ] Admin authentication
- [ ] Dashboard page
- [ ] Algo manager page
- [ ] Pool config page

### Phase 4: Testing & Deploy (Week 4)
- [ ] Integration tests
- [ ] Staging deployment
- [ ] Production rollout
- [ ] Monitoring setup

---

## 📊 Monitoring & Alerts

### Metrics to Track
- Current profitability per algo
- Switch frequency
- Time spent on each algo
- Revenue per algo (daily/weekly/monthly)
- Pool connection health

### Alert Conditions
- All pools for an algo down
- Profitability data stale (>15 min)
- Rapid switching (>3 switches in 1 hour)
- Manual override active for >24 hours

---

## 🎯 Success Metrics

| Metric | Target | Measurement |
|--------|--------|-------------|
| Profitability improvement | +15% vs static | Compare to single-algo baseline |
| Switch latency | <30 seconds | Time from decision to new shares |
| Uptime | 99.9% | Pool connectivity |
| Admin response time | <1 second | UI interactions |

---

## 📝 Notes

1. **ETC Mining**: Removed from primary focus due to Keccak output incompatibility
2. **NiceHash**: Kept as fallback for Keccak hashpower sales
3. **Focus**: Multi-algo GPU profitability switching is the main revenue driver
4. **NCL Expansion**: NCL slot now includes both AI tasks AND pool management logic

---

**Document Status**: PROPOSAL - Ready for review  
**Next Steps**: Approve design → Begin Phase 1 implementation
