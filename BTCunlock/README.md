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
  dedupes before PBKDF2 (CPU) / before derive (GPU), so you only pay once

| words | permutations | 12-word rate | GTX 1070 est. |
|-------|--------------|--------------|----------------|
| 12    | 479 001 600  | ~1/16 valid  | ~minutes       |
| 15    | 1.31 T       | ~1/32 valid  | hours–days     |
| 18    | 6.4 × 10^15  | ~1/64 valid  | impractical    |
| 24    | 6.2 × 10^23  | ~1/256 valid | never          |

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

`--batch` default 1 M per launch; raise to `4194304` if VRAM is free
(each result slot is 392 B — 4 M batch ≈ 33 MB states buffer, trivial).

The kernel self-heals: a work-item killed mid-PBKDF2 (driver limits,
thermal reaping) breaks its chain tag and the host recomputes that
phrase on CPU — you'll see `gpu: repaired N / dropped M` on stderr.

## GPU pipeline (src/gpu/kernel.cl)

```
per combo (1 work-item):  word indices → entropy → SHA-256 checksum
                          → phrase → U1 = HMAC-SHA512(phrase, salt‖1)
pbkdf2_step (×4 launches): Uᵢ = HMAC(Uᵢ₋₁); T ⊕= Uᵢ   (512 iters/launch)
host (rayon):            seed → BIP32 path → hash160 → target set
```

PBKDF2 is chunked across launches because a 2048-round HMAC loop inside a
single work-item trips per-item execution limits on Apple OpenCL
(~75 % of items silently die — measured; chunked loses zero). Each record
carries a chain tag (`OFF_TAG`) extended by every step launch — a killed
item leaves a stale tag and the host CPU-recomputes that phrase, so a
driver-level kill can no longer corrupt a seed silently. GPU↔CPU
seed parity is covered by `gpu::tests::gpu_cpu_parity` +
`gpu_cpu_permute_parity` (run with `cargo test --features gpu -- --ignored`).

Measured on Apple M1 (8 CUs, iGPU): ~0.7 M combos/s. Discrete GPUs
(1070 Ti class) land ~10–50× higher — the whole hot path is SHA-512.

## Feasibility

| missing words | combos        | checksum-valid | M1 GPU   | dGPU     |
|---------------|---------------|----------------|----------|----------|
| 1             | 2 048         | ~8             | instant  | instant  |
| 2             | 4.2 M         | ~16 K          | seconds  | seconds  |
| 3             | 8.6 G         | ~33 M          | ~hours   | ~10 min  |
| 4             | 17.6 T        | ~68 G          | days     | ~day     |

(24-word phrase, 8-bit checksum; 12-word phrases pass ~1/16 — more seeds.)

## Roadmap

- GPU-side secp256k1 + BIP32 (removes the host stage entirely)
- Metal backend (Apple native — OpenCL is deprecated there)
- word-edit-distance mode (typo'd word, not just missing)
- P2TR/xonly target matching, wallet.dat extraction
