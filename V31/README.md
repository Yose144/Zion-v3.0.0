# V31 — Mainnet Alpha Workspace

> **Stav 2026-08-09:** `V31` (`3.1.0-beta`) je aktivní **Mainnet Alpha** workspace. Workspace protokol je `zion-v3-node/3.1.0-alpha`. `cargo test --workspace` prochází (aktuálně 2178 testů, např. `zion-multichain` 579, `zion-ai-native` 337, `zion-core` 303, `zion-pool` 165, `zion-miner` 101 + další crate), `cargo clippy --workspace` čisté kromě pre-existing warnings. **V31 je produkční na Edge** — node, pool, multichain, DAO, OASIS, dashboard, web a marketplace běží na `62.171.141.136` s kanonickým `EkamDeeksha` v3.2 (512 KiB, 2 passy, 128 random reads, 2 AES rounds). V3 služby zastaveny a maskovány.

Workspace se nachází v `/home/zionserver/2.9.6-main/V31/`; V3 produkční služby byly zastaveny a maskovány, V3 zůstává jako historická checkpoint reference (`archive/V3/` + `v3_compat`).

## Filozofie

`V31/` je čistý, vrstvený mainnet-track workspace: žádný legacy, žádné duplikáty, žádný dead code. Základní pravda je jedna — `zion-l1-types` pro sdílená primitiva a `zion-cosmic-harmony` pro PoW, coiny a profit routing. Mining stojí na **Triple Stream** (ZION kanonický stream + volitelný AuxPoW GPU a CPU fallback). V3 kompatibilita se řeší **checkpoint sync**, nikoliv genesis resetem; produkční V3 zůstává nedotčená, dokud V31 neprojde plným end-to-end ověřením.

## Struktura workspace

| Cesta | Hlavní crate | Popis |
|---|---|---|
| `L1/types` | `zion-l1-types` | Sdílená L1 primitiva (`Address`, `ChainId`, `Asset`, `Hash`, `Amount`). |
| `L1/cosmic-harmony` | `zion-cosmic-harmony` | Kanonický PoW `EkamDeeksha`, `ExternalCoin`, `CoinProfile`, `ProfitRouter` a podpora disabled coinů. |
| `L1/cosmic-harmony-v3` | `zion-cosmic-harmony-v3` | Legacy v3/v2 PoW algoritmy (`deeksha_lite`, `chv3`, `lite_fire`) a CHV3 body root / NPU mixing scaffolding. |
| `L1/core` | `zion-core` | Node runtime s V3 checkpoint sync, V3 P2P listen/IBD, V3 RPC, state/template/reorg, SQLite storage a `PeerManager` (max peers, ban score, discovery). |
| `L1/miner` | `zion-miner` | Triple Stream miner, AuxPoW GPU/CPU fallback (`auxpow` feature), `StratumClient`, `ZION_STREAM3_FORCE_COIN`, disabled-coin filtering a kanonický `EkamDeeksha`. |
| `L1/pool` | `zion-pool` | Stratum server + PPLNS, share validator s `EkamDeeksha`, reconnect rate limiter a `template_feed_loop` z `zion-core`. |
| `L2/multichain` | `zion-multichain` | `ChainAdapter` trait, EVM/BTC/ZionL1 adaptery, HTLC s SQLite persistencí, DEX router + custom AMM deploy, WARP, rate limiting + auth, wallet keyring, Dharma Credits a HTTP API. |
| `L2/dao` | `zion-dao` | Návrh/quorum/timelock typy, smoke test, zapojený do workspace. |
| `L3/ncl` | `zion-ncl` | NCL compute marketplace — scaffold s unit testy. |
| `L3/ai-native` | `zion-ai-native` | AI-native orchestrace a agenti — scaffold s unit testy. |
| `L4/oasis` | `zion-oasis` | Oasis game — 200 avatarů, questy, CORS API, `APP&WEB/OasisWeb` Next.js 16 client s live HUD. |
| `L5/free-world` | `zion-free-world` | Free World vrstva — funkcionální scaffold s unit testy. |
| `L6/issobella` | `zion-issobella` | Issobella superstruktura — funkcionální scaffold s unit testy. |
| `sdk` | `zion-sdk` | SDK pro integrace třetích stran a interních nástrojů. |
| `cli` | `zion-cli` (bin `zion`) | Operátorské CLI — 28 subcommandů: `menu`, `status`, `wallet`, `bridge`, `swap`, `pool`, `miner`, `doctor`, `api`, `node`, `service`, `dao`, `atomic-swap`, `warp`, `monitor`, `topology`, `explorer`, `onboard`, `deploy`, `update`, `compose`, `completions`, `agent`, `hiran`, `issobella`, `free-world`, `ncl`, `auxpow`. |

