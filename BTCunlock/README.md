# BTCunlock

**Offline GPU-accelerated recovery toolkit for your own lost BTC wallets.**

Everything is computed locally. `recover` never touches the network —
no APIs, no telemetry, no address leakage. (`scan` is offline by default;
`--online` opts into esplora balance checks explicitly.)

> Recover wallets **you own**. If the mnemonic isn't yours, this tool is
> not for you — full-entropy brute force is impossible by design (2^128+).

## Build

```bash
cd BTCunlock
cargo build --release                  # CPU only
cargo build --release --features gpu   # + OpenCL GPU backend
```

`./target/release/btcunlock --help`

## `recover` — GPU mnemonic brute-force

You know your address, some mnemonic words are missing/illegible:

```bash
btcunlock recover "legal ? thank ? shrimp ... ... ?" \
    --target bc1qYourKnownAddress... \
    --gpu                          # OpenCL (NVIDIA/AMD/Intel/Apple)
    --pass "optional-25th-word"
```

- `?`, `_`, `x` mark unknown words (up to 6 holes)
- `--target` repeatable, or `--target-file addrs.txt` (one per line);
  accepts P2PKH / P2SH / P2WPKH / P2TR addresses or raw hex
  (40-char hash160, 64-char taproot output key)
- per candidate: checksum → PBKDF2 → BIP32 derive → **target match**
- default paths: `m/{84,49,44}'/c'/0'/0/0`; widen with
  `--purposes`, `--accounts`, `--max-index`, `--change-chain`;
  add purpose `86` to match taproot `bc1p…` targets (BIP86 key-spend)
- `--checkpoint f.ckpt --resume` — survives restarts (progress saved
  every batch; a checkpoint is bound to its phrase template)

Hits print the full mnemonic + path + address to stdout.

## `permute` — all words known, order unknown

You wrote down every word but the sequence is scrambled:

```bash
btcunlock permute "visit kingdom unveil kangaroo deposit found \
great grid remind science umbrella spot" \
    --target bc1q32e3dxcd0n2tlzdmchraf2057d0ax4xdwrk3jq \
    --gpu --checkpoint vault.ckpt --resume
```

- Factoradic (Lehmer) numbering — every perm id 0..n! maps to exactly one
  arrangement; **no repeats** beyond identical words (see below)
- Words are sorted by BIP39 index before numbering — host and GPU decode
  the same ordering
- `--limit N` caps the scan (partial sweeps); `--resume` continues a
  checkpoint; same `--pass`, target, and derivation options as `recover`
- duplicate words: perm ids over map onto the same phrase — the engine
  dedupes before PBKDF2 (CPU) / inside the filter kernel via a persistent
  GPU hash set (GPU), so you only pay once

| words | permutations | checksum rate | GTX 1070 Ti      |
|-------|--------------|---------------|------------------|
| 12    | 479 001 600  | ~1/16 valid   | ~8 min (measured)|
| 15    | 1.31 T       | ~1/32 valid   | ~days            |
| 18    | 6.4 × 10^15  | ~1/64 valid   | impractical      |
| 24    | 6.2 × 10^23  | ~1/256 valid  | never            |

12-word permute is cheap enough to be routine; 15-word needs patience;
18+ is for desperate cases only.

## `fix-mnemonic` — quick listing (≤2 holes)

```bash
btcunlock fix-mnemonic "word ... ? ... word" --derive
```

Prints every checksum-valid completion (+ first BIP84 address) — for eyeballing
a one-word slip. For bigger gaps use `recover` with a `--target`.

## `scan` — derivation-path scanner

The seed is right but the wallet used a different path/script type:

```bash
btcunlock scan "<full mnemonic>" --network mainnet
    --max-index 20 --accounts 2          # offline: prints every address
    --online                             # + esplora balance check
    --api http://localhost:3002/api      # own node (implies --online)
```

Walks BIP44 (P2PKH) / BIP49 (P2SH-P2WPKH) / BIP84 (P2WPKH) × accounts ×
receive/change × indices. `--online` reveals which addresses you look up —
prefer your own esplora.

