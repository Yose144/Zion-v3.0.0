# Plán — kanonický Ekam Deeksha po V31 genesis resetu

> **Cíl:** Po hard genesis resetu poběží V31 na jediném PoW algoritmu — `EkamDeeksha` z `zion-cosmic-harmony`. Odstraníme `HeightAwareDeeksha` fork dispatch a závislost na `zion-cosmic-harmony-v3`, uvolníme prostor pro AuxPoW streamy, NCL a další algoritmy, a zjednodušíme kód při zachování rychlosti a nízké energetické spotřeby.

---

## 1. Současný stav (aktualizováno 2026-08-07)

- **Fáze A hotovo:** `zion-core`, `zion-miner` a `zion-pool` používají přímo `EkamDeeksha` z `zion-cosmic-harmony`. `HeightAwareDeeksha` a height-aware fork gating byly odebrány z aktivní consensus/miner/pool cesty.
- **Fáze B hotovo:** `EkamDeeksha` v3.2 používá parametry 512 KiB scratchpad, 2 passy, 128 random reads a 2 AES rounds. KAT vektory byly přegenerovány.
- **GPU synchronizace:** OpenCL/CUDA/Metal zdrojové kernely byly aktualizovány na stejné konstanty. CUDA a Metal nebyly lokálně kompilovány/testovány (M1, žádný CUDA).
- `zion-cosmic-harmony-v3` zůstává v `zion-core` Cargo.toml pouze pro historickou V3 validaci (`v3_compat`, `v3_state`, …), nikoliv pro aktivní consensus.
- Všechny CPU testy procházejí: `cargo test -p zion-cosmic-harmony -p zion-core -p zion-pool -p zion-miner`, `cargo clippy --workspace` je čisté.

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

## 3. Fáze B — Ekam Deeksha v3.2 (finální parametry)

Cíl: zachovat memory-hard odolnost vůči ASIC, dostatečně velký scratchpad pro stabilitu hashrate a nízkou energetickou spotřebu.

| parametr | dnešek | varianta A (konzervativní) | varianta B (agresivní) | dopad |
|---|---|---|---|---|
| scratchpad | 512 KiB | 256 KiB | 128 KiB | větší paměť, vyšší ASIC resistance, pomalejší init |
| passes | 2 | 2 | 1 | memory traffic zvyšuje odolnost |
| random reads | 128 | 64 | 32 | vyšší latence ztěžuje predikci a pipeline |
| AES rounds | 2 | 4 | 2 | kryptografická složitost a spotřeba |

**Finální rozhodnutí:** `EkamDeeksha` v3.2 běží s **512 KiB scratchpad, 2 passy, 128 random reads a 2 AES rounds**. Tato konfigurace je nasazena v `zion-core`, `zion-miner`, `zion-pool` a GPU kernely (OpenCL/CUDA/Metal). KAT vektory byly přegenerovány a testy procházejí.

- 512 KiB vyžaduje rychlou paměť a dává dostatečnou rezervu pro AuxPoW/NCL workloady.
- 2 passy a 128 random reads zvyšují paměťový traffic a ztěžují predikci ASIC.
- 2 AES rounds (1 plný + 1 finální) udržují nízkou spotřebu při zachování kryptografické složitosti.

> **Poznámka:** Jakákoli změna parametrů vyžaduje nové KAT vektory a synchronizaci OpenCL/CUDA/Metal kernelů.

---

## 4. GPU kernel konsolidace

Po kanonizaci zůstává jedna aktivní rodina kernelů pro `EkamDeeksha` v3.2:

- **OpenCL** — `V31/L1/cosmic-harmony/src/gpu/kernels/deeksha_lite.cl` je kanonický (512 KiB, 2 passy, 128 random reads, 2 AES rounds). `deeksha_chv3.cl` a `deeksha_lite_fire.cl` jsou legacy a neměly by se používat pro live consensus.
- **CUDA** — `V31/L1/miner/src/gpu/kernels/cuda/deeksha_lite.cu` je kanonický (stejné v3.2 parametry). `deeksha_lite_fire.cu` a `cosmic_harmony_deeksha.cu` jsou legacy (128 KiB, 1 pass, 32 reads).
- **Metal** — `V31/L1/miner/src/gpu/kernels/metal/deeksha_lite.metal` a `ekam_deeksha.metal` stále používají v2 parametry (128 KiB / 1 pass / 32 reads). Je nutné je přepsat na v3.2, nebo zakázat Metal backend pro kanonický PoW, dokud nejsou aktualizovány.

Odstranit / archivovat:
- Legacy `deeksha_chv3.cl/.cu/.metal` a `deeksha_lite_fire.cl/.cu/.metal` z aktivních backendů.
- Height-aware dispatch z GPU vrstvy (již odstraněn).

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
