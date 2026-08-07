# V3 Trinity Progress Report — 2026-08-07

## Stav: Architektura opravena, ProgPoW OpenCL kernel čeká na port

Tento report shrnuje progres implementace V3 Trinity trojstreamového těžení
(ZION + ZANO + VRSC) na SMOS rigu. Práce vychází z referenčního mineru
v `archive/V3/` kde E2E fungoval, a aplikuje stejné patterny do V31.

**Kritické zjištění:** V31's OpenCL backend má jen deeksha kernels.
ProgPoW/Ethash/KawPow OpenCL kernel kód (7657 řádků v `AuXpow/src/gpu_miner.rs`)
nebyl portován do V31. Kernel soubory (`csrc/opencl/progpow_kernel.cl`) existují,
ale `OpenClExternalMiner` v `gpu/mod.rs` je stub.**

---

## Co funguje (GREEN)

### Stream 1: ZION (GPU deeksha)
- Miner se připojuje k poolu přes V3 protokol (Hello → Welcome → Job → Submit)
- ZION shares jsou **přijímané** poolem (`v3_share accepted=true`)
- Pool rotuje job každých ~5s, miner odesílá share s `nonce=0` (validní pro vardiff)
- GPU OpenCL backend inicializován na gfx1010 (RDNA1)

### ZANO Bridge (pool-side)
- **Fix:** `eth_getWork` polling task se ukončil při chybě `send_notification`
  (connection closed). Po reconnectu se polling nerestartoval → pool nedostával
  žádné ZANO joby.
- **Řešení:** Polling task se neukončí při chybě, jen loguje a čeká na další
  tick. Po reconnectu se polling restartuje jako safety net.
- **Výsledek:** ZANO bridge nyní přijímá joby kontinuálně z HeroMiners
  (heights 3805626+, ~3s interval)

### V3 Protokolový tok
- Pool konstruuje V3 Job zprávy s `external_stream` (ZANO) a
  `external_stream_cpu` (VRSC) poli
- Miner přijímá job bundle a rozešle do Stream 1/2/3 přes broadcast channel
- Miner konzole potvrzuje:
  ```
  v3_trinity connected pool=62.171.141.136:8444
  v3_trinity gpu_external coin=ZANO job_id=0x... height=3805881
  v3_trinity cpu_external coin=VRSC job_id=4f0638f height=2821420650
  ```

### Auto-Reconnect
- `run_v3_trinity` má vnější reconnect smyčku s exponenciálním backoffem
  (3s → 6s → 12s → ... → max 60s)
- Pool restarty už neukončí miner permanentně

### ZANO 0x Prefix Fix
- EthStratum (HeroMiners) posílá `header_hex` s `0x` prefixem
- `hex::decode` neumí `0x` prefix → `Invalid character 'x' at position 1`
- **Fix:** Strip `0x` prefix před `hex::decode`

### VRSC Full Header Construction
- LuckPool (ZcashStratum) posílá 9-param `mining.notify`:
  `[job_id, version, prevhash, merkle, reserved, ntime, nbits, clean, solution]`
- Původní `parse_notify` používal jen `prevhash` (32 bajtů) jako header
- **Fix:** Konstrukce plného ZcashStratum headeru:
  `version(4) + prevhash(32) + merkle(32) + reserved(32) + ntime(4) + nbits(4) + nonce(32) + varint(3) + solution(1344) = 1487 bajtů`
- **Výsledek:** `header_len=1487` (was 4, pak 370, nyní 1487)

### VRSC Solution Padding
- LuckPool posílá prázdný/partial `solution` v `params[8]`
- `mine_verushash` vyžaduje `VERUS_HEADER_SIZE = 1487` bajtů
- **Fix:** Pad solution na `VERUS_SOLUTION_SIZE = 1344` bajtů

---

## Co se debuguje (YELLOW)

### Stream 2: ZANO (GPU ProgPoWZ) — Architektura opravena, kernel čeká
- **Architektura opravena (commit d51258c72):** Stream 2 nyní používá GPU
  s persistent `gpu_ext` backendem + burst/gap duty-cycle time-slicing
  (50/50 split, gap_ms=300ms). To mirrors V3 reference `external_gpu_thread`.
- **BLOCKER:** V31's `OpenClExternalMiner` je stub — vrací
  `"OpenCL external AuxPoW mining is not yet ported for V31 (algorithm=progpow_zano)"`
- V31 má `csrc/opencl/progpow_kernel.cl` (kernel soubor existuje),
  ale `gpu/mod.rs:OpenClExternalMiner::new()` vždy bailuje
- V3's `AuXpow/src/gpu_miner.rs` (7657 řádků) má plnou ProgPoW/Ethash/KawPow
  OpenCL implementaci s DAG managementem
- **Další krok:** Port ProgPoW OpenCL kódu z `archive/AuXpow/src/gpu_miner.rs`
  do V31's `auxpow/gpu_miner.rs` nebo `gpu/mod.rs`

### Stream 3: VRSC (CPU VerusHash)
- `header_len=1487` — správně!
- `target_hex=ffffffff...` — target se špatně parsuje z `nbits`
  (pool posílá `nbits` jako compact bits, ale `target_hex` v ExternalStreamJob
  je `ffffffff...` = nejsnadnější možný target → žádný share nesplňuje)
