# ZION V3 Mainnet Launch Playbook

> **Verze:** 1.1 — 2026-05-14  
> **Cíl:** Koordinované spuštění ZION Mainnet Genesis #0 s Helsinkami jako hlavním uzlem.  
> **Stav:** Příprava — viz P0 blockery níže.  
> **Zodpovědný:** Core dev + ops  
> **Relevantní docs:** `StatusV3.md`, `V3/ROADMAP.md`, `DEFI_ROADMAP.md`, `AGENTS.md`

---

## 1. Executive Summary

Tento dokument je jediným zdrojem pravdy pro go/no-go rozhodnutí o spuštění ZION V3 Mainnet. Každá sekce má explicitní vlastníka a deadline. Nic z P0 nesmí zůstat otevřené v den T-0.

**Hlavní uzel:** Helsinki (`157.180.41.213` — dodá se do `server.md`)  
**Aktivní node:** Praha (`91.98.122.165`) — běží isolated (height 26,910+)  
**Záložní uzly:** US (`5.78.194.94`), SG (`5.223.84.191`) — nedostupné, vyžadují reprovision

---

## 2. P0 Blockers — Kritické před spuštěním

| # | Blokér | Vlastník | Deadline | Status | Akce |
|---|--------|----------|----------|--------|------|
| 1 | **Bridge validator 3/5 multisig** — placeholder adresy `0x0000…0001`–`0005` v `V3/L2/bridge/config/bridge-mainnet.toml` řádky 65–70 | Security / Ops | T-7 | 🔴 **OPEN** | Vygenerovat 5 reálných secp256k1 adres, nasadit na 5 separátních HSM hostů, otestovat quorum signing na testnetu ≥1 týden |
| 2 | **Ankr API key** — `bridge-mainnet.toml` ř. 28: `api_key = ""` vyžaduje premium tier | Ops | T-7 | 🔴 **OPEN** | Zakoupit/zřídit Ankr premium API key, otestovat failover |
| 3 | **Seed peer bootstrap** — Praha běží isolated (1 peer = self), US/SG/Helsinki nedostupné | Ops | T-3 | 🔴 **OPEN** | Helsinki hlavní uzel musí být online jako první seed; zbylé nody reprovisionovat a ověřit P2P mesh |
| 4 | **Premine wallet rotation** — ✅ **DONE 2026-05-14**. Původních 12 BIP-39 seedů bylo v git historii (`PREMINE_WALLETS_BACKUP.json`). BFG scrub proveden (2×). Staré klony = compromised. **Nových 12 walletů vygenerováno** a uloženo lokálně (mimo repo). Veřejné adresy viz `PREMINE_ADDRESSES_PUBLIC.txt`. | Security | T-14 | ✅ **DONE** | Původní 12 seedů BURNED. Nové adresy public. Nikdy necommitovat seedy. |
| 5 | **CI / GitHub Actions billing** — repo je private, runnery nestartují bez paid plan | DevOps | T-14 | 🟡 **OPEN** | Aktivovat GitHub Team/Enterprise plan NEBO migrovat CI na self-hosted runner (např. Helsinki) |
| 6 | **Externí security audit** — nezávislý review consensus + bridge + crypto | Security | T-21 | 🔴 **OPEN** | Najmout audit firmu (např. Trail of Bits, OpenZeppelin, CertiK). Minimálně: `L1/cosmic-harmony`, `L1/core`, `L2/bridge`, `L2/dao` |
| 7 | **Bug bounty program** — chybí veřejný disclosure kanál | Security | T-7 | 🔴 **OPEN** | Zřídit Immunefi / HackerOne program, zveřejnit scope a odměny |
| 8 | **Genesis block ceremonie** — frozen genesis hash musí být veřejně ověřitelný | Core Dev | T-1 | 🟡 **PREP** | Připravit `GENESIS_MESSAGE.txt`, deterministický build hash, witness log (video/hash signed by 3+ parties) |
| 9 | **RPC / P2P endpoint exposure** — firewall, rate limiting, DDoS ochrana | Ops | T-3 | 🔴 **OPEN** | UFW konfigurace na všech nodech, Cloudflare (pokud web public) nebo WAF, RPC rate limiter aktivní |
| 10 | **Docker hardened deployment** — non-root kontejnery, resource limits, secrets management | Ops | T-3 | 🟡 **OPEN** | Ověřit `V3/docker/HARDENING.md`, `docker-compose.yml` profily, `.env` správa (žádné secrets v gitu) |

