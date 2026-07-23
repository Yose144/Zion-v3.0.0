# ZION Trinity Miner — SMOS Edition (Private)

**Version:** `v3.1.9-vega-complete-70`
**Target rig:** `ZionRig` / `vega-smos` (AMD Vega 64 8GB `gfx900`, Intel Pentium G4560)
**Pool:** `62.171.141.136:8444`
**Status:** LIVE — triple stream (ZION GPU + ZANO GPU + VRSC CPU) aktivní a stabilní

> ⚠️ **PRIVATE** — tento adresář obsahuje interní build skripty, wallet adresy,
> IP Edge serveru a SMOS API token. Nepublikovat do `public/` repozitáře.

---

## Obsah adresáře

```
Smos/
├── README.md                              # tento soubor
├── zion-miner-smos-v3.1.9-vega-complete-62  # Linux x86_64 binárka (GLIBC 2.31+)
├── wrapper_complete.sh                    # SMOS wrapper script (env vars + download + exec)
├── build_complete.sh                      # Docker build script (rust:1.97.0-bullseye)
└── DEPLOY.md                              # postup nasazení na SMOS
```

---

## Trinity — co těží

| Stream | Coin  | Algo            | Device | Hashrate (Vega 64) |
|--------|-------|-----------------|--------|--------------------|
| 1      | ZION  | deeksha_lite_v1 | GPU    | ~12–15 kH/s        |
| 2      | ZANO  | progpow_zano    | GPU    | ~9.0–9.5 MH/s      |
| 3      | VRSC  | verushash       | CPU    | ~1.3–1.4 MH/s      |

**Shares/min (pozorováno):** ~60–70 accepted (ZION ~45, VRSC ~8, ZANO ~2)

---

## SMOS Console Output

SMOS web konzole ukazuje mining output po fixu `ZION_NO_STICKY=1`:

```
[2026-07-22 04:10:44] SHARE_ACCEPTED  job=1280  height=1280  nonce=15905545273570  algo=deeksha_lite_v1  latency_ms=73
external_stream job=1280 coin=ZANO algo=progpow_zano
external_stream_cpu job=1280 coin=VRSC algo=verushash
```

### Proč není TUI

SMOS používá pseudo-TTY (`isatty()` vrací `true`), ale `/dev/tty` není připojen
k web konzoli. Sticky header mode redirectoval stdout → `/dev/null` a TUI write
selhával. Proto:

- `ZION_NO_STICKY=1` vypíná sticky header (používá se na SMOS/Docker/pipe)
- `ZION_INTERACTIVE=0` vypíná TUI
- Output jde přes `raw_stdout()` (write(2) syscall) bypass Rust 8KB block buffer
- SMOS má 19-line ring buffer — ukazuje posledních 19 řádků outputu

Pro TUI je potřeba reálný terminál (SSH na rig nebo lokální spuštění).

---

## Build

### Požadavky

- Docker na Edge serveru (`62.171.141.136`)
- Zdrojový kód v `/home/zionserver/zion-build-local/` (rsync z Macu)
- `rust:1.97.0-bullseye` Docker image (GLIBC 2.31 — kompatibilní se SMOS)

### Postup

```bash
# 1. Lokální build na Macu (pro syntax check)
cd /Users/yeshuae/Projects/2.9.6/V3
cargo build --release -p zion-miner \
  --features gpu-metal,native-hashers,native-verushash,native-randomx

# 2. Sync zdroje na Edge
rsync -avz --exclude='.git' --exclude='target' \
  -e 'ssh -i ~/.ssh/zion-new-server -p 2222' \
  . root@62.171.141.136:/home/zionserver/zion-build-local/

# 3. Docker build na Edge (Linux x86_64, GLIBC 2.31)
ssh -i ~/.ssh/zion-new-server -p 2222 root@62.171.141.136 \
  '/tmp/build_complete.sh'
```

Viz `build_complete.sh` pro detaily. Binárka se instaluje do
`/var/www/zion-miner/zion-miner` (nginx servuje na `http://62.171.141.136/zion-miner/`).

---

## Deploy na SMOS

### ZIP balíček

SMOS očekává ZIP s adresářovou strukturou `<name>/miner` (spustitelný wrapper):

```bash
ssh -i ~/.ssh/zion-new-server -p 2222 root@62.171.141.136 << 'EOF'
V="v3.1.9-vega-complete-70"
Z="zion-miner-${V}.zip"
F="zion-miner-${V}"
rm -rf /tmp/$F && mkdir -p /tmp/$F
# v70 binary is the stable build (v71 crashed, v72/v73 4M/2M lower hashrate)
cp /var/www/zion-miner/zion-miner-v3.1.9-vega-complete-70.zip /tmp/v70.zip
unzip -o /tmp/v70.zip -d /tmp/v70x >/dev/null
cp /tmp/v70x/zion-miner-v3.1.9-vega-complete-70/miner /tmp/$F/miner
cp /tmp/wrapper_complete.sh /tmp/$F/miner
chmod +x /tmp/$F/miner
cd /tmp && rm -f /var/www/zion-miner/$Z
zip -r /var/www/zion-miner/$Z $F/
EOF
```

