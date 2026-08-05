# Plán — kanonický Ekam Deeksha po V31 genesis resetu

> **Cíl:** Po hard genesis resetu poběží V31 na jediném PoW algoritmu — `EkamDeeksha` z `zion-cosmic-harmony`. Odstraníme `HeightAwareDeeksha` fork dispatch a závislost na `zion-cosmic-harmony-v3`, uvolníme prostor pro AuxPoW streamy, NCL a další algoritmy, a zjednodušíme kód při zachování rychlosti a nízké energetické spotřeby.

---

## 1. Současný stav

- `EkamDeeksha` v `V31/L1/cosmic-harmony/src/algorithm/ekam_deeksha.rs` je bit-identický s původním V3 `deeksha_lite_v1`.
- `HeightAwareDeeksha` v `zion-core` dispatchuje podle výšky:
  - `height < 4500` → `deeksha_lite` (== Ekam Deeksha)
  - `4500 ≤ height < 5000` → `deeksha_chv3`
  - `height ≥ 5000` → `deeksha_lite_fire`
- `zion-core`, `zion-miner` i `zion-pool` používají `HeightAwareDeeksha`.
- `zion-cosmic-harmony-v3` je v `zion-core` závislost jen kvůli těmto legacy algoritmům a jejich fork height konstantám (`CHV3_FORK_HEIGHT`, `FIRE_FORK_HEIGHT`).

---

## 2. Fáze A — přepnutí na kanonický Ekam Deeksha (must-do)

### 2.1. Nahradit `HeightAwareDeeksha` za `EkamDeeksha`

Soubory, kde se musí změnit aktivní algoritmus:

- `V31/L1/core/src/consensus.rs` — `ConsensusEngine` použije `EkamDeeksha`.
- `V31/L1/core/src/node.rs` — runtime konstrukce consensusu.
- `V31/L1/miner/src/runtime.rs` — miner runtime.
- `V31/L1/miner/src/bin/zion-miner.rs` — CLI miner.
- `V31/L1/pool/src/validator.rs` — share validator.
- `V31/L1/pool/src/stratum.rs` — `algorithm_for_height()` vrátí `"ekam_deeksha"` pro všechny výšky.

### 2.2. Odebrat závislost `zion-cosmic-harmony-v3`

- `V31/L1/core/Cargo.toml` — odebrat `zion-cosmic-harmony-v3`.
- Ověřit, zda `V31/L1/miner/Cargo.toml` a `V31/L1/pool/Cargo.toml` mají `zion-cosmic-harmony-v3` jen kvůli dispatchi; pokud ano, také odebrat.

### 2.3. Protokol a status

- Pool stratum bude workerům posílat `algorithm: "ekam_deeksha"` místo `deeksha_lite_v1`.
- Status bannery a RPC `getmininginfo` se aktualizují.

### 2.4. Testy

- Přepsat height-aware fork testy v `zion-core` na sanity testy `EkamDeeksha`.
- Zachovat stress testy nonce search napříč cíli.

---

## 3. Fáze B — Ekam Deeksha v2 (volitelná optimalizace)

Cíl: menší paměťová stopa, rychlejší inicializace, nižší energie, ale zachovat memory-hard odolnost vůči ASIC.

| parametr | dnešek | varianta A (konzervativní) | varianta B (agresivní) | dopad |
|---|---|---|---|---|
| scratchpad | 256 KiB | 128 KiB | 64 KiB | menší paměť, rychlejší init, mírně nižší ASIC resistance |
| passes | 2 | 1 | 1 | rychlejší, méně paměťového trafficu |
| random reads | 64 | 32 | 16 | nižší latence, menší ASIC resistance |
| AES rounds | 4 | 2 | 2 | nižší spotřeba, rychlejší, mírně nižší kryptografická složitost |

**Doporučení:** použít **variantu A (128 KiB, 1 pass, 32 random reads, 2 AES rounds)** jako kompromis.

- 128 KiB stále vyžaduje rychlou paměť, ale uvolní polovinu scratchpadu pro AuxPoW/NCL.
- 1 pass a 2 AES rounds sníží spotřebu energie a dobu inicializace zhruba o 30–40 %.
- Proti čistému SHA3/Keccak to stále zůstává memory-hard a pro běžné ASIC s malou cache nevhodné.

> **Poznámka:** Jakákoli změna parametrů vyžaduje nové KAT vektory a synchronizaci OpenCL/CUDA/Metal kernelů.

---

## 4. GPU kernel konsolidace

Po kanonizaci zůstane jen jedna rodina kernelů:

- **OpenCL** — upravit `V31/L1/cosmic-harmony/src/gpu/kernels/cosmic_harmony_deeksha.cl` podle nových parametrů.
- **CUDA** — dokončit `V31/L1/miner/src/gpu/kernels/cuda/ekam_deeksha.cu` (nebo přejmenovat `deeksha_lite.cu`) a připojit `cuda_deeksha` modul.
- **Metal** — dokončit `V31/L1/miner/src/gpu/kernels/metal/ekam_deeksha.metal` a `metal_deeksha` modul.

Odstranit:
- `deeksha_chv3.cl/.cu/.metal` a `deeksha_lite_fire.cl/.cu/.metal`.
- Height-aware dispatch z GPU vrstvy.

---

## 5. Genesis reset + nasazení

1. Před resetem: merge PR s canonical PoW, všechny testy zelené.
2. Vygenerovat nový `genesis` s height 0 a novým genesis hashem.
3. Build na Edge:
   ```bash
   cd V31
   cargo build --release -p zion-node -p zion-pool -p zion-miner
   ```
4. Hard reset:
   - zastavit `zion-v31-node`, `zion-v31-pool`, `zion-v31-miner`
   - smazat chain DB a resetovat pool state
   - nasadit nové binárky a spustit s novým genesis
5. Pool restart — stratum posílá `ekam_deeksha` jobs.
6. Miner reconnect — auto-detect `ekam_deeksha`.
7. Smoke test: 10–20 bloků, pool shares accepted, IBD funguje.

---

## 6. Test gating

- `cargo test -p zion-cosmic-harmony`
- `cargo test -p zion-core`
- `cargo test -p zion-pool`
- `cargo test -p zion-miner`
- `cargo clippy --workspace`
- Benchmark: `zion-miner` CPU hashrate a spotřeba (W) oproti baseline na stejném HW.

---

## 7. Rozhodnutí k potvrzení

1. **Měníme parametry `EkamDeeksha` (varianta A/B), nebo zůstáváme u bit-identického `deeksha_lite_v1`?**
2. **Ponechat `zion-cosmic-harmony-v3` crate v workspace jako archiv, nebo úplně odebrat?**
3. **Kdy provést genesis reset?** (závisí na Edge maintenance okně)

---

*Poslední aktualizace: 2026-08-05*  
*Tento plán je živý — po potvrzení rozhodnutí v bodu 7 přejde do implementace.*
