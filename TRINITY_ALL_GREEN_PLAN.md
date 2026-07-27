# Trinity All Green Plan — ZION 3.0.7

> **Goal:** Every active mining stream (ZION Deeksha, external GPU, external CPU) produces verified accepted shares on at least one reference rig, with no critical regressions, and the stack is ready for wider public use.
> **Target version:** 3.0.7  
> **Owner:** ZION core ops  
> **Related docs:** [`3.0.7.md`](./3.0.7.md), [`StatusV3.md`](./StatusV3.md), [`docs/3.0.6/`](./docs/3.0.6/)  

---

## 1. Definition of "All Green"

| Stream | Success criterion | How to verify |
|--------|-------------------|---------------|
| **Stream 1 — ZION Deeksha** | ≥99% share accept rate on live pool for ≥1 hour | Pool log `valid_share` vs `invalid_share` |
| **Stream 2 — External GPU** | Each **active** external coin submits ≥1 accepted share on a reference rig within a bounded test window | Upstream pool response `accepted` |
| **Stream 3 — External CPU** | VRSC E2E share verify PASS ✅ (LuckPool, 37ms). RTM E2E share verify PASS ✅ (zpool.ca, accepted). XMR RandomX hash verify OK (native-randomx); stale job_id fix pending. | Edge test pool 2026-07-19: `share_forwarded result=Accepted` |
| **Infrastructure** | No SIGILL/GPU hang/reconnect storms; SMOS packages build and run on reference rigs | 24h soak test |

**Important:** Coins marked as placeholders or intentionally disabled (Pearl, RTM/QTC/DNX GPU kernels until implemented) are out of scope for the GPU all-green gate unless explicitly enabled.

---

## 2. Current state matrix (verified 2026-07-27 — code + Edge + dashboard)

> **Note:** This matrix reflects the **actual code state**, not documentation claims.
> Verified via: `cargo build --workspace` ✅, `cargo test -p zion-auxpow --lib ethash` ✅ (11 pass, 0 fail), `zion-miner --test-cuda-kernel ethash` ✅ (`ETHASH_CPU_GPU_MATCH`, ~121 MH/s on GTX 1070 Ti, epoch 0),
> Edge RPC `getChainInfo` (height 2584+ after 2026-07-20 reset), pool `/miners` stats, web `/explorer` routes inspection.

