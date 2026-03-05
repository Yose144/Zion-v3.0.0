# CHv4.1 Rollout Spec — Legacy-safe (bez povinného NPU hardware)

> Datum: 2026-03-05  
> Stav: Draft pro implementaci + koordinaci pool/miner/node release

---

## 1) Cíl

Nasadit CHv4.1 (golden middle) tak, aby:

- zůstal ASIC resistance,
- zůstal GPU/CPU friendly,
- **starší PC bez NPU byly plně kompatibilní**,
- síť neměla konsenzuální rozpad při přechodu.

---

## 2) Konsenzus pravidlo (zásadní)

**Povinná je fáze „NPU mixing“ jako matematický krok pipeline, nikoliv povinný NPU hardware.**

To znamená:

- Každý node/miner musí počítat stejnou CHv4.1 funkci.
- Pokud zařízení má NPU/CoreML, může použít akceleraci.
- Pokud zařízení NPU nemá, použije CPU INT8 fallback.
- Výsledek musí být bitově identický.

Tím je zachována kompatibilita pro legacy HW (starší desktop/notebook/VM).

---

## 3) CHv4.1 parametry (návrh)

### 3.1 Memory-hard (light profil)

- Scratchpad: **64 KiB**
- Sequential passes: **2**
- Random reads: **64**

### 3.2 NPU mixing

- Fáze zůstává v pipeline povinně.
- Integer-only deterministická reference zůstává CPU cesta.
- Hardware NPU = pouze performance akcelerace.

---

## 4) Kompatibilita matrix

| Zařízení | NPU | GPU | Podpora CHv4.1 |
|---|---:|---:|---|
| Starší PC (x86, bez NPU) | ❌ | volitelné | ✅ CPU INT8 fallback |
| Notebook s iGPU | ❌ | ✅ | ✅ GPU/CPU dle výkonu |
| Apple Silicon (M1/M2/M3) | volitelné | ✅ Metal | ✅ Metal + CPU fallback |
| Moderní AI PC (NPU) | ✅ | volitelné | ✅ NPU akcelerace + fallback |
| Headless server | většinou ❌ | často ❌ | ✅ čisté CPU mining/validace |

---

## 5) Fork plán (doporučený postup)

## Fáze A — Testnet

- Zavést konstantu `CHV4_1_FORK_HEIGHT_TESTNET`.
- Aktivovat CHv4.1 na testnetu na jasné výšce.
- Běh minimálně 7 dní v kuse.

## Fáze B — Mainnet příprava

- Vydat kompatibilní verze:
  - node,
  - pool,
  - miner (CPU-only i GPU varianty).
- Ověřit, že pool přijímá shares od legacy PC bez NPU.

## Fáze C — Mainnet aktivace

- Zavést konstantu `CHV4_1_FORK_HEIGHT_MAINNET`.
- Aktivovat na předem oznámené výšce.
- 2 týdny před aktivací freeze release větve.

---

## 6) Checklist před aktivací

### Konsenzus
- [ ] CPU vs GPU bitová shoda hashů
- [ ] CPU fallback vs NPU akcelerace bitová shoda
- [ ] Node/Pool/Miner používají stejnou referenční funkci

### Výkon
- [ ] Legacy PC baseline H/s (bez NPU) je použitelný
- [ ] GPU performance je stabilní bez extrémního thrashingu
- [ ] Pool stale rate zůstává v toleranci

### Provoz
- [ ] Release notes obsahují upgrade deadline
- [ ] Bootnode/pool operátoři potvrzený upgrade
- [ ] Monitoring panel má CHv4.1 metriky (share reject reasons, stale ratio)

---

## 7) Co explicitně garantujeme komunitě

1. **NPU hardware nebude povinný pro mining ani validaci.**
2. Starší PC bez NPU budou nadále fungovat.
3. NPU je pouze volitelná akcelerace výkonu.
4. Konsenzus zůstane deterministický a ověřitelný na CPU.

---

## 8) Implementační poznámky

- Zachovat feature flagy pro akceleraci (`native-npu`) odděleně od konsenzu.
- Nepoužívat floating-point větve v konsenzuální části hash pipeline.
- Runtime autodetekce HW smí měnit výkonovou cestu, ne matematiku výsledku.

---

## 9) Reference

- [CHV4_GOLDEN_MIDDLE_PROPOSAL.md](CHV4_GOLDEN_MIDDLE_PROPOSAL.md)
- [consensus.md](consensus.md)
- [../CHV4_IMPLEMENTATION_REPORT.md](../CHV4_IMPLEMENTATION_REPORT.md)
