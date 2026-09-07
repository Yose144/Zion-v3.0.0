# 🚀 ZION TerraNova — MAINNET PRE-FLIGHT CHECKLIST

> **⚠️ TOTO JE KRITICKÝ DOKUMENT — NEPUSTIT MAINNET BEZ SPLNĚNÍ VŠECH BODŮ ⚠️**
>
> Vytvořeno: 11. února 2026
> Poslední aktualizace: 13. února 2026
> Verze: v2.9.5 — **AKTUALIZOVÁNO — 26 nálezů opraveno ve 3 waves**

---

## 📋 Shrnutí

Před spuštěním mainnetu je třeba **zamknout, ověřit a zpevnit** všechny kryptografické adresy, fee struktury, genesis konfiguraci a provozní nastavení. Vše, co je na testnetu nastaveno "provizorně" nebo "přes env var", musí být na mainnetu **hardcoded nebo multisig-ověřené**.

### 🚨 KRITICKÝ NÁLEZ Z AUDITU — 14 P0 položek identifikováno!

Hloubkový audit (12. února 2026) odhalil **14 kritických (P0) nálezů**, **25+ středních (P1)** a **15+ nízkých (P2)** problémů, které musí být vyřešeny před mainnetem. Všechny jsou zahrnuty v tomto checklistu.

---

## 🔴 1. GENESIS & PREMINE WALLETY

### 1.1 Premine adresy (hardcoded v kódu)

| # | Co | Soubor | Aktuální stav | Mainnet akce |
|---|---|---|---|---|
| ⬜ | **OASIS + Golden Egg** wallety (5×) | `core/src/blockchain/premine.rs` | Testnet adresy `zion166e...`, `zion1l2h...` etc. | **VYMĚNIT za produkční cold-storage adresy** |
| ⬜ | **DAO Treasury** wallety (3×) | `core/src/blockchain/premine.rs` | Testnet adresy `zion176u...`, `zion1264...`, `zion1k8w...` | **Multisig DAO adresa, cold-storage** |
| ⬜ | **Infrastructure** wallety (3×) | `core/src/blockchain/premine.rs` | Testnet adresy `zion1q54...`, `zion1h4w...`, `zion1x63...` | **Produkční infra wallety** |
| ⬜ | **Humanitarian Fund** wallet (1×) | `core/src/blockchain/premine.rs` | Testnet adresa `zion1m4v...` | **Veřejná, transparentní adresa** |
| ⬜ | **Záloha private keys** | `PREMINE_WALLETS_BACKUP.json` | Existuje v repo (!) | **PŘESUNOUT DO OFFLINE VAULT, SMAZAT Z REPO** |

### 1.2 Premine částky — finální verifikace

| Kategorie | Plánované (ZION) | V kódu | Status |
|-----------|-----------------|--------|--------|
| OASIS + Winners Golden Egg/Xp | 8,250,000,000 | ✅ | ⬜ Finální audit |
| DAO Treasury | 4,000,000,000 | ✅ | ⬜ Finální audit |
| Infrastructure | 2,590,000,000 | ✅ | ⬜ Finální audit |
| Humanitarian | 1,440,000,000 | ✅ | ⬜ Finální audit |
| **CELKEM** | **16,780,000,000** | **✅** | ⬜ `cargo test` pass |

### 1.3 Genesis timestamp

| Parametr | Hodnota | Soubor |
|----------|---------|--------|
| `timestamp` | `1704067200` (Jan 1, 2024 00:00 UTC) | `config/mainnet.toml` |
| ⬜ | **Rozhodnout**: ponechat symbolické datum, nebo nastavit na skutečný launch? |

---

## � NEW — COSMIC HARMONY ALGORITHM — KRITICKÝ MISMATCH

> **Nalezeno auditem 12. února 2026 — NEJKRITIČTĚJŠÍ NÁLEZ**

| # | Problém | Soubor | Závažnost | Mainnet akce |
|---|---------|--------|-----------|-------------|
| ⬜ | **TŘI různé CH implementace!** Miner používá v3 (`cosmic-harmony/`), Core validátor používá v1 (`core/src/algorithms/`), Miner má ještě inline f64 fallback | `cosmic-harmony/src/lib.rs`, `core/src/algorithms/cosmic_harmony.rs`, `miner/src/native_algos.rs` | 🔴 P0 | **SJEDNOTIT na jedinou implementaci — jinak miner vytěží block který validátor odmítne!** |
| ⬜ | **Nonce 32-bit vs 64-bit mismatch** — CH v1 (core) používá 32-bit nonce, miner/pool posílají 64-bit → tiché truncation | `core/src/algorithms/cosmic_harmony.rs` vs `miner/src/stratum.rs` | 🔴 P0 | **Sjednotit na 64-bit nonce (u64) všude** |
| ⬜ | **Rotace algoritmů VYPNUTA** — `block.rs` má `// TODO: Restore rotation for mainnet` | `core/src/blockchain/block.rs` | 🔴 P0 | **Obnovit rotaci PŘED mainnetem nebo vědomě rozhodnout single-algo** |
| ✅ | **CH_V3_FORK_HEIGHT z env var** — má být hardcoded pro mainnet | `core/src/blockchain/block.rs` | 🔴 P0 | **✅ OPRAVENO** — `const CH_V3_FORK_HEIGHT: u64 = 0` (commit `f7ce224`) |

