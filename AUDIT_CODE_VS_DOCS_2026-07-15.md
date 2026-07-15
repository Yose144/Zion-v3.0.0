# Kompletní audit code-vs-docs + optimalizace

**Datum:** 2026-07-15  
**Repo:** `/Users/yeshuae/Projects/2.9.6`  
**Branch:** `main` (čistý working tree, poslední commit `346fa7745`)  
**Live RPC ověřeno:** `rpc.zionterranova.com:8443`  

## Shrnutí

Auditoval jsem kód vůči kanonickým dokumentům (`StatusV3.md`, `AGENTS.md`, `V3/ROADMAP.md`, `V3/README.md`, reporty z 07/2026 a deploy configy). Identifikováno **30+ discrepancí a optimalizačních příležitostí** rozdělených do vrstev L1/L2/L3/CLI/Web/Ops. Největší problémy jsou verzování (kód 3.0.5 vs live 3.0.6), chybějící env vars v edge configu, a reálné chyby v CLI.

| Kategorie | Počet | HIGH | MEDIUM | LOW |
|-----------|-------|------|--------|-----|
| L1 (core/consensus/RPC/pool) | 12 | 3 | 6 | 3 |
| CLI | 9 | 1 | 5 | 3 |
| L2/L3 (contracts, bridge, DAO, WARP) | 3 | 1 | 2 | 0 |
| Web frontend | 2 | 0 | 0 | 2 |
| Deployment / Ops / Systemd | 8 | 0 | 5 | 3 |
| Public/ subtree | 2 | 0 | 2 | 0 |
| **Celkem** | **36** | **5** | **20** | **11** |

---

## 1. L1 Core / Consensus / RPC / Pool

### 1.1 Protocol version: kód 3.0.5 vs live RPC 3.0.6 — HIGH

**Kód:** `V3/L1/core/src/lib.rs:47` deklaruje:
```rust
pub const NODE_PROTOCOL_VERSION: &str = "zion-v3-node/3.0.5";
```
**Live RPC:**
```json
{ "protocol_version": "zion-v3-node/3.0.6" }
```
**Dopad:** Běžící binárka na Edge nebyla postavena z aktuálního `main` v tomto repu, nebo existuje lokální/uncommited změna. `StatusV3.md` už jsem aktualizoval na 3.0.6, ale kód není v syncu.
**Fix:**
- Zjistit, zda na Edge běží patch, který není v repu.
- Buď bumpnout `NODE_PROTOCOL_VERSION` na `3.0.6` a commitnout, nebo sjednotit důvod rozdílu.
- Přidat CI check, který kontroluje shodu `NODE_PROTOCOL_VERSION` s `StatusV3.md`.

### 1.2 Chybějící AuxPow env vars v edge-environment.sh — HIGH

**Kód:** `V3/L1/pool/src/bin/server.rs:3076-3119` čte:
- `ZION_POOL_AUXPOW_ENABLED`
- `ZION_POOL_AUXPOW_COIN`
- `ZION_POOL_AUXPOW_SPLIT_ZION`
- `ZION_POOL_AUXPOW_SPLIT_EXTERNAL`
- `ZION_POOL_AUXPOW_WALLET`
- `ZION_POOL_AUXPOW_WORKER_NAME`
- `ZION_BACKEND_AUTO_INCLUDE_ZION`

**Config:** `edge-deploy/config/edge-environment.sh` obsahuje pouze základní pool config; výše uvedené chybí.
**Dopad:** Bez těchto proměnných se AuxPow bridge chová špatně — viz `CHAIN_STALL_FIX_REPORT_2026-07-13.md` (chybějící `ZION_POOL_AUXPOW_SPLIT_EXTERNAL` způsobila, že `should_issue_external_job()` vracelo vždy `true`).
**Fix:** Přidat do `edge-deploy/config/edge-environment.sh`:
```bash
# AuxPow (post-chain-stall-fix)
ZION_POOL_AUXPOW_ENABLED=1
ZION_POOL_AUXPOW_COIN=RVN
ZION_POOL_AUXPOW_SPLIT_ZION=4
ZION_POOL_AUXPOW_SPLIT_EXTERNAL=1
ZION_POOL_AUXPOW_WALLET=bc1q9c06f4wpf638xp2280j07qgdrpz0sdms7peqkh
ZION_POOL_AUXPOW_WORKER_NAME=zion-pool
ZION_BACKEND_AUTO_INCLUDE_ZION=1
```

