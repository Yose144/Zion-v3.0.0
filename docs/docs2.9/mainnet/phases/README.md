# 📁 ZION MainNet Phases — Index

Tento adresář obsahuje detailní technické specifikace pro každou fázi vedoucí k MainNet launchi.

---

## 📊 Přehled Fází

| Fáze | Název | Priorita | Trvání | Status |
|------|-------|----------|--------|--------|
| 0 | [Reality Lock](PHASE_0_REALITY_LOCK.md) | P0 | 1 týden | 🔴 Not Started |
| 1 | [Spec Freeze](PHASE_1_SPEC_FREEZE.md) | P0 | 2 týdny | 🔴 Not Started |
| 2 | [Wallet MVP](PHASE_2_WALLET_MVP.md) | P0 | 4 týdny | 🔴 Not Started |
| 3 | [Explorer API](PHASE_3_EXPLORER_API.md) | P1 | 2-3 týdny | 🔴 Not Started |
| 4 | [Pool Hardening](PHASE_4_POOL_HARDENING.md) | P1 | 2-3 týdny | 🔴 Not Started |
| 5 | [Security](PHASE_5_SECURITY.md) | P1 | 4 týdny | 🔴 Not Started |
| 6 | [Rehearsal](PHASE_6_REHEARSAL.md) | P0 | 1-2 týdny | 🔴 Not Started |
| 7 | [Launch](PHASE_7_LAUNCH.md) | P0 | T+30 days | 🔴 Not Started |

---

## 📈 Timeline Visualization

```
        Week 1   2   3   4   5   6   7   8   9  10  11  12  13  14  15  16+
        ├───┼───┼───┼───┼───┼───┼───┼───┼───┼───┼───┼───┼───┼───┼───┼────
Phase 0 ████
Phase 1     █████████
Phase 2             ████████████████
Phase 3                 ████████████
Phase 4                         ████████████
Phase 5                                 ████████████████████
Phase 6                                                     ████████
Phase 7                                                             🚀──▶
```

---

## 🔗 Závislosti

```
┌─────────────┐
│  Phase 0    │──────────────────────────────────────────────┐
│ Reality Lock│                                              │
└──────┬──────┘                                              │
       │                                                     │
       ▼                                                     │
┌─────────────┐                                              │
│  Phase 1    │──────────────────────────────────────────┐   │
│ Spec Freeze │                                          │   │
└──────┬──────┘                                          │   │
       │                                                 │   │
       ├──────────────┬──────────────┐                   │   │
       ▼              ▼              ▼                   │   │
┌─────────────┐ ┌─────────────┐ ┌─────────────┐         │   │
│  Phase 2    │ │  Phase 3    │ │  Phase 4    │         │   │
│ Wallet MVP  │ │ Explorer API│ │ Pool Harden │         │   │
└──────┬──────┘ └──────┬──────┘ └──────┬──────┘         │   │
       │               │               │                 │   │
       └───────────────┴───────────────┘                 │   │
                       │                                 │   │
                       ▼                                 │   │
               ┌─────────────┐                           │   │
               │  Phase 5    │◀──────────────────────────┘   │
               │  Security   │                               │
               └──────┬──────┘                               │
                      │                                      │
                      ▼                                      │
               ┌─────────────┐                               │
               │  Phase 6    │◀──────────────────────────────┘
               │  Rehearsal  │
               └──────┬──────┘
                      │
                      ▼
               ┌─────────────┐
               │  Phase 7    │
               │   LAUNCH    │
               └─────────────┘
```

---

## 📋 Quick Links

### Documentation
- [Hlavní Roadmapa](../COMPLETE_ROADMAP_TO_MAINNET.md)
- [Deep Project Analysis](../DEEP_PROJECT_ANALYSIS.md)
- [MainNet Constitution](../MAINNET_CONSTITUTION.md)

### Per-Phase Resources
| Phase | Key Deliverables |
|-------|-----------------|
| 0 | PORT_MATRIX.yaml, docker-compose.mainnet.yml |
| 1 | genesis.json, Constitution update |
| 2 | zion-wallet crate, WALLET_GUIDE.md |
| 3 | OpenAPI spec, API handlers |
| 4 | Stress test results, VarDiff config |
| 5 | THREAT_MODEL.md, fuzzing results |
| 6 | RUNBOOK.md, rehearsal report |
| 7 | Launch announcement, monitoring setup |

---

## ⏱️ Effort Summary

| Fáze | Odhadovaný čas |
|------|----------------|
| Phase 0 | 14h |
| Phase 1 | 26h |
| Phase 2 | 70h |
| Phase 3 | 54h |
| Phase 4 | 56h |
| Phase 5 | 96-120h |
| Phase 6 | 40h |
| Phase 7 | Ongoing |
| **Celkem** | **~360-400h** |

**Při full-time práci:** ~10-12 týdnů  
**Při part-time práci:** ~16-20 týdnů

---

## 🎯 Current Focus

**Aktuální fáze:** None (roadmapa právě vytvořena)

**Další kroky:**
1. Review tohoto dokumentu
2. Potvrzení timeline a priorit
3. Zahájení Phase 0 (Reality Lock)

---

*Index aktualizován: 2026-02-03*
