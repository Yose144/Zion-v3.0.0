# ZION 2.9.7 — MainNet Readiness (Unified)

> Datum aktualizace: 2026-03-03 (scope update: CHv4 od genesis, GPU kernels, Revenue, canary reset)  
> Účel: jednotný stav pro pre-mainnet rozhodnutí (single source of truth).

---

## 1) Aktuální stav

- 2.9.7 codebase je technicky stabilní a připravená jako pre-mainnet baseline.
- 168h stability test byl dokončen bez kritických chyb ✅
- CHv4 aktivní od genesis (`CHV4_NPU_FORK_HEIGHT = 0`), `block.rs` + pool `validator.rs` používají height-aware dispatch.
- CUDA + OpenCL GPU kernely mají CHv4 NPU Mixing implementován ✅ 2026-03-03
- Python GPU miner dispatch opraven na `chv4=1` vždy ✅ 2026-03-03
- **Scope aktualizace 2026-03-03:** Revenue wallets/canary a Multi-algo scheduler jsou **P0 v 2.9.7** (ne v 2.9.8). E2E test (F-04) a genesis ceremony (B-CRIT-03) zbývají.

---

## 2) Co je hotové

- L1/L2/L3 build a klíčové testy běží zeleně.
- CHv4 kompatibilní aliasing a pool/miner wiring je integrovaný.
- NCL RPC flow (`ncl.register`, `ncl.get_task`, `ncl.submit`, `ncl.status`) je aktivní.
- NCL runtime guardy jsou doplněny (enable flag, input validation, bounded rounds, metriky).
- Revenue scheduler/proxy/switcher jsou v repo implementované.- **Pool share validator** používá `cosmic_harmony_with_height()` — CHv4 shares (≥ 200 000) validovány správně. ✅ 2026-03-03
- **block.rs** height-aware dispatch `cosmic_harmony_with_height()`. ✅ 2026-03-03
- **Phase 1.12** — 100 miners stress test PASS (100/100, p99=9ms). ✅ 2026-03-03
---

## 3) Blokery před MainNet launch

### B-CRIT-01 — CHv4 produkční upgrade

- [x] Activation policy finalizována — `CHV4_NPU_FORK_HEIGHT = 0` od genesis — `docs/2.9.7/CHV4_ACTIVATION_POLICY.md` ✅ 2026-03-03
- [x] Production hardening — `block.rs` volá `cosmic_harmony_with_height()` ✅ 2026-03-03
- [x] Pool share validator — height-aware dispatch `cosmic_harmony_with_height()` ✅ 2026-03-03
- [x] GPU CUDA kernel — CHv4 NPU Mixing (Phase 5) v `cosmic_harmony_v3.cu` ✅ 2026-03-03
- [x] GPU OpenCL kernel — CHv4 NPU Mixing (Phase 5) v `cosmic_harmony_v3.cl` ✅ 2026-03-03
- [x] Python GPU miner — `chv4_flag = np.uint32(1)` vždy aktivní ✅ 2026-03-03
- [x] E2E production run — `tests/chv4_e2e.rs` 11/11 PASS (CHv4 od genesis, deterministický hash, share accepted) ✅ 2026-03-03

### B-CRIT-02 — Revenue produkční aktivace (P0 v 2.9.7)

- [ ] Nastavit produkční wallet adresy v revenue configu (`config/ch3_revenue_settings.json`).
- [ ] Zapnout buyback flow s limity rizika (slippage, cooldown, max order size).
- [ ] Multi-algo scheduler aktivace: 50/25/25 PerMiner mode na Helsinki poolu.
- [ ] 72h revenue canary run s auditovatelným payout ledgerem.

### B-CRIT-03 — Genesis + freeze artefakty

- Finalizovat genesis ceremony artefakty a hash sign-off.
- Dopsat/podepsat freeze dokumentaci (`MAINNET_CONSTITUTION`, docker SHA manifesty, sign-off tabulka).

---

## 4) Go/No-Go pravidlo

Go pro mainnet pouze pokud:

1. `B-CRIT-01..03` jsou uzavřeny.
2. Release checklist pro 2.9.7 je kompletně podepsán.
3. Canary běhy (stability + revenue) mají PASS bez kritických incidentů.

---

## 5) Referenční dokumenty

- `docs/2.9.7/2.9.7.md`
- `docs/2.9.7/CODE_FREEZE.md`
- `docs/2.9.7/STABILITY_LOG.md`
- `docs/2.9.7/MAINNET_CHV3_CUDA_REVENUE.md`
- `docs/2.9.7/MAINNET_GO_NO_GO.md`
- `docs/2.9.7/RELEASE_2.9.7_PRODUCTION_BASE.md`
- `docs/WP3.0/README.md`
