# DASHV2 — Zion Dashboard v2 Master Plan

> **Status:** Draft | **Last updated:** 2026-06-02 | **Author:** Devin
> **Scope:** Complete audit of the current dashboard, definition of what "full Zion" means, and a phased roadmap to get there.

---

## 1. Executive Summary

The current dashboard (`dashboard/app.py` + `dashboard.html` + `dashboard.js`) is functional but has a critical architectural flaw: **it determines service health primarily by log-file scraping**, not by real-time healthchecks. This causes false negatives (e.g., Node 1 shows "not running" despite being alive and serving RPC/metrics on 4 ports) and makes the dashboard unreliable as an operational tool.

**DASHV2** is the plan to evolve the dashboard from a "log viewer with pretty charts" into a **true operational control plane** — one that healthchecks services correctly, understands dependencies, surfaces actionable alerts, and gives a single-screen view of whether the entire Zion stack is production-ready.

---

## 2. What "Full Zion" Means

Zion is a multi-layer monorepo. The dashboard must represent the health of every production-grade component. Below is the canonical stack decomposition.

### 2.1 L1 — Core Layer (source of chain truth)

| Service | Binary | Ports | Role | Dependency |
|---|---|---|---|---|
| **Node 1** (Genesis) | `zion-core` / `node` | 8333 P2P, 8443 RPC, 8445 WS, 9115 metrics | Source of truth: validates blocks, manages mempool, P2P sync | None |
| **Node 2** (Follower) | `zion-core` / `node` | 8334 P2P, 8446 RPC, 8447 WS, 9116 metrics | Backup validator, syncs from Node 1 | Node 1 P2P |
| **Pool** | `zion-pool` / `server` | 8444 stratum | Miner coordination, block templates, share validation, PPLNS payout | Node 1 RPC |
| **Miner 1** | `zion-miner` | — | CPU/GPU hash production | Pool 8444 |
| **Miner 2** (GPU) | `zion-miner` | — | GPU hash production (optional second instance) | Pool 8444 |

### 2.2 L2 — Bridges & DeFi

| Service | Binary / Dir | Ports | Role | Dependency |
|---|---|---|---|---|
| **Bridge** | `V3/L2/bridge` | HTTP API | L1 ↔ EVM relay, lock/mint/burn | Node 1 RPC |
| **DAO** | `V3/L2/dao` | HTTP API | Governance, treasury, proposals, voting | Node 1 RPC |
| **Atomic Swap** | `V3/L2/atomic-swap` | HTTP API | HTLC swaps, refund watcher, escrow | Node 1 RPC |
| **Warp** | `V3/L3/warp` | HTTP API | Cross-chain relay daemon | Node 1 RPC |

### 2.3 L3 — AI, Web & Apps

| Service | Binary / Dir | Ports | Role | Dependency |
|---|---|---|---|---|
| **AI Native** | `HiranV2.2/inference/serve.py` | 8002 | Local Hiran v2.2 inference (Ollama ROCm) | Ollama 11434 |
| **Hiranyagarbha** | `scripts/start-hiranyagarbha.sh` | 8001 | Agent orchestrator, task queue | AI Native 8002 |
| **Web** | `APP&WEB/website-v2.9` | 3000 / 80 | Public website, API routes | Node 1 RPC |
| **Dashboard** | `dashboard/app.py` | 8766 | This UI | Node 1 RPC, Pool, all L2/L3 |
| **NCL** | `scripts/start-ncl.sh` | 8888 | Neural consensus layer | Node 1 RPC |

### 2.4 Infrastructure & Operations

| Service | Dir / Script | Ports | Role | Dependency |
|---|---|---|---|---|
| **Prometheus** | `V3/docker/...` | 9090 | Metrics aggregation | All L1–L3 metrics ports |
| **Grafana** | `V3/docker/...` | 3000 (if standalone) | Metrics dashboards | Prometheus |
| **Backup Daemon** | `scripts/backup-chain.sh` | — | Scheduled datadir + DB dumps | Node 1 state DB |
| **Swap Escrow** | `scripts/start-atomic-swap.sh` | — | On-chain escrow key persistence | Atomic Swap daemon |
| **OpenClaw Wrapper** | `scripts/openclaw-hiran-wrapper/` | — | Local Hiran CLI bridge for coding-agent | AI Native 8002 |

---

## 3. Current Dashboard Audit

### 3.1 What works well

