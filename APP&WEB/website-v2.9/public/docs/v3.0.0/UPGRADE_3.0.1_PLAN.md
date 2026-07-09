# ZION V3 — Upgrade Plan 3.0.1

> **Datum:** 2026-06-03
> **Cíl:** Zavřít známé TODO/placeholder gapy, aktivovat dead code, a dodat CI/CD před veřejným mainnet launch (31.12.2026).
> **Zakázáno:** Nepřidávat nové L4/L5/L6 funkce dokud L1/L2/L3 nejsou 100% production-ready.

---

## 1. Audit: Dokumentace vs Kód (zjištěno 2026-06-03)

### 1.1 Co funguje a matchuje s docs ✅

| Oblast | Stav v docs | Stav v kódu | Verdikt |
|--------|-------------|-------------|---------|
| L1 consensus (Ekam Deeksha v2) | ✅ Hotovo | ✅ 95+ testů | Match |
| L1 core (node, P2P, RPC, mempool) | ✅ Hotovo | ✅ 500 testů | Match |
| L1 pool (stratum, PPLNS, payouts) | ✅ Hotovo | ✅ 91 testů | Match |
| L1 miner (CPU/GPU, OpenCL/CUDA) | ✅ Hotovo | ✅ 59 testů | Match |
| Fee split 89/5/5/1 z genesis | ✅ Hotovo | ✅ Kód + testy | Match |
| CLI (`zion` binary) | ✅ Hotovo | ✅ 20+ subcommandů | Match |
| Hiran v2.2 CLI integrace | ✅ Hotovo | ✅ `V3/cli/src/commands/hiran.rs` (352 řádků) | Match |
| Monitoring (Prometheus + Grafana) | ✅ Hotovo | ✅ 3 dashboardy | Match |
| Desktop dashboard (Tauri v2) | ✅ Hotovo | ✅ `APP&WEB/desktop-dashboard/` | Match |
| Core+Edge topologie | ✅ Hotovo | ✅ Docker compose + systemd | Match |
| Alert rules (Prometheus) | ✅ Hotovo | ✅ 10+ pravidel | Match |
| L5/L6 daemon crates | ✅ Hotovo | ✅ `zion-free-world`, `zion-issobella` | Match |

### 1.2 Co je v kódu jako placeholder / nesedí s docs 🔧

| # | Oblast | Problém | Soubor | Priorita |
|---|--------|---------|--------|----------|
| G1 | **Bridge Base mainnet** | `wzion_address` + `bridge_contract_address` = `0x0000...` + `enabled: false` | `V3/L2/bridge/tests/mainnet_readiness.rs:195-198` | P0 |
| G2 | **NCL ONNX backend** | `OnnxBackend::new()` vrací `available: false` — dead code | `V3/L3/ncl/src/backend.rs:28` | P0 |
| G3 | **OASIS config** | `OasisConfig::load()` ignoruje path, vrací default | `V3/L4/oasis/src/config.rs:110` | P1 |
| G4 | **WARP contract addresses** | Všechny adaptery (EVM, Solana, Bitcoin, Cardano, Tron) mají dummy adresy s `TODO` | `V3/L3/warp/src/adapter/*.rs` | P1 |
| G5 | **Alertmanager notifikace** | Discord/Slack/Email šablony zakomentované — žádný real channel | `V3/docker/alertmanager/alertmanager.yml` | P1 |
| G6 | **private network ACL** | Šablona existuje, ale není aplikována na uzly | `scripts/network-acl.hujson` | P2 |
| G7 | **CI/CD** | Žádný GitHub Actions workflow pro V3 workspace | `.github/workflows/` — chybí | P1 |
| G8 | **P2P DNS seeds** | Peer discovery jen přes hardcoded `ZION_SEED_PEERS` | `V3/L1/core/src/p2p*.rs` | P2 |
| G9 | **GPU auto-tuning** | Uživatel musí ručně nastavit backend a work_size | `V3/L1/miner/src/main.rs` | P2 |

