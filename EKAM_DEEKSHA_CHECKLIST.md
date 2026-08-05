# Checklist — kanonický Ekam Deeksha

> Živý checklist fází A a B. Označuje se `[x]` / `[~]` / `[ ]` podle stavu.

## Fáze A — Přepnutí na kanonický Ekam Deeksha

- [x] A1 — Nahradit `HeightAwareDeeksha` za `EkamDeeksha` v `V31/L1/core/src/consensus.rs`
- [x] A2 — Aktualizovat `V31/L1/core/src/node.rs` na `EkamDeeksha`
- [x] A3 — Aktualizovat `V31/L1/core/src/lib.rs` exporty
- [x] A4 — Aktualizovat `V31/L1/miner/src/runtime.rs` na `EkamDeeksha`
- [~] A5 — Aktualizovat `V31/L1/miner/src/bin/zion-miner.rs` na `EkamDeeksha` (binárka nepoužívá `HeightAwareDeeksha` přímo — kanonický PoW přichází přes `MinerRuntime`/`ConsensusEngine`)
- [x] A6 — Aktualizovat `V31/L1/pool/src/validator.rs` na `EkamDeeksha`
- [x] A7 — Aktualizovat `V31/L1/pool/src/stratum.rs` — `algorithm_for_height` vrací `"ekam_deeksha"`
- [~] A8 — Odebrat závislost `zion-cosmic-harmony-v3` z `V31/L1/core/Cargo.toml` (ponecháno — `v3_compat`, `chain_state`, `node_runtime`, `v3_state`, `v3_template` a `v3_wallet` ji stále potřebují pro historickou V3 sync/validaci)
- [x] A9 — Odebrat závislost `zion-cosmic-harmony-v3` z `V31/L1/miner/Cargo.toml` (pokud existuje) — nebyla přítomna
- [x] A10 — Odebrat závislost `zion-cosmic-harmony-v3` z `V31/L1/pool/Cargo.toml` (pokud existuje) — nebyla přítomna
- [x] A11 — Přepsat height-aware fork testy v `zion-core` na sanity testy `EkamDeeksha`
- [x] A12 — `cargo test -p zion-core -p zion-cosmic-harmony -p zion-pool -p zion-miner` čisté (300 testů v zion-core, 160 v zion-pool, vše pass)
- [x] A13 — `cargo clippy --workspace` čisté (`-D warnings`, 30.87s, exit 0)
- [x] A14 — Commit fáze A a push (pushnuto v rámci následného commitu)

## Fáze B — Ekam Deeksha v2 (parametry + kernely)

- [x] B1 — Změnit `EkamDeeksha` parametry: scratchpad 128 KiB, 1 pass, 32 random reads, 2 AES rounds
- [x] B2 — Upravit `V31/L1/cosmic-harmony/src/algorithm/ekam_deeksha.rs` implementaci
- [x] B3 — Vygenerovat / aktualizovat KAT vektory a unit testy
- [x] B4 — Upravit OpenCL kernely `deeksha_lite.cl`, `deeksha_chv3.cl`, `deeksha_lite_fire.cl`, `cosmic_harmony_deeksha.cl` a `opencl_kernel.rs`
- [x] B5 — Upravit CUDA kernely `V31/L1/miner/src/gpu/kernels/cuda/*.cu`
- [x] B6 — Upravit Metal kernely `V31/L1/miner/csrc/metal/*.metal` a `V31/L1/miner/src/gpu/kernels/metal/*.metal` (nekompilováno na M1)
- [~] B7 — Odstranit legacy `deeksha_chv3` a `deeksha_lite_fire` kernely (prozatím ponechány a konstanty sjednoceny; legacy job názvy zůstávají pro kompatibilitu)
- [x] B8 — `cargo test -p zion-cosmic-harmony -p zion-core -p zion-pool -p zion-miner` čisté
- [x] B9 — `cargo clippy --workspace` čisté
- [x] B10 — Commit fáze B a push

## Dokumentace a finalizace

- [x] D1 — Aktualizovat `PLAN_EKAM_DEEKSHA.md` (fáze A/B provedeny, poznámky)
- [x] D2 — Aktualizovat `V31/STATUS.md` a `V31/README.md` (README částečně aktualizováno)
- [x] D3 — Aktualizovat `V31/AGENTS.md` (poznámky pro budoucí změny consensusu)
- [x] D4 — Final commit + push

---

*Poslední aktualizace: 2026-08-06*  
*Tento soubor se doplňuje po každé fázi.*