| Feature | Status | Notes |
|---|---|---|
| Auto-refresh | OK | 5s interval, tab-aware |
| Service list | OK | 17 services registered |
| Metrics history | OK | 60-sample ring buffer, persisted |
| Mempool panel | OK | TX count, fees, transaction table |
| Explorer tab | OK | Block list, detail modal, CSV export |
| Alerts tab | OK | Alert history, severity levels |
| Log terminal | OK | Tail + grep, service switching |
| CLI runner | OK | `zion` CLI via HTTP |
| Charts C–F (new) | OK | Health timeline, payout charts, sparkline, topology |

### 3.2 Critical flaws

| # | Flaw | Impact | Root Cause |
|---|---|---|---|
| **F1** | **Node shows "not running" when it is alive** | Operator thinks chain is down; may restart unnecessarily | `parse_node_log()` uses `tail_log("node1.log")`; node binary writes to timestamped file `node1.YYYYMMDD_HHMMSS.log` instead |
| **F2** | Healthcheck is log-scraping, not port/RPC | False negatives for any service that redirects stdout to a rotated log | `check_service_health()` calls `parse_*_log()` as primary source of "running" state |
| **F3** | No dependency awareness | Topology map shows nodes but doesn't propagate failure; if Node 1 dies, Pool/Bridge/DAO still appear "green" if their own logs exist | No dependency graph in health logic |
| **F4** | No alert severity by layer | All alerts look the same; Node 1 down = same visual weight as AI Native down | No `severity` field computed from service `kind` or `level` |
| **F5** | No "stack readiness" score | Operator can't tell at a glance if mainnet can launch | No aggregate health metric |
| **F6** | Payout charts are empty until first block | Donut shows blank canvas; no placeholder state | `renderPayoutDonut` returns early on empty data (patched in v6) |
| **F7** | Service health timeline only shows 11 hardcoded services | New services (Node 2, Warp, NCL, Oasis, Free World, Issobella) are invisible | `SERVICE_HISTORY_LABELS` is static |
| **F8** | Topology map uses hardcoded node positions | Adding a new service requires editing JS | Layout is static `x,y` in `TOPO_NODES` |
| **F9** | No GPU/VRAM monitoring for Miner | Dashboard shows hashrate but not temperature, GPU util, ROCm status | No integration with `rocm-smi` or miner telemetry endpoint |
| **F10** | AI Native health only checks port 8002 | Doesn't verify Ollama backend or model load status | `get_ai_services_status()` only does TCP to 8002 |

---

## 4. DASHV2 Vision

### 4.1 Core Principles

1. **Health is port/RPC/HTTP, not logs.** Logs are for forensics, not liveness.
2. **Dependencies propagate.** If Node 1 is down, everything that depends on it is visually degraded.
3. **Severity is contextual.** L1 down = critical. L3 down = warning.
4. **Readiness is a score.** One number (0–100%) tells you if the stack is launchable.
5. **Auto-heal where safe.** Restart miner if hashrate = 0. Alert, don't restart, for L1.

### 4.2 New Architecture

```
┌─────────────────────────────────────────────┐
│           Dashboard UI (v2)                 │
│  ┌─────────┐ ┌─────────┐ ┌──────────────┐  │
│  │ Readiness│ │ Topology│ │ Health Timeline│ │
│  │  Score   │ │  Map    │ │   (24h)      │  │
│  └─────────┘ └─────────┘ └──────────────┘  │
│  ┌─────────┐ ┌─────────┐ ┌──────────────┐  │
│  │  L1     │ │  L2     │ │  L3 + Infra  │  │
│  │  Cards  │ │  Cards  │ │   Cards      │  │
│  └─────────┘ └─────────┘ └──────────────┘  │
└─────────────────────────────────────────────┘
                    ▲
                    │ WebSocket / SSE
┌─────────────────────────────────────────────┐
│      Dashboard Backend (app.py v2)            │
│  ┌─────────────────────────────────────┐    │
│  │   Health Engine (ports + RPC + HTTP)│    │
│  │   • TCP connect per port            │    │
│  │   • RPC call for nodes              │    │
│  │   • HTTP GET for L2/L3              │    │
│  └─────────────────────────────────────┘    │
│  ┌─────────────────────────────────────┐    │
│  │   Dependency Resolver               │    │
│  │   • If Node 1 down → Pool yellow  │    │
│  │   • If Pool down → Miners red     │    │
│  └─────────────────────────────────────┘    │
│  ┌─────────────────────────────────────┐    │
│  │   Alert Engine (severity + dedup) │    │
│  │   • Critical / Warning / Info      │    │
│  │   • Throttle repeats (5 min)       │    │
│  └─────────────────────────────────────┘    │
│  ┌─────────────────────────────────────┐    │
│  │   Metrics Sampler (5s)              │    │
│  │   • Persist to JSON               │    │
│  │   • History ring buffer             │    │
│  └─────────────────────────────────────┘    │
└─────────────────────────────────────────────┘
```

