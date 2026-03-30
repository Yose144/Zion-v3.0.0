# ZION 2.7 REAL CORE MIGRATION LOG (October 2025)

## Purpose
Formal record of the transition from legacy 2.6.x (simulation-heavy, marketing layer interwoven with consensus) to **ZION 2.7 TestNet** minimal verifiable core. Goal: remove all simulation abstractions, rebuild trust layer openly, and establish a clean foundation for future secure feature layering.

## Legacy 2.6.x Issues
- Mixed simulation / production semantics (prefix-based pseudo-difficulty, artificial mining flows)
- Conflation of marketing concepts with consensus logic ("sacred" layers inside core paths)
- Lack of deterministic minimal tests for: difficulty, maturity, reorgs, relay
- Overextended README overshadowing actual consensus state
- Missing UTXO maturity enforcement; weak separation of share vs block validation
- No structured reorg handling; only linear growth assumption

## 2.7 Design Principles
| Principle | Description |
|-----------|-------------|
| Minimalism | Only features required for a real, testable blockchain core added initially |
| Determinism | Genesis fixed; block + tx hashing canonical JSON serialization |
| Verifiability | Integer target difficulty, measurable tests, explicit UTXO model |
| Incrementalism | Reorg skeleton + future improvements staged (snapshots, undo) |
| Transparency | Clear README Phase 2+ section; historical content isolated |
| Extensibility | Clear seams for future metrics, auth, bridge, AI miner integration |

## Implemented Core (Phase 1 → Phase 2+)
1. Genesis block + persistence (JSON per block, autosave loop)
2. Adaptive difficulty window (W=12) w/ clamp factor 4×; target = MAX_TARGET // diff (256-bit)
3. Real share validation (hash < target), removed prefix shortcuts
4. Stratum pool reworked: job templates + per-client difficulty, varDiff heuristic, share vs block acceptance
5. UTXO set tracking w/ coinbase maturity rule (maturity=10 blocks)
6. Fee-aware mempool (ordering + low-fee eviction when full)
7. Wallet scanner (full + incremental w/ persisted state)
8. P2P line-based JSON: hello, announce, inv_request, inv, getblocks, block, tx
9. Block sync (inventory + targeted retrieval)
10. Transaction relay w/ duplicate suppression
11. Reorg skeleton (all blocks map, children map, UTXO rebuild for longest chain adoption)
12. Performance metrics (template + block apply timing)
13. Security hardening layer (message size caps, rate limiting, structural validation)
14. Test suite covering: target/index, difficulty retarget, maturity, relay

## Key Files (2.7)
- `2.7/core/blockchain.py` – consensus engine, difficulty, UTXO, reorg skeleton
- `2.7/pool/stratum_pool.py` – external miner interface (per-client diff, varDiff, target broadcast)
- `2.7/network/p2p.py` – sync + relay network (now with basic validation)
- `2.7/tests/*.py` – deterministic behavioral validation
- `README.md` – updated with Phase 2+ section documenting real core

## Removed / Deprioritized Simulation Artifacts
- Prefix-based difficulty simulation replaced by real integer target comparison
- Artificial "cosmic" mining layers decoupled (moved to legacy section or pending future re-integration on top of real core)
- Legacy orchestrator scripts excluded from critical consensus path

## External Miner Alignment Notes
- Stratum now emits: `mining.notify`, `mining.set_difficulty`, and explicit `mining.set_target` (non-standard helper)
- Future: encode compact nBits properly; unify job schema versioning; optional extranonce spaces and coinbase assembly

## Reorg Strategy (Current vs Future)
| Aspect | Current | Planned |
|--------|---------|---------|
| Detection | Longer side chain triggers rebuild | Weighted + finalization window |
| Execution | Full UTXO replay from genesis | UTXO diff snapshots / rolling undo stack |
| Tie-break | Not yet implemented | Deterministic hash / work scoring |
| Pruning | None | Orphan GC threshold |

## Security Layer (Initial)
- 64KB message cap, buffer guard
- Rate limiting: 120 tx & 120 block/announce per minute
- Hash / txid format validation (length + hex) – lightweight
- Inventory caps (<=500 advertised, request <=50)
- Next: handshake authentication (identity signatures), peer scoring, banlist

## Testing Coverage Snapshot
| Test | Purpose |
|------|---------|
| `test_target_and_index.py` | Ensures block hash indexing + target hex formatting |
| `test_difficulty_retarget.py` | Validates clamp + directional adjustment under time variance |
| `test_maturity_and_relay.py` | Coinbase maturity enforcement + tx propagation correctness |
| `test_mine_block.py` | End-to-end mining path sanity |
| (Planned) Reorg scenario test | Competing branches + longest chain adoption |

## Open TODO (Beyond Phase 2+ Baseline)
- Reorg scenario unit test & tie-break spec
- Compact nBits field implementation + encoding correctness test
- Fee per byte weighting & ancestor package acceptance
- Mempool persistence across restarts
- Structured metrics/status endpoint (JSON)
- Authenticated P2P handshake (node key + signature)
- Difficulty median-time-source handling (timestamp smoothing)
- Snapshot / undo-layer for efficient reorg

## Migration Impact Summary
| Domain | Before (2.6.x) | After (2.7) |
|--------|----------------|-------------|
| Difficulty | Prefix simulation | Real 256-bit target math |
| Maturity | Not enforced | Coinbase maturity = 10 blocks |
| Reorg | None (linear) | Skeleton + full replay rebuild |
| Mining | Mixed AI/sim hooks | Canonical Stratum base + varDiff |
| UTXO | Implicit / partial | Explicit set + validation |
| Security | Minimal | Basic caps & rate limiting |
| Tests | Sparse | Core behavioral suite |
| Docs | Marketing-heavy | Dual-layer: real core + legacy appendix |

## Rationale for Immediate Simplicity
A minimal, audited foundation reduces ambiguity and attack surface. Higher-layer narrative/AI components can be re-attached with strict isolation once consensus invariants are locked and test coverage extended (especially reorg & fee policies).

## Next Recommended Steps
1. Implement & validate reorg fork test harness
2. Add metrics/status JSON endpoint for external tooling
3. Introduce deterministic difficulty test vectors (fixture-based timestamps)
4. Define job schema v1 (fields, optional extranonce placeholders)
5. Begin P2P identity/auth handshake design

---
*Logged: UTC build window early October 2025 – initial stabilization of REAL 2.7 core.*