## `wif` — inspect a WIF key

```bash
btcunlock wif Kx...   # network, compression, pubkey, P2PKH + P2WPKH
```

## `keyscan` — raw private-key range scan (Bitcoin puzzle mode)

Sequential walk of every key in `[start, end)` — compressed pubkey →
hash160 → match. This is the raw form of the 2015 "Bitcoin puzzle"
search: the key is *known* to sit in a range, so a scan is guaranteed to
hit iff the range is covered. It is not ECDLP and gives no shortcut on
arbitrary addresses.

```bash
btcunlock keyscan --start 0x1000000 --end 0x2000000 \
    --target 15JhYXn6Mx3oF4Y7PcTAv2wVVAuCFFQNiP \
    --gpu --stride 8 --batch 1048576 \
    --checkpoint p25.ckpt          # Ctrl-C, then --resume

btcunlock puzzle 25 --gpu           # shorthand: [2^24, 2^25) + the
                                    # published puzzle address
```

- `--start/--end`: big-endian hex, `0x` optional, up to 256 bits
- `--target`: P2PKH / P2WPKH address or 40-hex hash160, repeatable;
  `--target-file` reads one per line
- `--stride` (1–16): keys each GPU work-item walks. All `stride` points
  share ONE Montgomery batch inversion — per-key cost ≈ 1 point add +
  ~5 field muls + hash160, ~10× cheaper than inverting per key
- GPU hits are re-derived and verified on the host before reporting
  (key, WIF, address) — a kernel bug can lose a hit, never fake one
