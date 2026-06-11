# Fire Algoritmus Optimalizace - Consensus Fork Proposal

## 📋 Přehled

**Návrh:** Optimalizace `deeksha_lite_fire` algoritmu pro lepší poměr mezi GPU topením a efektivitou hledání bloků.

**Status:** 🟡 Navrhováno (čeká na schválení komunitou)

**Target Fork Height:** TBD (po schválení)

---

## 🎯 Problém

### Aktuální stav
- **THERMAL_ITERS = 65536** (příliš vysoké)
- **Hashrate:** 17.5 KH/s (vysoký, ale neefektivní)
- **Bloky nalezeny:** 0 (neefektivní)
- **Rejekty:** 24 (vysoké)
- **Accept rate:** ~85.7% (nízký)

### Srovnání s deeksha_lite_v1
| Metrika | deeksha_lite_v1 | deeksha_lite_fire (aktuální) |
|---------|----------------|------------------------------|
| Hashrate | 319 H/s | 17.5 KH/s |
| Bloky nalezeny | 5 | 0 |
| Accept rate | 97.3% | 85.7% |
| Topení GPU | Nízké | Vysoké |
| Efektivita | Vysoká | Nízká |

### Kořenová příčina
Thermal loop s 65536 iteracemi produkuje velké množství hashů, ale většina z nich není dostatečně nízká k překonání difficulty. Je to jako rychlé házení mincí, kde většina padá na rub.

---

## 🔧 Navrhované řešení

### Možnost B: Vyvážená optimalizace (DOPORUČENO)

**Změna:**
```rust
// Před:
pub const THERMAL_ITERS: usize = 65536;

// Po:
pub const THERMAL_ITERS: usize = 8192;  // 8x méně iterací
```

**Očekávané výsledky:**
- **Hashrate:** ~2-3 KH/s (redukce z 17.5 KH/s)
- **Accept rate:** ~95%+ (zlepšení z 85.7%)
- **Bloky nalezeny:** Kompetitivní s deeksha_lite_v1
- **Topení GPU:** Stále výrazné (vyvážené)
- **Efektivita:** Výrazně zlepšená

### Alternativní možnosti

#### Možnost A: Mírná optimalizace
- `THERMAL_ITERS = 16384` (4x méně)
- Hashrate: ~4-6 KH/s
- Zachová vysoké topení

#### Možnost C: Agresivní optimalizace
- `THERMAL_ITERS = 4096` (16x méně)
- Hashrate: ~1-2 KH/s
- Mírné topení, vysoká efektivita

---

## 📊 Technické detaily

### Soubory k úpravě

1. **V3/L1/cosmic-harmony/src/deeksha_lite_fire.rs**
   - Řádek 30: `THERMAL_ITERS` konstanta
   - Řádek 201: Thermal loop implementace

2. **V3/L1/cosmic-harmony/src/gpu/kernels/deeksha_lite_fire.cl**
   - OpenCL kernel pro GPU
   - Musí odpovídat CPU implementaci

3. **V3/L1/cosmic-harmony/src/lib.rs**
   - Verze algoritmu (optional pro detekci)

### Dopady na komponenty

#### Core (L1)
- ✅ Změna v cosmic-harmony (consensus-kritická)
- ✅ Všichny node musí upgradovat
- ✅ Pool musí podporovat nový algoritmus

#### Pool
- ✅ Změna validation logiky
- ✅ Update dokumentace pro mineristy
- ✅ Monitoring změn hashrate

#### Miner
- ✅ Přestavění s novou verzí cosmic-harmony
- ✅ Testování na různých GPU
- ✅ Update startovacích skriptů

---

## 🚀 Migration Plan

### Fáze 1: Příprava (2 týdny)
1. Implementace změn v cosmic-harmony
2. Unit testy nového algoritmu
3. Benchmarking na různých GPU
4. Code review a audit

### Fáze 2: Testování (1 týden)
1. Testnet deployment
2. Stres testování
3. Komunitní beta testování
4. Dokumentace pro mineristy

### Fáze 3: Deployment (1 den)
1. Hard fork na specifickém height
2. Coordination s pool operátory
3. Monitorování síťové stability
4. Rollback plan ready

### Fáze 4: Post-fork (1 týden)
1. Monitorování hashrate a bloků
2. Sběr zpětné vazby
3. Optimalizace podle potřeby
4. Dokumentace výsledků

