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
  accepts P2PKH / P2SH / P2WPKH addresses or raw 40-hex hash160
- per candidate: checksum → PBKDF2 → BIP32 derive → **target match**
- default paths: `m/{84,49,44}'/c'/0'/0/0`; widen with
  `--purposes`, `--accounts`, `--max-index`, `--change-chain`
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
                          RIPEMD-160 hash160 → target scan
host:                    only hits + dead items come back over PCIe;
                         each hit seed is re-derived on CPU for reporting
```

The compression functions use a circular `W[16]` message schedule under
`#pragma unroll` — register-resident after unrolling. (Do NOT hand-unroll
via macros: NVIDIA's frontend miscompiles the expanded form — verified
on GTX 1070 Ti, 2026-09. `#pragma unroll` is the portable fast path.)

The HMAC midstates are computed once in `emit_if_valid` (k0 = phrase‖0,
or SHA-512(phrase) when plen > 128) — `pbkdf2_step` then never touches
the phrase, and each PBKDF2 iteration costs 2 compressions instead of 4.

On NVIDIA the two stages are built with separate `-cl-nv-maxrregcount`
caps (filter 40 / step 64) — register pressure limits occupancy, and the
cap roughly doubles throughput. Override with `KERNEL_OPTS` (both) or
`KERNEL_OPTS_FILTER` / `KERNEL_OPTS_STEP` (per stage).

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

## Roadmap

- Metal backend (Apple native — OpenCL is deprecated there)
- word-edit-distance mode (typo'd word, not just missing)
- P2TR/xonly target matching, wallet.dat extraction
