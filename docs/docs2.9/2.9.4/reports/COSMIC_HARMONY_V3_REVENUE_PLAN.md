# 🛠️ Cosmic Harmony v3: Revenue Rebalancing Plan

**Date:** 31. ledna 2026
**Target:** Adjust revenue distribution models in ZION Universal Miner v2.9.5.

## 🎯 New Revenue Target Distribution

The goal is to shift focus from merged mining (legacy chains) towards AI Compute (Native ZION feature).

| Component | Old Target | **New Target** | Notes |
|-----------|------------|----------------|-------|
| 🪙 **ZION Mining** | 50%+ | **50%** | Core block reward + transaction fees. |
| 🔗 **ETC Merged** | ~20% | **5%** | Reduced focus. *Note: Unconfirmed on external pools via Python.* |
| 🔗 **NXS Merged** | ~5% | **5%** | Maintained as is for stability. |
| 💎 **Dynamic GPU** | ~20% | **20%** | Profit switching (ERG/RVN/KAS) remains key component. |
| 🧠 **NCL AI** | ~5% | **20%** | **Major Increase.** Utilizing NPU/GPU for AI tasks is prioritized. |

## 📋 Implementation Steps

### 1. Update Display & UI
- [x] Update Miner Start Banner in `main.rs`.
- [x] Update documentation to reflect new economics.

### 2. Adjust Logic configuration
- [x] **NCL AI:** Increase task checking frequency or batch size to achieve ~20% allocation. (Updated default to 0.4)
- [ ] **ETC/NXS:** Verify the "unconfirmed" status for external pools and potentially cap hashrate allocation if controllable, or simply update estimates if it's passive merged mining.

### 3. Verification
- [ ] Run miner and observe NCL task acceptance rate.
- [ ] Verify impact on total revenue calculation models.

---

**Authorized by:** ZION Core Dev
**Status:** In Progress