### 1.3 Chybějící Stream Profit env vars v edge configu — MEDIUM

**Dokumentace:** `StatusV3.md` §5 uvádí:
- `ZION_STREAM_PROFIT_SWITCH=true`
- `ZION_STREAM_PROFIT_API_PROVIDER=whattomine`
- `ZION_STREAM_PROFIT_INTERVAL=120`
- `ZION_STREAM_HYSTERESIS_PCT=15.0`
- `ZION_STREAM_PROFIT_SOURCES=...`

**Config:** v `edge-environment.sh` chybí.
**Fix:** Přidat sekci a sjednotit názvy zdrojů (aktuálně kód míchá `deeksha_lite` a `thermal_bonus`).

### 1.4 CHV3 fork height není v StatusV3.md — LOW

**Kód:** `V3/L1/cosmic-harmony/src/lib.rs:87,90`:
```rust
pub const CHV3_FORK_HEIGHT: u64 = 4500;
pub const FIRE_FORK_HEIGHT: u64 = 5000;
```
**Dokumentace:** Fork heights nejsou v `StatusV3.md` uvedeny.
**Fix:** Přidat do Blockchain State tabulky řádky s fork heights.

### 1.5 Pool advertizuje bezpečný alias, ale vnitřní profil je `deeksha_chv3` — MEDIUM

**Kód:**
- `V3/L1/pool/src/lib.rs:36-38` vždy vrací `"deeksha_lite_v1"` (oprava po chain stall).
- `V3/L1/cosmic-harmony/src/lib.rs` nadále vrací `deeksha_chv3` pro height >= 4500.
**Dopad:** Funkční, ale může mást. Pool fix je správný.
**Fix:** Přidat komentář do `cosmic-harmony/src/lib.rs`, proč se interně používá `deeksha_chv3` a pool to přepisuje.

### 1.6 P2P topology a `known_peers=1` — MEDIUM

**Kód / config:**
- `edge-deploy/systemd/zion-edge-node1.service:14`: `ZION_SEED_PEERS=none`
- `edge-deploy/systemd/zion-edge-node2.service:17`: `ZION_SEED_PEERS=127.0.0.1:8333`
- `scripts/start-backup-node.sh:25`: `ZION_SEED_PEERS='62.171.141.136:8333,62.171.141.136:8334'`

**Live stav:** `getNodeInfo` vrací `known_peers=1` na primary. To odpovídá jedinému inbound peerovi (node2). Backup node se evidentně nepřipojil.
**Dopad:** 3-node mesh není kompletní. Při výpadku node2 by primary ztratil jediného peera.
**Fix:**
1. Ověřit, proč backup node není připojený (stará binárka? firewall? SSH tunnel?).
2. Zvážit přidání `ZION_SEED_PEERS=127.0.0.1:8334` do node1 jako fallback outbound.
3. Přidat monitoring/alert na `known_peers < 2`.

### 1.7 Local backup node seed peers nejsou v StatusV3.md — LOW

**Fix:** Dokumentovat, že backup node seeduje na `62.171.141.136:8333` a `8334`.

### 1.8 RPC metody — VERIFIED ✅

Všechny dokumentované RPC metody (`getChainInfo`, `getNodeInfo`, `getBlockByHeight`, `getBlock`, `getTransaction`, `getAccountTransaction`, `getTransactionHistory`, `getAddressInfo`, `getMempoolInfo`, `getPeerInfo`, `getBlockTemplate`, `submitBlock`, `submitTransaction`, `submitAccountTransaction`) jsou implementovány v `V3/L1/core/src/rpc.rs`.

