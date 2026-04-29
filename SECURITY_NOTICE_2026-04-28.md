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

---

## Addendum — 2026-04-29: additional credentials leak (`docs/docs2.9/ZION_KEYS/`)

While completing the audit sweep, a **second** plaintext-credentials
directory was found at `docs/docs2.9/ZION_KEYS/`, introduced 2026-03-30
in commit `feat: AI Native Hiranyagarbha v1.0` (author:
`estrelaisabellazion3`). It contained:

- `GITHUB_TOKEN.txt` — a live GitHub Personal Access Token
  (`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`)
- `OPENAI_API_KEY.txt` — a live OpenAI API key
  (`sk-proj-CsUPFBafi12A3Kl6YVRY716An5iuJRzlmyW0n5wCAnMdJTHe7Gd…`)
- `SSH_KEYS_INFO.txt` — deployment SSH key path and SSH config pointing
  at `root@91.98.122.165` (live mainnet node)
- A screenshot of the keys and a `README.md` documenting usage

### Actions taken in this commit

- `git rm` of the entire `docs/docs2.9/ZION_KEYS/` directory.
- Extended `.gitignore` with patterns that block this category from
  being re-introduced: `**/ZION_KEYS/`, `**/*TOKEN*.txt`,
  `**/*API_KEY*.txt`, `**/*SECRET_KEY*.txt`, `**/*KEYS_INFO*.txt`,
  `**/*CREDENTIALS*.txt`.

### Actions still required (NOT done in this commit — please follow up manually)

1. **Revoke the GitHub PAT immediately.** Go to
   https://github.com/settings/tokens, find the token starting with
   `ghp_7gxI3Y…`, and click Revoke. If you can't identify it, revoke
   **all** PATs and reissue. Then review the account security log at
   https://github.com/settings/security-log for suspicious activity
   since 2025-11-10.
2. **Rotate the OpenAI API key.** Delete `sk-proj-CsUPFBafi12A3…` at
   https://platform.openai.com/api-keys and review the Usage page for
   anomalous billing.
3. **Rotate the SSH deployment key on `91.98.122.165`.** Generate a new
   keypair locally, `ssh-copy-id` the public half, then remove the old
   key from `~/.ssh/authorized_keys` on the server. Review
   `journalctl -u sshd --since "2025-11-10"` and `last -F` for
   unexpected logins.
4. **Include the `ZION_KEYS/` directory in the same BFG / git-filter-repo
   rewrite** planned for the wallet leak above. Amend the recommended
   command to:
   ```bash
   git filter-repo --invert-paths \
       --path zion-wallet.json \
       --path V3/zion-wallet.json \
       --path V3-src.tar \
       --path V3-src-fresh.tar \
       --path V3-src.zip \
       --path V3_upload.zip \
       --path docs/docs2.9/ZION_KEYS
   git push --force-with-lease origin main
   ```

**Until step 1–3 are completed, the leaked PAT, OpenAI key, and SSH
access are still live.** Removing the files from `HEAD` in this commit
does **not** invalidate any of them — they remain recoverable from
history and, more importantly, from any clone made before the rewrite.
Rotation is the only mitigation that actually closes the window.
