# Cosmic Harmony Deeksha — Unified Algo Spec (v2.9.8)

> Working name: `cosmic_harmony_deeksha`
> Canonical network name: `cosmic_harmony`
> Motivation: sjednotit nejlepší části CHv3 a CHv4/4.2 bez zbytečné komplexity.

---

## 1) Problém, který řešíme

Větve CHv3 / CHv4 / CHv4.2 přinesly silné komponenty, ale provozně vznikl mishmash:
- rozdílné dokumentační konstanty,
- více aktivních code-path,
- vyšší riziko pool/miner divergence,
- horší operativní diagnostika při incidentech.

Cíl 2.9.8 je odstranit složitost, ne bezpečnost.

---

## 2) Deeksha profil (doporučený default)

### 2.1 Consensus parametry (single source of truth)

- `SCRATCHPAD_SIZE = 64 KiB`
- `BLOCK_COUNT = 1024`
- `PASSES = 2`
- `RANDOM_READS = 64`
- `BACKWARD_PASSES = 0` (v Deeksha baseline vypnuto kvůli jednoduchosti)
- `KABALA_READS = 0` (v Deeksha baseline vypnuto)

Poznámka:
- CHv4.2 Merkabah prvky se neodstraňují z repa, ale v 2.9.8 nejsou součástí default consensus profilu.
- Můžou zůstat jako feature-gated experimentální profil mimo canonical chain.

### 2.2 Pipeline

`Keccak256 -> SHA3-512 -> GoldenMatrix -> MemoryHard(64KiB/2/64) -> NPU/CPU deterministic mix -> CosmicFusion -> Hash32`

### 2.3 NPU pravidlo

- NPU je **akcelerace výpočtu**, ne odlišný výstup.
- CPU fallback musí být bitově identický.
- Pokud NPU provider není dostupný, hash musí být stejný (jen pomalejší).

---

## 3) Co si bereme z CHv3 a co z CHv4/4.2

### Z CHv3 (zachovat)
- stabilní revenue orchestrace,
- pool scheduler stream groups (`zion`, `revenue`, `ncl`),
- osvědčené operativní guardy a telemetry.

### Z CHv4/4.2 (zachovat)
- moderní refaktor hash pipeline,
- nativní knihovny + GPU backendy,
- deterministic NPU mixing design,
- parity test discipline (Rust/C/GPU/Python).

### Odstranit pro 2.9.8 baseline
- více aktivních fork větví v runtime dispatch,
- duplicate/legacy aliasování bez canonical mapy,
- consensus path závislý na experimentálních profilech.

---

## 4) Síťový výkon a bezpečnost (target)

- throughput: blíže CHv4.1 golden-middle než CHv4 heavy,
- miner UX: běžné CPU/GPU zůstávají použitelné,
- ASIC resistance: zachována přes memory-hard + deterministic mixing,
- verification cost: levná validace pro pool/core.

---

## 5) Aktivace

- 2.9.8 má mít jedinou explicitní activation policy v jednom souboru.
- `CHV_DEEKSHA_FORK_HEIGHT` (jedna konstanta) + jednoznačné release notes.
- žádné paralelní „platí/už neplatí“ tabulky napříč docs.

---

## 6) Non-goals

- nepřidávat nové filozofické/perf experimenty do consensus hot path,
- neeskalovat memory-hard profil bez 7denního canary měření,
- nepropojovat rollout se ZK/proving experimenty.
