# V3 Trinity — Trojstreamové těžení (ZION + ZANO + VRSC)

## Přehled

V3 Trinity je architektura, při které miner udržuje **jednu V3 protokolovou
spojení** s ZION poolem. Pool do každé Job zprávy vkládá externí streamy
(`external_stream` pro GPU, `external_stream_cpu` pro CPU) a miner těží
všechny tři streamy paralelně:

| Stream | Coin  | Algoritmus    | Backend | Popis                          |
|--------|-------|---------------|---------|--------------------------------|
| 1      | ZION  | deeksha_lite  | GPU     | Kanonický L1 blok              |
| 2      | ZANO  | progpow_zano  | GPU/CPU | AuxPoW (pool forwarduje share) |
| 3      | VRSC  | verushash     | CPU     | AuxPoW (pool forwarduje share) |

## Architektura

```
  SMOS Rig (Miner)                    Edge Server (Pool)
  ┌──────────────┐                   ┌──────────────────────┐
  │  V3PoolClient│◄─── V3 TCP ──────►│  Stratum V3 Handler  │
  │  (1 spojení) │                   │  (port 8444)         │
  │              │   Hello/Welcome   │                      │
  │  Stream 1    │   Job (ZION+ext)  │  Template Feed Loop  │
  │  Stream 2    │   Submit/Result   │  (L1 RPC getTemplate)│
  │  Stream 3    │   ExtSubmit/ExtRes│                      │
  └──────────────┘                   │  AuxPoW Bridge:      │
                                     │   ├─ ZANO (HeroMin.) │
                                     │   └─ VRSC (LuckPool) │
                                     └──────────────────────┘
```

## Datový tok

1. **Pool** pravidelně (5s) volá `getTemplate` z L1 nodu → ZION block template
2. **Pool** zeptá AuxPoW bridge na aktuální ZANO a VRSC joby
3. **Pool** sestaví V3 Job zprávu se `external_stream` (ZANO) a `external_stream_cpu` (VRSC)
4. **Pool** odešle Job všem připojeným V3 minerům
5. **Miner** přijme Job, rozešle bundle do Stream 1/2/3
6. **Miner** Stream 1: GPU deeksha scan → Submit → Result
7. **Miner** Stream 2: CPU progpow_zano scan → ExternalSubmit → ExternalResult
8. **Miner** Stream 3: CPU verushash scan → ExternalSubmit → ExternalResult
9. **Pool** forwarduje ExternalSubmit do upstream poolu (HeroMiners/LuckPool)
10. **Pool** přijme výsledek z upstream poolu → pošle ExternalResult minerovi

## Konfigurace

### Miner (SMOS wrapper)

Viz `V31/scripts/smos/wrapper_v31_trinity.sh`. Klíčové env proměnné:

| Proměnná                | Default  | Popis                              |
|-------------------------|----------|------------------------------------|
| `ZION_V3_TRINITY`       | 1        | Aktivuje V3 Trinity mode           |
| `ZION_NO_V3_TRINITY`    | (unset)  | Pokud =1, vypne Trinity (fallback) |
| `ZION_TRINITY_EXT_GPU`  | 0        | Pokud =1, GPU pro Stream 2 (ZANO)  |
| `ZION_GPU_BACKEND`      | opencl   | GPU backend pro Stream 1           |
| `ZION_GPU_WORK_SIZE`    | 16384    | GPU work size pro deeksha          |
| `ZION_NONCE_COUNT`      | 65536    | Počet nonce na batch (ZION)        |
| `ZION_MINER_THREADS`    | 4        | CPU vlákna pro Stream 3 (VRSC)     |

### Pool (Edge server)

Pool environment (`/opt/zion/V31/.env`):

