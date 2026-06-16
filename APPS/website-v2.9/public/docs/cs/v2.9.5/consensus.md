# Konsenzus: Cosmic Harmony v3

> **Algoritmus:** Cosmic Harmony v3 (CHv3)  
> **První Rust implementace:** v2.9.5, leden 2026  
> **Původ algoritmu:** 26. září 2025

---

## Přehled

Cosmic Harmony v3 je Proof-of-Work algoritmus ZION. Je:

- **přívětivý k CPU** — vyvážený pro běžný x86 a ARM hardware
- **konkurentní na GPU** — implementace OpenCL/CUDA jsou životaschopné, ale nedominují
- **odolný vůči ASIC** — memory-hard design výrazně zvyšuje náklady vývoje ASIC
- **anti-botnet** — kalibrováno tak, aby farmy botnetů nebyly ekonomicky atraktivní

Algoritmus byl navržen **26. září 2025** — „genesis den“ projektu pro základní PoW design. Prototyp TypeScript/Python byl ve v2.9.5 nahrazen produkční Rust implementací.

---

## Návrh algoritmu

CHv3 je 4-fázová sekvenční hash funkce:

```
Vstup: hlavička bloku (výška + prev_hash + merkle_root + timestamp + nonce)
         │
         ▼
┌─────────────────────────────────────────────────────────────────┐
│ Fáze 1: QUANTUM SEED                                           │
│   Blake3(header) → Keccak256(výsledek) → SHA3-512(výsledek)   │
│   Trojitá hash vrstva jako základ „quantum-resistance“          │
└────────────────────────────┬────────────────────────────────────┘
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│ Fáze 2: GALACTIC MATRIX (memory hard)                          │
│   Alokace 2MB matice ze seedu fáze 1                           │
│   Průchod spirálou Fibonacciho odvozenou z noncu                │
│   Čtení z paměti není sekvenční → ASIC cache si škodí          │
└────────────────────────────┬────────────────────────────────────┘
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│ Fáze 3: STELLAR HARMONY                                        │
│   Míchání se zlatým řezem (φ = 1,618…) přes výstup matice      │
│   Přináší matematickou „krásu“ — nelze snadno obejít           │
└────────────────────────────┬────────────────────────────────────┘
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│ Fáze 4: COSMIC PROOF                                           │
│   Finální průchod Blake3 přes výstupy všech fází               │
│   Porovnání výsledku s cílem obtížnosti                         │
└────────────────────────────┬────────────────────────────────────┘
                             ▼
                      Platný hash bloku
```

---

## Memory hardness

Fáze 2 alokuje **2MB matici na jeden nonce**. To je mechanismus odolnosti vůči ASIC:

- statický scratchpad (jako Scrypt) lze levně realizovat v hardwaru  
- CHv3 používá **dynamické vzorce přístupu spirálou Fibonacciho**, kde sekvence závisí na noncu i mezihashi — přístupy do paměti jsou nepředvídatelné
- optimální ASIC by vyžadoval ~2MB rychlé SRAM na jádro, což rychle zvedá plochu čipu i cenu

---

## Referenční výkon

| Hardware | Orientační hashrate |
|----------|---------------------|
| Moderní CPU (4 jádra, AVX2) | ~2–8 MH/s |
| GPU (RTX 3070) | ~80–120 MH/s |
| GPU (RX 6700) | ~60–90 MH/s |

*Údaje z referenčních benchmarků v2.9.5. Výkon roste s optimalizovanými verzemi mineru.*

---

## Úprava obtížnosti (DAA)

ZION používá **LWMA** — Linearly Weighted Moving Average:

- **Okno:** 60 bloků (~1 hodina)
- **Limit změny:** ±25 % na okno
- **Cíl:** průměrný čas bloku 60 sekund

LWMA dává vyšší váhu novějším blokům, reaguje na náhlé změny hashratu (např. velký miner přichází nebo odchází) bez zbytečných kmitů.

---

## Dual mining

v2.9.5 zavedlo dual mining: současný běh CHv3 vedle **VerusHash** (VRSC). Miner odesílá share na oba pooly z jednoho hardwarového průchodu s malým dopadem na výkon. Implementováno v Rust miner crate.

---

## Validace bloku

Platný blok musí splňovat:

1. `CHv3(header) ≤ target` (splněn cíl obtížnosti)
2. `timestamp ∈ [prev_block_time, now + 2h]` (v časových mezích)
3. všechny transakce v Merkle stromě jsou platné UTXO utracení
4. odměna za blok ≤ protokolem definované maximum pro danou výšku
5. správné rozdělení coinbase: ověřeno dělení 89/5/5/1 %

---

## Historie algoritmu

| Datum | Verze | Poznámka |
|------|--------|-----------|
| 26. zář 2025 | prototyp ZH-2025 | TypeScript design, první GPU těžba |
| říjen 2025 | CHv1 | Python implementace, první multi-node |
| list–pro 2025 | CHv2 | lepší memory hardness, ladení GPU |
| led 2026 | **CHv3 Rust** | **Produkční Rust — ve v2.9.5** |
| ún 2026+ | CHv3 (neměněn) | v2.9.6, v2.9.7 — algoritmus stejný |
