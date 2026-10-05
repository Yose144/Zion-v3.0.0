# BTCunlock — Integration Report

Date: 2026-10-05 · Host: `dest-zion` (GTX 1070 Ti, shared with `zion-v31-miner` + llama.cpp) · Repo branch: `main`

## 1. What was built

`BTCunlock` (`BTCunlock/`) grew from a BIP39 mnemonic-recovery tool into a self-contained
Bitcoin key-search toolkit, now integrated into the ZION stack as an auxiliary
"Stream 4" workload — deliberately **outside** the stratum/pool protocol.

| Capability | Entry point | Notes |
|---|---|---|
| BIP39 holes / permutations → address match | `recover`, `permute`, `fix-mnemonic` | CPU + OpenCL GPU |
| Raw private-key interval scan (up to 256-bit) | `keyscan` | CPU + GPU, checkpoint/resume |
| Bitcoin Puzzle shorthand | `puzzle N` | embedded 1–160 catalog |
| Pollard kangaroo (bounded ECDLP) | `kangaroo` | requires public key — NOT usable on hash160-only puzzles |
| Live web dashboard | `btcunlock-ui.py` → `127.0.0.1:8777` | stdlib-only, read-only |
| WIF decode/derive | `wif` | offline |

## 2. Architecture decision — why NOT inside the miner

Evaluated and rejected wiring keyscan into `V31/L1/miner` Trinity streams:

- V3 `PoolMessage::Job` has **2 fixed external slots** (`external_stream`,
  `external_stream_cpu`); `ExternalStreamJob` is share-shaped (job_id, extranonce,
  target) — a keyscan result does not fit without a protocol redesign.
- Streams/`StreamId`/TUI/desktop-agent/dashboard are hard-coded to 3; a 4th slot
  is a cross-repo change (protocol + pool telemetry + 3 UIs).
- A scan hit is **private key material** — it must never flow through pool
  telemetry or public dashboards. `ncl_gateway.rs` precedent confirms auxiliary
  non-share workloads belong beside the pool, not inside it.

Chosen design (matches the `llama.cpp`-shares-GPU precedent):

```
btcunlock (systemd user service, Nice 15)
   │  checkpoint ~/btcunlock/p71.ckpt · log ~/btcunlock/p71.log
   │  hits → ~/btcunlock/btcunlock-hits/  (mode 600, fsync'd)
   ▼
btcunlock-ui.py :8777 ── /api/status (localhost, read-only)
   │                                    ▲
   ├── proxied/trimmed by ──────────────┤
   ▼                                    │
ZION_OS dashboard :8766                │ desktop-agent main.js poller
/api/keyscan → Stream-4 card           │ → 'keyscan-status' IPC → Stream-4 card
```

GPU contention is left to the driver (same as llama.cpp); `Nice 15` keeps CPU
priority below the miner. Zero changes to V31 miner, pool protocol, or website.

## 3. Runtime data layout — `~/btcunlock/`

```
~/btcunlock/
├── p71.ckpt           # puzzle #71 checkpoint (job_hash-bound, --resume)
├── p71.log            # scanner log
├── ui.log             # dashboard server log
├── hits-vault.json    # UI-side merged vault (mode 600)
└── btcunlock-hits/    # scanner-side hit backup (source of truth)
    ├── hits.jsonl     # append-only index, fsync per record, mode 600
    └── hit-<ts>-<key>.txt
```

Nothing runtime-related lives in the repo or home root anymore.

## 4. Services (systemd **user** units, linger-enabled)

Unit templates committed at `BTCunlock/deploy/zion-btcunlock{,-ui}.service`;
live copies in `~/.config/systemd/user/`.

- `zion-btcunlock.service` — `puzzle 71 --gpu --stride 16 --batch 262144
  --resume --checkpoint ~/btcunlock/p71.ckpt`, `Nice=15`, `Restart=always`,
  `RuntimeMaxSec=86400` (daily restart = bounded log; checkpoint makes it seamless)
- `zion-btcunlock-ui.service` — `python3 btcunlock-ui.py`, `Restart=always`

Manage: `systemctl --user {status,restart} zion-btcunlock{,-ui}`.
Boot persistence: `loginctl show-user zionserver -p Linger` → yes.

## 5. Dashboard / desktop-agent surfaces

- `ZION_OS/dashboard/app.py` — `GET /api/keyscan` proxies a **trimmed** status
  (drops rate_hist, log_tail, puzzle catalog, cmdline). Raw WIF stays behind the
  UI's localhost-only `/api/vault_wif` and is never proxied.
- `ZION_OS/dashboard/dashboard.html|js` — green Stream-4 card in the Trinity
  panel: keys/s, tested, coverage, full-range ETA, hits; grays out when the
  service is unreachable. `?v=132` cache-buster; `.gz` assets regenerated.
- `APP&WEB/desktop-agent` — main-process poller (`main.js`) → new
  `keyscan-status` IPC channel (`preload.js:onKeyscanStatus`) → Stream-4 card
  (`index.html` `.stream-ks`, auto-fit grid, `renderer.js:updateKeyscanCard`).
