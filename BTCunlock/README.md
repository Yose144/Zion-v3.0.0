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

## GPU pipeline (src/gpu/kernel.cl)

```
per combo (1 work-item):  word indices → entropy → SHA-256 checksum
                          → phrase → U1 = HMAC-SHA512(phrase, salt‖1)
pbkdf2_step (×4 launches): Uᵢ = HMAC(Uᵢ₋₁); T ⊕= Uᵢ   (512 iters/launch)
host (rayon):            seed → BIP32 path → hash160 → target set
```

PBKDF2 is chunked across launches because a 2048-round HMAC loop inside a
single work-item trips per-item execution limits on Apple OpenCL
(~75 % of items silently die — measured; chunked loses zero). GPU↔CPU
seed parity is covered by `gpu::tests::gpu_cpu_parity` (run with
`cargo test --features gpu -- --ignored`).

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