### 1.3 Phase 21–23 status (z `V3/ROADMAP.md`)

| Phase | Cíl | Požadavek | Skutečnost | Stav |
|-------|-----|-----------|------------|------|
| 21 | Miner Production Hardening | 53+ testů | 59 testů | ✅ Complete |
| 22 | Pool Production Hardening | 63+ testů | 91 testů | ✅ Complete |
| 23 | Monitoring & Observability | 7 alert rules, 5 dashboards | 10+ rules, 3 dashboards | ✅ Complete (zbývá aktivace notifikací) |

---

## 2. Scope 3.0.1

### Princip
> **"Ne nové featury, ale zavřít existující díry."**

3.0.1 je *polish release* — všechny P0/P1 gapy z bodu 1.2 musí být zavřené nebo alespoň mitigované.

---

## 3. Konkrétní úkoly

### 3.1 P0 — Blockers (musí být hotovo)

#### T1: Bridge Base mainnet readiness
- **Problém:** Bridge testy používají dummy adresy. Mainnet chain je disabled.
- **Úkol:**
  1. Připravit Foundry deployment skripty pro `ZIONBridge` + `wZION` ERC-20
  2. Přidat CLI příkaz `zion bridge deploy --network base`
  3. Po deployi aktualizovat `mainnet_readiness.rs` a `bridge-mainnet.toml`
  4. Povolit `enabled: true` pro Base mainnet
- **Acceptance:** `cargo test --manifest-path V3/Cargo.toml -p zion-bridge --test mainnet_readiness` prochází s realnými adresami (nebo `#[ignore]` pro mainnet-only test).

#### T2: NCL ONNX backend activation
- **Problém:** `ort` crate není připojený, ONNX backend je no-op.
- **Úkol:**
  1. Přidat `ort = "1.16"` do `V3/Cargo.toml` workspace dependencies
  2. Implementovat `OnnxBackend::new()` s reálnou `ort::Environment` inicializací
  3. Přidat feature-gate `onnx` pro volitelnou kompilaci (ORT je heavy dependency)
  4. Přidat 3+ testy pro ONNX inference path
- **Acceptance:** `cargo test --manifest-path V3/Cargo.toml -p zion-ncl` prochází; `OnnxBackend::available()` vrací `true` když je runtime nalezen.

### 3.2 P1 — Critical polish

#### T3: OASIS TOML config loading
- **Problém:** `OasisConfig::load()` je stub.
- **Úkol:**
  1. Přidat `toml` crate do workspace deps
  2. Implementovat deserializaci z TOML souboru do `OasisConfig`
  3. Přidat `#[serde(default)]` pro fallback hodnoty
  4. Přidat test pro load z temp souboru
- **Acceptance:** `cargo test --manifest-path V3/Cargo.toml -p zion-oasis` prochází; `OasisConfig::load("test.toml")?` načte non-default hodnoty.

#### T4: WARP real contract addresses (Base mainnet)
- **Problém:** Všechny chain adaptery mají TODO dummy adresy.
- **Úkol:**
  1. Pro Base mainnet zadat reálnou `wZION` ERC-20 adresu po deployi (z T1)
  2. Pro ostatní chainy ponechat dummy, ale přidat `warn!` log při použití testnet/devnet adresy
  3. Dokumentovat v `V3/L3/warp/README.md` které adresy jsou real a které placeholder
- **Acceptance:** `cargo clippy --manifest-path V3/Cargo.toml -p zion-warp` čisté; žádné `TODO` bez komentáře v `adapter/evm.rs`.