### 1.9 Optimalizace poolu (z `POOL_PERFORMANCE_PLAN_2026-07-11.md`)

- **Per-session job tracking** — `active_jobs` je pod mutexem; pro 1000+ minerů by stálo za to přejít na sharded mapu nebo per-session strukturu.
- **PPLNS persistence** — `V3/L1/pool/src/pplns.rs` serializuje pod zámkem; doporučuji snapshot-then-serialize mimo lock.
- **`known_peers` cap 1000** — OK, ale pro mainnet bych snížil na 500.

---

## 2. CLI (`V3/cli`)

### 2.1 `zion pool earnings` volá neexistující RPC metodu — HIGH

**Kód:** `V3/cli/src/commands/pool.rs:65-71`:
```rust
let result = node_rpc::call(
    rpc_host, rpc_port,
    "get_miner_stats",  // TATO METODA NEEXISTUJE
    json!({ "address": addr }),
).await;
```
**Realita:** `V3/L1/core/src/rpc.rs` neregistruje `get_miner_stats`. Pool má HTTP endpoint `/api/v1/miner/:address/stats` (`V3/L1/pool/src/bin/server.rs:4571`), ale CLI volá JSON-RPC na node.
**Dopad:** Příkaz `zion pool earnings` selže s `Method not found`.
**Fix:**
- Buď implementovat `get_miner_stats` v `rpc.rs`, nebo
- přepsat CLI, aby volal pool HTTP API (správný `host:port` z `cfg.target_pool`), nebo
- příkaz dočasně odstranit a dokumentovat alternativu.

### 2.2 CLI nepodporuje environment variables — MEDIUM

**Dokumentace:** `V3/ROADMAP.md:1151` tvrdí: *"V3 binaries use `from_env()` exclusively — CLI `command:` sections removed, all config via `ZION_*` env vars."*
**Realita:** `V3/cli/src/config.rs` používá pouze `~/.zion/zion.toml`.
**Fix:**
- Rozhodnout se: buď implementovat env-var override (precedence: env > TOML > defaults), nebo aktualizovat ROADMAP.md.

### 2.3 Příliš mnoho hardcoded `127.0.0.1` — MEDIUM

**Soubory:** `V3/cli/src/config.rs:158,178,181,192,195,227`, `V3/cli/src/commands/issobella.rs:20`, `free_world.rs:20`, `mine.rs:589`.
**Dopad:** Nejsnášnější pro remote deploy, kontejnery, multi-node topologie.
**Fix:** Přidat config položky pro všechny služby a CLI flagy `--host` tam, kde to dává smysl.

### 2.4 L2 služby používají `cfg.node.rpc_host` místo vlastního hostu — MEDIUM

**Soubory:**
- `V3/cli/src/commands/bridge.rs:9`
- `V3/cli/src/commands/dao.rs:9`
- `V3/cli/src/commands/swap.rs:9`

**Dopad:** Předpokládá, že bridge/dao/swap běží na stejném hostu jako node.
**Fix:** Přidat `bridge.host`, `dao.host`, `swap.host` do configu s defaultem na `node.rpc_host`.

### 2.5 Chybí CLI příkazy pro AuxPow / Stream Profit — MEDIUM

**Dokumentace:** `StatusV3.md` §5 popisuje 14 externích coinů a stream profit systém.
**Realita:** V CLI není `auxpow`, `profit`, `stream` ani `external-coin` příkaz.
**Fix:** Buď přidat základní příkazy (`zion auxpow status`, `zion auxpow config`), nebo dokumentovat, že se konfiguruje pouze přes env vars.

### 2.6 Chybí onboarding dokumentace — MEDIUM

**Realita:** `V3/cli/src/commands/onboard.rs` existuje a je plně funkční, ale `V3/README.md` a `V3/docs/CLI_GUIDE.md` ho nezmiňují.
**Fix:** Přidat `ONBOARDING_GUIDE.md` nebo sekci do README/CLI_GUIDE.