---

## �🔴 2. BURN & DAO SYSTÉMOVÉ ADRESY

| # | Adresa | Soubor | Aktuální | Mainnet akce |
|---|--------|--------|----------|--------------|
| ⬜ | **BURN_ADDRESS** | `core/src/blockchain/burn.rs` | `zion1burn0000000000000000000000000000000dead` | **Ověřit kryptografickou neplatnost** — nikdo nesmí mít privátní klíč |
| ⬜ | **DAO_ADDRESS** | `core/src/blockchain/burn.rs` | `zion1dao00000000000000000000000000000treasury` | **Nahradit skutečnou DAO multisig adresou** |
| ⬜ | Ověřit `is_burn_address()` v `state/mod.rs` | — | ✅ blokuje UTXO spend | ⬜ Penetrační test |

---

## 🔴 3. POOL — WALLETY & FEE NASTAVENÍ

### 3.1 Pool wallety

| # | Parametr | Soubor / Env | Aktuální (testnet) | Mainnet akce |
|---|----------|-------------|--------------------|----|
| ⬜ | **pool_wallet** | `pool/src/config.rs` → `ZION_POOL_WALLET` env | `ZION_TEST_WALLET` | **Produkční pool hot-wallet** |
| ⬜ | **humanitarian_wallet** | `pool/src/config.rs` → `ZION_HUMANITARIAN_WALLET` env | ⚠️ Helsinki: NENASTAVENO! | **Nastavit na finální humanitarian adresu** |
| ⬜ | **BTC wallet** (2miners payouts) | `pool/src/config.rs` → `DEFAULT_BTC_WALLET` | `bc1qvujra09wlsm35...` | **Ověřit ownership, nebo nový cold wallet** |
| ⬜ | **XMR wallet** (MoneroOcean) | `pool/src/config.rs` → `DEFAULT_XMR_WALLET` | `42m86RBWf4PeuRf8P5...` | **Ověřit ownership, nebo nový wallet** |

### 3.2 Fee struktura

| # | Parametr | Default | Env override | Mainnet rozhodnutí |
|---|----------|---------|-------------|-----|
| ⬜ | `pool_fee_percent` | `1.0%` | `ZION_POOL_FEE` | **Rozhodnout: 1% pool op / 0% (burn) / jiné?** |
| ⬜ | `humanitarian_tithe_percent` | `10.0%` | `ZION_HUMANITARIAN_TITHE_PERCENT` | **Potvrdit 10%** |
| ⬜ | Miner podíl | `89%` (dopočet) | — | Automaticky = 100 - pool - humanitarian |
| ⬜ | **1% pool_fee co s ním?** | Zůstává v pool wallet | Žádný burn kód | **ROZHODNOUT**: pool provoz / burn / DAO? |

### 3.3 Pool safety guards

| # | Kontrola | V kódu | Mainnet |
|---|----------|--------|---------|
| ⬜ | Fee ≤ 0 → reset na 1.0/10.0 | ✅ `config.rs` | ⬜ Zamknout env var přístup (read-only v produkci) |
| ⬜ | Warn pokud humanitarian_wallet prázdný | ✅ `processor.rs` | ⬜ **FAILOVAT** (ne jen warn) na mainnetu |

---

## 🔴 4. L1 FEE SYSTÉM — ZAMKNOUT

| # | Parametr | Soubor | Aktuální | Mainnet |
|---|----------|--------|----------|---------|
| ⬜ | `MIN_TX_FEE` | `core/src/blockchain/fee.rs` | `1,000` atomic (0.001 ZION) | **Rozhodnout finální minimum** |
| ⬜ | `MIN_FEE_RATE` | `core/src/blockchain/fee.rs` | `1` atomic/byte | **Potvrdit nebo zvýšit** |
| ⬜ | `MAX_TX_SIZE_BYTES` | `core/src/blockchain/fee.rs` | `100,000` (100 KB) | **Potvrdit** |
| ⬜ | `fee_policy` | `config/mainnet.toml` | `"burn"` | ✅ Fees se pálí, nemění se |
| ⬜ | Coinbase cap = block_reward ONLY | `validation.rs` L200 | ✅ Enforced | ⬜ Fuzz test |

---

## 🔴 5. CONSENSUS & EMISSION — ZAMKNOUT

| # | Parametr | Hodnota | Soubor | Mainnet |
|---|----------|---------|--------|---------|
| ⬜ | Block reward | `5,400,067,000` atomic (5,400.067 ZION) | `config/mainnet.toml` | **ZAMKNOUT** — nesmí se měnit |
| ⬜ | Block time target | `60s` | `config/mainnet.toml` | ⬜ Potvrdit |
| ⬜ | LWMA DAA window | `60` bloků | `config/mainnet.toml` | ⬜ Potvrdit |
| ⬜ | Max mining blocks | `23,652,000` (~45 let) | `config/mainnet.toml` | **ZAMKNOUT** |
| ⬜ | Total supply | `144,000,000,000` ZION | `premine.rs` + `mainnet.toml` | **ZAMKNOUT** — konsenzuální invariant |
| ⬜ | Halving | `false` (žádné halvování) | `config/mainnet.toml` | **ZAMKNOUT** |
| ⬜ | Coinbase maturity | `100` bloků | `config/mainnet.toml` | ⬜ Potvrdit |
| ⬜ | Min difficulty (mainnet) | `1000` | `config/mainnet.toml` | ⬜ **Kalibrovat** na základě testnet dat |

