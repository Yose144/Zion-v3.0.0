# ZION 2.9.7 — MainNet Readiness (Unified)

> Datum aktualizace: 2026-03-03  
> Účel: jednotný stav pro pre-mainnet rozhodnutí (single source of truth).

---

## 1) Aktuální stav

- 2.9.7 codebase je technicky stabilní a připravená jako pre-mainnet baseline.
- 168h stability test byl dokončen bez kritických chyb (operator-reported; dashboard uptime green).
- CHv4 Phase A/B je implementováno v kódu, ale před mainnetem je nutné dokončit produkční upgrade path a activation policy.
- Revenue systém je implementován, ale produkční aktivace (wallets + buyback + canary payouts) je stále otevřená.

---

## 2) Co je hotové

- L1/L2/L3 build a klíčové testy běží zeleně.
- CHv4 kompatibilní aliasing a pool/miner wiring je integrovaný.
- NCL RPC flow (`ncl.register`, `ncl.get_task`, `ncl.submit`, `ncl.status`) je aktivní.
- NCL runtime guardy jsou doplněny (enable flag, input validation, bounded rounds, metriky).
- Revenue scheduler/proxy/switcher jsou v repo implementované.

---

## 3) Blokery před MainNet launch

### B-CRIT-01 — CHv4 produkční upgrade

- Finalizovat activation policy (fork-height governance + rollout strategie).
- Dokončit production hardening CHv4 execution path (release profil, fallback policy, observabilita).
- Uzavřít E2E mining test scénář pro CHv4 na produkčním profilování.

### B-CRIT-02 — Revenue produkční aktivace

- Nastavit produkční wallet adresy v revenue configu.
- Zapnout buyback flow s limity rizika (slippage, cooldown, max order size).
- Projít 72h revenue canary run s auditovatelným payout ledgerem.

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