Binárky z `L1/core` (`zion-node`, `zion-migrate`) a z `cli` (`zion`) jsou generovány ve stejných cestách jako ostatní crate workspace. `zion-core` poskytuje node runtime a SQLite storage; `zion-cli` je jednotný operátorský binární vstup.

## Rychlý start

Build a testy:

```bash
cd V31
cargo check
cargo test
cargo build --release
```

Před prvním buildem ujistěte se, že máte stabilní toolchain podle `rust-toolchain.toml` (pokud existuje) nebo aktuální stable Rust. `Cargo.lock` je součástí repozitáře a obsahuje ověřené verze závislostí.

Pro CI použijte `cargo test --workspace`. Před commitem doporučujeme `cargo clippy -- -D warnings`. Pokud upravujete závislosti, spusťte `cargo tree` a `cargo audit` pro ověření duplicit nebo zranitelností.

AuxPoW fallback se aktivuje buildem mineru s featurem `auxpow`:

```bash
cargo build --release -p zion-miner --features auxpow
```

Lokální spuštění (příklady, upravte cesty a configy dle prostředí):

```bash
# Node — P2P listen, RPC, SQLite state
RUST_LOG=info ./target/release/zion-node --config config/node.toml

# Pool — Stratum + PPLNS
./target/release/zion-pool --config config/pool.toml

# Miner — triple stream s volitelným AuxPoW fallback
./target/release/zion-miner \
  --pool 127.0.0.1:3333 \
  --worker worker1 \
  --address <vaše_zion_address>

# Vynucená coina na streamu 3
ZION_STREAM3_FORCE_COIN=MONERO ./target/release/zion-miner --pool 127.0.0.1:3333

# Autonomous profit switching pro Stream 2/3
ZION_AUTONOMOUS=1 ./target/release/zion-miner --pool 127.0.0.1:3333
```

Pro plný Mainnet Alpha release použij `cargo build --release` — profil má `lto = "fat"`, `codegen-units = 1` a strip symbolů. Výsledné binárky najdete v `target/release/`. V3 checkpoint se načítá z nastavení v configu (`checkpoint_dir` nebo ekvivalentní klíč).

## Aktuální highlighty

