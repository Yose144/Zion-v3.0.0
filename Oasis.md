# Oasis — ZION TerraNova Master Index

> **Poslední update:** 2026-07-31
> **Aktivní workspace:** `V31/` (3.1.0-alpha.2) — Mainnet Alpha
> **Produkční runtime:** `V3/` na Edge (`62.171.141.136`)
> **Lokální OASIS Game:** `cargo run -p zion-oasis` (port 8094) + `APP&WEB/OasisWeb` (Next.js 16, port 3000) — 200 avatarů, live HUD, CORS.
> **OASIS Web vizuál v0.0.1:** live na `https://oasis.zionterranova.com` — spirálová galaxie 30k částic, 3D Strom života, bloom.

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

## 2. Aktuální stav (2026-07-31)

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

### 2.2 OASIS Web / L4 vizuál v0.0.1

Live na: `https://oasis.zionterranova.com`

- **Stack:** Next.js 16, React Three Fiber, Three.js, `@react-three/drei`, `@react-three/postprocessing`.
- **Intro:** `WarpIntro` — warp/zvětšující se hvězdné pole + fade do scény.
- **Scéna:** `OasisScene` s kamerovým příletem od okraje galaxie ke středu.
- **Galaxie (v0.0.1):**
  - 30 000 částic, 5 spirálových ramen, radius 38.
  - Inspirace: CodePen / Three.js Journey galaxy (`branches`, `spin`, `randomnessPower`).
  - Barevný přechod: zlaté jádro → fialový okraj.
  - Měkká kulatá particle textura, `AdditiveBlending`, rotace.
  - Soubor: [`APP&WEB/OasisWeb/src/components/Galaxy.tsx`](APP&WEB/OasisWeb/src/components/Galaxy.tsx)
- **Strom života (v0.0.1):**
  - Procedurální fraktální strom s 3D trubičkovými větvemi (`TubeGeometry`).
  - Zlaté větve s `emissive`, 9 svítících plodů, fialové kořeny, glow aura sprite.
  - Soubor: [`APP&WEB/OasisWeb/src/components/TreeOfLife.tsx`](APP&WEB/OasisWeb/src/components/TreeOfLife.tsx)
- **Další vizuální prvky:** `GalaxyCore` (zářící jádro), `Nebula` (průhledné sprite oblaky), `TerritoryRing` (8 světů kolem stromu), `World` (interaktivní planety).

### 2.3 Maintenance landing page

- Live na: `https://www.zionterranova.com` (nginx servuje `maintenance.html`).
- Zdroj: [`APP&WEB/website-v2.9/public/maintenance.html`](APP&WEB/website-v2.9/public/maintenance.html)
- Hlavní prvek: interaktivní Stargate → `https://oasis.zionterranova.com/`.
- Obsah: hero s glass/rainbow card, L1–L6 mikro karty (2 řady po 3), status bar, CTA tlačítka, glass footer.

### 2.4 Dokumentace

- Kořen je pročištěn — historické `.md` přesunuty do `docs/3.0.7/` a `docs/3.0.8/`.
- `V31/README.md` je kanonický vstup do V31 workspace.
- `README.md` v kořeni ukazuje na V31 a na archivy.
- Tento soubor (`Oasis.md`) reflektuje stav webové OASIS prezentace a vrstev L4–L6.

### 2.5 Síť / provoz

- Server: `62.171.141.136` (Contabo, IPv6 `2a02:c207:2342:5821::1`).
- Pool: `62.171.141.136:8444`.
- Veřejný RPC: `rpc.zionterranova.com:8443` → `127.0.0.1:9443` (nginx, IP allowlist).
- Web: `https://zionterranova.com`, dashboard: `https://dashboard.zionterranova.com`.
- Oasis web: `https://oasis.zionterranova.com`.
- SSH: `ssh zion-new` (port 22/2222, klíč `~/.ssh/zion-new-server` / `~/.ssh/zion-edge-post-wipe-2026-07-29`).

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

# Lokální OASIS web
cd APP&WEB/OasisWeb
npm install
npm run build
npm run start
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
| **OASIS web zdroj** | [`APP&WEB/OasisWeb/`](APP&WEB/OasisWeb/) |
| **Maintenance page** | [`APP&WEB/website-v2.9/public/maintenance.html`](APP&WEB/website-v2.9/public/maintenance.html) |
| **3.0.7 archiv** | [`docs/3.0.7/`](docs/3.0.7/) |
| **3.0.8 / V31 prep archiv** | [`docs/3.0.8/`](docs/3.0.8/) |
| **3.0.6 archiv** | [`docs/3.0.6/`](docs/3.0.6/) |

---

## 5. Co je další / otevřené

- ~~E2E smoke test node + pool + miner lokálně.~~ **Hotovo (2026-07-30):** node vytěží block, pool přijme share a submitne `submitBlock`, node přijme block (výška 1+).
- ~~Production P2P hardening — peer discovery, ban score, max peers.~~ **Hotovo (2026-07-30).**
- ~~Custom AMM deploy v `zion-multichain`.~~ **Hotovo (2026-07-30):** `/v1/swap/pool/deploy` a `/v1/swap/pools`, persistence do SQLite, načítání při startu.
- ~~WARP API rate limiting + auth v `zion-multichain`.~~ **Hotovo (2026-07-30):** per-IP token bucket, optional `Authorization: Bearer <api_key>`, `/health` public.
- ~~Stress test `HeightAwareDeeksha` fork gating.~~ **Hotovo (2026-07-30):** boundary CHV3/Fire + sweep 0–5500 v `zion-core`.
- ~~Tag `v3.1.0-alpha.2`.~~ **Hotovo (2026-07-30):** tag vytvořen a pushnut, workspace build prochází.
- ~~Finální cut-over z V3 Edge na V31.~~ **Hotovo (2026-07-30):** viz [`V31/CUTOVER_PLAN.md`](V31/CUTOVER_PLAN.md).
- ~~Plná L4–L6 end-to-end verifikace (Oasis, Free World, Issobella).~~ **Hotovo (2026-07-30):** `V31/smoke` cross-layer test propojuje Oasis player, Free World grant a Issobella proposal přes AI-Native bridge.
- **OASIS web v0.0.1** — galaxy + tree of life nasazeno (2026-07-31).
- **Další vizuální iterace** — leaves/petals na stromu, interakce se světy, guild avataři, OASIS HUD.

---

**Pokud nevíš, kde začít — začni ve [`V31/README.md`](V31/README.md) a pak [`V31/ALPHA_BUILD_PLAN.md`](V31/ALPHA_BUILD_PLAN.md). Pro webovou OASIS viz [`APP&WEB/OasisWeb/README.md`](APP&WEB/OasisWeb/README.md).**