---

## 🚨 NEW — CONSENSUS BEZPEČNOSTNÍ PROBLÉMY (z auditu)

| # | Problém | Soubor | Závažnost | Mainnet akce |
|---|---------|--------|-----------|-------------|
| ✅ | **MAX_REORG_DEPTH = 50** — komentář v kódu: "reduce to 10 for MainNet" | `core/src/blockchain/chain.rs` | 🔴 P0 | **✅ Sníženo na 10** (commit `f7ce224`) |
| ✅ | **Terciární fork-choice pravidlo (90% work + 3 bloky)** | `core/src/blockchain/reorg.rs` | 🔴 P0 | **✅ ODSTRANĚNO** (commit `f7ce224`) |
| ✅ | **Fork-choice používá `>=`** | `core/src/blockchain/chain.rs` | 🟡 P1 | **✅ Změněno na `>`** (commit `f7ce224`) |
| ✅ | **`consensus::check()` vždy vrací `true`** — mrtvá funkce | `core/src/blockchain/consensus.rs` | 🟡 P1 | **✅ Smazáno** (commit `f7ce224`) |
| ⬜ | **MIN_DIFFICULTY = 1** (core fallback) — příliš nízko i pro fallback | `core/src/blockchain/consensus.rs` | 🟡 P1 | **Zvýšit na 1000 (konzistentní s config)** |
| ✅ | **Genesis block timestamp opraveno** — používá `NetworkType::genesis_timestamp()` | `core/src/blockchain/block.rs` | 🟡 P1 | **Wave 4** |
| ⬜ | **Rollback nevrací TX do mempoolu** — transakce ztraceny po reorgu | `core/src/blockchain/reorg.rs` | 🟡 P1 | **Implementovat TX recycling** |
| ⬜ | **`add_block_fast()` a `add_block_unchecked()` jsou `pub`** | `core/src/blockchain/chain.rs` | 🟡 P2 | **Omezit viditelnost na `pub(crate)`** |

---

## 🔴 6. SÍŤOVÁ INFRASTRUKTURA

### 6.1 Seed nody

| # | Seed | Stav | Mainnet |
|---|------|------|---------|
| ⬜ | `seed1.zionterranova.com:8333` | DNS neexistuje | **Zaregistrovat DNS, nasadit node** |
| ⬜ | `seed2.zionterranova.com:8333` | DNS neexistuje | **Zaregistrovat DNS, nasadit node** |
| ⬜ | `seed3.zionterranova.com:8333` | DNS neexistuje | **Zaregistrovat DNS, nasadit node** |
| ⬜ | Minimálně 3 seed nody na 3 různých ISP/regionech | — | **Povinné** |

### 6.2 Porty (mainnet vs testnet)

| Služba | Testnet | Mainnet | Rozlišení |
|--------|---------|---------|-----------|
| P2P | `8334` | `8333` | ⬜ Ověřit firewall pravidla |
| RPC | `8444` | `8443` | ⬜ Rate limiting + auth |
| Stratum | `3333` | `3333` | ⬜ TLS? |
| Pool API | `8080` | `8080` | ⬜ Exposovat přes nginx s rate limit |

### 6.3 Servery

| Server | IP | Role | Mainnet akce |
|--------|-----|------|-------------|
| ⬜ | Helsinki `77.42.31.72` | Core + Pool + Miner + Web | **Oddělit role** na min. 2 servery |
| ⬜ | SeedDE `46.225.126.243` | Core + Pool + Miner | ⬜ Ověřit redundanci |
| ⬜ | Usa1 `5.78.178.227` | Seed | ⬜ Ověřit regionální latenci |
| ⬜ | Usa2 `178.156.240.160` | Seed | ⬜ Ověřit regionální latenci |
| ⬜ | Asia3 `5.223.43.93` | Seed | ⬜ Ověřit APAC konektivitu |

---

## 🚨 NEW — P2P & SÍŤOVÁ BEZPEČNOST (z auditu)