---

## 3. BFG Scrub History — Completed Actions

> **2026-05-14** — Rescrub proveden po mergi nových commitů z druhého PC.

### Odstraněné soubory z historie

| Soubor | Původní exposure | Stav |
|--------|-----------------|------|
| `PREMINE_WALLETS_BACKUP.json` | 12 BIP-39 seedů, 16.78B ZION | ✅ Odstraněno z historie (0 commits) |
| `test_api_keys.json` | API klíče | ✅ Odstraněno z historie (0 commits) |
| `secret.yaml` | Deployment secrets | ✅ Odstraněno z historie (0 commits) |
| `config.php.backup` | DB config backup | ✅ Odstraněno z historie (0 commits) |
| `CryptoService.secp256k1.backup` | Mobile crypto backup | ✅ Odstraněno z historie + working tree |
| `WalletService.js.backup` | Mobile wallet backup | ✅ Odstraněno z historie + working tree |
| `presale-en.html.backup.20251222` | HTML backup | ✅ Odstraněno z historie + working tree |
| `docs/docs2.9/26.9.2025VICTORY/MINING_Z3_ADDRESSES_BACKUP.md` | View keys + hesla | ✅ Odstraněno z working tree (historie pending BFG v3) |

### Post-scrub instrukce

1. **Všechny staré klony** repo (před 2026-05-14) považovat za **compromised** — obsahují leaked secrets.
2. **Smaž lokální repo** na obou PC a stáhni úplně čisté (`git clone --depth 1` nebo full clone po force-push).
3. **Rotace klíčů:** Všechny credentials z leaked souborů (DB hesla, API keys, SSH keys) musí být rotovány.
4. **Premine:** Původních 12 walletů bylo vygenerováno NOVÝCH 12. Staré seedy jsou BURNED — nikdy je nepoužívej.

---

## 4. Infrastruktura Checklist

### 4.1 Servery (doplní se do `server.md`)

| Role | Lokace | IP / Host | Spec | Služby | Status |
|------|--------|-----------|------|--------|--------|
| Hlavní node | Helsinki | `157.180.41.213` | Dodá se | `zion-core` (node), `zion-pool`, Prometheus, Grafana, seed peer | ❌ nedostupné |
| Záložní node | US | `5.78.194.94` | — | `zion-core`, `zion-pool` | ❌ nedostupné |
| Záložní node | Singapore | `5.223.84.191` | — | `zion-core`, `zion-pool` | ❌ nedostupné |
| Legacy active | Praha | `91.98.122.165` | Hetzner | Vše, ale isolated | ✅ běží (height 26,910+) |

**Akce:**
- [ ] Helsinki — provision server, nainstalovat Docker, nakonfigurovat UFW
- [ ] US/SG — reprovision nebo zřídit nové instance
- [ ] Všechny nody — SSH key rotation, pouze key-auth, root login zakázat
- [ ] Všechny nody — fail2ban nebo equivalent
- [ ] Všechny nody — automatické bezpečnostní updaty (unattended-upgrades)

### 4.2 Docker Stack (na každém node)

```bash
# Základní spuštění na Helsinkách (po doplnění .env)
docker compose -f V3/docker/docker-compose.yml --profile mainnet up -d
```

- [ ] Node (`zion-core`) — P2P 8333, RPC 8443, metrics 9115
- [ ] Pool (`zion-pool`) — Stratum 3333, API 8080
- [ ] Bridge relay (`zion-bridge`) — porty dle configu
- [ ] DAO daemon (`zion-dao`) — Axum HTTP port dle configu
- [ ] Hiran inference (`zion-hiran`) — port 8002 (pokud GPU dostupné)
- [ ] Prometheus — scrapuje všechny služby
- [ ] Grafana — dashboardy pro node, pool, bridge, hiran
- [ ] SQLite/DB zálohy — `bridge.db`, `dao.db`, chain snapshoty na persistent volume

### 4.3 Networking

- [ ] DNS seeds — zřídit `dnsseed.zion.network` nebo fallback bootstrap list
- [ ] P2P port 8333 otevřený inbound (nejen outbound)
- [ ] RPC port 8443 — pouze z allowlistu / VPN / localhost + reverse proxy s TLS
- [ ] Metrics port 9115 — internal only nebo VPN
- [ ] Pool stratum 3333 — veřejný pro minery, rate limiting