### SMOS API — nasazení

```bash
# 1. Nastavit minerOptions na rig group (URL ZIPu)
curl -s -X PUT \
  -H "X-AUTH-TOKEN: <SMOS_API_TOKEN>" \
  -H "Content-Type: application/json" \
  https://api.simplemining.net/rig-groups/1773590 \
  -d '{"minerOptions":"http://62.171.141.136/zion-miner/zion-miner-v3.1.9-vega-complete-70.zip"}'

# 2. Smazat staré cache na rigu
curl -s -X PATCH \
  -H "X-AUTH-TOKEN: <SMOS_API_TOKEN>" \
  -H "Content-Type: application/merge-patch+json" \
  https://api.simplemining.net/rigs/execute-command \
  -d '{"rigIds":[518837],"commandId":7,"commandOptions":"rm -rf /root/miner/zion-miner-v3.1.9-vega-* /var/tmp/miner/zion-miner-v3.1.9-vega-* /root/miner_org/zion-miner-v3.1.9-vega-* ; echo OK"}'

# 3. Reboot rigu (ne reload — reload nestáhne nový ZIP)
curl -s -X PUT \
  -H "X-AUTH-TOKEN: <SMOS_API_TOKEN>" \
  -H "Content-Type: application/json" \
  https://api.simplemining.net/rigs/518837 \
  -d '{"execute":"reboot"}'
```

⚠️ **Cloudflare blokuje** commandOptions obsahující "curl" nebo "wget".
Pro download z rigu používá wrapper `curl` (to je OK — blokace je jen v SMOS
API commandOptions, ne v samotném wrapper skriptu).

---

## Konfigurace — Env Vars

### Core

| Var | Default | Popis |
|-----|---------|-------|
| `ZION_GPU_BACKEND` | `opencl` | GPU backend (opencl/metal) |
| `ZION_PROFILE` | `pool` | pool/solo/benchmark |
| `ZION_LOOP_COUNT` | `1000000` | počet iterací |
| `ZION_VERBOSE` | `1` | verbose output |
| `ZION_INTERACTIVE` | `0` | TUI (0=vypnuto, SMOS) |
| `ZION_NO_STICKY` | `1` | vypne sticky header (SMOS/Docker) |
| `ZION_METRICS_REPORT_SECS` | `15` | interval status outputu |
| `ZION_STATS_FILE` | `/tmp/zion-miner-stats.json` | JSON stats file |

### GPU / Autotune

| Var | Value | Popis |
|-----|-------|-------|
| `ZION_AUTOTUNE` | `1` | automatické ladění nonce count |
| `ZION_AUTOTUNE_SECS` | `3` | interval autotune |
| `ZION_IGNORE_GPU_SELF_TEST_FAIL` | `1` | ignorovat self-test fail |
| `ZION_OCL_BUILD_OPTS` | `-cl-std=CL1.2 -cl-mad-enable` | OpenCL build opts |

### ZION (Deeksha Lite v1)

| Var | Value | Popis |
|-----|-------|-------|
| `ZION_MINER_ALGORITHM` | `deeksha_lite_v1` | ZION PoW algo |
| `ZION_GPU_WORK_SIZE` | `16384` | GPU work size |
| `ZION_NONCE_COUNT` | `32768` | nonce count na batch |
| `ZION_NONCE_COUNT_MIN` | `16384` | min pro autotune |
| `ZION_NONCE_COUNT_MAX` | `131072` | max pro autotune |
| `ZION_GPU_MAX_BATCH` | `16384` | max batch size |
| `ZION_GPU_EARLY_BREAK` | `1` | early break na solution |
| `ZION_GPU_NO_STREAM_BYPRODUCT` | `1` | žádné byproduct streamy |

### Trinity

| Var | Value | Popis |
|-----|-------|-------|
| `ZION_STREAM1_ENABLED` | `1` | ZION GPU stream |
| `ZION_STREAM2_ENABLED` | `1` | ZANO GPU stream |
| `ZION_STREAM2_FORCE_COIN` | `ZANO` | force ZANO coin |
| `ZION_STREAM3_ENABLED` | `1` | VRSC CPU stream |
| `ZION_MINER_CPU_COIN` | `VRSC` | CPU coin |
| `ZION_EXT_CPU_NONCE_COUNT` | `2000000` | CPU nonce count |

### ZANO / ProgPoWZ (Vega 64 8GB)

