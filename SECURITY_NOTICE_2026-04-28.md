# SECURITY NOTICE — 2026-04-28

## Summary

Two `zion-wallet.json` files containing **plaintext Ed25519 secret keys**
(and one BIP39 mnemonic) were found tracked in this repository:

- `/zion-wallet.json` (root)
- `/V3/zion-wallet.json`

They were introduced in commit `b3a8f58` ("client: v3.0.0") and have remained
in `main` since that release. Anyone who has cloned, forked, or otherwise
fetched the repository at any point between that commit and the date of this
notice is in possession of the secret key material.

The affected addresses are:

- `zion196u5p7u0559055g4x8685245q2d2c7a7g24n4t7`
- `zion16853d8r885l4g4u8p8t7v5n8u6v7e0f445dr3f8`

These addresses **must be treated as fully compromised**.

## Actions taken in this commit

- `git rm` of both wallet files.
- `git rm` of the V3 source-tree archives committed alongside them
  (`V3-src.tar`, `V3-src-fresh.tar`, `V3-src.zip`, `V3_upload.zip`),
  which may contain additional copies of the same keys.
- Updated `.gitignore` (root and `V3/`) with explicit patterns for wallet
  exports, mnemonics, keystores, and source archives, so the same mistake
  cannot be re-committed accidentally.
- Published the internal V3 audit report
  (`V3/docs/audits/2026-04-V3_INTERNAL_AUDIT.md`) which explains the full
  set of findings — this leak is finding **F3** in that report.

## Actions still required (NOT done in this commit — please follow up manually)

1. **Drain the affected wallets right now.** If either of those addresses
   currently holds any non-zero balance on the live mainnet, send all
   funds to a freshly generated wallet **from a machine that already
   has a copy of the secret key** (do *not* re-clone the key from git
   for this purpose). After this, never reuse those addresses for
   anything.
2. **Scrub git history.** Removing the files from `HEAD` does **not**
   remove them from history — they are still recoverable from any prior
   commit. Run a history rewrite once the team is aligned on a
   coordinated rewrite window:
   ```bash
   # Recommended: git-filter-repo (fast, modern, replaces filter-branch)
   pip install --user git-filter-repo
   git filter-repo --invert-paths \
       --path zion-wallet.json \
       --path V3/zion-wallet.json \
       --path V3-src.tar \
       --path V3-src-fresh.tar \
       --path V3-src.zip \
       --path V3_upload.zip
   git push --force-with-lease origin main
   ```
   Every collaborator must then **re-clone** the repository.
3. **Rotate any other keys** that were stored on developer laptops in the
   same era — assume that any laptop that had write access to this repo
   may also have had ad-hoc local copies of additional keys.
4. **Audit the rest of the secrets surface.** ROADMAP Q3 2026 already
   plans a full BFG repo scrub for premine keys; bring it forward.

## Reference

See `V3/docs/audits/2026-04-V3_INTERNAL_AUDIT.md`, Finding **F3**, for
the full technical explanation, and section 17 for the recommended
priority order of all the audit findings.
