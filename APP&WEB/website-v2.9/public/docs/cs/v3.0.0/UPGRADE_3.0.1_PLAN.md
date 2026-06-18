# ZION V3 — Plán upgradu 3.0.1

> **Datum:** 3. 6. 2026
> **Cíl:** Uzavřít známé mezery, aktivovat nevyužitý kód a dodat CI/CD před veřejným mainnet launch (31. 12. 2026).
> **Princip:** Žádné nové L4/L5/L6 funkce, dokud L1/L2/L3 nejsou 100% production-ready.

---

## 1. Audit: Dokumentace vs Kód

### 1.1 Co funguje a matchuje s docs ✅

| Oblast | Stav v docs | Stav v kódu | Verdikt |
|--------|-------------|-------------|---------|
| L1 konsenzus (Ekam Deeksha v2) | ✅ Hotovo | ✅ 95+ testů | Match |
| L1 core (node, P2P, RPC, mempool) | ✅ Hotovo | ✅ 500 testů | Match |
| L1 pool (stratum, PPLNS, payouts) | ✅ Hotovo | ✅ 91 testů | Match |
| L1 miner (CPU/GPU, OpenCL/CUDA) | ✅ Hotovo | ✅ 59 testů | Match |
| Fee split 89/5/5/1 z genesis | ✅ Hotovo | ✅ Kód + testy | Match |
| CLI (`zion` binary) | ✅ Hotovo | ✅ 20+ subcommandů | Match |
| Monitoring (Prometheus + Grafana) | ✅ Hotovo | ✅ 3 dashboardy | Match |
| Desktop dashboard (Tauri v2) | ✅ Hotovo | ✅ `APP&WEB/desktop-dashboard/` | Match |
| Core+Edge topologie | ✅ Hotovo | ✅ Docker compose + systemd | Match |
| Alert rules (Prometheus) | ✅ Hotovo | ✅ 10+ pravidel | Match |

### 1.2 Co je v kódu jako placeholder / nesedí s docs 🔧

| # | Oblast | Problém | Priorita |
|---|--------|---------|----------|
| G1 | Bridge Base mainnet | Dummy adresy, mainnet disabled | P0 |
| G2 | NCL ONNX backend | Dead code — neaktivní | P0 |
| G3 | OASIS konfigurace | Ignoruje path, vrací default | P1 |
| G4 | WARP contract adresy | Dummy adresy ve všech adaptérech | P1 |
| G5 | Alertmanager notifikace | Žádný real channel | P1 |
| G6 | Tailscale ACL | Šablona neaplikovaná | P2 |
| G7 | CI/CD | Žádný GitHub Actions workflow | P1 |
| G8 | P2P DNS seeds | Jen hardcoded seed peers | P2 |
| G9 | GPU auto-tuning | Ruční nastavení backendu | P2 |

---

## 2. Scope 3.0.1

> **"Ne nové featury, ale uzavřít existující mezery."**

3.0.1 je *polish release* — všechny P0/P1 mezery musí být uzavřeny nebo mitigovány.

---

## 3. Konkrétní úkoly

### 3.1 P0 — Blockers (musí být hotovo)

- **T1:** Bridge Base mainnet readiness — reálné adresy, enable mainnet
- **T2:** NCL ONNX backend activation — připojit `ort` crate, implementovat inference

### 3.2 P1 — High Priority

- **T3:** OASIS config fix — načítání z file místo default
- **T4:** WARP contract addresses — reálné adresy pro všechny chainy
- **T5:** Alertmanager notifikace — aktivovat Discord/Slack/Email
- **T6:** CI/CD pipeline — GitHub Actions pro V3 workspace

### 3.3 P2 — Nice-to-have

- **T7:** Tailscale ACL aplikace
- **T8:** P2P DNS seed discovery
- **T9:** GPU auto-tuning (backend + work_size)

---

## 4. Acceptance Criteria

| Úkol | Metrika |
|------|---------|
| T1 | `cargo test -p zion-bridge --test mainnet_readiness` prochází |
| T2 | ONNX inference testy procházejí s `ort` feature gate |
| T3 | OASIS config načítá z TOML file |
| T4 | WARP adapter testy procházejí s reálnými adresami |
| T5 | Alertmanager odesílá notifikace do alespoň 1 channelu |
| T6 | CI prochází: build, test, clippy, fmt, audit |
| T7 | Tailscale ACL aplikována na všechny uzly |
| T8 | P2P discovery funguje bez hardcoded seeds |
| T9 | GPU miner auto-detekuje backend a optimalizuje work_size |

---

*ZION V3 Upgrade Plan 3.0.1 • Veřejný přehled • aktualizováno 3. 6. 2026*