- **Další krok:** Opravit target parsing v pool's `build_external_stream_cpu()`
  — převést `nbits` na full 32-byte target před vložením do ExternalStreamJob

### ZION Nonce Progression
- `zion_nonce_cursor` (AtomicU64) přidán — advance o `batch_size` každý batch
- Pool rotuje job každých ~5s → cursor se resetuje na `start_nonce` (0)
  předtím než batch dohledá → `nonce=0` v každém share
- To je OK pro vardiff shares (nonce=0 je validní), ale GPU neprohledává
  celý nonce space efektivně
- **Další krok:** Zvětšit batch nebo snížit job rotation interval

---

## Architektura (V31 vs V3 reference)

### V3 reference (archive/V3) — fungovalo E2E
- **Persistent threads:** Stream 2 (GPU) a Stream 3 (CPU) běží ve vlastních
  vláknech, přijímají joby přes mpsc channel
- **Dedicated ext-share submitter:** Okamžitý submit externích shares bez
  čekání na main loop
- **Pool I/O thread:** Pre-fetch jobů + async submit response
- **Adaptive duty-cycle:** GPU time-slicing mezi Stream 1 a Stream 2

### V31 (aktuální) — tokio async + GPU time-slicing
- **tokio::spawn tasks:** Stream 1/2/3 jako async tasky s broadcast channel
- **GPU time-slicing:** Stream 2 (gpu_ext) používá persistent GPU backend
  s burst/gap duty-cycle (gap_ms=300ms default). Stream 1 (gpu_zion) dostává
  GPU čas během gap. To mirrors V3 reference architecture.
- **Auto-reconnect:** Vnější reconnect smyčka s backoffem
- **Nonce cursor:** AtomicU64 pro nonce progression
- **BLOCKER:** OpenClExternalMiner je stub — ProgPoW kernel není portován

---

## Commity (2026-08-07)

| Commit     | Popis                                                    |
|------------|----------------------------------------------------------|
| 287e21df0  | feat: V3 Trinity mode — single V3 protocol connection    |
| 1a1ee050e  | fix: V3 Trinity mode default ON when auxpow enabled      |
| 94c7023c1  | fix(auxpow): ZANO EthStratum bridge — polling survives   |
| 6a118efc3  | debug: Add eprintln for V3 Trinity external stream       |
| 877882ffc  | feat(trinity): nonce progression, GPU time-slicing, docs |
| 1768f20f7  | fix: ZANO 0x prefix + VRSC full header construction      |
| f0dde84db  | fix: VRSC solution padding to 1344 bytes                 |
| d51258c72  | fix(trinity): Stream 2 GPU time-slicing (V3 reference)   |

---

## Konfigurace

### SMOS Rig
- **GPU:** AMD RX 5700 XT (gfx1010, RDNA1, 8GB VRAM)
- **OS:** SimpleMining OS (SMOS)
- **Miner:** V31 zion-miner (auxpow + gpu-opencl features)
- **Pool:** 62.171.141.136:8444 (V3 protokol)

### Pool (Edge Server)
- **ZANO:** de.zano.herominers.com:1110 (EthStratum)
- **VRSC:** eu.luckpool.net:3956 (ZcashStratum)
- **L1 RPC:** 127.0.0.1:9445 (V31 node)

---

## Další kroky

1. **Port ProgPoW OpenCL kernel** (KRITICKÉ) — Port ProgPoW/Ethash/KawPow
   OpenCL kódu z `archive/AuXpow/src/gpu_miner.rs` (7657 řádků) do V31.
   Kernel soubory existují (`csrc/opencl/progpow_kernel.cl`), ale
   `OpenClExternalMiner` v `gpu/mod.rs` je stub. Bez tohoto portu Stream 2
   (ZANO) nemůže těžit na GPU.
2. **VRSC target parsing** — Opravit `nbits → target` konverzi v pool's
   `build_external_stream_cpu()` aby VRSC měl správný difficulty target
3. **VRSC VerusHash native** — Ověřit že `native-verushash` feature je
   zapnutý v buildu (jinak `mine_verushash` vrací None)
4. **ZION GPU hashrate** — Ověřit že GPU skutečně hashuje (Hash=0.00 v SMOS
   může být jen report issue, shares jsou accepted)
5. **Dedicated ext-share submitter** — Přidat asynchronní submit pro
   externí shares (jako V3 reference) pro snížení latence

---

## Soubory

| Soubor                                    | Popis                          |
|-------------------------------------------|--------------------------------|
| V31/L1/miner/src/runtime.rs               | V3 Trinity mode, nonce cursor  |
| V31/L1/miner/src/auxpow/client.rs         | ZANO/VRSC parse_notify fix     |
| V31/L1/miner/src/v3_pool_client.rs        | V3 protokol klient              |
| V31/L1/miner/src/bin/zion-miner.rs        | V3 Trinity default ON           |
| V31/L1/pool/src/stratum.rs                | Pool V3 handler, ext_stream     |
| V31/L1/pool/src/auxpow_runtime.rs         | AuxPoW bridge runtime           |
| V31/scripts/smos/wrapper_v31_trinity.sh   | SMOS wrapper script             |
| V31/docs/TRINITY_V3.md                    | CZ dokumentace                  |