- CPU path does one scalar mult per 64k-chunk then `combine(+G)` steps
- Measured ~27 M keys/s on a shared GTX 1070 Ti (stride 16, batch
  524288, `key_scan` regcap 80) → puzzle #25 (16.7 M keys) in ~0.6 s.
  Realistic reach on one GPU: ~2^45 keys/week. The open puzzles (#71+)
  are range ~2^70 — a full sequential scan is 10^5–10^6 GPU-years;
  running them is a lottery ticket, not a plan
- `puzzle N` resolves the published address for N = 1–160 and marks
  solved ones as self-tests (handy regression checks)

Checkpoint is `btcunlock-keys.ckpt` (or `--checkpoint`), bound to the
range+targets — resume with `--resume` on the same command.

## `kangaroo` — bounded ECDLP (needs the public key)

Pollard's lambda method: given `Q = k·G` with `start ≤ k < end`,
recovers `k` in `~2√(end−start)` group operations instead of a linear
scan. This is the algorithm that actually solves puzzle-range keys —
**but only when the public key is known** (revealed by a spend or
published by the challenge author).

```bash
btcunlock kangaroo 0279be66...f81798 --start 0x1 --end 0x1000000
#                                             ↑ compressed (02/03+64hex)
#                                               or uncompressed (04+128hex)
```

- Tame/wild herds, power-of-two jump set, distinguished points
  (`--dp-bits` memory/time trade-off, auto by default), `--max-steps`
  safety cap (auto ≈ 16√width)
- Candidates are recomputed mod n and **verified against the pubkey and
  the interval** before reporting — no false hits
- Hits persist exactly like keyscan (mode-600 `hits.jsonl` + txt +
  optional `--hit-cmd`)
- **Cannot work on address-only targets.** hash160 hides the pubkey, so
  puzzles like #71 (`pubkey_known: false`) are mathematically out of
  scope — use `keyscan`/`puzzle` for those (lottery), or wait for the
  owner to reveal the key. Open puzzles *with* known pubkeys (#140+)
  are 2^70+ wide — kangaroo cuts them to ~2^70 ops, still impractical.
  Honest reach: ~2^44–2^48 width = minutes on one CPU thread; ~2^56+
  needs a serious DP-server setup (not implemented — single process,
  single pair of walkers)

Self-test: `cargo test --release kangaroo` recovers puzzle #25's key
from its pubkey, plus a ragged non-power-of-two interval.

## Hit backup & alerting (`keyscan`, `puzzle`, `kangaroo`)

Every verified hit is persisted **before** it reaches stdout — a crash
or closed terminal cannot lose a found key:

```
<ckpt_dir>/btcunlock-hits/
├── hits.jsonl                     # append-only index, one JSON/line
└── hit-<ISO>-0x<key>.txt          # human-readable copy
```

Both mode `0600` (they contain the WIF). The record carries key,
key_hex, WIF, address, target, label, range, tested count, timestamp.

`--hit-cmd '<cmd>'` runs a hook per hit with env vars
`BTCUNLOCK_KEY`, `BTCUNLOCK_KEY_HEX`, `BTCUNLOCK_WIF`,
`BTCUNLOCK_ADDRESS`, `BTCUNLOCK_TARGET`, `BTCUNLOCK_LABEL` — e.g.
`scp` the hit file off-site, send a mail/ntfy push.

## Live dashboard — `btcunlock-ui.py`

Self-contained stdlib-only Python web UI, zero dependencies:

```bash
python3 btcunlock-ui.py --port 8777      # http://localhost:8777
```

Shows: live throughput + sparkline, keys tested, range coverage and the
honest "1 in N" odds, puzzle card (id, address, range, OPEN/solved),
GPU telemetry (nvidia-smi), milestones-to-coverage table, open-puzzle
catalog, checkpoint age, copy-ready `--resume` command, log tail, and a
**hits vault** — hits merged from the scanner's `hits.jsonl` into
`hits-vault.json` (mode 600). WIFs are masked in web payloads; reveal
via `GET /api/vault_wif?key=0x…` from localhost only.

Defaults point at `~/btcunlock/` (override with `--log/--ckpt/--vault`).

## Distributed scan — coordinator + workers

Two more stdlib-only scripts turn the single-machine scan into a fleet
operation: the keyspace is split into fixed-size **units** that workers
lease, scan and report — so coverage is systematic instead of every rig
re-walking the same front.

```
                 ┌─────────────────────────────┐
   lease unit →  │ btcunlock-coordinator.py    │ → report done
                 │ state.json · hits/ (600)    │
                 │ :8779 (token-gated writes)  │
                 └──────────────┬──────────────┘
        ┌───────────────────────┼────────────────────────┐
btcunlock-worker.py      worker.py                  worker.py
(GPU rig A)              (rig B)                    (rig C)
```

**Coordinator** (`btcunlock-coordinator.py`) — on any always-on host
(production: Edge, behind nginx TLS at `/lottery/api/`):

```bash
BTCUNLOCK_COORD_TOKEN=<openssl rand -hex 24> \
COORD_STATE=/opt/zion/btcunlock/coordinator-state.json \
COORD_HITS=/opt/zion/btcunlock/hits \
COORD_START=0x400000000000000000 COORD_END=0x800000000000000000 \
COORD_UNIT_SIZE=68719476736 COORD_TARGETS=<puzzle-addr> \
COORD_LABEL="puzzle #71" \
python3 btcunlock-coordinator.py --port 8779
```

Endpoints: `GET /api/status` + `GET /api/units` (public, no secrets);
`POST /api/lease`, `/api/report`, `/api/hit` and `GET /api/vault` need
`Authorization: Bearer <token>`. A lease expires after `COORD_LEASE_TTL`
(default 3 h) — a dead worker wastes at most one unit, which then returns
to the pool automatically. State is one atomic JSON file.

**Worker** (`btcunlock-worker.py`) — wraps `keyscan` per leased unit:

```bash
BTCUNLOCK_COORD_TOKEN=<token> python3 btcunlock-worker.py \
    --coord https://dashboard.zionterranova.com/lottery \
    --worker-id rig-01 --label "GTX 1070 Ti" --gpu
```

Streams scanner output, posts progress every ~20 s, marks units done,
and POSTs hits to the coordinator instantly (the binary still writes its
own mode-600 backup). Signals propagate to the child scan; a mid-unit
kill just lets the lease expire.

**nginx exposure** (Edge pattern): `location /lottery/api/ { allow all;
proxy_pass http://127.0.0.1:8779/api/; }` — GET endpoints stay public
telemetry, POSTs carry the token over TLS. Systemd templates live in
`deploy/` (`zion-btcunlock-coord.service` system unit,
`zion-btcunlock.service` worker user unit).

## Runtime data layout

Keep all run artifacts in one place — the production layout used by
the operator:

```
~/btcunlock/
├── worker.log               # worker + scanner stdout/stderr
├── coord.env                # COORD_URL + TOKEN for worker mode (600)
├── unit-<id>.ckpt           # transient per-unit checkpoints (auto-removed)
├── p71.ckpt / p71.log       # legacy standalone-scan artifacts
├── btcunlock-hits/          # scanner-side hit backup (mode 600)
│   ├── hits.jsonl
│   └── hit-*.txt
├── hits-vault.json          # UI-side merged vault (mode 600)
└── ui.log                   # dashboard server log
```

Start worker + UI detached so they survive the shell:

```bash
cd BTCunlock
setsid nohup nice -n 15 env $(grep -v '^#' ~/btcunlock/coord.env | xargs) \
    python3 btcunlock-worker.py --gpu --stride 16 --batch 262144 \
    --worker-id "$(hostname)" --label "rig" \
    > ~/btcunlock/worker.log 2>&1 < /dev/null &
setsid nohup python3 btcunlock-ui.py --port 8777 \
    --log ~/btcunlock/worker.log \
    > ~/btcunlock/ui.log 2>&1 < /dev/null &
```

## `bench` / `gpu-list`

```bash
btcunlock gpu-list          # OpenCL devices
btcunlock bench --gpu       # combos/s + seeds/s on the real pipeline
```

## Run on a GPU rig (GTX 1070 / Linux)

The GPU backend is **OpenCL** — no CUDA toolkit needed. NVIDIA's driver
ships the OpenCL ICD; the same `kernel.cl` runs unmodified.

```bash
# 1. deps — NVIDIA driver + OpenCL headers + rust
sudo apt install nvidia-driver-535 ocl-icd-opencl-dev opencl-headers git
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh

# 2. source
git clone https://github.com/Yose144/Zion-v3.0.0.git
cd Zion-v3.0.0/BTCunlock

# 3. build + verify
cargo build --release --features gpu
./target/release/btcunlock gpu-list        # expect: GeForce GTX 1070
cargo test --release --features gpu -- --ignored   # GPU↔CPU parity

# 4. run — e.g. the 12-word permutation vault
./target/release/btcunlock permute "<12 words>" \
    --target bc1q... --gpu --checkpoint run.ckpt
# detach-safe: Ctrl-C anytime, restart with --resume
```

`--batch` default 16 M per launch for `recover` (4 M for `permute`).
Bigger batches matter: the PBKDF2 stage runs one work-item per
checksum-valid candidate and needs ≥64k parallel chains to saturate a
dGPU — at 24-word's 1/256 pass rate that means ~16M-combo batches.
VRAM cost: states buffer = batch/8 × 520 B (16 M → ~1.1 GB).

The kernel self-heals: a work-item killed mid-PBKDF2 (driver limits,
thermal reaping) breaks its chain tag and the host recomputes that
phrase on CPU — you'll see `gpu: repaired N / dropped M` on stderr.

## GPU pipeline (src/gpu/kernel.cl)

```
bip39_filter (1 item/combo): word indices → entropy → SHA-256 checksum
                          → phrase → U1 = HMAC-SHA512(phrase, salt‖1)
                          → record stores HMAC midstates hin/hout
pbkdf2_step (×4 launches): Uᵢ = SHA512(hin‖Uᵢ₋₁) → SHA512(hout‖·); T ⊕= Uᵢ
                          (512 iters/launch, 2 compressions/iter)
derive_match (1 item/seed): BIP32 tree walk on device — secp256k1 field
                          arithmetic, Jacobian point ops, fixed-base
                          4-bit-window k·G table (built on host at init),
                          RIPEMD-160 hash160 + BIP341 TapTweak → target scan
host:                    only hits + dead items come back over PCIe;
                         each hit seed is re-derived on CPU for reporting
key_scan (item=stride keys): k₀·G via the window table, then stride−1
                         Jacobian +G additions; ONE Montgomery batch
                         inversion → affine → hash160 → target match.
                         Hits carry the absolute key; host re-verifies
```

The compression functions use a circular `W[16]` message schedule under
`#pragma unroll` — register-resident after unrolling. (Do NOT hand-unroll
via macros: NVIDIA's frontend miscompiles the expanded form — verified
on GTX 1070 Ti, 2026-09. `#pragma unroll` is the portable fast path.)

The HMAC midstates are computed once in `emit_if_valid` (k0 = phrase‖0,
or SHA-512(phrase) when plen > 128) — `pbkdf2_step` then never touches
the phrase, and each PBKDF2 iteration costs 2 compressions instead of 4.

On NVIDIA the stages are built with separate `-cl-nv-maxrregcount`
caps (filter 40 / step 64 / **key_scan 80**) — register pressure limits
occupancy, and the right cap roughly doubles throughput. key_scan
measured on GTX 1070 Ti: 64→22.0, **80→26.6**, 96→23.3, 255→9.7 Mk/s
(≥96 also balloons JIT compile time to minutes; NVIDIA caches binaries
per option string, so a once-compiled config starts instantly).
Override with `KERNEL_OPTS` (all) or per-stage `KERNEL_OPTS_FILTER` /
`KERNEL_OPTS_STEP` / `KERNEL_OPTS_KEYSCAN`.

PBKDF2 is chunked across launches because a 2048-round HMAC loop inside a
single work-item trips per-item execution limits on Apple OpenCL
(~75 % of items silently die — measured; chunked loses zero). Each record
carries a chain tag (`OFF_TAG`) extended by every step launch — a killed
item leaves a stale tag and the host CPU-recomputes that phrase, so a
driver-level kill can no longer corrupt a seed silently. GPU↔CPU
seed parity is covered by `gpu::tests::gpu_cpu_parity` +
`gpu_cpu_permute_parity` (run with `cargo test --features gpu -- --ignored`).
`BTCUNLOCK_DEBUG=1` prints per-stage batch timings to stderr.

Measured (bench template, 24-word/3-hole): Apple M1 ~0.7 M combos/s;
**GTX 1070 Ti ~9.6 M combos/s / ~37 k seeds/s** (filter ~43 M/s,
pbkdf2 ~42 k seeds/s at 32 M batch). With GPU-side stage 4 the host is
out of the loop — a 12-word/2-hole recovery (4.2 M combos) completes
end-to-end in ~11 s on a busy GTX 1070 Ti (~400 k combos/s including
BIP32+match), vs ~67 s when the host derived every seed.

## Feasibility

| missing words | combos        | checksum-valid | M1 GPU   | GTX 1070 Ti |
|---------------|---------------|----------------|----------|-------------|
| 1             | 2 048         | ~8             | instant  | instant     |
| 2             | 4.2 M         | ~16 K          | seconds  | instant     |
| 3             | 8.6 G         | ~33 M          | ~hours   | ~15 min     |
| 4             | 17.6 T        | ~68 G          | days     | ~3 weeks    |

(24-word phrase, 8-bit checksum; 12-word phrases pass ~1/16 — more seeds.)

## Security & legal-use boundaries

- Recover **your own** wallets and public challenge puzzles only.
  Full-entropy brute force of arbitrary mnemonics is 2^128+ — impossible
  by design; address-only key search is a lottery, not an attack.
- Hit records and the UI vault contain raw private keys (WIF) — mode
  `0600`, never commit them, never world-read them. `--hit-cmd` hooks
  that copy hits elsewhere inherit that responsibility.
- The dashboard binds where you tell it; exposing it on a LAN reveals
  masked hits but the `/api/vault_wif` endpoint answers WIFs to any
  localhost client — keep it on 127.0.0.1 or protect it.

## Roadmap

- Metal backend (Apple native — OpenCL is deprecated there)
- word-edit-distance mode (typo'd word, not just missing)
- P2TR script-path (merkle-root) targets, wallet.dat extraction
- kangaroo: multi-walker parallelism + DP server, GPU kernel port