| Var | Value | Popis |
|-----|-------|-------|
| `ZION_EXT_GPU_TIME_DUTY_PCT` | `100` | GPU duty cycle % |
| `ZION_SECONDARY_GPU_WORK_SIZE` | `1000000` | ZANO work size (1M highest stable) |
| `ZION_AUXPOW_GPU_WORK_SIZE` | `1000000` | AuXpow internal cap |
| `ZION_AUXPOW_GPU_GROUP_SIZE` | `128` | lws (256 hangs on Vega) |
| `ZION_AUXPOW_GPU_USE_BPERMUTE` | `1` | use ds_bpermute (group 128 safe) |
| `ZION_AUXPOW_GPU_VRAM_PCT` | `40` | VRAM % pro DAG |
| `ZION_AUXPOW_GPU_BYTES_PER_ITEM` | `64` | bytes per item |
| `ZION_ZANO_STALE_SECS` | `30` | stale threshold (s) |

---

## Troubleshooting

### Konzole ukazuje jen 19 řádků startup

- `ZION_NO_STICKY=1` musí být nastaveno (jinak sticky header redirect stdout→/dev/null)
- Po změně wrapperu je potřeba **reboot** (ne reload) — reload nestáhne nový ZIP
- SMOS má 19-line ring buffer — staré bash commandy ("Running User Bash commands...")
odtlačují miner output. Neposílat zbytečně bash commandy přes SMOS API.

### ZANO kernel hang / context lost

- `ZION_AUXPOW_GPU_GROUP_SIZE=256` + `USE_BPERMUTE=1` → `amdgpu` context lost / hang na Vega 64 GCN
- Fix: `ZION_AUXPOW_GPU_GROUP_SIZE=128` + `USE_BPERMUTE=1` → ~9.5 MH/s stable
- `ZION_AUXPOW_GPU_WORK_SIZE=4000000` (4M) → lower hashrate (~7.5 MH/s) a méně accepted shares
- Optimal: `ZION_AUXPOW_GPU_WORK_SIZE=1000000` (1M)
- Pool log: `auxpow_gpu_kernel_hang elapsed_ms=30003 timeout=30s aborting batch`

### ZANO stale shares

- `ZION_ZANO_STALE_SECS=30` — shares starší než 30s se rejectují lokálně
- Pool log: `external_share_stale miner=local-miner coin=ZANO — rejecting locally`

### Pool crash: TLS port 8448 conflict

- Node (L1) poslouchá na `127.0.0.1:8448`
- Pool se snaží bind `0.0.0.0:8448` → `Address already in use`
- Fix: zakomentovat `ZION_POOL_TLS_BIND` v `/etc/zion/edge-environment.sh`

---

## Edge Server

- **IP:** `62.171.141.136`
- **SSH:** `ssh -i ~/.ssh/zion-new-server -p 2222 root@62.171.141.136`
- **Pool:** `62.171.141.136:8444` (stratum)
- **Miner binary URL:** `http://62.171.141.136/zion-miner/zion-miner`
- **ZIP URL:** `http://62.171.141.136/zion-miner/zion-miner-v3.1.9-vega-complete-70.zip`
- **Build dir:** `/home/zionserver/zion-build-local/`
- **Nginx root:** `/var/www/zion-miner/`

---

## SMOS API

- **Endpoint:** `https://api.simplemining.net`
- **Auth:** `X-AUTH-TOKEN` header
- **Rig ID:** `518837` (ZionRig / vega-smos)
- **Rig Group ID:** `1773590`
- **Command ID:** `7` (User Bash)
- **Cloudflare blokuje:** commandOptions s "curl" nebo "wget" klíčovými slovy

### Užitečné API volání

```bash
# Stav rigu (uptime, hash, console)
curl -s -H "X-AUTH-TOKEN: <TOKEN>" https://api.simplemining.net/rigs/518837

# Reload rigu
curl -s -X PUT -H "X-AUTH-TOKEN: <TOKEN>" -H "Content-Type: application/json" \
  https://api.simplemining.net/rigs/518837 -d '{"execute":"reload"}'

# Reboot rigu
curl -s -X PUT -H "X-AUTH-TOKEN: <TOKEN>" -H "Content-Type: application/json" \
  https://api.simplemining.net/rigs/518837 -d '{"execute":"reboot"}'

# Spuštění bash commandu na rigu
curl -s -X PATCH -H "X-AUTH-TOKEN: <TOKEN>" \
  -H "Content-Type: application/merge-patch+json" \
  https://api.simplemining.net/rigs/execute-command \
  -d '{"rigIds":[518837],"commandId":7,"commandOptions":"<CMD>"}'
```

---

## Verze historie

| Verze | Datum | Změny |
|-------|-------|-------|
| v3.1.9-vega-complete-60 | 2026-07-21 | isatty check pro sticky header |
| v3.1.9-vega-complete-61 | 2026-07-21 | raw_stdout() bypass Rust buffer |
| v3.1.9-vega-complete-62 | 2026-07-21 | ZION_NO_STICKY env var, gws 6M→2M, ZION_VERBOSE=1 |
| v3.1.9-vega-complete-70 | 2026-07-23 | ZANO stable ~9.5 MH/s on Vega 64 (bpermute+group 128, work size 1M) |