| # | Problém | Soubor | Závažnost | Mainnet akce |
|---|---------|--------|-----------|-------------|
| ⬜ | **DNS seed validace není dokončena** — aktivních 5 IP seedů je již nasazeno | `L1/core/src/p2p/seeds.rs` | 🟡 P1 | **Dokončit seed1-3 DNS + monitorovaný failover** |
| ✅ | **process_block nemá mutex** — race condition | `core/src/state/mod.rs` | 🔴 P0 | **✅ Přidán `block_processing_lock: Mutex<()>`** (commit `f7ce224`) |
| ✅ | **save_block + apply_block_utxos NEJSOU atomické** | `core/src/state/mod.rs` | 🔴 P0 | **✅ Single LMDB write transakce** (commit `f7ce224`) |
| ✅ | **Legacy rollback může deadlocknout** | `core/src/storage/lmdb.rs` | 🔴 P0 | **✅ Refaktorováno — single write txn** (commit `5d0e2b8`) |
| ✅ | **Žádné oddělení inbound/outbound slotů** — eclipse attack vektor | `core/src/p2p/peers.rs` | 🟡 P1 | **Wave 5: PeerDirection enum, 8 outbound slotů reservováno** |
| ⬜ | **Zprávy bez autentizace** — plain JSON/TCP, žádný HMAC/MAC | `core/src/p2p/messages.rs` | 🟡 P1 | **Přidat message MAC po handshake** |
| ✅ | **Handshake přijme prázdný network magic** | `core/src/p2p/security.rs` | 🟡 P1 | **✅ Odmítnuto** (Wave 3) |
| ✅ | **Ban duration = 120s** (testnet hodnota) | `core/src/p2p/security.rs` | 🟡 P1 | **✅ Eskalace 300/1800/7200s** (commit `5d0e2b8`) |
| ✅ | **Self-connection detekce přidána** (nonce v Handshake + HandshakeAck) | `core/src/p2p/mod.rs` | 🟡 P1 | **Wave 4** |
| ✅ | **Heartbeat reconnect bez exponenciálního backoff** | `core/src/p2p/heartbeat.rs` | 🟡 P2 | **✅ Exponential backoff** (Wave 3) |

---

## 🚨 NEW — STORAGE & MEMPOOL (z auditu)

| # | Problém | Soubor | Závažnost | Mainnet akce |
|---|---------|--------|-----------|-------------|
| ✅ | **LMDB map_size = 10 GB fixní** — na mainnetu dojde místo | `core/src/storage/lmdb.rs` | 🟡 P1 | **✅ Konfigurovatelné přes ZION_LMDB_MAP_SIZE_GB** (Wave 3) |
| ✅ | **Balance cache se neinvaliduje po apply_block** | `core/src/storage/lmdb.rs` | 🟡 P1 | **✅ Auto-invalidace** (commit `5d0e2b8`) |
| ⬜ | **Full UTXO scan při cache miss** — O(n), pomalé na mainnetu | `core/src/storage/lmdb.rs` | 🟡 P1 | **Přidat address→UTXO index** |
| ✅ | **storage/index.rs je prázdný stub** | `core/src/storage/index.rs` | 🟡 P2 | **✅ Smazáno** (Wave 3) |
| ✅ | **Mempool jen count-based (10,000 TX)** — žádný byte-level cap | `core/src/mempool/pool.rs` | 🟡 P1 | **✅ MAX_MEMPOOL_BYTES = 20 MB** (commit `5d0e2b8`) |
| ✅ | **Legacy `add_transaction()` obchází validaci** | `core/src/mempool/pool.rs` | 🟡 P1 | **✅ #[deprecated]** (commit `5d0e2b8`) |
| ✅ | **Wallet: žádný `zeroize` na privátních klíčích** | `core/src/wallet/mod.rs` | 🟡 P1 | **✅ zeroize crate přidán** (commit `5d0e2b8`) |
| ⬜ | **Wallet: largest-first UTXO selekce** → hromadění prachu | `core/src/wallet/mod.rs` | 🟡 P2 | Implementovat branch-and-bound |

---

## 🔴 7. BEZPEČNOSTNÍ HARDENING

| # | Oblast | Aktuální stav | Mainnet akce |
|---|--------|---------------|-------------|
| ⬜ | **Private keys v repo** | `PREMINE_WALLETS_BACKUP.json` + `PREMINE_ADDRESSES_PUBLIC.txt` | **OKAMŽITĚ smazat z git history** (`git filter-branch` nebo BFG) |
| ⬜ | **SSH klíč** | `~/.ssh/zion_hetzner_key` pro root | ⬜ Zakázat root SSH, vytvořit dedikovaný user |
| ⬜ | **Docker kontejnery** | `--network zion-net` | ⬜ Izolovat RPC (interní only), Stratum (public) |
| ⬜ | **RPC autentizace** | Žádná | **Přidat API key / JWT pro write operace** |
| ⬜ | **TLS/SSL** | Žádné na P2P/Stratum | ⬜ Minimálně Stratum přes TLS pro minery |
| ⬜ | **Rate limiting** | Žádné na RPC/API | **Nginx reverse proxy + rate limit** |
| ⬜ | **DDoS ochrana** | Žádná | ⬜ Cloudflare / fail2ban / iptables |
| ⬜ | **Backup strategie** | Žádná | ⬜ Automatický backup blockchainu + konfigurace |

---

## 🚨 NEW — BEZPEČNOSTNÍ NÁLEZY Z AUDITU — SECRETS & CREDENTIALS

> **⚠️ OKAMŽITÁ AKCE VYŽADOVÁNA ⚠️**

