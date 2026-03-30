# ZION V3 72h Rehearsal Closure Report

**Datum uzavreni:** [doplnit]  
**Rehearsal window:** [start UTC] -> [end UTC]  
**Verdikt rehearsal:** `[GO / AMBER / NO-GO]`  
**Verdikt public launch:** `[GO / NO-GO]`  
**Rozsah:** Prague / USA / Singapore auditovany 3-node V3 set  
**Navaznost:** `docs/mainnet/MAINNET_EXIT_CRITERIA.md`, `docs/mainnet/MAINNET_CHECKLIST.md`

---

## 1. Executive Verdict

Sem patri kratke uzavreni 72h okna v 5-10 vetach:

- zda se udrzel `tip agreement`
- zda se objevily restarty a jestli byly `planned upgrade` nebo `unexpected incident`
- zda po restartech doslo k obnoveni peer connectivity, pool accept a synchronizace
- zda C-01 proslo bez waiveru, s waiverem, nebo neproslo
- zda public launch zustava blokovany a cim konkretne

---

## 2. Runtime Snapshot Pri Uzavreni Okna

| Node | Host | chain_height | tip_hash | peers | mempool | restart_count | started_at | Stav |
|------|------|--------------|----------|-------|---------|---------------|------------|------|
| Prague | `91.98.122.165` | [doplnit] | [doplnit] | [doplnit] | [doplnit] | [doplnit] | [doplnit] | [OK / AMBER / FAIL] |
| USA | `5.78.194.94` | [doplnit] | [doplnit] | [doplnit] | [doplnit] | [doplnit] | [doplnit] | [OK / AMBER / FAIL] |
| Singapore | `5.223.84.191` | [doplnit] | [doplnit] | [doplnit] | [doplnit] | [doplnit] | [doplnit] | [OK / AMBER / FAIL] |

**Collector snapshot timestamp:** `[doplnit]`  
**Dashboard stav pri uzavreni:** `[RUNNING / COMPLETE / DEGRADED]`  
**Tip agreement:** `[LOCKED / DEGRADED / BROKEN]`

---

## 3. Evidence Pouzita Pro Closure

### A. Dashboard a collector

- posledni collector snapshot: `[doplnit cestu nebo lokaci]`
- dashboard capture time: `[doplnit]`
- dashboard issues counter: `[doplnit]`
- remarks: `[doplnit]`

### B. Cross-node RPC evidence

- Prague `getChainInfo`: `[vlozit shrnuti]`
- USA `getChainInfo`: `[vlozit shrnuti]`
- Singapore `getChainInfo`: `[vlozit shrnuti]`

### C. Docker / runtime evidence

- `docker inspect zion-core` restart metadata ulozena: `[ano/ne]`
- `docker ps` potvrzen na vsech 3 nodech: `[ano/ne]`
- pool `/stats` nebo ekvivalentni acceptance evidence ulozena: `[ano/ne]`

---

## 4. Restart / Recovery Appendix

| Node | Cas | Typ | Duvod | Recovery do tip agreement | Peer recovery | Pool accept recovery | Poznamka |
|------|-----|-----|-------|---------------------------|---------------|----------------------|----------|
| Prague | [doplnit nebo n/a] | `[planned / unexpected / n/a]` | [doplnit] | [doplnit] | [doplnit] | [doplnit] | [doplnit] |
| USA | [doplnit nebo n/a] | `[planned / unexpected / n/a]` | [doplnit] | [doplnit] | [doplnit] | [doplnit] | [doplnit] |
| Singapore | [doplnit nebo n/a] | `[planned / unexpected / n/a]` | [doplnit] | [doplnit] | [doplnit] | [doplnit] | [doplnit] |

**Pravidlo vyhodnoceni:**

- planned upgrade restart je pripustny jen pokud je dolozeny recovery cas a obnoveni tip agreementu
- unexpected incident posouva rehearsal minimalne do `AMBER`, pokud neni formalne odwaiverovany

---

## 5. Metodicky Souhrn C-01

| Metrika | Pozadavek | Vysledek | Stav | Poznamka |
|---------|-----------|----------|------|----------|
| Orphan rate | < 5 % | [doplnit nebo `not yet instrumented`] | [PASS / AMBER / FAIL] | [doplnit] |
| Block reject rate | < 2 % | [doplnit] | [PASS / AMBER / FAIL] | [doplnit] |
| Node uptime | bez necekaneho restartu | [doplnit] | [PASS / AMBER / FAIL] | [doplnit] |
| Block time prumer | 55-65 s (+/-8 %) | [doplnit] | [PASS / AMBER / FAIL] | [doplnit] |
| Chain divergence | steady-state 0 blk | [doplnit] | [PASS / AMBER / FAIL] | [doplnit] |
| Restart discipline | recovery potvrzena | [doplnit] | [PASS / AMBER / FAIL] | [doplnit] |

---

## 6. Pool, Mining a Chain Growth Summary

- pool acceptance za okno: `[doplnit]`
- pool reject summary: `[doplnit]`
- chain growth za okno: `[doplnit]`
- prumerny block time: `[doplnit]`
- nejvetsi pozorovana divergence: `[doplnit]`
- open operational anomalies: `[doplnit / none]`

---

## 7. Launch Blockers Pri Uzavreni Okna

| Oblast | Stav | Poznamka |
|--------|------|----------|
| BFG scrub premine historie | `[OPEN / CLOSED]` | [doplnit] |
| Exit criteria sign-off | `[OPEN / CLOSED]` | [doplnit] |
| Genesis artefakty + checksumy | `[OPEN / CLOSED]` | [doplnit] |
| Alert routing / ops closure | `[OPEN / CLOSED]` | [doplnit] |
| Security review / fuzz pass | `[OPEN / CLOSED]` | [doplnit] |

---

## 8. Finalni RAG Matrix

| Oblast | Stav | Poznamka |
|--------|------|----------|
| Runtime stability | `[GREEN / AMBER / RED]` | [doplnit] |
| Cross-node sync | `[GREEN / AMBER / RED]` | [doplnit] |
| Restart discipline | `[GREEN / AMBER / RED]` | [doplnit] |
| Pool recovery | `[GREEN / AMBER / RED]` | [doplnit] |
| Monitoring evidence | `[GREEN / AMBER / RED]` | [doplnit] |
| Launch gating closure | `[GREEN / AMBER / RED]` | [doplnit] |

---

## 9. Finalni Rozhodnuti

### Rehearsal verdict

`[GO / AMBER / NO-GO]`

Strucne zdurvodneni:

- [doplnit]
- [doplnit]
- [doplnit]

### Public launch verdict

`[GO / NO-GO]`

Pokud zustava `NO-GO`, explicitne vypsat zbyvajici blokatory:

1. [doplnit]
2. [doplnit]
3. [doplnit]

---

## 10. Prilohy A Odkazy

- dashboard evidence: `[doplnit]`
- collector snapshot: `[doplnit]`
- rollout / runbook reference: `docs/mainnet/V3_ROLLOUT_VERIFICATION_CHECKLIST.md`
- exit criteria: `docs/mainnet/MAINNET_EXIT_CRITERIA.md`
- launch checklist: `docs/mainnet/MAINNET_CHECKLIST.md`
- doplnujici incident nebo rollout reporty: `[doplnit]`

---

## 11. Sign-Off

| Role | Jmeno | Datum | Podpis / potvrzeni |
|------|-------|-------|--------------------|
| Core Dev | | | |
| Ops Lead | | | |
| Security / Review | | | |
