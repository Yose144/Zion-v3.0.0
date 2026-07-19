# Triple Stream All Green Plan — ZION 3.0.7

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
| **Stream 3 — External CPU** | VRSC ≥95% accept rate, XMR can connect and receive accepted shares (or documented why not) | Upstream pool logs / miner `ExternalResult` |
| **Infrastructure** | No SIGILL/GPU hang/reconnect storms; SMOS packages build and run on reference rigs | 24h soak test |

**Important:** Coins marked as placeholders or intentionally disabled (Pearl, RTM/QTC/DNX GPU kernels until implemented) are out of scope for the GPU all-green gate unless explicitly enabled.

---

## 2. Current state matrix (from 3.0.6 reports)

| Coin | Algo | Stream | Status | Blocker | Owner rig |
|------|------|--------|--------|---------|-----------|
| **ZION** | deeksha_lite_v1 / fire | 1 | ✅ Green | — | All rigs |
| **EPIC** | progpow | 2 | 🟡 Almost green | Awaiting real accepted share after latest hash-verification fix | RX 5700 XT / RTX |
| **ETC** | ethash | 2 | 🔴 Invalid share | Hash computation mismatch (endian/seed/FNV) | RTX / Vega |
| **RVN** | kawpow | 2 | 🔴 Invalid nonce | NiceHash extranonce1 handling | RX 5700 XT |
| **DCR** | blake3 | 2 | 🔴 below_target | Kernel vs target mismatch | RX 5700 XT |
| **ERG** | autolykos | 2 | 🔴 unknown | Autolykos GPU hash mismatch | RX 5700 XT |
| **KAS / ALPH** | kheavyhash / blake3 | 2 | 🟡 0 shares | Network difficulty too high for short tests; needs long run | M1 / RX 5700 XT |
| **FLUX / CLORE** | zelhash / kawpow | 2 | 🔴 Pool unreachable | Datacenter blocking / DNS | Edge pool |
| **VRSC** | verushash | 3 | 🟡 ~92% accept | Residual stale due to 12s block time + multi-hop | M1 / Vega |
| **XMR** | randomx | 3 | 🔴 Blocked | Datacenter IP blocked / MoneroOcean auto-switch | Edge pool |
| **IRON / KLS / DNX** | fishhash / karlsenhash / dynexsolve | 2 | 🔴 Auth/reachability | Pool-side filtering or custom protocol quirks | Edge pool |
| **PRL** | pearlhash | 2 | 🔴 Disabled | Miner-side GPU thread not implemented | — |
| **VTC** | verthash | 2 | 🔴 Host-side TODO | 1.2 GB data file loader missing | — |
| **ZCL** | equihashzero | 2 | 🔴 Host-side TODO | Multi-kernel Wagner dispatch missing | — |

---

## 3. Phases

### Phase 1 — GPU share validation fixes (Week 1)

Fix the core hash/submit bugs that prevent external GPU shares from being accepted.

| # | Task | Coin(s) | Files likely touched | Acceptance |
|---|------|---------|---------------------|------------|
| 1.1 | Build CPU reference Ethash hasher and compare with GPU output byte-for-byte | ETC | `AuXpow/src/external_hashers.rs`, `cuda_external.rs`, `gpu_miner.rs` | First matching hash on known header+nonce+mix_hash |
| 1.2 | Fix endianness / seed_hash / FNV issue found in 1.1 | ETC | `AuXpow/csrc/opencl/ethash_kernel.cl`, `gpu_miner.rs` | `Invalid share` → accepted |
| 1.3 | Verify KawPow NiceHash nonce construction (extranonce1 upper bits + random lower bits) | RVN | `V3/L1/miner/src/main.rs` external_gpu_thread | `Invalid nonce` → accepted |
| 1.4 | Add CPU reference Blake3 path for DCR and compare target comparison | DCR | `AuXpow/src/external_hashers.rs`, `miner_harness.rs` | `below_target` gone |
| 1.5 | Add CPU reference Autolykos verifier for ERG | ERG | `AuXpow/src/external_hashers.rs`, `gpu_miner.rs` | `unknown` → accepted or specific error |
| 1.6 | Add `--reference-check` debug mode to miner that re-hashes found shares on CPU before submitting | All DAG/memory algos | `V3/L1/miner/src/main.rs`, `AuXpow/src/external_hashers.rs` | Log shows `reference_hash_ok=true` |