| # | Problém | Kde | Závažnost | Akce |
|---|---------|-----|-----------|------|
| ⬜ | **12 kompletních premine privátních klíčů V REPO** — 16.78B ZION | `PREMINE_WALLETS_BACKUP.json` | 🔴 P0 IHNED | **BFG Repo-Cleaner → smazat z git historie. Vygenerovat NOVÉ klíče. Považovat stávající za kompromitované!** |
| ✅ | **Hardcoded SMTP heslo v plaintextu** `<REDACTED>` | `2.9-History/debug_email_template.py`, deploy skripty | 🔴 P0 IHNED | **Wave 6: Přesunuto do env var `SMTP_PASSWORD`** |
| ✅ | **Redis hesla v Docker Compose** — default fallbacky odstraněny | `docker-compose.*.yml` | 🔴 P0 | **Wave 6: Vyžaduje `.env` soubor (viz `docker/.env.example`)** |
| ✅ | **Grafana admin heslo** — default fallback odstraněn | `docker/monitoring/` | 🔴 P0 | **Wave 6: Vyžaduje `GRAFANA_ADMIN_PASSWORD` env var** |
| ⬜ | **Wallet heslo** `ZionBootstrap2025TempDev` | docker-compose | 🔴 P0 | **Přesunout do Docker secrets** |
| ⬜ | **Hardcoded BTC wallet** `bc1qvujra09wlsm35...` v 10+ souborech | `pool/src/config.rs`, `miner/`, docs | 🟡 P1 | **Přesunout do env var, ověřit ownership** |
| ⬜ | **Hardcoded XMR wallet** `42m86RBWf4PeuRf8P5...` | `pool/src/config.rs` | 🟡 P1 | **Přesunout do env var** |
| ⬜ | **SSH veřejný klíč + IP** commitnutý | archiv | 🟡 P2 | Ověřit zda starý server `91.98.122.165` je deaktivován |
| ✅ | **Stripe mock klíče jako fallback** — failuje na mock místo erroru | website API | 🟡 P2 | **Wave 5: os.environ[] bez fallbacku, mock key check** |

---

## 🚨 NEW — POOL BEZPEČNOSTNÍ PROBLÉMY (z auditu)

| # | Problém | Soubor | Závažnost | Mainnet akce |
|---|---------|--------|-----------|-------------|
| ❌ | **`unsafe` mutace Arc pointeru** — ~~undefined behavior~~ FALSE POSITIVE | `pool/src/profit_switcher.rs` | ~~🔴 P0~~ | žádný `unsafe` blok v souboru |
| ✅ | **Žádný rate limiting na stratum** — DDoS vektor | `pool/src/stratum/mod.rs` | 🔴 P0 | **✅ Per-IP limit (max 10/IP)** (commit `5d0e2b8`) |
| ✅ | **Hardcoded `ZION_TEST_WALLET` jako default** — žádný mainnet guard | `pool/src/config.rs` | 🔴 P0 | **✅ panic! na mainnetu** (commit `f7ce224`) |
| ✅ | **Share cache se nikdy nepruní** → memory leak | `pool/src/shares/` | 🟡 P1 | **✅ Periodic pruning (60s, max age 600s)** (Wave 3) |
| ⬜ | **Žádná Bech32 validace miner adres** | `pool/src/session.rs` | 🟡 P1 | **Validovat miner address při subscribe** |
| ✅ | **Humanitarian tithe retry přidáno** — 3 pokusy s exponential backoff | `pool/src/shares/processor.rs` | 🟡 P1 | **Wave 4** |
| ⬜ | **Dva payout systémy (Redis + PostgreSQL)** → riziko double-pay | pool crate | 🟡 P1 | **Sjednotit na jeden systém** |
| ⬜ | **xmrig stahován bez SHA256 verifikace** | pool scripts | 🟡 P2 | Přidat checksum ověření |

---

## 🚨 NEW — MINER PROBLÉMY (z auditu)

| # | Problém | Soubor | Závažnost | Mainnet akce |
|---|---------|--------|-----------|-------------|
| ⬜ | **9/12 native-libs chybí Linux .so** — Ethash, KawPow, Autolykos atd. | `native-libs/` | 🟡 P1 | **Cross-compile nebo fallback soft-implementation** |
| ✅ | **Extranonce1/2 ignorován v stratum submit** | `miner/src/stratum.rs` | 🟡 P1 | **Wave 5: Per-session extranonce1 (4-byte hex z session_id hash)** |
| ⬜ | **Testnet RandomX key hardcoded** | `miner/src/` | 🟡 P2 | **Odebírat z bloku/config** |
| ✅ | **GPU algo stuby vrací Keccak fallback** — dokumentováno | `miner/src/native_algos.rs` | 🟡 P2 | **Wave 6: Module-level doc comment vysvětlující chování** |

---

## 🚨 NEW — DOCKER & DEPLOYMENT (z auditu)