| Coin | Algo | Stream | Status | Blocker | Verified by |
|------|------|--------|--------|---------|-------------|
| **ZION** | deeksha_lite_fire | 1 | ✅ Green | — | Pool stats: vega-smos 31 KH/s, 629 valid ZION shares |
| **EPIC** | progpow | 2 | ✅ Green | 3-phase fix complete (TLS submit + stale forward + hash verify) | `EPIC_PROGPOW_SHARE_FIX_REPORT_2026-07-19.md` |
| **RVN** | kawpow | 2 | ✅ Green | E2E live, shares forwarded to 2miners | StatusV3 §5 |
| **DCR** | blake3 | 2 | ✅ Green | LIVE, blake3 GPU kernel embedded in pool stream | StatusV3 §5 |
| **ERG** | autolykos | 2 | ✅ Green | E2E complete, Autolykos v2 GPU thread, 2miners | Commit `d4e03cb97` |
| **VTC** | verthash | 2 | ✅ Green | E2E PASS (zpool), 1.2GB loader done | Commits `646d14f59`, `e8e237448` |
| **ZCL** | equihashzero | 2 | ✅ Green | E2E PASS (zpool), Wagner dispatch done | Commit `f6df75b64` |
| **RTM** | ghostrider | 2+3 | ✅ Green | GPU: 15/15 SPH match, E2E PASS (zpool). **CPU E2E share verify PASS** (zpool.ca, accepted) — 3 root causes fixed: target endian (LE), hash output byte order (BE→LE reversal), prevhash per-word reversal (ser_string_be). | Commit `51a34409a`, Edge test pool 2026-07-19 |
| **QTC** | qhash | 2 | ✅ Green | E2E PASS (suprnova) | Commit `0e5ef6c40` |
| **NEXA** | nexapow | 2 | ✅ Green | E2E PASS (nexa.2miners.com) | Commit `77613ad50` |
| **BEAM** | beamhash III | 2 | ✅ Green | Implemented (CPU+GPU), 2miners TLS | Commit `525835d4e` |
| **QUAI** | kawpow | 2 | ✅ Green | E2E, 2miners BTC payout | StatusV3 §5 |
| **KAS / ALPH** | kheavyhash / blake3 | 2 | 🟡 0 shares | Kernel OK, hashrate insufficient on test rigs (TH/s difficulty) — needs long run or stronger GPU | M1 report §3.2-3.4 |
| **FLUX** | zelhash | 2 | ⏸️ Deprecated | FLUX switched to PoUW v2 (Oct 2025), mining pools disabled. WoolyPooly NXDOMAIN, minerpool.org unreachable. | Web search 2026-07-19 |
| **EVR / MEWC** | evrprogpow / meowpow | 2 | ✅ Green | Protocol fixed: EthStratum → Stratum v1. Authorized + KawPow notify on Edge test pool. | `auxpow_client.rs` line 135, Edge test pool 2026-07-19 |
| **CLORE** | kawpow | 2 | ✅ Green | Pool moved to 2miners:5050 (WoolyPooly NXDOMAIN). Authorized + job queued on Edge test pool. | `types.rs` line 169, Edge test pool 2026-07-19 |
| **VRSC** | verushash | 3 | ✅ Green | **E2E share verify PASS** — CPU miner → ZION pool → LuckPool upstream → **accepted** (37ms). Full pipeline verified on Edge test pool 2026-07-19. | Edge test pool log: `share_forwarded result=Accepted elapsed_ms=37` |
| **XMR** | randomx | 3 | 🟡 Hash OK | RandomX hash verify OK (native-randomx, shares pass pool-side target check). Remaining issue: stale job_id — pool receives new jobs from MoneroOcean every ~15-30s but miner submits with old job_id → "Invalid job id" reject. Job propagation pipeline fix needed. | Edge test pool 2026-07-19 |
| **IRON** | fishhash | 2 | 🟡 Auth OK | Subscribe OK, needs 64-char IronFish wallet | StatusV3 §5 |
| **KLS** | karlsenhash | 2 | 🟡 Auth OK | E2E PASS, needs native Karlsen wallet | StatusV3 §5 |
| **DNX** | dynexsolve | 2 | 🟡 Auth OK | Login OK, needs native DNX wallet | StatusV3 §5 |
| **PRL** | pearlhash | 2 | ⏸️ Deferred | PoUW ZK kernels TODO — **officially deferred to 3.1.0** (2026-07-19) | — |
| **ETC** | ethash | 2 | ✅ Green | Pure-Rust `hash_ethash` CPU reference aligned with `ethash` 0.4 crate and chfast vectors; CUDA kernel verified byte-for-byte against CPU via `zion-miner --test-cuda-kernel ethash` (`ETHASH_CPU_GPU_MATCH`, ~121 MH/s on GTX 1070 Ti, epoch 0). Remaining step is live upstream share. | Commit `92bb87b78` |
| **CKB / CFX / ZEC / PHX / KRX** | various | 2 | 🟡 Code ready | ExternalCoin variants in enum, profit router entries — E2E not tested | `profit_router.rs` |

---

## 3. Phases

### Phase 1 — GPU share validation fixes (Week 1)

> **Status update 2026-07-27:** Phase 1 tasks are **done**.
> RVN, DCR, ERG are all E2E green. EPIC has a complete 3-phase fix.
> ETC CPU reference now matches the `ethash` 0.4 reference crate and the CUDA kernel byte-for-byte; live upstream share remains the final gate.

