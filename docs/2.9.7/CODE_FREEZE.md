# CODE FREEZE SIGN-OFF — ZION TerraNova v2.9.7

> **Stav:** 🔴 OPEN — sign-off nesplněn  
> **Target tag:** `v2.9.7-freeze`  
> **Datum cíle:** 31. 3. 2026

---

## Checklist sign-off

Každý bod musí mít ✅ + datum + podpis (initials nebo GitHub login).

### Infrastruktura
- [ ] Pool Docker běží na Helsinki (port 3333+8080) — `curl http://77.42.31.72:8080/stats`
- [ ] Alertmanager Telegram tokeny aktivní + test-incident doručen
- [ ] `peers` health endpoint vrací číslo (ne null)
- [ ] SeedDE offline a odpojen ze seed listu

### Konsensus / Bezpečnost
- [ ] On-chain time-lock vynucen v mainnet buildu (`premine.rs`)
- [ ] Algoritmus rotace rozhodnutí zapsat (aktivovat nebo komentář CONFIRMED)
- [ ] `blocks_rejected` alert threshold nastaven a testován

### Genesis
- [ ] `genesis.json` vytvořen OFFLINE, hash ověřen
- [ ] Premine adresy odpovídají `PREMINE_ADDRESSES_PUBLIC.txt`
- [ ] GENESIS_MESSAGE.txt finalizován

### Release Engineering
- [ ] `MAINNET_CONSTITUTION.md` — status: FROZEN, SHA-256: `<hash>`
- [ ] Docker SHA-256 manifesty v `DOCKER_MANIFEST.md`
- [ ] 168h stability window (7 dní) bez restartu (viz `STABILITY_LOG.md`) — target 2026-03-03 11:48 UTC
- [ ] CI zelené: `cargo test` ≥ 501 testů, `cargo clippy -- -D warnings`, Hardhat 96
- [ ] API_ENDPOINTS.md canonical — zkontrolován s živými servery
- [ ] `MAINNET_EXIT_CRITERIA.md` — všechny checkboxy ✅

---

## Podpisy

| Role | Jméno / Login | Datum | Podpis |
|------|---------------|-------|--------|
| Lead Dev | | | |
| Infra | | | |
| Security | | | |

---

## Poznámky hotfixů po freeze

Pokud je po podpisu nalezena kritická chyba, zaznamenat zde:

| Datum | Popis | Hotfix verze | Commit |
|-------|-------|--------------|--------|
| — | — | — | — |