| # | Problém | Soubor | Závažnost | Mainnet akce |
|---|---------|--------|-----------|-------------|
| ✅ | **Kontejnery běží jako non-root `zion` user** | `docker/Dockerfile.*` | 🔴 P1 | **Wave 7: `groupadd zion && useradd zion && USER zion`** |
| ⬜ | **Alertmanager zakomentovaný** — alerty se nikam neposílají | `docker/monitoring/` | 🔴 P1 | **Nastavit Alertmanager (Slack/Telegram)** |
| ⬜ | **Prometheus scrapuje přes HTTP na veřejných IP** — systémové metriky public! | monitoring config | 🔴 P1 | **Firewall: porty 9100, 9121, 8080/metrics pouze z Prometheus** |
| ✅ | **Node Exporter s `pid: host` + celý host FS** | docker-compose monitoring | 🟡 P1 | **Wave 6: Odebráno `pid: host`, přidán `read_only` + `security_opt`** |
| ✅ | **Docker resource limits** (mem_limit, cpus) přidány | docker-compose.*.yml | 🟡 P1 | **Wave 6: `deploy.resources.limits` na mainnet compose** |
| ✅ | **`read_only: true`** přidáno na kontejnery | docker-compose.*.yml | 🟡 P2 | **Wave 6** |
| ✅ | **`security_opt: no-new-privileges`** přidáno | docker-compose.*.yml | 🟡 P2 | **Wave 6** |
| ⬜ | **Docker image tagy `:latest`** — žádné verzování | docker-compose.*.yml | 🟡 P2 | **Verzovat image tagy (`:v2.9.5`)** |
| ✅ | **Deploy skripty: `StrictHostKeyChecking=accept-new`** | `scripts/deploy_*.sh` | 🟡 P1 | **Wave 6: Změněno z `=no` na `=accept-new`** |
| ✅ | **Deploy skripty: SSH user konfiguratelný** `DEPLOY_USER` | `scripts/deploy_*.sh` | 🟡 P1 | **Wave 7: `DEPLOY_USER` env var (default root, přepínout na `zion`)** |
| ✅ | **Docker Node.js verze sjednocena** na node:22-alpine (LTS) | Dockerfile, Dockerfile.production | 🟡 P2 | **Wave 7** |

---

## 🚨 NEW — WEBSITE BEZPEČNOST (z auditu)

| # | Problém | Soubor | Závažnost | Mainnet akce |
|---|---------|--------|-----------|-------------|
| ✅ | **CSP security hlavičky přidány** (CSP, X-Frame-Options, HSTS, nosniff) | `next.config.ts` | 🟡 P1 | **Wave 4** |
| ✅ | **CORS: `Access-Control-Allow-Origin`** omezeno na doménu | API routes | 🟡 P1 | **Wave 6: `process.env.CORS_ORIGIN \|\| 'https://zionterranova.com'`** |
| ✅ | **Admin panel bez autentizace** pokud `ADMIN_PASSWORD` env chybí — zcela otevřený | middleware.ts | 🔴 P1 | **Wave 5: 403 Forbidden pokud `ADMIN_PASSWORD` chybí** |
| ✅ | **API rate limiting** — 120 req/min per IP | middleware.ts | 🟡 P1 | **Wave 7: In-memory IP rate limiter, 429 Too Many Requests** |
| ✅ | **Guardians API = 501 Not Implemented** (místo fake dat) | website API | 🟡 P2 | **Wave 7: Vrací 501 s vysvětlením** |
| ⬜ | **ŽÁDNÉ frontend testy** — 0% pokrytí, žádný test framework | website | 🟡 P2 | Přidat Vitest + @testing-library/react |
| ⬜ | **Žádné E2E testy** — chybí Playwright/Cypress | website | 🟡 P2 | Přidat E2E testy pro kritické cesty |

---

## 🚨 NEW — KONFIGURACE — NESOULAD (z auditu)

| # | Problém | Soubory | Závažnost | Mainnet akce |
|---|---------|---------|-----------|-------------|
| ✅ | **Devnet premine alokace NESOUHLASÍ** — infra: 2.59B vs 2.50B, humanitarian: 1.44B vs 1.53B | `config/devnet.toml` vs `mainnet.toml` | 🟡 P1 | **Wave 5: Sjedn. infra=2590B, humanitarian=1440B, timestamp=1704067200** |
| ✅ | **RPC bind `127.0.0.1:8443`** — pouze localhost, nginx pro remote access | `config/mainnet.toml` | 🟡 P1 | **Wave 4** |
| ⬜ | **Žádný CI/CD pro website** — deploy je manuální SSH+Docker | — | 🟡 P2 | Přidat GitHub Actions workflow |
| ✅ | **Dependabot/Renovate** nastaven | `.github/dependabot.yml` | 🟡 P2 | **Wave 6: Cargo + Actions + npm (weekly)** |
| ⬜ | **CI nestaví Windows** — jen Linux + macOS | `.github/workflows/release.yml` | 🟡 P3 | Přidat Windows target |

---

## 🚨 NEW — MONITORING GAPS (z auditu)

| # | Problém | Závažnost | Mainnet akce |
|---|---------|-----------|-------------|
| ⬜ | **Alertmanager NENÍ nastaven** — alerty existují ale nikam se neposílají | 🔴 P1 | **Nastavit Slack/Telegram webhook** |
| ⬜ | **Žádné miner metriky** — žádný scrape target pro miner kontejnery | 🟡 P1 | Přidat miner /metrics endpoint |
| ⬜ | **Žádná log agregace** — jen Docker stdout, žádný Loki/ELK | 🟡 P2 | Zvážit Loki |
| ⬜ | **Žádný external uptime monitoring** — UptimeRobot/Pingdom | 🟡 P2 | Nastavit external monitoring |
| ⬜ | **Žádné TLS cert monitoring** — cert expiry se nesleduje | 🟡 P2 | Přidat cert-manager alerting |
| ✅ | **Backup skript** pro Redis + LMDB data | `scripts/backup-data.sh` | 🔴 P1 | **Wave 7: BGSAVE + LMDB copy, 7 daily + 4 weekly retention** |