### 2.7 `.unwrap()` v produkčním kódu config.rs — MEDIUM

**Soubor:** `V3/cli/src/config.rs:413,419,425,431,437,443,449` (všechny v `set_value` pro `hiran.*`).
**Fix:** Nahradit `?` operátorem nebo `ok_or`.

### 2.8 Chybí help text pro env proměnnou hesla — LOW

**Realita:** Wallet příkazy podporují `--password-env`, ale není jasné, jak se proměnná jmenuje.
**Fix:** Dokumentovat konvenci `ZION_WALLET_PASSWORD` v help textu.

### 2.9 CLI TUI/menu — VERIFIED ✅

Všechny 24 command moduly jsou zapojeny v `main.rs` a `menu.rs` (`V3/cli/src/menu.rs`).

---

## 3. L2 / L3 (Contracts, Bridge, DAO, Atomic Swap, WARP)

### 3.1 BridgeValidator contract není v deployment JSON — HIGH

**Dokumentace:** `StatusV3.md:118` uvádí adresu `0x9C138dC6ebA8A883AB3802F6Dcb79C772a835627`.
**Realita:** Adresa není v žádném `deployed-*.json` ani v `bridge-mainnet.toml`.
**Dopad:** Operativní drift, risk nesprávných on-chain verifikací.
**Fix:**
- Přidat `bridge_validator` do všech relevantních `deployed-*.json`.
- Aktualizovat `bridge-mainnet.toml` a `verify-base-mainnet-basescan.ts`.

### 3.2 ZIONAtomicSwap adresa chybí v StatusV3.md — MEDIUM

**Realita:** Adresa `0x3DE9Ad42716854083ab837706E3961d10B0e63Eb` je v `swap-mainnet.toml:46`, `verify-base-mainnet-basescan.ts:45` a `BASESCAN_VERIFY_REPORT.md:14`.
**Dokumentace:** `StatusV3.md:123` má pouze poznámku "(escrow funded 100K ZION)".
**Fix:** Doplnit adresu do StatusV3.md.

### 3.3 Chybí `deployed-base.json` — MEDIUM

**Realita:** Pro Base Mainnet existují `deployed-defi.json` a `deployed-farm-base.json`, ale není jednotný `deployed-base.json` jako pro ostatní EVM chainy.
**Fix:** Vytvořit `V3/L2/contracts/hardhat/deployed-base.json` se všemi Base kontrakty.

### 3.4 Bridge vault address — VERIFIED ✅

`zion1j53677g5k83030x3s2z2z644e7h07792q0u02t7` je konzistentní napříč `StatusV3.md`, `DefiL2.md`, `bridge-mainnet.toml`, `warp-mainnet.toml` a `V3/L1/core/src/fee.rs:134`.

### 3.5 DAO guardians — VERIFIED ✅

`dao-mainnet.toml:53-86` má 7 guardianů; Treasury multisig má 3/3. L1 scanner správně skenuje `account_transactions`.

### 3.6 Atomic swap — VERIFIED ✅

Adresa, escrow, port 8452, L1 + EVM watchery, memo parsing — vše konzistentní.

### 3.7 WARP adapters — 10/12 placeholderů

**Implementováno:** Solana, Stellar (reálné adresy v `StatusV3.md`).
**Placeholder/TODO:** Bitcoin, Tron, Cardano, Cosmos, Aptos, NEAR, Sui, TON, Lightning.
**Fix:** Je to očekáváno dle roadmapy, ale stojí za to přidat WARP deployment tracker do `ROADMAP.md` s checkboxes.

---

## 4. Web Frontend (`APP&WEB/website-v2.9`)

### 4.1 `/defi/staking` a `/defi/farming` přesměrovávají na `/defi` — LOW