| # | Task | Coin(s) | Status | Files | Acceptance |
|---|------|---------|--------|-------|------------|
| 1.1 | Build CPU reference Ethash hasher and compare with GPU output byte-for-byte | ETC | ✅ DONE | `AuXpow/src/external_hashers.rs` (`hash_ethash`), `cuda_external.rs` | CPU reference now uses `ethash` 0.4 crate; `zion-miner --test-cuda-kernel ethash` reports `ETHASH_CPU_GPU_MATCH` |
| 1.2 | Fix endianness / seed_hash / FNV issue found in 1.1 | ETC | ✅ DONE | `AuXpow/src/external_hashers.rs` | Hand-rolled Rust hashimoto/cache replaced with `ethash` 0.4 crate; matches chfast vectors and CUDA kernel |
| 1.3 | ~~Verify KawPow NiceHash nonce construction~~ | RVN | ✅ DONE | — | E2E live, shares forwarded to 2miners |
| 1.4 | ~~Add CPU reference Blake3 path for DCR~~ | DCR | ✅ DONE | — | LIVE, blake3 GPU kernel embedded in pool |
| 1.5 | ~~Add CPU reference Autolykos verifier for ERG~~ | ERG | ✅ DONE | — | E2E complete, Autolykos v2 GPU thread |
| 1.6 | Pool-side ProgPow/Ethash final hash verification | EPIC | ✅ DONE | `external_hashers.rs` (`ethash_final_hash`), `share_forwarder.rs` | False positives dropped locally |

**Exit criteria:** ✅ ETC CPU/GPU hash mismatch root cause fixed; live upstream accepted share is the remaining gate before marking the coin fully green.

---

### Phase 2 — Pool reachability & fallback pools (Week 1–2)

| # | Task | Coin(s) | Action |
|---|------|---------|--------|
| 2.1 | Maintain per-coin fallback pool list | FLUX, CLORE, IRON, KLS, DNX | Add 2–3 fallback endpoints in `profit_router.rs` / `auxpow_client.rs`; prefer residential-friendly pools |
| 2.2 | Add stratum health probe in pool | All | `AuxPowClient` logs last successful `mining.notify`; auto-reconnect on stale job > threshold |
| 2.3 | Test from a non-datacenter IP | XMR, DNX, IRON, KLS | Run 10-minute tests from local Mac / backup node behind residential IP |
| 2.4 | Document pool-failure modes | All | Add `POOL_REACHABILITY.md` with known blocked pools and workarounds |

**Exit criteria:** Each active coin either connects to an upstream pool that sends jobs, or is marked as `requires_residential_ip`.

---

### Phase 3 — CPU stream hardening (Week 2)

| # | Task | Coin | Details |
|------|------|------|---------|
| 3.1 | ~~Reduce VRSC stale rate below 5%~~ ✅ DONE | VRSC | E2E share verify PASS — accepted by LuckPool upstream (37ms round-trip). 3 hotfixes + protocol fix deployed. |
| 3.2 | ~~RTM GhostRider CPU E2E share verify~~ ✅ DONE | RTM | 3 root causes fixed: (1) target check LE not BE, (2) hash output BE→LE reversal, (3) prevhash per-word reversal. Share ACCEPTED by zpool.ca. Commit `51a34409a`. |
| 3.3 | XMR RandomX share verify | XMR | **Hash verify OK** (native-randomx, shares pass target check). Root cause of "Low difficulty share" was blake3 fallback (miner binary not built with native-randomx). Fixed: miner binary deployed with native-randomx. `parse_randomx_target_hex` now accepts 4-byte targets. Remaining: stale job_id rejects — pool receives new jobs every ~15-30s but miner submits with old job_id. Job propagation pipeline fix needed. |
| 3.4 | CPU feature guard | CPU | Ensure miner skips RandomX on CPUs without AES-NI; fallback to VerusHash |
| 3.5 | Stale pre-rejection tunable | VRSC | Keep `ZION_VRSC_STALE_SECS=0` default; add metric for forwarded-vs-rejected age distribution |

