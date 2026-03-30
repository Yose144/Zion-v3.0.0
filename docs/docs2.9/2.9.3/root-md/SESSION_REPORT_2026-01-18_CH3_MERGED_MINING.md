# SESSION REPORT: CH v3 Merged Mining Integration
**Date:** 2026-01-18  
**Focus:** Aktivace merged mining a profit switching  
**Status:** ✅ Implemented (ready for testing)

---

## 🎯 Summary

Aktivovány CH v3 revenue streams v poolu:
- ✅ **MultiChainSubmitter** integrován do hlavního poolu
- ✅ **Hash export** hookován do obou submit handlerů (XMRig + Stratum)
- ✅ **Pool config** aktualizován s CH v3 nastavením
- ✅ **Profit switching** připraveno (ERG, RVN pools)

---

## 📁 Modified Files

### 1. `src/pool/zion_pool_v2_9.py`
- ✅ Import `MultiChainSubmitter, AlgorithmType` přidán
- ✅ `self.hash_submitter` inicializován z ch3 config
- ✅ Pool connection na startup (`connect_all()`)
- ✅ Graceful disconnect na stop (`disconnect_all()`)
- ✅ Wire do `protocol_handler.hash_submitter`

### 2. `src/pool/network/protocol_handler.py`
- ✅ Atribut `self.hash_submitter = None` v konstruktoru
- ✅ Helper metoda `_export_ch3_hash()` pro merged mining
- ✅ Hook v XMRig submit handleru (method == "submit")
- ✅ Hook v Stratum submit handleru (method == "mining.submit")
- ✅ Export pouze pro high-value shares (diff >= 10000)

### 3. `config/pool_native_config.json`
- ✅ Sekce `ch3` s merged_mining a dynamic_gpu
- ✅ Sekce `ncl` s enabled a npu_allocation

---

## 🔧 CH v3 Architecture

```
┌─────────────────────────────────────────────────────────────┐
│           CH v3 PIPELINE + MERGED MINING                     │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  ZION Block Header                                           │
│       │                                                      │
│       ▼                                                      │
│  ┌─────────┐    ┌─────────┐    ┌────────────┐    ┌───────┐ │
│  │Keccak256│───►│SHA3-512 │───►│GoldenMatrix│───►│Fusion │ │
│  └────┬────┘    └────┬────┘    └────────────┘    └───┬───┘ │
│       │              │                               │      │
│       ▼              ▼                               ▼      │
│   ┌──────┐      ┌──────┐                        ┌──────┐   │
│   │ ETC  │      │ NXS  │                        │ ZION │   │
│   │2miners│     │nexus │                        │ Pool │   │
│   └──────┘      └──────┘                        └──────┘   │
│                                                             │
│   + Dynamic GPU Pool (profit switching):                    │
│   ┌──────┐  ┌──────┐  ┌──────┐  ┌──────┐                  │
│   │ ERG  │  │ RVN  │  │ KAS  │  │ ALPH │                  │
│   │2miners│ │2miners│ │2miners│ │2miners│                  │
│   └──────┘  └──────┘  └──────┘  └──────┘                  │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

## 📊 Revenue Streams

| Stream | Allocation | Source | Status |
|--------|------------|--------|--------|
| ZION (Cosmic Fusion) | 50%+ | Primary chain | ✅ Active |
| ETC (Keccak merged) | ~20% | etc.2miners.com:1010 | ✅ Configured |
| NXS (SHA3 merged) | ~5% | nexus.io | ⚠️ Disabled (no wallet) |
| Dynamic GPU | ~20% | ERG/RVN auto-switch | ✅ Configured |
| NCL AI Bonus | ~5% | npu_allocation: 30% | ✅ Active |

---

## 🚀 Deployment Steps

### 1. Update Production Config
```bash
ssh root@77.42.31.72
cd /root/zion-helsinki

# Update pool config with CH v3 settings
nano config/pool_config.json
```

Add to config:
```json
{
  "ch3": {
    "enabled": true,
    "merged_mining": {
      "etc": {
        "enabled": true,
        "pool": "etc.2miners.com",
        "port": 1010,
        "wallet": "YOUR_ETC_WALLET"
      },
      "nxs": {
        "enabled": false
      }
    },
    "dynamic_gpu": {
      "enabled": true,
      "mode": "auto",
      "coins": {
        "erg": {
          "enabled": true,
          "pool": "erg.2miners.com",
          "port": 8888,
          "wallet": "YOUR_ERG_WALLET"
        },
        "rvn": {
          "enabled": true,
          "pool": "rvn.2miners.com",
          "port": 6060,
          "wallet": "YOUR_RVN_WALLET"
        }
      }
    }
  },
  "ncl": {
    "enabled": true,
    "npu_allocation": 0.30
  }
}
```

### 2. Upload Updated Code
```bash
rsync -avz --delete \
  src/pool/zion_pool_v2_9.py \
  src/pool/network/protocol_handler.py \
  src/pool/ch3_hash_submitter.py \
  root@77.42.31.72:/root/zion-helsinki/src/pool/
```

### 3. Restart Pool
```bash
ssh root@77.42.31.72 "cd /root/zion-helsinki && ./restart_pool.sh"
```

### 4. Monitor
```bash
# Check logs for CH3 connections
ssh root@77.42.31.72 "tail -f /root/zion-helsinki/logs/pool.log | grep -i 'ch3\|merged\|etc\|erg'"
```

---

## 🔍 Testing

### Local Test (dry run)
```python
import asyncio
from src.pool.ch3_hash_submitter import MultiChainSubmitter, AlgorithmType, HashExport

async def test():
    wallets = {"ETC": "0x...", "ERG": "9f..."}
    submitter = MultiChainSubmitter(wallets)
    submitter.configure_defaults()
    
    # Don't actually connect in test
    print(f"Configured pools: {list(submitter.pools.keys())}")
    
asyncio.run(test())
```

### Production Test
1. Mine with diff >= 10000
2. Check logs for "CH3 hash exported to ETC"
3. Verify shares on 2miners dashboard

---

## ⚠️ Notes

1. **Wallet Setup Required**: Before enabling merged mining, you need:
   - ETC wallet (MetaMask or hardware)
   - ERG wallet (ergoplatform.org)
   - RVN wallet (RVN core or exchange)

2. **Profit Switching**: Currently manual. Auto mode will use WhatToMine API.

3. **Share Threshold**: Only shares with diff >= 10000 are exported (to avoid spam).

4. **Async Design**: All hash exports are fire-and-forget (`asyncio.create_task`) to not block mining.

---

## 📈 Next Steps

1. [ ] Configure production wallets for ETC/ERG/RVN
2. [ ] Deploy updated code to 77.42.31.72
3. [ ] Test merged mining with real shares
4. [ ] Enable profit switching (WhatToMine API)
5. [ ] Monitor revenue from external pools

---

**Session Duration:** ~30 min  
**Commits:** Ready for commit  
**Production Impact:** None until deployed with wallets

---

🌟 *"Five streams, one compute cycle."* — CH v3 Vision
