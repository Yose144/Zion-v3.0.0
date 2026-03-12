# ZION v2.9.9 — Pure Code Manifest

> *"Perfection is achieved not when there is nothing more to add, but when there is nothing left to take away."*  
> — Antoine de Saint-Exupéry

---

## Proč Pure Code

### Kontext

v2.9.8 Ekam Deeksha zavedla kanonický PoW algoritmus pro ZION:

```
header+nonce → Keccak-256 → SHA3-512 → GoldenMatrix →
  MemoryHard(64KiB, Blake3 XOF init + Blake3 XOF mixing, 2 passes, 64 random reads) →
  NpuMix(INT8 MLP 64→128→64) → CosmicFusion(8 rounds) → Hash32
```

Pipeline je implementovaná, otestovaná a živě běží. GPU kernely (Metal, OpenCL, CUDA) jsou funkční.
Rust L1 miner na Apple M1 dosahuje **28.2 kH/s** při dispatchi 8192, Python fallback **9.6 kH/s**.

**Ale kódová základna stále nese balast z CHv3, CHv4.2 (Merkabah) a několika přechodových epoch.**

### Analogie: XMRig Hugepages

RandomX bez hugepages běží na ~1/3 výkonu. Algoritmus je stejný, implementace je stejná —
ale operační systém není nakonfigurovaný, aby odemkl plný potenciál.

U nás byl problém identický v podstatě:
- Ekam Deeksha GPU kernely byly **zkompilované a načtené** do Metal pipeline
- Ale L1 miner wrapper volal **legacy `mine()`** místo **`mine_ekam()`**
- Výsledek: 2.3 kH/s místo 28.2 kH/s — **12.5× ztráta výkonu** kvůli jednomu nesprávnému dispatch volání

Fix byl triviální (2 soubory, ~10 řádků), ale odhalil hlubší problém: **kód je příliš složitý na to,
aby si člověk všiml, že správná cesta není aktivní**. To je přesně důvod pro Pure Code migraci.

### Motivace

| Problém | Důsledek |
|---------|----------|
| Mrtvé metody (`mine()`, `mine_v42()` atd.) | Dispatch nejednoznačnost, skrytý výkonový propad |
| Více Python fallback skriptů | Nejasné, který se skutečně spouští |
| Duplicitní GPU shader soubory | Riziko desynchronizace, matoucí pro audit |
| Mrtvé enum varianty | Zbytečné match větve, falešný pocit volby |
| Legacy binary libs | Zvětšování balíčku, matoucí link-time chyby |

### Cíl

Po v2.9.9 bude v repozitáři **jediná cesta pro každou operaci**:

- CPU hash → `cosmic_harmony_ekam_deeksha()` v `deeksha.rs`
- GPU Metal → `mine_ekam()` v `metal_miner.rs` (přejmenováno na `mine()`)
- GPU OpenCL → `ekam_deeksha_mine` kernel v `cosmic_harmony_deeksha.cl`
- GPU CUDA → `ekam_deeksha_mine` + `ekam_cuda_mine()` v `cosmic_harmony_deeksha.cu`
- Python fallback → `cosmic_harmony_deeksha_fallback.py`
- Python GPU → `cosmic_harmony_v42_gpu.py` (přejmenováno, Ekam-only)
- Benchmark → vždy Ekam pipeline

---

## Pravidla čistého kódu

### R1: Žádný mrtvý kód
Pokud metoda, soubor nebo enum varianta není dosažitelná z produkčního runtime, smaže se.

### R2: Žádné duplicity
Jeden shader per backend. Jeden Python miner. Jeden set NPU vah.

### R3: Pojmenování odpovídá realitě
- `mine()` dělá Ekam Deeksha, ne legacy CHv4
- `cosmic_harmony` v pool protokolu = Ekam Deeksha
- Soubory se jmenují podle toho, co obsahují

### R4: Fallback je explicitní, ne skrytý
- Rust miner → Python fallback → CPU referenční
- Každý přechod je logovaný a viditelný

### R5: Jeden kanonický test vektor
```
header: "ZION_DEEKSHA_GENESIS_V298_CANONICAL"
nonce:  0x2980_0001_0000_0001
hash:   6339f2fb178fe2957a10d9e2a84cf9d5e340064f0d165e845b6a54eaf7924fbd
```
Tento vektor musí projít na CPU, GPU (Metal/OpenCL/CUDA) i Python. Nic jiného se netestuje.

---

## Co se nemění

- **Consensus** — hash výstup je bit-perfect identický s v2.9.8 Ekam Deeksha
- **Pool protokol** — `algo=cosmic_harmony` login zůstává
- **Stratum flow** — subscribe → authorize → mining.notify → submit
- **Revenue model** — CHv3 revenue streamy (CPU + GPU + NCL) zůstávají
- **Network identity** — stejný genesis, stejný chain, stejný mainnet target