- **Kanonický Ekam Deeksha PoW v3.2 + stress testy** — `EkamDeeksha` z `zion-cosmic-harmony` je jediný PoW v `zion-core`, `zion-miner` a `zion-pool` (512 KiB scratchpad, 2 passy, 128 random reads, 2 AES rounds); unit testy pokrývají mine/verify a nonce-search sweep 0–5500.
- **L3–L6 cross-layer smoke** — `V31/smoke` crate prověřuje end-to-end tok: NCL compute job → AI-Native consciousness → Oasis bridge → Oasis player → Free World grant → Issobella proposal.
- **Triple Stream mining** — kanonický ZION stream + AuxPoW GPU a CPU fallback přes `auxpow` feature.
- **V3 checkpoint sync** — V3 stav slouží jako checkpoint pro V31, nikoliv jako genesis reset.
- **V3 P2P + RPC** — `zion-core` umí V3 P2P listen/IBD a V3 RPC pro kompatibilitu s Edge.
- **E2E smoke node+pool+miner** — lokálně vytěžen a přijat block výška 1+; pool posílá `mining.notify`, miner `mining.submit`, node `submitBlock`.
- **Production P2P hardening** — `PeerManager` sdílený canonical/V3 P2P, max inbound limit, ban score, `GetPeers`/`Peers` discovery.
- **Forced coin override** — proměnné prostředí `ZION_STREAM2_FORCE_COIN` a `ZION_STREAM3_FORCE_COIN` přepíšou automatický výběr coiny.
- **Autonomous profit switching** — `ZION_AUTONOMOUS=1` vybírá Stream 2/3 podle live WhatToMine/NiceHash nebo fallback odhadů, s 15% hysteresí a odečtem ceny elektriny. Detaily a známá omezení viz `docs/3.2/AUTONOMOUS_PROFIT_ROUTER.md`.
- **Disabled-coin filtering** — filtr zakázaných coinů v `zion-miner` i `zion-cosmic-harmony`.
- **DAO skeleton** — `zion-dao` má základní návrh/quorum/timelock typy a smoke test.
- **HTLC persistence** — `zion-multichain` persistuje HTLC stav do SQLite.
- **DEX router + custom AMM deploy** — `zion-multichain` obsahuje constant-product AMM, multi-hop quote, HTTP `POST /v1/swap/pool/deploy` a `GET /v1/swap/pools` s SQLite persistencí.
- **WARP cross-chain** — WARP cross-chain infrastruktura.
- **Wallet keyring + Dharma Credits** — multichain vrstva spravuje wallet a Dharma Credits.
- **SQLite storage napříč L1** — chain state, mempool index, account store, pool PPLNS a HTLC sdílí jednotný přístup k SQLite.

- **DEX solver HTTP client + broadcast** — `HttpSolverClient` posílá `SwapIntent` JSON na `{solver_url}/v1/swap/solve`, očekává `SolverBid` JSON, `204 No Content` znamená odmítnutí. `zion-multichain` server má endpointy `POST /v1/swap/solve` a `POST /v1/swap/intent/:id/broadcast`. Testy v `tests/server.rs` a `tests/solver_network_http.rs`.

- **GPU OpenCL build verification** — `zion-miner` se buildne s `gpu-opencl` (a `gpu-cuda`, pokud je `libnvrtc`), test `tests/gpu_opencl_detect.rs` ověřuje detekci platformy a spuštění Deeksha jádra na lokální GPU.

- **Desktop Agent V31 binaries** — `APP&WEB/desktop-agent` balí V31 `zion-miner`, `zion-universal-miner`, `zion-node`/`node` a CLI `zion`. Příprava: `npm run prepare:rust-miner`; build balíčků: `npm run build:linux` → `.AppImage` a `.deb`.

## Co ještě běží / E2E

Všechny naplánované E2E položky pro `3.1.0-beta` (protokol `3.1.0-alpha`) jsou hotové. Zbývá ops/externí krok:

