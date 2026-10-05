# ZION 3.2.0 "One Love" — Release Artifacts & Provenance

> **Status:** PREPARED (gates pending — G8 run, external audit, DR drill)
> **Target:** v3.2.0 stable · **Prepared:** 2026-10-05

---

## 1. Release contents

| Component | Artifact | Version source |
|---|---|---|
| L1 node | `zion-node` binary + systemd unit | workspace `version = "3.2.0"` |
| L1 pool | `zion-pool` binary + unit | workspace |
| L1 miner | `zion-miner` (CPU + CUDA + OpenCL) | workspace |
| L2 multichain | `warpd` (bridge, HTLC, DEX, solver) | workspace |
| DAO | `zion-dao` binary + unit | workspace |
| Identity | `zion-identity` (ZIS, WebAuthn) | workspace |
| Website / app | Next.js bundle + nginx conf | `package.json` 3.2.0 |
| Docs / config | `docs/3.2/`, deploy scripts | tagged commit |

## 2. Version

- Workspace version: `3.2.0` (`V31/Cargo.toml` `[workspace.package]`)
- Protocol: `protocol_version 3.1.0-alpha` → bump to `3.2.0` in release commit (hardcoded in `node.rs` status response)
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

- [ ] G8 run ≥99.9 % (run #3, after #2 documented)
- [ ] External audit remediation complete / accepted
- [ ] DR drill green (this file + `DR_DRILL_2026-10-05.md`)
- [ ] Version bumped to `3.2.0` in `Cargo.toml` + `node.rs` protocol string
- [ ] Release notes `RELEASE_NOTES_3.2.0.md` written