---

## ⚠️ Rizika a mitigace

### Riziko 1: Neefektivní optimalizace
- **Mitigace:** Thorough testování v testnetu
- **Fallback:** Možnost dalšího forku s jinou hodnotou

### Riziko 2: Kompatibilita GPU
- **Mitigace:** Testování na různých GPU (AMD, NVIDIA, Intel)
- **Fallback:** CPU fallback zůstává funkční

### Riziko 3: Síťová fragmentace
- **Mitigace:** Clear communication a coordination
- **Fallback:** Emergency rollback mechanism

### Riziko 4: Snížené topení
- **Mitigace:** Možnost přepnutí na vyšší THERMAL_ITERS
- **Fallback:** Alternativní algoritmus pro topení

---

## 📝 Governance

### Schvalovací proces
1. Technický review (core team)
2. Komunitní diskuse (Discord/GitHub)
3. Vote mechanism (pokud existuje)
4. Final approval (project lead)

### Rollback plan
Pokud se fork nepovede:
- Emergency rollback na předchozí verzi
- Komunikace problému komunitě
- Analýza a náprava
- Nový fork attempt

---

## 🎯 Success Metrics

### Krátkodobé (1 týden po forku)
- **Accept rate:** >95%
- **Hashrate:** 2-3 KH/s (optimální rozsah)
- **Stabilita síť:** Žádné výpadky
- **Miner adoption:** >80%

### Dlouhodobé (1 měsíc po forku)
- **Bloky nalezeny:** Kompetitivní s v1
- **GPU teplota:** Stále výrazná
- **Komunitní spokojenost:** Vysoká
- **Síťová hashrate:** Stabilní/růstoucí

---

## 🧪 Benchmark Results (2026-06-11)

### Thermal Loop Performance Test

**Test Configuration:**
- **Platform:** Windows 11 (MINGW64)
- **Test type:** CPU-only thermal loop benchmark
- **Iterations:** 10,000 thermal loop executions
- **THERMAL_ITERS:** 8192 (optimized) vs 65536 (original)

**Results:**
```
Total time: 222.5457ms
Average time per thermal loop: 22.255 μs
Thermal loop rate: 44.93 KHz
```

**Analysis:**
- **Thermal loop reduction:** 8x fewer iterations (65536 → 8192)
- **CPU performance:** 44.93 KHz thermal loop rate
- **Expected GPU performance:** ~2-3 KH/s (vs 17.5 KH/s original)
- **Efficiency improvement:** Better block finding rate expected due to reduced rejections

**Comparison with Current Fire:**
| Metric | Original Fire (65536) | Optimized Fire (8192) |
|--------|----------------------|----------------------|
| THERMAL_ITERS | 65536 | 8192 (8x reduction) |
| CPU thermal loop rate | ~5.6 KHz (estimated) | 44.93 KHz (measured) |
| GPU hashrate (expected) | 17.5 KH/s | 2-3 KH/s |
| Blocks found | 0 (inefficient) | TBD (pending GPU test) |
| Accept rate | 85.7% | Expected >95% |

**Next Steps:**
1. ✅ CPU benchmark completed
2. ⏳ GPU mining test required
3. ⏳ Compare block finding rate vs original Fire
4. ⏳ Monitor GPU temperature and power consumption
5. ⏳ If successful, propose for consensus fork

---

## 📚 Reference

### Související dokumenty
- [AGENTS.md](./AGENTS.md) - L1 consensus pravidla
- [StatusV3.md](./StatusV3.md) - Aktuální stav sítě
- [HIRAN_LOCAL_SETUP.md](./HIRAN_LOCAL_SETUP.md) - Hiran inference setup

### Technical references
- DeekshaLite v1 specifikace
- LWMA difficulty adjustment
- OpenCL kernel optimization

---

## 📞 Kontakt

**Autor:** Devin AI Assistant
**Datum:** 2026-06-11
**Review status:** 🟡 Čeká na schválení

**Diskuze:** GitHub Issues / Discord

---

## 🔄 Version History

- **v1.0** (2026-06-11): Initial proposal
- **v1.1** (2026-06-11): Added CPU benchmark results (44.93 KHz thermal loop rate)
- **v2.0** (TBD): Po schválení implementace