---

## 🔴 8. KÓDOVÁ KVALITA — PŘED FREEZE

| # | Kontrola | Stav | Mainnet |
|---|----------|------|---------|
| ⬜ | `cargo test --release` — všechny testy pass | ✅ (testnet) | ⬜ Finální run na mainnet konfiguraci |
| ⬜ | `cargo clippy -- -D warnings` — žádné warningy | ⬜ | ⬜ Povinné |
| ⬜ | `cargo audit` — žádné kritické CVE | ✅ CI existuje | ⬜ Ověřit výstup |
| ⬜ | Security audit (minimálně interní) | `audit_v2.9.1/` existuje | ⬜ Aktualizovat pro v2.9.5 |
| ⬜ | Fuzz testing (block parsing, TX validation) | ⬜ | ⬜ Minimálně 72h fuzz run |
| ⬜ | Stress test — 100 minerů | ⬜ | ⬜ Viz ROADMAP Fáze 1.12 |
| ⬜ | 72h stability test | ⬜ | ⬜ Viz ROADMAP Fáze 1.10 |
| ⬜ | Network partition test | ⬜ | ⬜ Viz ROADMAP Fáze 1.11 |
| ⬜ | Reorg test (≤ 10 bloků) | ⬜ | ⬜ Ověřit `max_reorg_depth = 10` |
| ⬜ | **`dev-tools` feature NESMÍ být enabled v prod** | ⬜ | ⬜ CI check: `--no-default-features` |
| ⬜ | **Audit všech `unsafe` bloků** (15+ v miner FFI) | ⬜ | ⬜ Obalit safe wrappery |
| ⬜ | **Spec freeze guard testy** (`tests/spec_freeze.rs`) | ✅ existuje | ⬜ Ověřit coverage |

---

## 🔴 9. GENESIS BLOCK — FINÁLNÍ SESTAVENÍ

Toto se provede **jednou** a pak se genesis block **zamkne navždy**.

| # | Krok | Stav |
|---|------|------|
| ⬜ | Vygenerovat finální premine adresy (cold-storage) | |
| ⬜ | Zálohovat private keys offline (min. 2 geografické lokace) | |
| ⬜ | Aktualizovat `premine.rs` s finálními adresami | |
| ⬜ | Aktualizovat `burn.rs` — finální `DAO_ADDRESS` (multisig) | |
| ⬜ | Run `cargo test` — ověřit PREMINE_TOTAL = 16,780,000,000 ZION | |
| ⬜ | Sestavit genesis block na čistém stroji | |
| ⬜ | Hash genesis bloku → zapsat do dokumentace | |
| ⬜ | Distribute genesis block na všechny seed nody | |
| ⬜ | **CODE FREEZE** — tag `v2.9.5-mainnet-genesis` | |

---

## 🔴 10. POOL MAINNET KONFIGURACE

```bash
# Docker env vars — VŠECHNY musí být nastaveny před spuštěním pool kontejneru

# POVINNÉ
ZION_POOL_WALLET=zion1XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX   # Produkční pool hot-wallet
ZION_HUMANITARIAN_WALLET=zion1XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX  # Humanitární fond
ZION_REDIS_URL=redis://zion-redis:6379/
ZION_CORE_RPC=http://zion-core:8443/jsonrpc

# POTVRZENÍ FEE SPLIT
ZION_POOL_FEE=1.0                    # 1% — prozatím pool provoz
ZION_HUMANITARIAN_TITHE_PERCENT=10.0 # 10% — humanitární desátek

# REVENUE (BTC/XMR wallety pro external mining)
ZION_REVENUE_CONFIG=/config/ch3_revenue_settings.json

# BEZPEČNOSTNÍ
ZION_POOL_LISTEN=0.0.0.0:3333
ZION_POOL_API=0.0.0.0:8080           # POUZE interní síť, ne public!
```

---

## 🟡 11. NICE-TO-HAVE (ne blokující, ale doporučené)

| # | Položka | Priorita |
|---|---------|----------|
| ⬜ | Explorer backend (indexer) | Vysoká |
| ⬜ | Block explorer UI na webu | Vysoká |
| ⬜ | Automatický monitoring (Grafana alerting) | Střední |
| ⬜ | Veřejné API docs (OpenAPI/Swagger) | Střední |
| ⬜ | Mining pool dashboard (veřejný) | Střední |
| ⬜ | Mobile wallet (iOS/Android) | Nízká (post-launch) |
| ⬜ | Desktop wallet (Electron) | Nízká (post-launch) |

---

## 📊 SOUHRNNÉ SKÓRE Z AUDITU (12. února 2026)