- ~~End-to-end smoke test node + pool + miner v jednom lokálním runu.~~ **Hotovo (2026-07-30).**
- ~~P2P production hardening — peer discovery, ban score a resiliance proti reconnect stormu.~~ **Hotovo (2026-07-30).**
- ~~Custom AMM deploy a integrace v `zion-multichain`.~~ **Hotovo (2026-07-30):** `/v1/swap/pool/deploy`, `/v1/swap/pools`, SQLite persistence, načítání při startu.
- ~~WARP API rate limiting a autentizace v `zion-multichain`.~~ **Hotovo (2026-07-30):** per-IP token bucket, optional `Authorization: Bearer <api_key>`, `/health` public.
- ~~Plná L3–L6 end-to-end verifikace — Oasis game, NCL compute marketplace, AI-native agenti, Free World a Issobella.~~ **Hotovo (2026-07-30):** `V31/smoke` crate s cross-layer smoke testem (NCL → AI-Native → Oasis → Free World → Issobella) prochází.
- ~~Kanonický `EkamDeeksha` PoW pro všechny výšky.~~ **Hotovo (2026-08-07):** `zion-core`, `zion-miner` a `zion-pool` používají `EkamDeeksha`; nonce-search stress sweep 0–5500 v `zion-core`.
- ~~Tag `v3.1.0-alpha.2`.~~ **Hotovo (2026-07-30):** tag vytvořen a pushnut, workspace build prochází.
- ~~Finální cut-over plán z V3 Edge (`62.171.141.136`) na V31.~~ **Hotovo (2026-07-30):** viz [`V31/CUTOVER_PLAN.md`](./CUTOVER_PLAN.md).
- ~~Cross-chain WARP transfer (Base ↔ ZionL1).~~ **Hotovo (2026-07-30):** `V31/smoke` HTLC lock/claim smoke mezi Base a ZionL1.
- ~~DAO governance proposal + vote.~~ **Hotovo (2026-07-30):** `V31/smoke` proposal, vote a quorum check.

### Další krok — `v3.1.0-beta` release

1. Build release binárky (Linux, Windows, macOS) + `SHA256SUMS.txt`.
2. Spustit 7d/30d continuous run na non-prod prostředí.
3. Reálné non-EVM WARP deploye + nahrazení placeholder kontraktů env proměnnými.
4. Provedení cut-over dle [`V31/CUTOVER_PLAN.md`](./CUTOVER_PLAN.md).

## Bezpečnost a provoz

- Síťové/portové pravidla a bezpečnostní postupy pro V31: [`V31/AGENTS.md`](./AGENTS.md).
- Detailní fázový build plán: [`V31/ALPHA_BUILD_PLAN.md`](./ALPHA_BUILD_PLAN.md).
- Globální provozní historie, incidenty a topologie: [`/home/zionserver/2.9.6-main/AGENTS.md`](../AGENTS.md).

Dodržujte default-deny firewall (`ufw`/`nftables`), IP allowlist pro RPC/dashboard a aktuální `ignoreip` v `fail2ban` jail `zion-p2p` před každým lokálním testem backup nody nebo poolu. Detailní seznam portů a operator IP najdete v [`V31/AGENTS.md`](./AGENTS.md).

Klíčové provozní body z `V31/AGENTS.md`:
- Node RPC `127.0.0.1:9445` nikdy není veřejně dosažitelný; veřejný RPC jde přes nginx `rpc.zionterranova.com:8443` s IP allowlistem.
- Pool stratum běží na `62.171.141.136:8444` a je primární veřejná služba pro minery.
- P2P porty `8333`/`8334` mají whitelisted peery a fail2ban ochranu.
- SSH je povolen pouze pro `OPERATOR_IPS` a běží na portech `22` a `2222`, IPv4 i IPv6.

## Další dokumentace

- [`ALPHA_BUILD_PLAN.md`](./ALPHA_BUILD_PLAN.md)
- [`AGENTS.md`](./AGENTS.md)
- [`AUTONOMOUS_PROFIT_ROUTER.md`](../docs/3.2/AUTONOMOUS_PROFIT_ROUTER.md)
- [`V3.1_MIGRATION_PLAN.md`](../docs/3.0.6/V3.1_MIGRATION_PLAN.md)
- [`/home/zionserver/2.9.6-main/AGENTS.md`](../AGENTS.md)
- [`docs/3.2/ROADMAP.md`](../docs/3.2/ROADMAP.md) (dlouhodobý roadmap)
- [`V31/PLAN_TO_3.2.md`](./PLAN_TO_3.2.md) (plán na 3.2)

---

**Verze:** `3.1.0-beta` (2026-08-07)
**Autorita:** Tento `README.md` je kanonický vstupní bod pro V31 Mainnet Alpha workspace.
