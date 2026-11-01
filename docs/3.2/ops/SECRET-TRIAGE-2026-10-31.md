# Secret & Repo-Hygiene Triage — 2026-10-31

Scope: full tracked-tree scan (~11.8k tracked text files) after the `V31/` cutover.
This document records **what was found, what was fixed in-repo, and what only the
operator can do**. No secret values are reproduced here.

## 1. Fixed in this pass (commit `d25e6714f`)

| Item | Location | Action |
|---|---|---|
| Live-format Groq API key | `docs/docs2.9/2.9.2/SESSION_REPORT_2026-01-13.md` (line 81) | Value replaced with `<REDACTED-ROTATED-2026-10-31>`. **Revocation at the Groq console is still pending — see §3.** |
| Customer mnemonic in a doc example | `docs/docs2.9/2.9/ESHOP_WALLETS_LIVE_SUMMARY.md` (~line 266) | Replaced with a placeholder; docs never need a real mnemonic. |
| Root meta-workspace | `Cargo.toml`, `src/lib.rs` | Deleted (unused `zion-root` package). |
| Stub trees | `update-server/`, `edge-deploy/`, `V31/vendor/` | Deleted (`update-server/` held only a `.env.example`). |
| Stale source snapshot | `apps/website-v2.9/src-only.tar.gz` | Untracked. |
| Dead pre-commit hooks | `.pre-commit-config.yaml` | Retargeted to `V31/Cargo.toml`; removed hooks for the deleted root workspace. |
| Missing ignore rules | `.gitignore` | Added raw model weights (`*.safetensors`, `*.gguf`, `*.pt`, `*.pth`, `*.onnx`) and `apps/*/src-only*.tar.gz`. |

## 2. Reviewed and deliberately kept (not leaks)

These matched secret-shaped heuristics but are not exploitable, so they were left
unchanged to avoid breaking builds, tests, or reproducible regtest flows:

| Location | Why it is not a live secret |
|---|---|
| `infra/edge-deploy/config/edge-environment.sh`, `V31/deploy/config/edge-environment.sh` | All six secret variables hold one identical 42-char `<UPPERCASE_PLACEHOLDER>` value. |
| `docs/docs2.9/PRESALE_DEPLOYMENT_GUIDE.md` | Stripe key is the documented `sk_live_xxx…` shape, not a real key. |
| `docs/docs2.9/2.8.3/SECURITY_AUDIT_REPORT.txt` | 96 `BEGIN PRIVATE KEY` hits are Python `site-packages` test fixtures inside an audit dump. |
| `V31/scripts/smos/wrapper_v31_trinity_srb.sh:94` | Placeholder wallet, not a key. |
| `.../forge-std/StdChains.sol` | Well-known public Infura endpoints from the vendored library. |
| `archive/ZionDex/intent/src/signing.rs` (~275/294) | Hex test fixture for the intent-signing unit tests; unverified, low risk, archived tree. |
| `Hiran/2.3/rebuild/adapter_model.safetensors.xz.aa|.ab`, `Hiran/2.3/rebuild/merged_seed.jsonl` | Model/training artifacts, kept intentionally (operator decision). `merged_seed.jsonl` (12.2 MB) is a curriculum seed, not a credential. |

## 3. Operator actions still required

1. **Revoke the Groq key.** In-repo redaction does not invalidate it; the value
   is still reachable through git history until a scrub happens (see 3.3).
2. **Check the presale test wallet balance.** The seed in
   `apps/mobile-app/test_*.js` is labelled "from presale API" and is pinned to
   `zion1t2t5r3p697z4v6m4x242l4j7k6w3y470h4d7q7g` by three assertions, so it
   cannot be swapped without re-deriving those vectors.
   - If that address holds **zero** balance: it is a spent test wallet — no action.
   - If it holds **any** balance: it is a compromised hot wallet — sweep the funds,
     then replace the seed together with the assertion vectors.
   A warning header was added at each occurrence (and to
   `V31/L2/multichain/warp-e2e.toml`, whose seed pins `l1_vault_address` for the
   local regtest e2e stack).
3. **History scrub (not performed — needs explicit approval).** The Groq key landed
   in commit `a49b93a5b`. Scrubbing it rewrites every commit after that point, so
   the SHA remap in `docs/3.2/ops/SHA-REMAP-2026-10-21.json` would need to be
   extended again. Recommended order: revoke the key first, and treat the scrub as
   optional hygiene rather than a security requirement.
4. **Install the guards locally.** `.pre-commit-config.yaml` already wires
   `gitleaks` + `detect-private-key`, but neither `pre-commit` nor `gitleaks` was
   installed on the dev machine — which is exactly why the Groq key could be
   committed. Run:
   ```bash
   pip install --user pre-commit
   pre-commit install && pre-commit install --hook-type pre-push
   ```
5. **`apps/public_html/` PII.** Per operator decision the tree is kept (407 MB,
   1378 files), but 11 `zw_*.json` files look like presale wallet exports. They are
   not tracked secrets in the credential sense, yet they are personal data — a GDPR
   decision (retention or removal) is still open.

## 4. Guard rails added

- `.gitignore` now blocks new raw weights and one-off source snapshots, on top of the
  existing wallet/mnemonic/key patterns.
- `.pre-commit-config.yaml` no longer references non-existent workspaces, so the
  hooks can actually run (`cargo-fmt-v31`, `cargo-clippy-v31`).
- `AGENTS.md` no longer claims the update-server exists in this repo, and points at
  the real `infra/edge-deploy/` tree.