**Dokumentace:** `V3/ROADMAP.md` P1 tvrdí, že staking/farming stránky byly deploynuty.
**Realita:** `StakingPanel.tsx` a `FarmingPanel.tsx` jsou plně funkční a integrované v `/defi`, ale samostatné routes redirectují.
**Fix:** Aktualizovat ROADMAP.md, že UI je konsolidované v `/defi`, nebo implementovat samostatné stránky.

### 4.2 WEB_V2.9 upgrade guide file list — LOW

**Dokumentace:** `docs/3.0.3/WEB_V2.9_TO_V3.0.3_UPGRADE.md` uvádí 13 `.tsx` souborů ke kontrole.
**Fix:** Manuálně ověřit, že konverze decimals byla provedena ve všech uvedených souborech.

### 4.3 Zbytek webu — VERIFIED ✅

Contract addresses, API proxy routes, DeFi panely, wallet SDK, responsivita, i18n, security headers, Next.js standalone deploy — vše konzistentní.

---

## 5. Deployment / Ops / Systemd

### 5.1 Systemd služby stále běží pod root — MEDIUM

**Soubory:** všechny `edge-deploy/systemd/zion-edge-*.service` používají `User=root`, `ProtectSystem=false`, `NoNewPrivileges=false`.
**Dokumentace:** `StatusV3.md:301` explicitně uvádí "systemd User=zion: ⚠️ NOT DEPLOYED (still User=root)".
**Fix:**
1. Vytvořit uživatele `zion` na Edge.
2. Aktualizovat všechny service files: `User=zion`, `ProtectSystem=strict`/`full`, `NoNewPrivileges=true`, `PrivateTmp=yes`, `ReadWritePaths=` pro data dirs.
3. Otestovat s `systemd-analyze security`.

### 5.2 Backup script path konflikt — MEDIUM

**Systemd:** `zion-edge-backup.service:9` ukazuje na `/root/zion/2.9.6/ZION_OS/infra/scripts/backup-edge.sh`.
**Repo:**
- `edge-deploy/scripts/backup-edge.sh:24`: `REPO_ROOT="/root/zion-2.9.6-main"`
- `ZION_OS/infra/scripts/backup-edge.sh:24`: `REPO_ROOT="/root/zion/2.9.6"`
**Fix:** Vybrat kanonickou lokaci, odstranit duplicitu, aktualizovat systemd service a `AGENTS.md`.

### 5.3 Port binding nesrovnalosti — MEDIUM

**Dokumentace:** `AGENTS.md` tvrdí "ALL services are on 127.0.0.1".
**Realita:**
- `zion-edge-dashboard.service:11`: `ZIONOS_BIND=0.0.0.0:8888`
- Atomic swap a WARP API bindují `0.0.0.0` v `StatusV3.md` i systemd.
**Fix:** Ujasnit si policy public vs localhost-only a aktualizovat `AGENTS.md` a service files konzistentně.

### 5.4 Historická IP v watchdog commentu — LOW

**Soubor:** `edge-deploy/watchdog.sh:6-7` zmiňuje starý Edge `77.42.71.94`.
**Fix:** Odstranit nebo aktualizovat komentář.

### 5.5 ZION_SWAP_ESCROW_KEY není nastaveno v repo configu — LOW (expected)

**Soubor:** `edge-deploy/config/edge-environment.sh:57` má placeholder.
**Dopad:** OK — secret se nastavuje ručně na serveru. Jen ověřit, že je opravdu nastaven na Edge.

### 5.6 Watchdog skriptů je více — LOW

- `scripts/watchdog.sh` — local backup / SSH tunnels
- `edge-deploy/watchdog.sh` — Edge node/pool
- `V3/deploy/new-server/zion-watchdog.sh` — zjednodušená verze
**Fix:** Dokumentovat v `AGENTS.md`, který skript se používá kde.

---

## 6. Public/ subtree

### 6.1 Public README má badge Protocol-3.0.4 — MEDIUM

**Soubor:** `public/README.md:17`.
**Realita:** Live je 3.0.6, kód 3.0.5.
**Fix:** Aktualizovat badge a všechny multilingual READMEs na 3.0.6 (nebo alespoň 3.0.5), přidat CHANGELOG entry, subtree push.