**Exit criteria:** ETC, RVN, DCR, ERG each show ≥1 accepted share on at least one reference rig, OR root cause is documented and coin is explicitly deferred.

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
| 3.1 | Reduce VRSC stale rate below 5% | VRSC | Continue batch-size tuning; evaluate direct push channel from pool to miner for new jobs |
| 3.2 | XMR pool strategy | XMR | Either (a) find reachable pure-RandomX pool, (b) proxy via residential node, or (c) disable XMR in default config and document |
| 3.3 | CPU feature guard | CPU | Ensure miner skips RandomX on CPUs without AES-NI; fallback to VerusHash |
| 3.4 | Stale pre-rejection tunable | VRSC | Keep `ZION_VRSC_STALE_SECS=0` default; add metric for forwarded-vs-rejected age distribution |

**Exit criteria:** VRSC accept rate ≥95% over 1h; XMR has a documented path to accepted shares.

---

### Phase 4 — Placeholder / host-side completion (Week 2–3, priority order)

| # | Task | Coin | Effort | Priority |
|------|------|------|--------|----------|
| 4.1 | Verthash 1.2 GB data file loader | VTC | Medium | High — kernel ready |
| 4.2 | Equihash 192,7 host-side Wagner dispatch | ZCL | High | Medium — needs >6GB VRAM |
| 4.3 | GhostRider GPU kernel (RTM) | RTM | Very high | Low — CPU path works |
| 4.4 | Qhash / DynexSolve GPU kernels | QTC, DNX | Very high | Low — PoUW/research coins |

**Exit criteria:** VTC and ZCL reach at least "kernel initialized + job parsed" state. RTM/QTC/DNX GPU stay deferred unless extra capacity appears.

---

### Phase 5 — Pearl PoUW decision (Week 2)

| Option | Decision | Consequence |
|--------|----------|-------------|
| A — Enable | Implement `pearl_gpu_thread()` and `submit_pearl_proof()` | Adds PoUW revenue stream; increases complexity |
| B — Defer officially | Keep PRL jobs ignored in miner; document in `3.0.7.md` | Simpler scope; Pearl remains pool-only infra |

**Recommendation:** Choose **B** for 3.0.7 to avoid scope creep. Revisit in 3.1.0.

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

| # | Task | Details |
|------|------|---------|
| 7.1 | Implement missing explorer API routes | `/block`, `/tx`, `/address`, `/broadcast`, `/verify-message`, `/sse` |
| 7.2 | Build V4 frontend pages | Block/tx/address detail, rich list, mempool feed, charts |
| 7.3 | Wire SSE live feed | Push `new_block` + `mempool_update` events from Next.js API to clients |
| 7.4 | Deploy behind `/explorer` | Replace or shadow existing `/explorer` when ready |

---

### Phase 8 — Documentation, sync & release (Week 4)

| # | Task | Details |
|------|------|---------|
| 8.1 | Update `StatusV3.md` with 3.0.7 gate results | Mark each coin green/red/deferred |
| 8.2 | Update `ROADMAP.md` | Move Triple Stream items to 3.0.7 done; surface 3.1.0 items |
| 8.3 | Sync `public/` subtree | Push non-secret 3.0.7 code/docs to public repo |
| 8.4 | Create GitHub release v3.0.7-beta | Binaries + SHA256SUMS + release notes |
| 8.5 | Update SMOS group config and roll out | ZionLiteFire group + reference rigs |

---

## 4. Go / No-Go criteria for 3.0.7

**GO:**
- ZION Deeksha ≥99% accept for 24h on Edge pool.
- At least **one** external GPU coin and **one** external CPU coin verified with upstream accepted shares.
- No SIGILL/GPU hang on reference rigs for ≥24h.
- All workspace tests pass.
- Explorer V4 landing + blocks/txs list live.

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

*Generated with [Devin](https://devin.ai) — ZION V3 Mainnet Beta, 2026-07-19.*
