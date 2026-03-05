# CHv4 Golden Middle Proposal (GPU/CPU friendly + ASIC resistant)

> Datum: 2026-03-05  
> Stav: Návrh pro rozhodnutí před změnou konsenzu

---

## 1) Proč tento dokument

Aktuální CHv4 implementace je funkčně správná, ale konfigurace memory-hard části je pro síť příliš těžká pro běžné minery:

- velký scratchpad na vlákno,
- více sekvenčních průchodů,
- vysoký počet náhodných čtení,
- výsledkem je nízký hashrate a riziko pomalé adopce minerů.

Cíl není odstranit ochranu proti ASIC, ale najít **zlatý střed**:

- zachovat CPU i GPU použitelnost,
- nenechat ASIC získat extrémní výhodu,
- využít NPU krok jako ekonomickou bariéru pro specializovaný hardware.

---

## 2) Design cíle

### Povinné cíle

1. Síť musí zůstat rychlá a prakticky těžitelná na běžném HW.
2. Konsenzus musí být deterministický (bitově identický výstup napříč CPU/GPU/NPU).
3. ASIC nesmí mít "řádovou" výhodu proti commodity HW.
4. Implementace musí jít nasadit jedním jasným hard-fork bodem.

### Měřitelné cíle

- Poměr výkonu GPU/CPU držet přibližně v pásmu 2× až 8× (ne stovky ×).
- Ověření share a bloku musí zůstat levné pro pool i node.
- Bez nutnosti velké VRAM na thread (bez extrémní penalizace notebooků/desktopů).

---

## 3) Varianty

## Varianta A: Heavy memory-hard (aktuální stav)

- Scratchpad: vysoký
- Passes: vysoké
- Random reads: vysoké
- NPU step: zapnutý

Výhoda:
- silná paměťová bariéra.

Nevýhoda:
- síť je prakticky pomalá pro běžné minery,
- špatná UX adopce,
- nepřiměřená penalizace i pro legitimní GPU.

## Varianta B: NPU-only (bez memory-hard)

- Scratchpad: vypnutý
- NPU step: zapnutý

Výhoda:
- vysoký hashrate, velmi dobrá použitelnost.

Nevýhoda:
- riziko ASIC optimalizace čistě na NPU transformaci,
- menší bariéra proti levnému fixed-function návrhu.

## Varianta C: Golden Middle (doporučeno)

- **Light memory-hard** + **NPU step povinně**.
- Memory-hard výrazně snížit, ale ne odstranit.

Doporučené parametry (start):
- Scratchpad: **64 KiB** na thread
- Sequential passes: **2**
- Random reads: **64**
- NPU mixing: **beze změny, povinný**

Proč:
- výrazně nižší latence než heavy profil,
- stále existuje paměťová a datově-závislá bariéra,
- NPU krok zůstává ekonomickou bariérou pro ASIC.

---

## 4) Doporučení (co nasadit)

Doporučení je přijmout **Variantu C (Golden Middle)** jako CHv4.1:

1. Light memory-hard parametry (64 KiB / 2 / 64).
2. NPU mixing zůstává povinnou fází.
3. Deterministická integer cesta zůstává referenční (CPU fallback).
4. Žádné floating-point odchylky v konsenzu.

Tohle je kompromis mezi výkonem sítě a odolností proti specializovanému HW.

---

## 5) Hard-fork a kompatibilita

Protože jde o změnu PoW pipeline parametrů, je to **konsenzuální změna**.

Návrh postupu:

1. Zavést CHv4.1 parametry pod novou konstantou fork height.
2. Pool/miner/node releasy připravit předem.
3. Aktivace na přesné výšce bloku (mainnet/testnet zvlášť).
4. Po aktivaci odstranit runtime override z produkce (ponechat jen v test build profilu).

---

## 6) Test plán před aktivací

## A) Determinismus
- CPU vs GPU bitová shoda (velký vzorek noncí).
- CPU vs NPU fallback shoda.
- Node vs pool vs miner shoda výsledků.

## B) Výkon
- Benchmark na Apple Silicon, x86 CPU, běžná GPU třída.
- Měření latency/hash, hash/s, spotřeba, stabilita.

## C) Síťová simulace
- Testnet window alespoň 7 dní.
- Sledovat stale rate, orphan rate, share acceptance.

## D) Bezpečnost
- Statistické testy distribuce hash výstupu.
- Základní odhad ASIC výhody proti commodity HW.

---

## 7) Co nedělat

- Nenasazovat změnu bez explicitního fork-height plánu.
- Nenechat paralelně běžet dva nekompatibilní výpočty ve stejné výšce.
- Neodstraňovat NPU krok bez náhradní bariéry.

---

## 8) Rozhodnutí pro tým

Pro produkční síť doporučeno:

- přijmout CHv4.1 Golden Middle,
- držet NPU krok povinný,
- memory-hard ponechat v light režimu,
- aktivovat přes jasně komunikovaný fork height.

Tím zůstane síť použitelná, zároveň se neotevře cesta k triviálnímu ASIC dominance scénáři.