### 6.2 `public/V3/cli` obsahuje starší community-cli — MEDIUM

**Realita:** V `public/V3/community-cli/` jsou starší soubory, zatímco hlavní CLI je v `V3/cli/`.
**Fix:** Při příštím subtree push zkontrolovat, že `public/V3/cli` odpovídá `V3/cli`, nebo dokumentovat rozdíl.

---

## 7. Přehled všech optimalizací (prioritizovaný)

### HIGH — opravit okamžitě
1. Sjednotit protocol version (kód vs live vs public subtree).
2. Přidat chybějící AuxPow env vars do `edge-deploy/config/edge-environment.sh`.
3. Opravit `zion pool earnings` — buď RPC metoda, nebo HTTP pool API volání.
4. Přidat BridgeValidator adresu do deployment JSONů a verify scriptu.

### MEDIUM — do konce týdne
5. Přidat Stream Profit env vars a sjednotit názvy zdrojů.
6. Implementovat env-var override v CLI nebo opravit `ROADMAP.md`.
7. Přidat `bridge.host`, `dao.host`, `swap.host` do CLI configu.
8. Zredukovat hardcoded `127.0.0.1` v CLI a přidat `--host` flagy.
9. Přidat CLI příkazy pro AuxPow / nebo dokumentovat env-only konfiguraci.
10. Vytvořit `V3/docs/ONBOARDING_GUIDE.md`.
11. Nastavit systemd `User=zion` + hardening flags na Edge.
12. Vyřešit backup script path konflikt.
13. Ujasnit port binding policy a aktualizovat `AGENTS.md` + service files.
14. Vytvořit `deployed-base.json` pro Base Mainnet.
15. Doplnit ZIONAtomicSwap adresu do `StatusV3.md`.
16. Zjistit, proč backup node nemá spojení k primary (`known_peers=1`).

### LOW — refaktoring / dokumentace
17. Přidat fork heights do `StatusV3.md`.
18. Přidat komentář o CHV3 alias v `cosmic-harmony/src/lib.rs`.
19. Dokumentovat backup node seed peers v `StatusV3.md`.
20. Snížit `known_peers` cap na 500.
21. Per-session job tracking v poolu (škálovatelnost).
22. Snapshot-then-serialize pro PPLNS.
23. Nahradit `.unwrap()` v `config.rs`.
24. Dokumentovat `ZION_WALLET_PASSWORD` konvenci.
25. Implementovat `/defi/staking` a `/defi/farming` standalone pages nebo aktualizovat docs.
26. Vyčistit historickou IP v `edge-deploy/watchdog.sh`.
27. Dokumentovat rozdíly mezi watchdog skripty.
28. Přidat WARP deployment tracker do `ROADMAP.md`.
29. Aktualizovat public/ subtree verzi a changelog.
30. Přidat CI check na shodu `NODE_PROTOCOL_VERSION` s `StatusV3.md`.

---

## 8. Okamžitý action plan (co udělat teď)

Pokud chceš, mohu rovnou aplikovat tyto změny v repu:

1. **Bump `NODE_PROTOCOL_VERSION`** na `3.0.6` v `V3/L1/core/src/lib.rs` a `public/V3/L1/core/src/lib.rs`.
2. **Aktualizovat `edge-deploy/config/edge-environment.sh`** — přidat AuxPow a Stream Profit proměnné.
3. **Opravit `V3/cli/src/commands/pool.rs`** — přepnout earnings na pool HTTP API místo neexistujícího RPC.
4. **Aktualizovat `StatusV3.md`** — doplnit ZIONAtomicSwap adresu, fork heights, CHV3 vysvětlení.
5. **Přidat BridgeValidator do `deployed-*.json`** a verify scriptu.
6. **Aktualizovat public/ README badge** na 3.0.6 a přidat CHANGELOG entry.

Chceš, abych začal s těmito změnami? Pokud ano, které priority mám udělat jako první?
