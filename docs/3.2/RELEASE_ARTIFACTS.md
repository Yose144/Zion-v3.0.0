# ZION 3.2.0 "One Love" — Release Artifacts & Provenance

> **Status:** DRAFT PROCEDURE, not executed. The Stable gates are not met: G8 run #2 failed, the external audit is not engaged, and DR is only partially proven (see `REPORTS/DR_DRILL_2026-10-05.md`).
> **Version label:** `3.2.0`. The workspace already uses it, and the public client releases `v3.2.0-cli`, `v3.2.0-desktop` and `v3.2.0-miner` were published under it on 2026-08-22. "Stable" is a gate decision, not a version string.
> **Target:** v3.2.0 stable · **Prepared:** 2026-10-05 · **Revised:** 2026-10-05 (internal audit)

---

## 1. Release contents

| Component | Artifact | Version source |
|---|---|---|
| L1 node | `zion-node` binary + systemd unit | workspace `version = "3.2.0"` |
| L1 pool | `zion-pool` binary + unit | workspace |
| L1 miner | `zion-miner` (CPU + CUDA + OpenCL) | workspace |
| L2 multichain | `warpd` (bridge, HTLC, DEX, solver) | workspace |
| DAO | `zion-dao` binary + unit | workspace |
| Identity (ZIS) | Node.js service `APP&WEB/identity` (`dist/`) | its own `package.json` (not a Cargo workspace member) |
| Website / app | Next.js bundle + nginx conf | `package.json` 3.2.0 |
| Docs / config | `docs/3.2/`, deploy scripts | tagged commit |

## 2. Version

- Workspace version: `3.2.0` (`V31/Cargo.toml` `[workspace.package]`)
- Protocol: the `3.1.0-alpha` strings in `node.rs`/`rpc.rs` are V3-compat P2P handshake/protocol labels and **stay unchanged**. The binary version is exposed separately as RPC `node_version` (`CARGO_PKG_VERSION`, internal-audit fix F).
- Website: `package.json` `3.2.0` (already correct)

## 3. Release procedure (checklist)

```bash
# 1. freeze — tag the audited commit
git tag -s v3.2.0 -m "ZION 3.2.0 'One Love' — stable"
git push origin v3.2.0

# 2. build reproducible binaries (Linux x86_64, glibc ≥2.31)
cd V31 && cargo build --release --locked \
  -p zion-core -p zion-pool -p zion-miner -p zion-multichain -p zion-dao

# 3. checksums + manifest
cd target/release
sha256sum zion-node zion-pool zion-miner warpd zion-dao > SHA256SUMS-v3.2.0.txt

# 4. sign
gpg --armor --detach-sign SHA256SUMS-v3.2.0.txt
# → SHA256SUMS-v3.2.0.txt.asc

# 5. publish
gh release create v3.2.0 \
  target/release/zion-node target/release/zion-pool target/release/zion-miner \
  target/release/warpd target/release/zion-dao \
  SHA256SUMS-v3.2.0.txt SHA256SUMS-v3.2.0.txt.asc \
  --title "ZION 3.2.0 'One Love'" --notes docs/3.2/RELEASE_NOTES_3.2.0.md
```

## 4. Provenance requirements

| Check | How |
|---|---|
| Build from tagged commit | `git describe` in CI; embed commit sha in binary `--version` |
| Checksum manifest | `SHA256SUMS-v3.2.0.txt` + detached `gpg` signature |
| Supply chain | `cargo audit` clean (or accepted); `cargo tree --locked` pinned deps |
| Deploy provenance | Edge binary sha256 must equal release checksum — verified on deploy |

## 5. Gates before tagging

- [ ] G8 run ≥99.9 % with no critical incident (run #2 **failed**; run #3 needs a mining-liveness plan first)
- [ ] External audit engaged, remediation complete / accepted (scope draft: `EXTERNAL_AUDIT_SCOPE.md`)
- [ ] Real DR drill: encrypted off-site backups + full-stack restore (the 2026-10-05 test was a partial single-node restore)
- [ ] Internal audit 2026-10-05: critical/high code fixes deployed and soaked; operator items IA-07/08/09/10 decided
- [x] Workspace version `3.2.0` (protocol label intentionally unchanged; `node_version` exposed via RPC)
- [ ] Release notes `RELEASE_NOTES_3.2.0.md` written
