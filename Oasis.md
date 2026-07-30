# Oasis — ZION TerraNova Master Index

> **Poslední update:** 2026-07-30  
> **Aktivní workspace:** `V31/` (3.1.0-alpha.2) — Mainnet Alpha  
> **Produkční runtime:** `V3/` na Edge (`62.171.141.136`)

Tento soubor je rychlý přehled celého projektu a vstupní bod pro každého, kdo se vrací po pauze. Obsahuje stav, klíčové dokumenty, co je hotové a co je další krok.

---

## 1. Co je ZION

ZION TerraNova je Proof-of-Work Layer 1 blockchain s vrstvenou architekturou:

- **L1** — consensus, miner, pool, typy, PoW (`EkamDeeksha` / `HeightAwareDeeksha`).
- **L2** — multichain (bridge, swap/HTLC/DEX, wallet, WARP, Dharma Credits, DAO).
- **L3** — AI-native, NCL compute marketplace, orchestrátor.
- **L4** — Oasis (hra, consciousness levels, avataři, golden egg).
- **L5** — Free World.
- **L6** — Issobella.

L1–L6 existují jako crate ve `V31/` workspace. V3 zůstává běžící na Edge, dokud V31 neprojde E2E cut-over.

---

## 2. Aktuální stav (2026-07-30)

### 2.1 V31 Mainnet Alpha

- `cd V31 && cargo test` prochází pro celý workspace.
- `V31/ALPHA_BUILD_PLAN.md` je kanonický plán.
- `V31/AGENTS.md` obsahuje bezpečnostní a provozní pravidla — porty, firewall, operator IPs, fail2ban, tajnosti, zálohy.
- Klíčové featury implementované:
  - **Height-aware PoW fork gating** (`HeightAwareDeeksha`, heights 4500/5000).
  - **Triple Stream miner** — ZION + AuxPoW GPU/CPU fallback.
  - **Pool reconnect rate limiter** proti reconnect stormu.
  - `ZION_STREAM3_FORCE_COIN` a disabled-coin support v profit routeru.
  - **HTLC SQLite persistence** v `zion-multichain`.
  - **V3 checkpoint sync, P2P, RPC, state/template/reorg** v `zion-core`.
  - **DAO skeleton** (`zion-dao`).

### 2.2 Dokumentace

- Kořen je pročištěn — historické `.md` přesunuty do `docs/3.0.7/` a `docs/3.0.8/`.
- `V31/README.md` je kanonický vstup do V31 workspace.
- `README.md` v kořeni ukazuje na V31 a na archivy.

### 2.3 Síť / provoz

- Server: `62.171.141.136` (Contabo, IPv6 `2a02:c207:2342:5821::1`).
- Pool: `62.171.141.136:8444`.
- Veřejný RPC: `rpc.zionterranova.com:8443` → `127.0.0.1:9443` (nginx, IP allowlist).
- Web: `https://zionterranova.com`, dashboard: `https://dashboard.zionterranova.com`.
- SSH: `ssh zion-new` (port 22/2222, klíč `~/.ssh/zion-new-server`).

---

## 3. Rychlý start

```bash
# Build a testy V31
cd V31
cargo check
cargo test
cargo build --release

# Lokální node / pool / miner (příklad)
./target/release/zion-node --db-path ./node.db --rpc 127.0.0.1:9443 --p2p 0.0.0.0:0 --human <human_addr> --issobella <issobella_addr>
./target/release/zion-pool --bind 127.0.0.1:3333 --l1-rpc-url http://127.0.0.1:9443 --miner-address <miner_addr>
./target/release/zion miner start --pool-url 127.0.0.1:3333 --reward-address <miner_addr> --no-gpu --no-cpu
```

---

## 4. Klíčové odkazy

| Co | Kde |
|---|---|
| **V31 workspace** | [`V31/README.md`](V31/README.md) |
| **V31 build plán** | [`V31/ALPHA_BUILD_PLAN.md`](V31/ALPHA_BUILD_PLAN.md) |
| **V31 bezpečnostní pravidla** | [`V31/AGENTS.md`](V31/AGENTS.md) |
| **Globální AGENTS / provoz** | [`AGENTS.md`](AGENTS.md) |
| **Live status** | [`StatusV3.md`](StatusV3.md) |
| **Kořenový README** | [`README.md`](README.md) |
| **3.0.7 archiv** | [`docs/3.0.7/`](docs/3.0.7/) |
| **3.0.8 / V31 prep archiv** | [`docs/3.0.8/`](docs/3.0.8/) |
| **3.0.6 archiv** | [`docs/3.0.6/`](docs/3.0.6/) |

---

## 5. Co je další / otevřené

- ~~E2E smoke test node + pool + miner lokálně.~~ **Hotovo (2026-07-30):** node vytěží block, pool přijme share a submitne `submitBlock`, node přijme block (výška 1+).
- Production P2P hardening — peer discovery, ban score, max peers.
- Custom AMM deploy v `zion-multichain`.
- Plná L4–L6 end-to-end verifikace (Oasis, Free World, Issobella).
- Finální cut-over z V3 Edge na V31.

---

**Pokud nevíš, kde začít — začni ve [`V31/README.md`](V31/README.md) a pak [`V31/ALPHA_BUILD_PLAN.md`](V31/ALPHA_BUILD_PLAN.md).**
