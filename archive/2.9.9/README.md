# ZION Archive — v2.9.x Era

> **Historical artifacts from the pre-v3.0.0 era (2.9.5–2.9.9).**
>
> Kept for reference, audit trail, and migration evidence. Not actively maintained.
>
> Active development is in [`V3/`](../../V3/) and [`APP&WEB/`](../../APP&WEB/).

---

## Directory Layout

```
archive/2.9.9/
├── README.md              ← You are here
├── legacy-code/           ← Pre-V3 L1–L6 source code
│   ├── L1/                ← Old blockchain, miner, cosmic-harmony
│   ├── L2/                ← Old DAO, bridge, swap
│   ├── L3/                ← Old WARP relay
│   ├── L4/                ← Old OASIS
│   ├── L5/                ← Vision docs only
│   └── L6/                ← Vision docs only
├── docs/                  ← Historical documentation
│   ├── FORSITA.md
│   ├── STATUS.md
│   ├── StatusV3-Part2.md
│   ├── ROADMAP.md
│   ├── DEFI_ROADMAP.md
│   ├── LAUNCH_PLAN_20_6_2026.md
│   ├── MainnetLaunch.md
│   ├── MAINNETREADYrun.md
│   ├── MAINNETSTATUSW11.md
│   ├── MAINNET_FINAL_VERIFICATION_CHECKLIST.md
│   ├── revenue.md
│   ├── REVENUE_DEEP_ANALYSIS.md
│   ├── REVENUE_IMPLEMENTATION_PLAN.md
│   ├── REVENUE_SYSTEM_ROBUST.md
│   ├── Oasis.md
│   ├── zion.md
│   ├── ZION-CLI.md
│   ├── NCL_INTEGRATION.md
│   ├── DUALBOOT_GUIDE.md
│   ├── WINDOWS11_DOCKER_STACK.md
│   ├── HIRAN_V2.2_CLI_INTEGRATION.md
│   ├── HIRAN_V2.2_COMPLETION_PLAN.md
│   ├── planHv2.2train.md
│   ├── planTestingMainetDocker.md
│   ├── analzak2.6.md
│   ├── reportv3.md
│   ├── webupdate.md
│   └── test-results-*.md
└── ops/                   ← Runtime data, monitoring, tests
    ├── backups/             ← Backup archives
    ├── data/                ← Revenue journal (JSONL)
    ├── monitoring/          ← Prometheus/Grafana configs
    ├── tests/               ← Python integration/e2e tests
    └── tools/               ← Blog import, vscode-devin-chat
```

---

## What Moved Here (v2.9.9 Cleanup)

### Legacy Code (`legacy-code/`)
Pre-V3 implementation of L1–L6. Superseded by [`V3/`](../../V3/).

| Layer | Replacement | Status |
|-------|-------------|--------|
| L1 | `V3/L1/core/`, `V3/L1/pool/`, `V3/L1/miner/` | Active |
| L2 | `V3/L2/dao/`, `V3/L2/bridge/`, `V3/L2/atomic-swap/` | Active |
| L3 | `V3/L3/warp/` | Active |
| L4 | `V3/L4/oasis/` | Active |
| L5 | `V3/L5/free-world/` | Active |
| L6 | `V3/L6/issobella/` | Active |

### Documentation (`docs/`)
Historical plans, roadmaps, and analysis documents. For current status see [`StatusV3.md`](../../StatusV3.md).

### Operations (`ops/`)
Runtime artifacts that accumulated during 2.9.x testing. For current monitoring see [`V3/docker/`](../../V3/docker/).

---

## Why Keep This?

1. **Audit trail** — Evidence of development progression
2. **Migration reference** — When porting old features to V3
3. **Historical context** — Understanding decisions made in 2.9.x
4. **Training data** — Hiran model context

---

*Last updated: 2026-05-23*
*Cleanup commit: `525e7c38` — chore: cleanup root directory for v3.0.0 Mainnet Ready*