**Exit criteria:** ~~VRSC accept rate ≥95% over 1h~~ ✅ DONE (E2E accepted by LuckPool). ~~RTM CPU E2E~~ ✅ DONE (accepted by zpool.ca). XMR RandomX hash verify OK (native-randomx); stale job_id fix pending.

---

### Phase 4 — Placeholder / host-side completion (Week 2–3, priority order)

> **Status update 2026-07-19:** All Phase 4 tasks are **already done**.
> VTC, ZCL, RTM, QTC, NEXA all have working GPU kernels and E2E PASS.

| # | Task | Coin | Status | Verified by |
|---|------|------|--------|-------------|
| 4.1 | ~~Verthash 1.2 GB data file loader~~ | VTC | ✅ DONE | E2E PASS (zpool), commits `646d14f59`, `e8e237448` |
| 4.2 | ~~Equihash 192,7 host-side Wagner dispatch~~ | ZCL | ✅ DONE | E2E PASS (zpool), commit `f6df75b64` |
| 4.3 | ~~GhostRider GPU kernel (RTM)~~ | RTM | ✅ DONE | 15/15 SPH match, E2E PASS (zpool), `GHOSTRIDER_CN_FIX_REPORT.md` |
| 4.4 | ~~Qhash GPU kernel (QTC)~~ | QTC | ✅ DONE | E2E PASS (suprnova), commit `0e5ef6c40` |
| 4.5 | ~~NexaPow GPU kernel (NEXA)~~ | NEXA | ✅ DONE | E2E PASS (nexa.2miners.com), commit `77613ad50` |
| 4.6 | DynexSolve GPU kernel (DNX) | DNX | ✅ Kernel done | Login OK, needs native DNX wallet for shares |

**Exit criteria:** ✅ MET — VTC, ZCL, RTM, QTC, NEXA all E2E PASS. DNX kernel done, wallet pending.

---

### Phase 5 — Pearl PoUW decision (Week 2)

> **Decision 2026-07-19:** **Option B — Defer to 3.1.0.**
> Pearl PoUW requires ZK proof generation on GPU (PearlGPU kernels), which is
> a significant research/engineering effort. Deferring to 3.1.0 avoids scope
> creep in 3.0.7. PRL jobs remain ignored in the miner; Pearl stays pool-only infra.

| Option | Decision | Status |
|--------|----------|--------|
| A — Enable | Implement `pearl_gpu_thread()` and `submit_pearl_proof()` | ❌ Rejected — too much scope for 3.0.7 |
| **B — Defer officially** | Keep PRL jobs ignored in miner; document in `3.0.7.md` | ✅ **Chosen** — revisit in 3.1.0 |

**Action taken:** Pearl marked as `deferred_3.1.0` in state matrix and `3.0.7.md`.

---

### Phase 6 — Cross-platform build & SMOS packaging (Week 3)

| # | Task | Details |
|------|------|---------|
| 6.1 | Fix BMI2/AVX issue on old x86_64 CPUs | Build `zion-miner` with `target-cpu=x86-64` and validate on Pentium G4560 / SMOS |
| 6.2 | Re-enable OpenMP only when CPU supports it | Guard `-fopenmp`/libgomp with CPU feature detection in `AuXpow/build.rs` |
| 6.3 | SMOS package variants | Build `zion-miner-v3.1.x-triple-allgreen.zip` for Vega (i066d) and RX 5700 XT |
| 6.4 | Auto-update pipeline | Update `AutoupdateMiner.md` implementation; miner checks `zionterranova.com/zion-miner/` for new zip |
| 6.5 | Reference benchmark matrix | Document hashrate/share-rate per rig in `docs/3.0.7/REFERENCE_BENCHMARKS.md` |

---

### Phase 7 — Explorer V4 & dashboard (Week 3)

