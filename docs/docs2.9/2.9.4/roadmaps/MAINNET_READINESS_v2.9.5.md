# 🚀 ZION v2.9.5 — MainNet Readiness (gaps + plán)

**Datum:** 2026-02-03  
**Scope:** v2.9.5 native Rust stack (`2.9.5/`).  
**Poznámka:** Repo obsahuje historické/legacy „MainNet launch“ dokumenty s jinými parametry; tento dokument je aktuální pro v2.9.5.

## 0) Hlavní rozhodnutí, které je potřeba uzamknout

Než se bude mluvit o MainNet date:
- **MainNet datum**: v dokumentech se objevuje 2026 i 2027. Doporučení: uzamknout 1 datum a přepsat všude.
- **Chain params**: chain_id, genesis timestamp, initial difficulty, port matrix, reward schedule (base + bonus).
- **Upgrade politika**: jak budou fungovat hard-forky/soft-forky a versioning protokolu.

Bez toho se plány budou vždy rozcházet.

## 1) Co je už silné (stav v2.9.5)

Opřeno o real-code status:
- [2.9.5/docs/REAL_STATUS_v2.9.5.md](../../../2.9.5/docs/REAL_STATUS_v2.9.5.md)

Shrnutí:
- Core: storage (LMDB), TX validace, UTXO rollback, mining template blob, RPC základ, P2P (seed discovery + persistence + rate limit/blacklist).
- Pool: Stratum server, share validator (hash computed server-side), VarDiff, PPLNS + payout pipeline, stats API, Redis, NCL extension.
- Miner: E2E share mining pro cosmic harmony, NCL polling+submit; GPU zatím WIP.

## 2) MainNet checklist — „MUST HAVE“

### A) Konsensus & ekonomika
- [ ] Finalizovat emission/reward: base reward, consciousness bonus, tithe, fee model (a zapsat jako specifikaci).
- [ ] Algo politika pro MainNet (rotace vs fix) + deterministické testy.
- [ ] Jasná pravidla pro block/tx validity + error codes (stabilní API).

### B) P2P & síťová bezpečnost
- [ ] Sybil/DoS obrana (beyond rate-limit): peer scoring, inbound slot policy, message size limits audit.
- [ ] P2P encryption (min. transport-level TLS nebo noise-like handshake) — pokud je to MainNet requirement.
- [ ] Reorg test suite (simulace forků, rollback correctness, chain selection).
- [ ] Snapshot/fast-sync strategie (aby nový node nesyncoval týdny).

### C) Storage & data integrita
- [ ] DB migrace/backup/restore story (automatické zálohy, verze DB schématu).
- [ ] Pruning/archival modes (minimálně definovat a otestovat).

### D) RPC / API stabilita
- [ ] Versioned API (např. `v1`) + backward compatibility pravidla.
- [ ] Rate limiting na RPC (pokud bude veřejné).
- [ ] Explorer endpoints (minimum): blocks, block detail, tx detail, address history.

### E) Pool & miner ready pro veřejnost
- [ ] VarDiff tuning + anti-spam (share flood, dup shares, scanner garbage traffic).
- [ ] Multi-arch build pipeline pro core/pool/miner (x86_64 + ARM64).
- [ ] GPU mining story (min. roadmap + první funkční build pro 1 platformu).

### F) Wallet UX (minimální)
- [ ] CLI wallet (create/import/export, send/receive, fee estimation, recovery).
- [ ] Bezpečný key management + backup flows.

### G) Security & audit
- [ ] Fuzzing základ pro P2P a parsery (blob, stratum messages, rpc json).
- [ ] Externí audit scope + interní security checklist splněn.
- [ ] Incident response playbook + monitoring.

## 3) Doporučené milníky (navazující na TestNet)

### Milestone M1 — TestNet stabilita (2–4 týdny)
Exit criteria:
- 72h běh bez kritického incidentu
- P2P sync mezi 3 nody stabilní
- Share acceptance metriky „čisté“ (oddělený garbage traffic)

### Milestone M2 — Ekonomika + wallet minimum (4–8 týdnů)
Exit criteria:
- první reálné payouty na TestNet (ověřené v chain)
- CLI wallet end-to-end

### Milestone M3 — Explorer + API stabilizace (8–12 týdnů)
Exit criteria:
- základní explorer endpoints
- stabilní verze RPC

### Milestone M4 — Security hardening + audit prep (12+ týdnů)
Exit criteria:
- fuzzing + rate limit policy
- audit ready (scope, threat model, build reproducibility)

### Milestone M5 — MainNet genesis rehearsal
Exit criteria:
- „dry-run genesis“ na izolované síti
- runbook pro seed nodes + bootstrap

## 4) Konkrétní P0 úkoly pro tento týden

- [ ] Uzamknout port matrix a odstranit drift (viz [docs/2.9.4/meta/PORT_MATRIX_TESTNET_v2.9.5.md](../meta/PORT_MATRIX_TESTNET_v2.9.5.md)).
- [ ] Udělat jeden kanonický deploy způsob pro core+pool (docker nebo systemd) a napsat 1 návod.
- [ ] Oddělit invalid shares: scanner/garbage vs real PoW reject.