- Dashboard auth unchanged (ZIS SSO / Basic Auth); `/api/keyscan` is behind it.

## 6. Hit backup chain (defense in depth)

1. Scanner `save_hit()` — **before** console print: `hits.jsonl` append +
   human-readable file, both mode 600, `sync_all()` durability.
2. Optional `--hit-cmd` hook — env `BTCUNLOCK_KEY{,_HEX}`, `BTCUNLOCK_WIF`,
   `BTCUNLOCK_ADDRESS`, `BTCUNLOCK_TARGET`, `BTCUNLOCK_LABEL` (scp/ntfy/mail…).
3. UI vault merges `hits.jsonl` (primary) + log-parse (fallback) into
   `hits-vault.json` (mode 600); web payload masks WIF.

GPU candidate hits are always **host-verified** (recompute pubkey → hash160 →
compare target) before recording.

## 7. Performance — GTX 1070 Ti (shared)

Measured A/B for the `key_scan` kernel (`-cl-nv-maxrregcount`, env
`KERNEL_OPTS_KEYSCAN` overrides):

| reg cap | Mk/s | note |
|---|---|---|
| 64 (old shared default) | 21.97 | |
| **80 (selected)** | **26.6–27.7** | stride 16, batch 262k–524k |
| 96 / 128 / 255 | 9.7–23.3 | pathological NVIDIA JIT (>6 min) |

- `stride 16` ≈ batch-inversion sweet spot (stride 4 → 5.5 Mk/s).
- Production kept `batch 262144`; `524288` benchmarked +4 % — change deliberately.
- Validation hits: puzzle #5 `0x15`, #25 `0x1fa5ee5`, #30 `0x3d94cd64`
  (incl. checkpoint-resume), kangaroo recovers #25 key + key `1`.

## 8. Bugs found & fixed during integration

| Bug | Effect | Fix |
|---|---|---|
| `#[derive(Ord)]` on `[u32;8]` compared limbs low→high | `2^70+4M > 2^71` → scan exited after 1 launch | manual multi-limb `Ord` + regression test |
| `saturating_sub` inverted borrow | coverage printed `-3.1250%` | borrow propagation fix + cross-limb tests |
| resume counted pre-session keys in rate | decaying phantom "Gk/s" | `tested0` session baseline |
| `SecretKey::from_slice([1u8;32])` ≠ key 1 | CPU walk derived wrong pubkeys after first key per chunk | proper scalar-1 pubkey; caught by new tests |
| UI JS: literal `\n` inside `'…'` | whole dashboard dead (SyntaxError) | escaping fixed, `node --check` gate |
| UI parser bound to bash wrapper | wrong process match | `pgrep -x` + `/proc` cmdline match |

## 9. Honest feasibility note

Puzzle #71 exposes **hash160 only** (`pubkey_known: false`) → kangaroo/Shor need
a public key; Grover ≈ 2^35 oracle calls × ~10^6 T-gates — no practical shortcut.
At ~26 Mk/s a full 2^70 sweep is ~1.4 M GPU-years; this run is a **lottery
ticket**, not a plan. Open puzzles with public keys (#140…#160) are wider than
2^70 after √-reduction — no cheap win there either.

## 10. Verification log

- `cargo test` 17/17 · `cargo test --features gpu -- --ignored` 4/4 GPU↔CPU parity
- `cargo build --release{, --features gpu}` clean
- `node --check` on served JS + desktop-agent files · `py_compile` app.py / UI
- `curl :8777/api/status` → live payload; `/api/keyscan` → trimmed payload
- hit-backup e2e: `puzzle 5` → mode-600 files + hook fired + vault merge
- services: all `active`, checkpoint advancing across restarts

## 11. Commits (chronological)

`38d1de2cb` keyscan engine+GPU kernel+puzzle CLI · `dc35e575a` U256 Ord fix ·
`08a2dc009` UI v1 · `e42bfff34` UI v2 (puzzle card, vault, milestones, catalog) ·
`ea65e3e55` in-scanner hit backup + `--hit-cmd` · `d946b9161` UI JS newline fix ·
`42ebf640b` U256 borrow/resume-rate fix + `~/btcunlock/` layout ·
`5c36615f9` regcap 80 tuning · `01a9d8449` kangaroo · `9caf32447` README/docs ·
`0a280b7ac` Stream-4 integration (units, dashboard, agent) ·
`4f64e7709` daily-restart log bound

## 12. Operational cheatsheet

```bash
# status
systemctl --user status zion-btcunlock zion-btcunlock-ui
tail -f ~/btcunlock/p71.log
curl -s 127.0.0.1:8777/api/status | python3 -m json.tool

# resume after reboot/manual
cd ~/2.9.6-main/BTCunlock
./target/release/btcunlock puzzle 71 --gpu --stride 16 --batch 262144 \
    --checkpoint ~/btcunlock/p71.ckpt --resume

# hits (mode 600 — private keys!)
ls -l ~/btcunlock/btcunlock-hits/
```
