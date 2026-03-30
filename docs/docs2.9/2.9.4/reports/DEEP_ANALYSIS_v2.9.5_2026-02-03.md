# 🔍 ZION TerraNova v2.9.5 — Hluboká analýza (stav k 2026-02-03)

> Cíl tohoto dokumentu: dát **jednu konzistentní mapu reality** pro v2.9.5 (native Rust stack), vyjasnit rozpory mezi reporty/roadmapami a navrhnout **prioritizované další kroky** pro TestNet.

## 1) Executive summary

### Co je (reálně) v2.9.5 dnes nejsilnější
- **Native Rust stack běží end-to-end**: miner → pool (Stratum) → core (JSON-RPC) a je potvrzené přijímání shareů.
- **Core + pool mají kanonický „real status“ dokument** s odkazy do kódu a testů.
- **P2P bootstrap/sync minimálně pro 2 nody byl reportovaný jako úspěšný** (Helsinki ↔ USA) a existují nástroje/skripty pro bootstrap.
- **Cosmic Harmony v3** se profiluje jako sjednocovací mining engine + revenue model (a navíc se prolíná s NCL).

### Největší rizika / „pozor na realitu“
- **Metriky invalid shareů** jsou v některých reportech extrémní (řádově stovky milionů invalid vs stovky tisíc valid). V reportu 2026-01-29 je vysvětlení (scannery + historická data), ale to znamená, že **pool statistiky mohou být bez resetu/filtrace zavádějící**.
- **Konfigurační drift**: různé reporty uvádí jiné porty a jiné RPC endpointy (historicky např. 8080 vs 8444). To je typická příčina „funguje to jen někde“.
- **P2P status je nekonzistentní mezi reporty** (jednou „síť sync aktivní“, jindy „no P2P sync“). Pravděpodobně jde o rozdíl mezi různými nasazeními nebo konfiguracemi.
- Repo obsahuje **více historických architektur** (Python stack, C++/Node shim stack, Rust native stack). Bez jasného „current default“ je dokumentace přirozeně ve sporu.

## 2) Doporučená „single source of truth“ sada dokumentů pro v2.9.5

Pokud má být v2.9.5 řízená jako produkt, tahle pětice by měla být považovaná za kanon:
1. Stav v kódu: [2.9.5/docs/REAL_STATUS_v2.9.5.md](../../../2.9.5/docs/REAL_STATUS_v2.9.5.md)
2. Deploy realita (Docker native stack): [2.9.5/docker-compose.native-2.9.5.yml](../../../2.9.5/docker-compose.native-2.9.5.yml)
3. TestNet roadmap (operativní plán): [TESTNET_ROADMAP_2026.md](../roadmaps/TESTNET_ROADMAP_2026.md)
4. Poslední E2E distribuovaný mining report: [SESSION_REPORT_2026-02-02_DISTRIBUTED_MINING_SUCCESS.md](../session-reports/2026/SESSION_REPORT_2026-02-02_DISTRIBUTED_MINING_SUCCESS.md)
5. CH3 roadmap (pokud je CH3 „motor“): [2.9.5/docs/COSMIC_HARMONY_V3_ROADMAP.md](../../../2.9.5/docs/COSMIC_HARMONY_V3_ROADMAP.md)

## 3) Architektura v2.9.5 (native) — jak to má téct

### Komponenty (2.9.5 workspace)
- Core node (Rust): [2.9.5/zion-native/core/src/main.rs](../../2.9.5/zion-native/core/src/main.rs)
- Pool (Rust): [2.9.5/zion-native/pool/src/main.rs](../../2.9.5/zion-native/pool/src/main.rs)
- Universal miner (Rust): [2.9.5/zion-universal-miner](../../2.9.5/zion-universal-miner)
- NCL (Rust): člen workspace v [2.9.5/Cargo.toml](../../2.9.5/Cargo.toml)
- Cosmic Harmony v3 (Rust): [2.9.5/zion-cosmic-harmony-v3](../../2.9.5/zion-cosmic-harmony-v3)

### Runtime topologie (podle docker-compose)
Viz [2.9.5/docker-compose.native-2.9.5.yml](../../2.9.5/docker-compose.native-2.9.5.yml):
- `zion-core` (P2P + JSON-RPC)
- `zion-pool` (Stratum + Pool API)
- `redis` (shares, PPLNS window, metriky)
- `zion-api` (Python FastAPI gateway)
- `zion-web` (Next.js)
- `nginx` (reverse proxy)

## 4) Stav „ověřeno v reportech“ (Jan–Feb 2026)

### 4.1 Share validace
- Invalid share rate byl řešen v reportu: [SESSION_REPORT_2026-01-29_POOL_SHARES_FIX.md](../session-reports/2026/SESSION_REPORT_2026-01-29_POOL_SHARES_FIX.md)
- Důležité: report tvrdí, že vysoký invalid count byl historický + scan traffic; po resetu validace funguje.

**Praktická implikace:** bez sanitace dat je dashboard/telemetrie snadno falešně alarmující.

### 4.2 Hash mismatch a kompatibilita submitu
- Popis problému a přístup k diagnostice: [SESSION_REPORT_2026-01-29_HASH_FIX.md](../session-reports/2026/SESSION_REPORT_2026-01-29_HASH_FIX.md)

