# 🔍 Analýza & POC plán — v2.9.1 (Native Dirigent)

Datum: 2025-12-16
Autor: automatizovaný agent (GitHub Copilot)

## Cíl dokumentu
Krátká, akční analýza připravená pro vedení a inženýrské týmy: sumarizuje současný stav, výsledky baseline testů, navrhuje konkrétní POC pro Rust pool, metriky pro Go/No-Go rozhodnutí a plán testů (včetně simulovaných submitů).

---

## Shrnutí současného stavu
- Většina kódu (≈83 %) je stále v Pythonu (blockchain, pool, RPC, P2P). Nativní části jsou primárně mining algoritmy (C/C++).  
- Baseline: connection load test (200 simulovaných minerů) → všechny připojení + mining.notify doručeny; medián první notify ≈ 0.207 s, p90 ≈ 0.324 s.  
- Chybí: simulované share submissions at scale (hlavní zátěžová osa), dlouhodobé stabilitní testy (paměť, FD spill), a POC nativního poolu.

---

## Doporučený přístup
1. **Krátký POC (4–8 týdnů)** — vytvořit Rust pool prototype (Tokio) a zároveň spustit důkladné simulované load testy na současném Python poolu.  
2. **Dvoufázové rozhodnutí (Go/No-Go):** POC → porovnání výkonu vs baseline → rozhodnutí pro full rewrite nebo pokračování v optimalizacích Pythonu.

---

## POC: Rust Pool Prototype (konkrétní úkoly)
- Minimální Stratum TCP server (Tokio) s handshake (subscribe/authorize) a posíláním mining.notify.  
- Share validator stub (volitelně volat C algoritmy pro fast validation nebo simulovat).  
- Redis/Prometheus integrace a jednoduchý admin API endpoint pro health/stats.  
- Bench: simulace 10k virtuálních klientů (connection + notify + simulated submits), cíle: latency < 50 ms (p90) a mem footprint < 50MB per 10k miners.

Souborová kostra: `zion-native/pool/src/{main.rs,stratum/,shares/,metrics/}`

---

## Test plán (konkrétní kroky a metriky)
1. Connection & notify baseline (hotovo): 200 miners → měřit: connected, notified, latency (median/p90/p99), errors.  
2. Simulované share submissions: několik úrovní (200, 1k, 5k, 10k). Měříme: submit latency, accepted/rejected rate, block detection path (simulate block candidates), DB write latency, memory/FD usage.  
3. Long-run stability: 24–72h test při cílových počtech pro ověření paměťového úniku a restore behavior.  
4. Rust POC benchmark: porovnat above metrics vs Python baseline na stejném HW.

Metriky Go/No-Go (POC must pass):
- Share validation latency: < 0.5 ms (POC target)  
- Connection capacity: 10k concurrent + notify latency p90 < 0.5 s  
- Memory baseline: < 50MB při 10k connections  
- CI: automatické benchmarky + fuzzing pasují

---

## Simulace submitů — dvě možnosti
- **A: Light-weight simulated submits** (preferred for scale): Use a dedicated async script that opens connections, receives job, and periodically sends `mining.submit`/`mining.submit` with realistic but simulated nonce/hash payloads (no heavy hashing). Safer for baseline and scales easily.  
- **B: Real miner simulation:** Launch many instances of `zion_universal_miner_v2_stratum.py` in simulation mode (it will send simulated shares). This is more realistic but resource-heavy.

Doporučení: start with (A) to map scaling limits, then validate with small runs of (B).

---

## Bezpečnost & operační doporučení
- Testy `submit` by default neprovádějí `submit_block` na produkční chain — používáme `--dry-run` nebo sandbox RPC (testnode).  
- Omezení: při masivních bench testech používejte izolovanou síť a monitorovat ulimit/FD, TCP backlog, kernel somaxconn.

---

## Odhad zdrojů a timeline (POC)
- Team: 2× Senior Rust, 1× DevOps, 1× QA (4 osoby)  
- Doba: 4–8 týdnů pro POC + základní bench a rozhodnutí.  
- Přibližný cost: $40k–$80k (závisí na sazebníku/hosting).

---

## Next steps (krátké & akční)
1. Spustit simulované submity (skript) a měřit 200/1k/5k scénáře (dnes–týden).  
2. Vytvořit Rust pool POC issue board + initial PR template (7 dní).  
3. Po 4 týdnech vyhodnotit POC metriky a rozhodnout Go/No-Go.

---

Chcete, abych tento dokument rozšířil do oficiálního RFC (detailní acceptance tests, CI config, budget sheet) nebo raději nejdřív spustíme simulované submit testy?