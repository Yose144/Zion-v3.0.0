# Mainnet příprava — CUDA + Multialgo Mining + CHv3 Revenue

> **Verze:** draft pro 2.9.7 kontext  
> **Datum:** 26. února 2026  
> **Scope:** co je nutné dokončit, aby šlo bezpečně spustit produkční mining + revenue vrstvu v navazující fázi (2.9.8).

---

## 1) CUDA podpora (P0 pro GPU revenue)

### Technické minimum
- [ ] Stabilní CUDA backend v mineru/pool pipeline (bez ručních patchů při restartu).
- [ ] Build matrix pro Linux amd64 + arm64 control node (runtime GPU hosty jsou amd64).
- [ ] Ověřená kompatibilita minimálně pro NVIDIA Turing/Ampere (driver + CUDA runtime verze).
- [ ] Automatický fallback: při CUDA init fail se worker přepne na CPU profil bez pádu procesu.

### Kvalita a observabilita
- [ ] Telemetrie: hash rate, valid/invalid shares, stale shares, GPU util, VRAM, power, temp.
- [ ] Alerty: GPU watchdog timeout, nárůst invalid share ratio, revenue drop > X %.
- [ ] Canary run: 72h stabilní provoz alespoň na 2 různých GPU profilech.

### Exit kritéria
- [ ] `P99 share submit latency` v limitu definovaném týmem.
- [ ] Invalid shares pod schváleným prahem po 24h/72h běhu.
- [ ] 0 kritických crashů v miner procesu během 72h canary.

---

## 2) Kompletní multialgo mining (P0/P1)

### Scheduler a policy
- [ ] Scheduler má jednoznačnou policy prioritu: `stability > profitability spike`.
- [ ] Hysteresis + cooldown proti častému přepínání algoritmů/coinů.
- [ ] Per-miner i fleet-level guardrails (aby se celý cluster nepřepnul současně při šumu dat).

### Datové zdroje profitability
- [ ] Primární feed (WhatToMine) + fallback feed + poslední validní snapshot.
- [ ] Ochrana proti outlierům (clamp + rolling median).
- [ ] Deterministický režim při výpadku externích API.

### Protokoly / kompatibilita
- [ ] End-to-end test pro EthStratum, CryptoNoteStratum, ZcashStratum, StandardStratum.
- [ ] Retry/backoff strategie při reconnectu k externím poolům.
- [ ] Share accounting konzistentní mezi streamy (bez dvojího započítání).

### Exit kritéria
- [ ] 72h test bez thrashingu a bez ztráty účetnictví share.
- [ ] Profit switch rozhodnutí auditovatelná (log důvodů přepnutí).
- [ ] Cross-check očekávaných vs. reálných payoutů v toleranci týmu.

---

## 3) CHv3 revenue systém (aktivace)

### Finanční tok a bezpečnost
- [ ] Vyplnit produkční wallet adresy (`BTC/XMR/ZION`) v `config/ch3_revenue_settings.json`.
- [ ] Aktivovat buyback logiku se striktním limitem rizika (max slippage, max order size, cooldown).
- [ ] Zavést audit ledger: `gross revenue`, `fees`, `buyback`, `net to treasury`, `burn/tribute`.

### Governance a compliance
- [ ] Schválit pravidla `fee burn` a případný `ocean_tribute` governance hlasováním.
- [ ] Definovat podpisové role (multisig/DAO) a interval veřejných reportů.
- [ ] Zveřejnit incident runbook (kdy a jak vypnout revenue moduly safe-switchí).

### Provoz
- [ ] 72h revenue canary na testnet/prod-like režimu s malým objemem.
- [ ] Ověřit payout pipeline (včetně MoneroOcean/NKN/Mysterium pokud aktivní).
- [ ] Připravit rollback plán na single-command přepnutí na čistý ZION mining.

### Exit kritéria
- [ ] Všechny payout cesty ověřeny malou transakcí.
- [ ] Buyback modul má pass na risk limits testech.
- [ ] Měsíční report template připraven a napojen na export dat.

---

## 4) Doporučené pořadí realizace

1. CUDA stabilita + fallback + observabilita.
2. Multialgo scheduler hardening (hysteresis, fallback feedy, audit log).
3. CHv3 revenue aktivace na malém provozu.
4. 72h canary + postmortem + rollout na plný provoz.

---

## 5) Rozhodnutí token supply: 144B vs 144M

### Shrnutí
- **Technicky** jsou možné obě varianty.
- **Pro UX a ekonomický narativ** je v této fázi obvykle bezpečnější držet vyšší nominální supply (např. 144B) a řešit hodnotu přes tokenomics (emise, burn, utility), než dělat tvrdé snížení na 144M těsně před mainnetem.

### Proč být opatrný se změnou na 144M teď
- Změna total supply před freeze zasahuje dokumentaci, model, očekávání komunity a potenciálně distribuci.
- Hrozí zmatek v komunikaci i migracích mezi testnet/mainnet artefakty.
- Vyžaduje nové ekonomické simulace (inflace, odměny, treasury runway, buyback dopad).

### Praktické doporučení
- Nechat **2.9.7 freeze bez změny supply modelu**.
- Pokud chcete 144M, udělat to jako samostatné governance rozhodnutí s modelací a explicitním migration plánem.
- Připravit A/B ekonomický dokument: stejné reward křivky pro 144B vs 144M a porovnat dopad na bezpečnost sítě + přístupnost pro uživatele.
