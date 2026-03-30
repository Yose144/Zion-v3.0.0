# 🚀 ZION v2.8.4 – Release Plan (ASIC‑only)

Date: 2025-10-30
Owner: ZION Core Team
Status: Draft

## Goals

- Single, unified blockchain backend (no dual maintenance)
- ASIC‑resistant mining only (Cosmic Harmony primary; RandomX/Yescrypt/Autolykos v2 optional)
- Clean operator migration with clear docs and tests
- Premine and genesis fully validated (15.78B ZION)

---

## Scope Overview

1) Blockchain Unification
- Migrate API and Wallet to `src/core/new_zion_blockchain.py`
- Add deprecation warning to `core/real_blockchain.py`; plan removal in next release
- Verify DB schema compatibility and chain state integrity

2) Mining Algorithms (ASIC‑only)
- Registry at `src/core/algorithms.py` (cosmic_harmony, randomx, yescrypt, autolykos_v2)
- Default = `cosmic_harmony`; no SHA256 fallback anywhere
- RPC/API endpoint to expose `list_supported()` for ops visibility

3) Genesis/Premine Validation
- Test: premine total = 15,782,857,143 ZION; category asserts
- Test: genesis creation on testnet boots with premine balances

4) Pool + Dashboard
- Pool config difficulties for supported algos; default cosmic_harmony
- Dashboard algo selector limited to ASIC‑only set (remove SHA256)
- Websocket metrics include current algorithm and hashrate/difficulty

5) Docs & Operator Experience
- Release Notes v2.8.4 and Migration Guide
- Build guides for native libs (Cosmic Harmony C++; pyrx/yescrypt/pyautolykos2)
- Security statement: ASIC‑only policy, no SHA256 fallback

6) CI/CD & Packaging
- Lint/type/tests green; optional C++ build job on Linux/macOS
- Docker images updated; include libcosmicharmony or documented bind-mount

---

## Work Items

- Unify blockchain backend
  - [ ] api: switch imports to `src/core/new_zion_blockchain.py`
  - [ ] wallet: switch imports; smoke test basic ops
  - [ ] add DeprecationWarning in `core/real_blockchain.py`
  - [ ] plan removal in v2.8.5

- RPC/API
  - [ ] Add `GET /algorithms` or include in `/blockchain/info` → expose `list_supported()`
  - [ ] Document response in API README

- Algorithms
  - [ ] Ensure `src/core/algorithms.py` has no SHA256 code/mentions
  - [ ] Add unit tests for registry behavior (availability, errors)

- Pool & Dashboard
  - [ ] Update difficulties in `src/core/seednodes.py` (pool config) if needed
  - [ ] Remove SHA256 from any GUI lists; ensure defaults to `cosmic_harmony`
  - [ ] Show algorithm in metrics and Dashboard status panel

- Genesis/Premine
  - [ ] Add test: premine totals and categories
  - [ ] Add test: genesis block on testnet (init path)

- Docs
  - [ ] `docs/2.8.4/RELEASE_NOTES_v2.8.4.md`
  - [ ] `docs/2.8.4/NODE_MIGRATION_GUIDE_v2.8.4.md`
  - [ ] Update `COSMIC_HARMONY_ALGORITHM.md` (done)
  - [ ] Update `BLOCKCHAIN_UNIFICATION_PLAN.md` (done)

- Build & Native Libs
  - [ ] Doc: compile `libcosmicharmony.{so,dylib}`
  - [ ] Doc: install `pyrx` (RandomX), `yescrypt` python binding, `pyautolykos2`
  - [ ] Optional: `extras` section in requirements.txt

- CI/CD
  - [ ] Ensure tests/lint run in CI
  - [ ] Optional job to build C++ lib on Linux/macOS

- Cleanup
  - [ ] Remove/adjust legacy scripts that mention `SHA256 fallback` (or mark legacy)
  - [ ] Replace messages in `zion/mining/randomx_engine.py`, `zion/mining/zion-nicehash-miner.py`, `core/real_blockchain.py`, etc.

- Security & Audit
  - [ ] Internal review checklist for ASIC‑only posture
  - [ ] Prepare brief for external audit (Cosmic Harmony + integration)

---

## Timeline (4 weeks)

Week 1 – Core migration
- API/Wallet → new blockchain, deprecate legacy
- Add RPC algo info endpoint
- Unit tests for algorithms registry

Week 2 – Tests & Pool/UI
- Genesis/premine tests, testnet boot path
- Pool difficulty sanity, Dashboard updates, metrics

Week 3 – Docs & Packaging
- Release Notes + Migration Guide
- Native libs build docs
- Docker images refresh

Week 4 – Hardening
- CI pipeline finalize, legacy cleanup
- Performance smoke (C++ vs Python), publish ranges
- Security review; schedule external audit

---

## Risks & Mitigations

- Missing native libs → Node mines only with available algos; clearly documented
- API/Wallet differences → Compatibility tests + deprecation cycle
- Performance variance → Provide C++ build steps; Python mode for dev only
- Operator confusion → Clear migration guide and RPC `/algorithms` endpoint

---

## Acceptance Criteria

- Single backend used across API, Wallet, WARP, Pool
- No SHA256 mining fallback anywhere in the codebase
- RPC exposes supported algorithms; Dashboard shows active algorithm
- Genesis tests pass; totals match 15.78B ZION
- Docs up to date; CI green on lint/type/test