| Proměnná                    | Popis                                    |
|-----------------------------|------------------------------------------|
| `ZION_POOL_AUXPOW_COINS`    | Seznam aktivních coinů (ZANO,VRSC)       |
| `ZION_POOL_AUXPOW_WALLET`   | Výplatní adresa pro upstream pooly       |
| `ZION_POOL_AUXPOW_WALLET_ZANO` | Per-coin wallet override (ZANO)       |
| `ZION_POOL_AUXPOW_WALLET_VRSC` | Per-coin wallet override (VRSC)       |

## Nonce Progression

Miner udržuje `zion_nonce_cursor` (AtomicU64). Při každém novém Jobu se
cursor resetuje na `job.start_nonce` (pool posílá 0). Při každém batchu
se cursor posune o `batch_size` dopředu, takže miner neprohledává stále
stejný rozsah nonces.

## Auto-Reconnect

`run_v3_trinity` má vnější reconnect smyčku s exponenciálním backoffem
(3s → 6s → 12s → ... → max 60s). Při restartu poolu nebo výpadku sítě
se miner automaticky znovu připojí.

## GPU Time-Slicing

Na single-GPU rige (SMOS) je GPU vyhrazeno pro Stream 1 (ZION deeksha).
Externí streamy (ZANO, VRSC) používají CPU, aby se vyhnuly GPU mutex
kolizi. Pro dual-GPU setup lze nastavit `ZION_TRINITY_EXT_GPU=1`.

## ZANO Bridge Fix (2026-08-07)

**Root cause:** `eth_getWork` polling task se ukončil při chybě
`send_notification` (connection closed). Po reconnectu se polling
nerestartoval → pool nedostával žádné ZANO joby.

**Fix:** Polling task se neukončí při chybě, jen loguje a čeká na další
tick. Po reconnectu se polling restartuje jako safety net.

## Deployment

### Build (lokálně + Docker na Edge)

```bash
# Lokální build (macOS)
cd V31 && cargo build --release -p zion-miner --features auxpow,gpu-opencl

# Edge Docker build (Ubuntu 18.04 + OpenCL)
rsync -avz --exclude='target' --exclude='.git' \
  -e "ssh -i ~/.ssh/zion-edge-post-wipe-2026-07-29 -p 2222" \
  V31/L1/miner/src/ root@62.171.141.136:/opt/zion/V31-build/L1/miner/src/

ssh -i ~/.ssh/zion-edge-post-wipe-2026-07-29 -p 2222 root@62.171.141.136 \
  'docker run --rm -v /opt/zion/V31-build:/workspace \
   -v /opt/zion/cargo-cache:/root/.cargo/registry \
   -w /workspace ubuntu:18.04 bash -c "
     apt-get update -qq && apt-get install -y -qq curl build-essential \
     pkg-config libssl-dev ocl-icd-opencl-dev
     curl --proto =https --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y
     source /root/.cargo/env
     cargo build --release -p zion-miner --features auxpow,gpu-opencl
     cp target/release/zion-miner /workspace/zion-miner-v31
   "'

# Upload binary + reload SMOS
scp -i ~/.ssh/zion-edge-post-wipe-2026-07-29 -P 2222 \
  V31-build/zion-miner-v31 root@62.171.141.136:/var/www/zion-miner/

curl -X PATCH -H "X-AUTH-TOKEN: <token>" \
  -H "Content-Type: application/merge-patch+json" \
  "https://api.simplemining.net/rigs/execute-reload" -d '{"rigIds":[518837]}'
```

### Verifikace

Pool logy:
```bash
ssh -i ~/.ssh/zion-edge-post-wipe-2026-07-29 -p 2222 root@62.171.141.136 \
  'journalctl -u zion-v31-pool --since "5 min ago" | grep -E "v3_hello|v3_share|external_submit"'
```

Miner konzole (SMOS API):
```
v3_trinity connected pool=62.171.141.136:8444 miner=zion1s6m...
v3_trinity gpu_external coin=ZANO job_id=0x... height=3805669
v3_trinity cpu_external coin=VRSC job_id=4f05f6d height=0
v3_trinity mined_ext_share stream=GpuExternal coin=ZANO nonce=12345
```