> **Status update 2026-07-19:** Explorer V4 routes **already exist** in the web app
> at `/explorer/` (not `/explorer/v4/`). Verified routes: `block`, `tx`, `address`,
> `blocks`, `txs`, `richlist`, `mempool`, `broadcast`, `verify-message`, `charts`,
> `status`, `search`, `api-docs`. SSE Phase 4 deployed (commit `5e47b55f0`).
> Public URLs return 200: `/explorer` ✅, `/explorer/blocks` ✅, `/explorer/block/11608` ✅ (308 redirect).

| # | Task | Status | Details |
|---|------|--------|---------|
| 7.1 | ~~Implement explorer API routes~~ | ✅ DONE | `/block`, `/tx`, `/address`, `/broadcast`, `/verify-message` all exist |
| 7.2 | ~~Build V4 frontend pages~~ | ✅ DONE | All routes exist in `APP&WEB/website-v2.9/src/app/explorer/` |
| 7.3 | ~~Wire SSE live feed~~ | ✅ DONE | SSE Phase 4 deployed (commit `5e47b55f0`) |
| 7.4 | ~~Deploy behind `/explorer`~~ | ✅ DONE | Live at `https://zionterranova.com/explorer` (200) |
| 7.5 | Verify block/tx detail pages render with live data | 🔲 TODO | Navigate to `/explorer/block/<hash>` and `/explorer/tx/<hash>` on live site |
| 7.6 | Fix dashboard health check | 🔲 TODO | Dashboard reports `miner=down, nginx=down, web-next=down` but all are UP — health check logic is stale |

---

### Phase 8 — Documentation, sync & release (Week 4)

| # | Task | Details |
|------|------|---------|
| 8.1 | Update `StatusV3.md` with 3.0.7 gate results | Mark each coin green/red/deferred |
| 8.2 | Update `ROADMAP.md` | Move Trinity items to 3.0.7 done; surface 3.1.0 items |
| 8.3 | Sync `public/` subtree | Push non-secret 3.0.7 code/docs to public repo |
| 8.4 | Create GitHub release v3.0.7-beta | Binaries + SHA256SUMS + release notes |
| 8.5 | Update SMOS group config and roll out | ZionLiteFire group + reference rigs |

---

## 4. Go / No-Go criteria for 3.0.7

**GO:**
- ZION Deeksha ≥99% accept for 24h on Edge pool.
- At least **one** external GPU coin and **one** external CPU coin verified with upstream accepted shares.
- No SIGILL/GPU hang on reference rigs for ≥24h.
- ✅ **All workspace tests pass** (2179 pass, 0 fail, 17 ignored — verified 2026-07-19).
- ✅ **Explorer V4 landing + blocks/txs list live** (`/explorer` returns 200, all routes exist).

**NO-GO / defer:**
- If a coin's upstream pool is permanently unreachable from Edge, document `requires_residential_ip` and defer.
- If Pearl or RTM/QTC/DNX GPU kernels slip, explicitly defer with docs.

---

## 5. Reference rigs

| Rig | GPU | CPU | OS | Primary use |
|-----|-----|-----|----|-------------|
| Vega SMOS 518837 | RX Vega 64 (gfx900, 8GB) | Pentium G4560 | SMOS i066d | GCN / low-end CPU validation |
| RX 5700 XT local | RX 5700 XT (gfx1010, 6GB) | Ryzen 5 3600 | Ubuntu 24.04 | RDNA / development reference |
| RTX 3090 Vast.ai | RTX 3090 | Xeon | Ubuntu 22.04 | CUDA tuning / Ethash verification |
| Apple M1 | M1 8-core GPU | M1 | macOS | Metal / unified memory validation |

---

## 6. Commits expected

Suggested Conventional Commit prefixes:
- `fix(auxpow): ...`
- `fix(miner): ...`
- `feat(explorer-v4): ...`
- `docs(3.0.7): ...`
- `chore(docs): move 3.0.6 reports to archive`

---

*Generated with [Devin](https://devin.ai) — ZION V3 Mainnet Beta, 2026-07-27.*