**Interpretace:** v této fázi je největší tření vždy “jak přesně se serializuje header blob” a jestli pool/core hashují *identická* data.

### 4.3 P2P multi-node (min. 2 nody)
- Úspěch P2P + mining infra: [SESSION_REPORT_2026-01-31_P2P_MINING_SUCCESS.md](../session-reports/2026/SESSION_REPORT_2026-01-31_P2P_MINING_SUCCESS.md)
- Operativní plán na multi-node: [TESTNET_ROADMAP_2026.md](../roadmaps/TESTNET_ROADMAP_2026.md)

### 4.4 Distribuovaný deployment napříč architekturami
- Deploy přes kontinenty a GLIBC/Docker základ fix: [SESSION_REPORT_2026-02-02_DISTRIBUTED_MINING_SUCCESS.md](../session-reports/2026/SESSION_REPORT_2026-02-02_DISTRIBUTED_MINING_SUCCESS.md)

**Závěr:** multi-arch realita (ARM64 vs x86_64) je teď “hard requirement”.

## 5) Klíčové rozpory a co z nich plyne

### Rozpor A: porty a endpointy
- Core v kódu defaultně startuje na `rpc_port=8444` a `p2p_port=8334` (a umí env override): [2.9.5/zion-native/core/src/main.rs](../../2.9.5/zion-native/core/src/main.rs)
- Docker-compose mapuje `8444` (RPC) a `8334` (P2P): [2.9.5/docker-compose.native-2.9.5.yml](../../2.9.5/docker-compose.native-2.9.5.yml)
- Reporty se liší (někde 8080, jinde 8444).

**Co to znamená:** je potřeba mít jeden kanonický „port matrix“ pro TestNet a držet ho napříč systemd/docker/miner configs.

### Rozpor B: P2P „funguje“ vs „není“
- 2026-01-31 report popisuje sync Helsinki↔USA.
- 2026-02-02 report uvádí „No P2P Sync“ jako limitation.

**Pravděpodobné vysvětlení:** dvě paralelní nasazení / odlišná konfigurace core (např. seed/peers) nebo jiný build.

### Rozpor C: invalid share „katastrofa“ vs „OK po resetu“
- Extrémní invalid/valid v některých statistikách.
- Jinde vysvětlení, že jde o scan traffic/historická data.

**Co s tím:** oddělit metriky „invalid due to protocol/garbage“ vs „invalid due to PoW/target“ a mít možnost resetu/retence.

## 6) Roadmap alignment — co nejvíc táhne v2.9.5 kupředu

### TestNet (operativně, únor 2026)
- [TESTNET_ROADMAP_2026.md](../roadmaps/TESTNET_ROADMAP_2026.md) definuje fáze: mining loop → stress test → payouts/wallet → dashboard/explorer → GPU → security.

### CH3 (strategicky, Q1–Q2 2026)
- [2.9.5/docs/COSMIC_HARMONY_V3_ROADMAP.md](../../2.9.5/docs/COSMIC_HARMONY_V3_ROADMAP.md) říká: core+algo integrace je hodně daleko, profit router i miner integrace jsou označené jako hotové/částečně hotové.

**Poznámka k realitě:** CH3 roadmap uvádí řadu milníků jako „done“, ale zároveň má otevřené položky v pool integraci a testnet launch checklistu. Doporučuji brát “done” jen tam, kde existuje test/E2E.

## 7) Prioritizovaný backlog (doporučení)

### P0 (musí být stabilní pro veřejný TestNet)
1. **Konfigurační sjednocení portů + endpointů** (core/pool/miner/docker/systemd) + jedna tabulka v docs.
2. **Data kvalita metrik**: rozlišit typy invalid shareů + retence/reset.
3. **P2P reorg/propagace test** (simulace reorg handling z roadmapy).

### P1 (vyšší důvěra a použitelnost)
4. **Payout execution test** (reálné testnet payouty a potvrzení on-chain).
5. **Block explorer API minimum** (`/blocks`, `/block/{hash}`, `/tx/{hash}`, `/address/{addr}`).

### P2 (škálování)
6. **Stress test 10+ minerů** + VarDiff tuning tak, aby se pool neutopil v mikro-shares.
7. **Multi-arch build pipeline** (ARM64 + x86_64) — ideálně automat.

## 8) Co je v repo „outdated“ vůči 2.9.5

- Starší architektura popisující C++ core + Node shim + node pool: [docs/technical/PROJECT_ARCHITECTURE_OVERVIEW.md](../technical/PROJECT_ARCHITECTURE_OVERVIEW.md)

To není nutně špatně jako historie, ale pro v2.9.5 je potřeba jasně označit, že jde o starší generaci.

---

## Appendix: Klíčové roadmapy a plány
- [docs/2.9/ROADMAP_NEXT_STEPS_v2.9.5.md](../2.9/ROADMAP_NEXT_STEPS_v2.9.5.md)
- [docs/roadmaps/ROADMAP_v2.9.5_ZION_NATIVE.md](../roadmaps/ROADMAP_v2.9.5_ZION_NATIVE.md)
- [docs/2.9/ROADMAP_REALISTIC_v2.9_2025-2027.md](../2.9/ROADMAP_REALISTIC_v2.9_2025-2027.md)