#### T5: Alertmanager Discord activation + test
- **Problém:** Notifikační kanály jsou zakomentované.
- **Úkol:**
  1. Odkomentovat `discord_configs` v `alertmanager.yml`
  2. Přidat env-var substitution (`${DISCORD_WEBHOOK_URL}`) místo hardcoded URL
  3. Přidat `DISCORD_WEBHOOK_URL` do `.env.example`
  4. Přidat test script `scripts/test-alertmanager.sh` který pošle test alert
  5. Dokumentovat v `AGENTS.md` a `V3/docker/DOCKER.md`
- **Acceptance:** `docker compose -f V3/docker/docker-compose.yml --profile monitoring up -d` + `curl test alert` = zpráva v Discordu (pokud je webhook nastavený).

#### T6: CI/CD pipeline (GitHub Actions)
- **Problém:** Žádná automatická validace commitů.
- **Úkol:**
  1. Vytvořit `.github/workflows/v3-ci.yml`:
     - `cargo check --workspace`
     - `cargo test --workspace -- --test-threads=1`
     - `cargo clippy --workspace --all-targets`
     - `cargo fmt --all --check`
  2. Vytvořit `.github/workflows/v3-release.yml` pro build release binárek (node, pool, miner, cli)
  3. Cachovat `target/` a `~/.cargo` pro rychlost
- **Acceptance:** Push na `main` spustí CI; PR zobrazí check status.

### 3.3 P2 — Nice-to-have

#### T7: P2P DNS seed discovery
- **Úkol:** Přidat `dns_seeds: Vec<String>` do node config; periodicky resolve A záznamy jako fallback k hardcoded peers.

#### T8: GPU miner auto-detection & tuning
- **Úkol:** Na startup detekovat dostupné GPU platformy (OpenCL/CUDA/Metal) přes runtime probes; auto-vybrat nejlepší backend a `work_size` podle VRAM.

#### T9: private network ACL aplikace
- **Úkol:** Dokumentovat krok-za-krokem v `scripts/network-acl.hujson` header komentáři jak aplikovat ACL v network admin UI.

---

## 4. Version bump

| Soubor | Změna |
|--------|-------|
| `V3/Cargo.toml` | `version = "3.0.1"` |
| `V3/Cargo.toml` workspace deps | zkontrolovat patch updates (security) |
| `StatusV3.md` | Přidat sekci "Co je nového 2026-06-XX (3.0.1)" |
| `V3/ROADMAP.md` | Označit Phase 21–23 jako complete; odkázat na tento plán |

---

## 5. Test matrix

| Command | Před 3.0.1 | Po 3.0.1 |
|---------|-----------|----------|
| `cargo check --workspace` | ✅ | ✅ |
| `cargo test --workspace -- --test-threads=1` | ✅ | ✅ + nové |
| `cargo clippy --workspace --all-targets` | ✅ | ✅ (bez TODO warnings) |
| `cargo fmt --all --check` | ✅ | ✅ |
| `cargo audit --file V3/Cargo.lock` | ? | ✅ (0 vulnerabilities) |
| `docker compose --profile mainnet config` | ✅ | ✅ |
| `docker compose --profile monitoring config` | ✅ | ✅ |

---

## 6. Risks & mitigations

| Risk | Mitigace |
|------|----------|
| ORT crate je heavy a může zpomalit build | Feature-gate `onnx` — default off |
| Bridge contract deploy stojí real ETH na Base | Test na Sepolia first; mainnet deploy až po Sepolia success |
| Discord webhook URL je secret | Použít env-var substitution, NE commitovat URL |
| CI runner nemusí mít Rust | Použít `dtolnay/rust-toolchain@stable` action |

---

## 7. Post-3.0.1 roadmap

- **3.1.0** — Bridge 3/5 validator provisioning, cross-chain swap UI
- **3.2.0** — Full NCL compute marketplace (ONNX + GPU offload)
- **3.3.0** — OASIS avatar runtime (L4 activation)
- **3.5.0** — Public mainnet Genesis #0 launch (31.12.2026)

---

*Generated with Devin — audit + plan compiled from live codebase state.*
