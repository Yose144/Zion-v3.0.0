# Cosmic Harmony — konsenzusní algoritmus: CHv3 → CHv4

**Současnost:** CHv3 (živě na TestNetu)  
**Další krok:** CHv4 — fáze neural bloom (vývoj — cíl Q2 2026)

---

## Časová osa vývoje

| Verze | Název | Vydání | Hlavní změna |
|-------|-------|--------|---------------|
| CHv1 | Stellar Seed | září 2025 | Genesis algoritmus — Python prototyp |
| CHv2 | Galactic Wave | říjen 2025 | Lepší využití GPU, memory-hard |
| CHv3 | Cosmic Harmony | leden 2026 | 100 % Rust, 4fázový pipeline, 2 MB scratchpad |
| CHv4 | Neural Bloom | Q2 2026 | 8 kol Feistel perceptronu, 4 MB scratchpad |

---

## CHv3 — současný produkční algoritmus

### 4fázový pipeline

```
[Fáze 1] Quantum Seed
    Vstup: hlavička bloku (80 bajtů)
    Hash: Blake3 (256bit deterministické semeno)
    Účel: neinteraktivní pre-image důkaz

[Fáze 2] Galactic Matrix
    Scratchpad: 2 MB výplň paměti AES-NI
    Operace: 1024 kol AES bloků
    Účel: memory-hard — nepřátelské k ASIC
    GPU optimalizace: ✅ nativní CUDA/OpenCL

[Fáze 3] Stellar Harmony
    Vstup: digest scratchpadu
    Mix: varianta Argon2-lite (4 kola)
    Účel: sekvenční závislost na paměti

[Fáze 4] Cosmic Proof
    Výstup: 256bit PoW hash
    Cíl: dynamická obtížnost (LWMA DAA)
```

### CHv3 výkon (referenční hardware)

| Hardware | Hashrate | Poznámka |
|----------|----------|----------|
| RTX 4090 | ~6,2 MH/s | CUDA jádro v1.3 |
| RTX 3080 | ~3,8 MH/s | |
| RX 6800 XT | ~2,9 MH/s | OpenCL |
| Ryzen 9 7950X | ~340 kH/s | solo CPU |
| i7-12700K | ~180 kH/s | solo CPU |

### Odolnost vůči ASIC

1. **Memory-hard 2 MB scratchpad** — nelze „vynechat“ v ASIC křemíku  
2. **Závislost na AES-NI** — běžné CPU dosahuje téměř optimální výkon  
3. **Nepravidelný přístup do paměti** — komplikuje ASIC prefetch  
4. **Aktualizovatelný pipeline** — změna algoritmu možná hard forkem  

---

## CHv4 — Neural Bloom (ve vývoji)

### Nová fáze: Neural Bloom (náhrada fáze 3)

```
[Fáze 3 CHv4] Neural Bloom
    Struktura: 8kolová Feistelova síť
    Váhy:      seedované z noncu bloku (pseudo-náhodné)
    Operace:   mixování stylem perceptronu
    Scratchpad: 4 MB (2× oproti CHv3)
    Účel:
      - bariéra proti ASIC: nepravidelný výpočetní graf
      - zdvojnásobení paměti: 4 MB → limit DDR5 propustnosti
      - vhodné pro GPU: 32-wide warp na kolo bloom
```

### CHv4 vs CHv3

| Atribut | CHv3 | CHv4 |
|---------|------|------|
| Scratchpad | 2 MB | 4 MB |
| Kol AES | 1024 | 1024 |
| Neuronová fáze | — | 8 kol Feistel |
| Hash výstup | 256 bit | 256 bit |
| Odhad GPU (4090) | 6,2 MH/s | ~3,8 MH/s |
| Odolnost ASIC | vysoká | velmi vysoká |
| Vyžaduje hard fork | — | ano |

> **Poznámka:** CHv4 vyžaduje hard fork TestNetu před MainNetem. Nižší hashrate na kartu odpovídá těžšímu výpočtu — obtížnost sítě se přizpůsobí přes LWMA.

### Plán aktivace

1. Dokončení implementace + testy  
2. Oznámení výšky hard forku na TestNetu (min. 4 týdny)  
3. Okno pro aktualizaci minerů  
4. MainNet fork (blok TBD)  

---

## Úprava obtížnosti — LWMA

ZION používá **LWMA (Linearly Weighted Moving Average)** pro DAA.

$$D_{\text{new}} = D_{\text{ref}} \cdot \frac{T_{\text{target}} \cdot N \cdot (N+1)}{2 \cdot \text{LWMA}}$$

kde $N$ = 60 (okno), $T_{\text{target}}$ = 60 s, LWMA = vážený průměr řešicích časů.

**Vlastnosti:** rychlá reakce na změnu hashrate, plynulé chování, osvědčené u GPU-minovatelných měn.

---

*Viz také: [6-Layer Architecture](README.md) · [Mining Guide](../v2.9.7/design-system.md)*