---

## 5. Security Checklist

| Oblast | Kontrola | Stav |
|--------|----------|------|
| **Git historie** | BFG scrub dokončen (2×), leaked files odstraněny z historie | ✅ P0 #4 uzavřen |
| **Secrets** | Žádné API klíče, PAT, SSH keys v gitu | 🔴 Ověřit gitleaks pre-commit hook na všech strojích |
| **Premine** | 12 nových walletů, staré seedy burned | ✅ Nové adresy v `PREMINE_ADDRESSES_PUBLIC.txt` |
| **Bridge** | 5 validatorů na separátních HSM, 3/5 quorum | 🔴 Placeholdery (P0 #1) |
| **RPC** | Rate limiter, auth (pokud veřejný), TLS | 🔴 Chybí (P0 #9) |
| **P2P** | Banlist, subnet diversity, connection limiter | 🟡 Implementováno v kódu, ověřit konfiguraci |
| **Firewall** | UFW/iptables — deny all, allow explicit | 🔴 Chybí playbook |
| **OS** | Non-root Docker, AppArmor/SELinux, read-only rootfs | 🟡 Částečně v Dockerfile |
| **Logy** | Centralizovaný log aggregation (např. Loki), retence ≥90 dní | 🔴 Chybí |
| **Monitoring** | Alerting: node down, pool down, high mempool, low peer count, bridge anomaly | 🟡 Prometheus/Grafana ready, alert rules partial |

---

## 6. Genesis #0 Procedura

> **Datum:** TBD (koordinovaný hard deadline)  
> **Místo:** Asynchronní — 3+ witness parties  
> **Síť:** `zion-mainnet-1`, Chain ID `zion-mainnet-1`

### Kroky T-24h až T+0

1. **T-14:** Všechny P0 blockery uzavřené, go/no-go hlasování
2. **T-7:** Veřejné oznámení genesis date (BitcoinTalk, Twitter/X, Discord)
3. **T-3:** Helsinki node provisioned, `ZION_SEED_PEERS` nakonfigurovány
4. **T-1:** Deterministický build kontejneru, `docker build` hash zaznamenán
5. **T-1:** Genesis block hash vypočítán lokálně, 3+ nezávislá ověření
6. **T-0 (H-hour):**
   - Spustit Helsinki node s `--genesis-only` (pokud existuje) nebo standardní start
   - Ověřit genesis hash shodný s `MAINNET_CONSTITUTION.md`
   - Ověřit coinbase dedication message v `GENESIS_MESSAGE.txt`
   - P2P announce — připojit Prahu, US, SG postupně
   - Pool server start — čekat na prvního minera
   - RPC health check — `getSupplyInfo`, `getTemplate`
   - Bridge relay start (až po L1 stabilizaci ≥6 bloků)
   - Website update — mainnet banner live

### Post-Genesis (T+0 až T+24h)

- [ ] Block explorer ukazuje height 0 s ověřitelným hashem
- [ ] Mempool prázdný, první TX čeká na potvrzení
- [ ] Pool přijímá share validace
- [ ] První block mined by komunita (ne genesis miner)
- [ ] Bridge relayer — `metrics.bridge_relayer_missing_signers == 0` ≥1 hodina
- [ ] DAO treasury lock — ověřit cliff na ~525,600 blocks

---

## 7. Go / No-Go Kriteria

| Kriterium | Požadavek | Provede | Zaznamená |
|-----------|-----------|---------|-----------|
| P0 blockery | 0 otevřených | Launch lead | Tento dokument |
| Testy | `cargo test --manifest-path V3/Cargo.toml --workspace` all green | CI / Dev | Log |
| Clippy | 0 warnings | Dev | CI log |
| Audit | Final report s ≤low-severity findings | Security lead | PDF |
| Premine | 12 nových walletů, public addresses verified | Core dev | `PREMINE_ADDRESSES_PUBLIC.txt` |
| Bridge | 5 reálných validatorů, testnet quorum ≥1 týden | Ops | Grafana metrics |
| Nodes | ≥3 seed peers online, P2P mesh funkční | Ops | `getpeerinfo` |
| Genesis | Hash match constitution, 3+ independent verify | Core dev | Signed witness doc |
| Monitoring | All dashboards green, alerting active | Ops | Grafana screenshot |
| Rollback plan | Hotový a otestovaný | Ops | `ROLLBACK_PLAYBOOK.md` |

**Go/no-go meeting:** T-24h, všichni vlastníci P0 musí být present (async OK).

---

## 8. Post-Launch Monitoring (T+0 až T+168h / 7 dní)

### 8.1 Denní kontroly (automatizované + manuální)

- [ ] Block time — target 60s, variance < ±15%
- [ ] Difficulty — DAA LWMA chová se předvídatelně
- [ ] Peer count — ≥8 na každém seed node
- [ ] Mempool size — nezacyklené, fee rate healthy
- [ ] Pool hash rate — >0, share acceptance rate >95%
- [ ] Bridge relay — daily volume, anomaly detection
- [ ] DAO proposals — žádné neočekávané treasury výběry
- [ ] Disk usage — chain snapshoty, DB, logy
- [ ] Alerting kanály — žádné false positives

### 8.2 Týdenní review

- [ ] Revenue/subsidy split — 89/5/5/1 flowuje správně
- [ ] Chain reorg depth — max 1–2, žádný >10
- [ ] Orphan rate — <1%
- [ ] Security logy — neautorizované pokusy, banlist review
- [ ] Backup restore test — chain snapshot z minulého týdne

---

## 9. Kontingenční Plány

### Scénář A: Genesis block neprochází validací
- **Akce:** Nepanikařit. Zastavit všechny nody. Debug lokálně na testnetu. Nezveřejňovat mainnet. Oznámit delay T+24h.
- **Příčina:** Pravděpodobně `TX_HASH_V2` / `BODY_ROOT_V2` mismatch nebo genesis PoW parametry.

### Scénář B: Bridge relayer padá / nepotvrzuje quorum
- **Akce:** Bridge auto-pause (`auto_pause_on_anomaly = true`). Ruční review validator logs. Nepouštět L1↔Base tok dokud není quorum stabilní.

### Scénář C: 51% / DDoS útok na pool nebo node
- **Akce:** Aktivovat P2P banlist. Zvýšit `max_reorg_depth` monitoring. Přepnout pool na invite-only (whitelist). Spustit záložní nody.

### Scénář D: Premine wallet compromise
- **Akce:** Okamžitě zamrazit DAO treasury (timelock). Rotovat všechny affected keys. Veřejné oznámení + incident report.

### Scénář E: CI / build pipeline down
- **Akce:** Manuální `cargo build --release` na Helsinkách. GitHub Actions je nice-to-have pro release, ne blocker.

---

## 10. Dodatek: Rychlé Odkazy

| Cíl | Cesta |
|-----|-------|
| V3 Roadmap | `V3/ROADMAP.md` |
| Status Report | `StatusV3.md` + `StatusV3-Part2.md` |
| DeFi Roadmap | `DEFI_ROADMAP.md` |
| Agent Guidance | `AGENTS.md` |
| Bridge Config | `V3/L2/bridge/config/bridge-mainnet.toml` |
| Docker Guide | `V3/docker/DOCKER.md` |
| Hardening | `V3/docker/HARDENING.md` |
| Genesis Constituce | `docs/mainnet/MAINNET_CONSTITUTION.md` |
| Operational Runbook | `V3/docs/operational/` |
| BFG Scrub Runbook | `V3/docs/operational/BFG_SCRUB_RUNBOOK.md` |
| Mainnet Deploy | `docs/mainnet/V3_ROLLOUT_VERIFICATION_CHECKLIST.md` |
| Premine Addresses | `PREMINE_ADDRESSES_PUBLIC.txt` (this repo) |
| CLI | `cargo run --manifest-path V3/Cargo.toml -p zion-cli -- --help` |

---

## 11. Changelog tohoto dokumentu

| Datum | Verze | Změna | Autor |
|-------|-------|-------|-------|
| 2026-05-14 | 1.0 | První verze — P0 blockery, infrastruktura, genesis procedura, go/no-go | Devin |
| 2026-05-14 | 1.1 | + BFG scrub history sekce, premine rotation done, P0 #4 closed, PREMINE_ADDRESSES_PUBLIC.txt | Devin |

---

**Poznámka:** Tento dokument je živý. Každá změna statusu P0 musí být reflektována do `StatusV3.md` a sem. Před každým push na `main` ověřit, že neobsahuje secrets (gitleaks). Po scrubu 2026-05-14 smaž lokální repo a stáhni čisté.