---

## 5. Phased Roadmap

### Phase 1 — Health Engine Fix (Critical)
**Goal:** Dashboard never lies about service liveness.

- [ ] **H1:** Rewrite `check_service_health()` to use port connectivity + RPC/HTTP first, log scraping as fallback.
- [ ] **H2:** Fix `parse_node_log()` to glob `node1.*.log` and pick the most recent, not hardcoded `node1.log`.
- [ ] **H3:** Add `SERVICE_REGISTRY` entries for missing services (Node 2, Warp, NCL, Oasis, Free World, Issobella).
- [ ] **H4:** `all_services_health()` must return `status` derived from `port_check` or `rpc_check`, not `log_age`.
- [ ] **H5:** Add per-service `health_method` field in registry: `tcp`, `rpc`, `http`, `process`, `log`.

### Phase 2 — Dependency Graph (High)
**Goal:** Topology and health timeline understand service dependencies.

- [ ] **D1:** Extend `SERVICE_REGISTRY` with `depends_on: ["node1"]` etc.
- [ ] **D2:** Health engine computes "derived status": if dependency is down, dependent service gets `degraded` or `unknown`.
- [ ] **D3:** Topology map edges glow only if both endpoints are healthy AND the dependency is satisfied.
- [ ] **D4:** Health timeline rows are ordered by dependency depth (L1 first, then L2, then L3).

### Phase 3 — Readiness Score & Severity (High)
**Goal:** One number tells the operator if mainnet can launch.

- [ ] **R1:** Compute `readiness_score` (0–100%) weighted by layer:
  - L1 = 50% (Node 1 20%, Node 2 10%, Pool 10%, Miners 10%)
  - L2 = 25% (Bridge 8%, DAO 8%, Atomic Swap 5%, Warp 4%)
  - L3 = 15% (AI 5%, Web 5%, Hiranyagarbha 3%, NCL 2%)
  - Infra = 10% (Prometheus 4%, Grafana 3%, Backup 3%)
- [ ] **R2:** Score is red (<60), yellow (60–85), green (>85).
- [ ] **R3:** Alert severity auto-derived from layer: L1 = critical, L2 = warning, L3 = info.
- [ ] **R4:** Alert deduplication: same alert within 5 min does not re-notify.

### Phase 4 — UI/UX Polish (Medium)
**Goal:** Dashboard is beautiful, responsive, and actionable.

- [ ] **U1:** Replace static topology layout with force-directed/auto-layout (or responsive grid).
- [ ] **U2:** Add GPU monitoring card: temp, VRAM, hashrate, fan % (read from `rocm-smi` or miner telemetry).
- [ ] **U3:** AI Native card shows model name, VRAM usage, backend (ROCm/CUDA/CPU), queue depth.
- [ ] **U4:** Add "Auto-heal" toggle: safe actions (restart miner) happen automatically; L1 actions require confirmation.
- [ ] **U5:** Mobile-friendly: cards stack vertically, charts scale, timeline horizontal scroll.
- [ ] **U6:** Dark/light theme toggle (persisted in localStorage).

### Phase 5 — Observability Integration (Medium)
**Goal:** Dashboard is not a silo; it feeds into Prometheus/Grafana.

- [ ] **O1:** Dashboard exposes `/metrics` endpoint in Prometheus format (service up/down, readiness score).
- [ ] **O2:** Service history JSON is also written as Prometheus-compatible time-series file.
- [ ] **O3:** Alert history is queryable via API for external PagerDuty/Opsgenie integration.

### Phase 6 — Predictive & Anomaly (Future)
**Goal:** Catch problems before they become outages.

- [ ] **P1:** Detect hashrate drop trend (miner failing, not just 0).
- [ ] **P2:** Detect mempool growth rate (spam or bug).
- [ ] **P3:** Detect block time drift (consensus risk).
- [ ] **P4:** AI-driven log anomaly detection (optional, Hiran-powered).

---

## 6. Service Registry Specification (v2)

Each service should have this schema:

```json
{
  "id": "node1",
  "name": "Node 1 (Genesis)",
  "icon": "🔷",
  "level": "L1",
  "kind": "node",
  "purpose": "Source of chain truth...",
  "ports": { "p2p": 8333, "rpc": 8443, "ws": 8445, "metrics": 9115 },
  "depends_on": [],
  "health_method": "rpc",
  "health_endpoint": "http://127.0.0.1:8443/health",
  "log": "node1",
  "start": "start-node1",
  "severity": "critical",
  "autoheal": false
}
```

| Field | Description |
|---|---|
| `health_method` | `tcp`, `rpc`, `http`, `process`, `log` |
| `health_endpoint` | URL to call if method is `http` or `rpc` |
| `severity` | `critical`, `warning`, `info` — affects alerting |
| `autoheal` | If `true`, dashboard may auto-restart on failure |
| `depends_on` | List of service IDs this service needs to function |

---

## 7. Healthcheck Algorithm (v2)

```python
def check_service_health_v2(svc):
    method = svc.get("health_method", "log")
    
    if method == "rpc":
        # Try RPC health endpoint
        ok, detail = rpc_check(svc["health_endpoint"])
        if ok: return {"alive": True, "status": "running", "detail": detail}
    
    if method == "http":
        # Try HTTP health endpoint
        ok, detail = http_check(svc["health_endpoint"])
        if ok: return {"alive": True, "status": "running", "detail": detail}
    
    if method == "tcp":
        # Try all declared ports
        for name, port in svc.get("ports", {}).items():
            if not tcp_check("127.0.0.1", port):
                return {"alive": False, "status": "stopped", "detail": f"{name}:{port} closed"}
        return {"alive": True, "status": "running", "detail": "all ports open"}
    
    if method == "process":
        # Check PID file or pgrep
        pid = read_pid_file(svc["id"])
        if pid and process_alive(pid): 
            return {"alive": True, "status": "running", "detail": f"pid={pid}"}
    
    # Fallback: log scraping (legacy)
    return check_service_health_legacy(svc)
```

**Dependency propagation:**
```python
def compute_derived_status(svc, all_health):
    my_health = check_service_health_v2(svc)
    if not my_health["alive"]:
        return my_health  # Already dead
    
    for dep_id in svc.get("depends_on", []):
        dep = find_health(all_health, dep_id)
        if dep and not dep["alive"]:
            return {
                "alive": False,  # Functionally dead
                "status": "degraded",
                "detail": f"Dependency {dep_id} is down",
                "ports_open": my_health.get("ports_open", []),
                "derived": True
            }
    return my_health
```

---

## 8. File Locations

| File | Current Role | DASHV2 Role |
|---|---|---|
| `dashboard/app.py` | HTTP server, log scrapers, API handlers | Health engine v2, dependency resolver, readiness score |
| `dashboard/dashboard.html` | Static HTML with Tailwind | Same + new v2 panels (readiness score, GPU card, AI card) |
| `dashboard/dashboard.js` | Client-side rendering, charts | Same + dependency-aware topology, auto-refresh with SSE |
| `dashboard/services.json` | Service registry (partial) | **Canonical registry v2** with `health_method`, `depends_on`, `severity` |
| `dashboard/DASHV2.md` | — | **This document** |
| `V3/data/service-health-history.json` | 24h health history | Same format, extended to all services |

---

## 9. Immediate Next Steps

1. **Commit this plan** to `dashboard/DASHV2.md`.
2. **Start Phase 1** by rewriting `check_service_health()` in `app.py` to use TCP/RPC first.
3. **Fix Node 1 log glob** (`node1.*.log`) so the current dashboard stops lying.
4. **Audit `services.json`** against Section 2.1–2.4 and add missing services.
5. **Add `health_method` and `depends_on`** to every registry entry.

---

## 10. Appendix: Known Working Commands

```bash
# Build workspace
cargo check --manifest-path V3/Cargo.toml --workspace

# Run node
ZION_NODE_ID=local-node ZION_P2P_BIND=0.0.0.0:8333 ZION_RPC_BIND=0.0.0.0:8443 cargo run --release --manifest-path V3/Cargo.toml -p zion-core --bin node

# Run pool
ZION_POOL_BIND=0.0.0.0:8444 ZION_NODE_RPC_ADDR=127.0.0.1:8443 cargo run --release --manifest-path V3/Cargo.toml -p zion-pool --bin server

# Start dashboard
bash dashboard/start-dashboard.sh

# Test node health
curl -s http://127.0.0.1:8443/health
curl -s http://127.0.0.1:9115/metrics | head
```

---

*End of DASHV2 plan. Ready for implementation.*