| Oblast | Skóre | Status |
|--------|-------|--------|
| **Core Rust kód** | 8/10 | ✅ Solidní testy, LWMA/Ed25519 správně |
| **Consensus bezpečnost** | 5/10 | ⚠️ Reorg pravidla, mutex, atomicita |
| **Pool** | 6/10 | ⚠️ Unsafe, rate limit, dual payout |
| **P2P networking** | 4/10 | ⚠️ 2 seedy, žádná auth, eclipse riziko |
| **Storage** | 6/10 | ⚠️ Neatomické operace, cache |
| **Miner** | 7/10 | ⚠️ CH mismatch je kritický! |
| **Website bezpečnost** | 4/10 | ⚠️ Žádné CSP, rate limit, testy |
| **Secrets management** | 2/10 | 🚨 Private keys v repo! |
| **Docker/Deploy** | 5/10 | ⚠️ Root, default hesla |
| **CI/CD** | 6/10 | ✅ Rust CI OK, ❌ web CI chybí |
| **Monitoring** | 5/10 | ⚠️ Alertmanager nenastavený |
| **Celkové hodnocení** | **5/10** | **Není připraveno na mainnet — potřeba 40+ oprav** |

---

## 🔒 LAUNCH SEQUENCE (den L)

```
T-14 dní ⬜ Opravit všechny P0 nálezy (14 položek — viz audit)
T-10 dní ⬜ Opravit P1 nálezy (25+ položek)
T-7 dní  ⬜ Code freeze → tag v2.9.5-mainnet-rc1
T-5 dní  ⬜ Finální security audit pass
T-4 dny  ⬜ BFG: smazat PREMINE_WALLETS_BACKUP.json z celé git historie
T-3 dny  ⬜ Genesis block sestavení + distribuce na seed nody
T-2 dny  ⬜ Dry-run: start seed nodů, ověřit synchronizaci
T-1 den  ⬜ Pool deployment s finální konfigurací
T-12h    ⬜ Monitoring stack (Prometheus + Grafana + Alertmanager) online
T-6h     ⬜ Announcement: genesis block hash, seed node IPs, miner download
T-0      🟢 MAINNET LAUNCH — seed nody startují mining
T+1h     ⬜ Ověřit: bloky jdou, pool přijímá shares, humanitarian tithe odesílá
T+24h    ⬜ Stability check: žádné reorgy > 2 bloky
T+72h    ⬜ ✅ Mainnet stabilní — otevřít pro komunitu
```

---

## 📍 SOUBORY K EDITACI PŘED MAINETEM

| Soubor | Důvod | Kritičnost |
|--------|-------|------------|
| `core/src/blockchain/premine.rs` | Finální premine adresy | 🔴 KRITICKÉ |
| `core/src/blockchain/burn.rs` | Finální DAO_ADDRESS | 🔴 KRITICKÉ |
| `core/src/algorithms/cosmic_harmony.rs` | **Sjednotit s `cosmic-harmony/src/lib.rs`** | 🔴 KRITICKÉ |
| `core/src/blockchain/block.rs` | Obnovit algo rotaci, hardcode fork height | 🔴 KRITICKÉ |
| `core/src/blockchain/chain.rs` | MAX_REORG_DEPTH: 50→10, fork-choice `>` | 🔴 KRITICKÉ |
| `core/src/blockchain/reorg.rs` | Odstranit terciární fork-choice pravidlo | 🔴 KRITICKÉ |
| `core/src/state/mod.rs` | Mutex na process_block, atomické UTXO | 🔴 KRITICKÉ |
| `core/src/p2p/seeds.rs` | Přidat DNS seed nody | 🔴 KRITICKÉ |
| `pool/src/config.rs` | Pool wallet, fee defaults, mainnet guard | 🔴 KRITICKÉ |
| `pool/src/profit_switcher.rs` | Opravit unsafe Arc mutaci | 🔴 KRITICKÉ |
| `config/mainnet.toml` | Genesis timestamp, seed nodes, ports | 🔴 KRITICKÉ |
| `PREMINE_WALLETS_BACKUP.json` | **SMAZAT Z REPO + GIT HISTORIE** | 🔴 BEZPEČNOST |
| `docker/Dockerfile.*` | Non-root user, healthchecks | 🟡 HARDENING |
| `docker-compose.*.yml` | Silná hesla, resource limits, security_opt | 🟡 HARDENING |
| `pool/src/shares/processor.rs` | Retry pro humanitarian tithe | 🟡 Spolehlivost |
| `pool/src/buyback.rs` | BTC/XMR wallet adresy z env var | 🟡 Ověřit |
| `core/src/wallet/mod.rs` | Přidat zeroize na privátní klíče | 🟡 Bezpečnost |
| `core/src/mempool/pool.rs` | Byte-level cap, odstranit legacy add | 🟡 Robustnost |
| `core/src/storage/lmdb.rs` | Auto-resize, cache invalidace | 🟡 Škálovatelnost |
| `website-v2.9/next.config.ts` | CSP hlavičky, security headers | 🟡 Web bezpečnost |
| `scripts/deploy_*.sh` | StrictHostKeyChecking, non-root SSH | 🟡 Deploy bezpečnost |

---

> **✍️ Podpis**: Tento checklist je závazný. Žádný bod s 🔴 nesmí být přeskočen.
> Každý splněný bod označit ✅ s datem a iniciálami.
>
> **Odpovědnost**: Yeshua E. (YE) — Lead Developer & DAO Architect
