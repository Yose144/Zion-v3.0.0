# ZION Mainnet + DeFi/DEX L2 — Completion Roadmap

> Version: 3.0.2  
> Last updated: 2026-06-22  
> Scope: Base Mainnet bridge, DeFi/DEX L2, website, and production readiness

---

## 1. Executive Summary

### ✅ Done (2026-06-22)

- **Base Mainnet 5/5 bridge deployed and migrated**
  - New `ZIONBridge`: `0x72c8f0Dc60E27aB7A83fe3B416fab4F0600a6467`
  - New `BridgeValidator`: `0x9C138dC6ebA8A883AB3802F6Dcb79C772a835627`
  - wZION `BRIDGE_ROLE` migrated from old single-sig bridge
  - Old bridge (`0xa5a09b2...`) no longer has mint/burn rights
  - 5 validator addresses funded and configured
- **Bridge config and website updated** to point to new mainnet contracts
- **Testnet fixes**: Base Sepolia RPC, EVM watcher block-range chunking, metrics
- **Tests**: `cargo test -p zion-bridge` → **47/47 passed**
- **Smoke test**: mainnet relay config loads correctly with `Validator threshold: 5/5`

### 🔄 Next Milestones

1. **Mainnet bridge relay live** (start + monitor)
2. **DeFi/DEX L2 feature-complete** (swap, bridge burn widget, staking UI)
3. **Website production deploy** (`zionterranova.com/defi`)
4. **Operational readiness** (funding, monitoring, docs, audit)

---

## 2. Mainnet Bridge Status

### 2.1 Contracts

| Contract | Address | Role | Status |
|----------|---------|------|--------|
| wZION | `0x0c493763d107ab0ABb0aee1Ca3999292d8202bb6` | Wrapped ZION ERC-20 | ✅ Live |
| ZIONBridge (new) | `0x72c8f0Dc60E27aB7A83fe3B416fab4F0600a6467` | 5/5 bridge controller | ✅ Deployed |
| BridgeValidator (new) | `0x9C138dC6ebA8A883AB3802F6Dcb79C772a835627` | 5/5 guardian multisig | ✅ Deployed |
| ZIONBridge (old) | `0xa5a09b2C09A7182BBA9623A2D2cd46cD7D041721` | Old single-sig bridge | ❌ Revoked |
| UniV3Pool | `0xa88C4C89EB4597Df2e29A8061895300FcDF44FBB` | wZION/WETH liquidity | ✅ Live |
| UniV3Router | `0x2626664c2603336E57B271c5C0b26F421741e481` | Uniswap V3 router | ✅ Live |

### 2.2 Validators / Guardians (Base Mainnet)

| # | Address | Balance | Role |
|---|---------|---------|------|
| 1 | `0xdde17506BC2D2dCE1d594bD1D85B0BAbb389D186` | 0.002083 ETH | Deployer + Guardian + Validator |
| 2 | `0x24d986841E56e5571489B25951eE8C1Ae761FA82` | 0.001000 ETH | Guardian + Validator |
| 3 | `0x665c55eDCF25c2c5A1dfF1B20eE950cBDC58d3d0` | 0.001000 ETH | Guardian + Validator |
| 4 | `0x8E644b3E9FaBf52eE321DC5B3D5AA06d6e3E66C6` | 0.001000 ETH | Guardian + Validator |
| 5 | `0x7e0D2eD71d78B9CFB5034A83333e82e304bc4CB2` | 0.001000 ETH | Guardian + Validator |

> **Funding note:** Minimum operational ETH is met. Recommended to top up to ≥0.01 ETH each before high-volume operations.

### 2.3 Deployment Transactions

| Step | Tx Hash |
|------|---------|
| Deploy BridgeValidator (5/5) | `0xaf4df777b36598d5ce7d2c7640a019140f1dae3dbe9c622db333891a6b7168db` |
| Deploy ZIONBridge (5/5) | `0x885d8e582b2534eb744cec3b42e49a6ad4c05784d21aa4f1c529c8ea13fd886f` |
| Grant BRIDGE_ROLE to new bridge | `0x37629a36939449dc75e4f9c2a532cd44aced9df5c6049920c86720b7a1e3a122` |
| Revoke BRIDGE_ROLE from old bridge | `0x9375eda2c17565e6e89aabff38f04ca8910a76276cdd55f2294de414479afc9f` |
| Add guardian 2 | `0x96ea2b37a821f705eaef7ee6d0982c10b6b9c1418ef81cf1f5096a2072af2474` |
| Add guardian 3 | `0xc303d4e09853131236cb6392a2b5094e3f4e2a403d7514d576ca3446e2ff1756` |
| Add guardian 4 | `0xe149193a9b37881c52c8af596521e1c91e088fbfa5d341a52a8c27b8f26512be` |
| Add guardian 5 | `0x70b2f439f40933c4f8b94cd8d67bad79bdea9f8d39032a773f118b29bd71303f` |

### 2.4 Configuration Files

- `V3/config/bridge-mainnet.toml`
- `V3/L2/bridge/config/bridge-mainnet.toml`
- `APP&WEB/website-v2.9/src/lib/bridge-api.ts`
- `APP&WEB/website-v2.9/src/lib/defi-contracts.ts`

---

## 3. DeFi / DEX L2 Roadmap

### 3.1 Current State

| Component | Path | Status | Notes |
|-----------|------|--------|-------|
| wZION token | `V3/L2/bridge/contracts/src/wZION.sol` | ✅ Deployed | Base Mainnet |
| ZIONBridge | `V3/L2/bridge/contracts/src/ZIONBridge.sol` | ✅ Deployed 5/5 | New contract |
| BridgeValidator | `V3/L2/bridge/contracts/src/BridgeValidator.sol` | ✅ Deployed 5/5 | New contract |
| Bridge relay daemon | `V3/L2/bridge` | ✅ Ready | Config loads, tests pass |
| Swap aggregator backend | `V3/L2/swap-aggregator` | ✅ Active | Rust/Axum + SQLite |
| Atomic swap HTLC | `V3/L2/atomic-swap` | ✅ Active | E2E tests |
| DAO treasury | `V3/L2/dao` | ✅ Active | 65 tests |
| Website DeFi UI | `APP&WEB/website-v2.9` | 🔄 Needs deploy | Updated to mainnet |
| Bridge burn widget | `APP&WEB/website-v2.9/src/components/BridgeBurnWidget.tsx` | 🔄 Needs deploy | Points to new mainnet |
| Staking UI | `/defi/staking` | 🔄 Placeholder | 12% APR, 7d cooldown |
| Farming UI | `/defi/farming` | 🔄 Placeholder | Farm pool cards |

### 3.2 Completion Checklist

#### Phase A — Bridge Production

| # | Task | Status | Owner |
|---|------|--------|-------|
| 1 | Top up 5 validator addresses to ≥0.01 ETH | ❌ | Ops |
| 2 | Start mainnet bridge relay on Edge/Core | ❌ | Ops |
| 3 | Monitor metrics endpoint for 24h | ❌ | Ops |
| 4 | Verify first mainnet lock→mint flow end-to-end | ❌ | QA |
| 5 | Verify first mainnet burn→unlock flow end-to-end | ❌ | QA |
| 6 | Set up alerting on relay health | ❌ | Ops |
| 7 | External security audit | ❌ | Security |

#### Phase B — DeFi / DEX Website

| # | Task | Status | Path |
|---|------|--------|------|
| 1 | Build website with new mainnet contracts | ✅ Code ready | `APP&WEB/website-v2.9` |
| 2 | Deploy website to production (`zionterranova.com/defi`) | ❌ | Edge server |
| 3 | Verify swap quotes on Base Mainnet | ❌ | `/defi/swap` |
| 4 | Verify bridge burn widget on Base Mainnet | ❌ | Bridge widget |
| 5 | Verify staking deposit/withdraw UI | ❌ | `/defi/staking` |
| 6 | Verify farming deposit/withdraw UI | ❌ | `/defi/farming` |
| 7 | Add mainnet explorer links (basescan.org) | ✅ Code ready | `bridge-api.ts` |
| 8 | Test wallet connection (MetaMask, Rabby, etc.) | ❌ | QA |
| 9 | Mobile responsiveness pass | ❌ | QA |
| 10 | SEO / social metadata for `/defi` | ❌ | Marketing |

#### Phase C — DEX / Liquidity

| # | Task | Status | Notes |
|---|------|--------|-------|
| 1 | Verify UniV3Pool liquidity and pricing | ✅ Live | `0xa88C4C89...` |
| 2 | Add liquidity if needed | ❌ | Ops/Treasury |
| 3 | Set up swap aggregator production DB | ❌ | `V3/L2/swap-aggregator` |
| 4 | Configure mainnet RPC for swap backend | ❌ | `https://mainnet.base.org` or dedicated |
| 5 | Price oracle / TWAP integration | ❌ | Design |
| 6 | MEV protection review | ❌ | Security |
| 7 | Fee structure and treasury routing | ❌ | DAO |

#### Phase D — Operations & Compliance

| # | Task | Status | Notes |
|---|------|--------|-------|
| 1 | Production monitoring (Grafana/Prometheus) | 🔄 | `V3/docker` monitoring profile |
| 2 | Log aggregation | ❌ | Edge/local |
| 3 | Incident response runbook | 🔄 | `BRIDGE_MAINNET_LAUNCH_CHECKLIST.md` |
| 4 | Backup and recovery for bridge DB | ❌ | `data/bridge-mainnet.db` |
| 5 | Key custody review for 5 validators | ❌ | Security |
| 6 | Bug bounty program | ❌ | Security |
| 7 | Legal / compliance review for DeFi features | ❌ | Legal |

---

## 4. Immediate Action Plan (Next 48h)

### Day 1 — Relay & Funding

1. Top up 5 validator addresses to 0.01 ETH each (total ~0.05 ETH).
2. Start mainnet bridge relay:
   ```powershell
   $env:ZION_BRIDGE_CONFIG = 'V3/config/bridge-mainnet.toml'
   cargo run --release --manifest-path V3/Cargo.toml -p zion-bridge
   ```
3. Monitor metrics at `http://127.0.0.1:9102/metrics`.
4. Watch for `last_evm_block` progressing and no `evm_poll_error` spikes.

### Day 2 — Website Deploy

1. Build website:
   ```bash
   cd APP&WEB/website-v2.9
   npm install
   npm run build
   ```
2. Deploy to Edge server (`77.42.71.94`):
   ```bash
   # On Edge server
   cd /root/zion-2.9.6-main/APP&WEB/website-v2.9
   npm install
   npm run build
   docker build -t zion-website:v3.0.2 .
   docker compose up -d
   ```
3. Verify `https://zionterranova.com/defi` loads with new contracts.
4. Test swap quote and bridge widget on Base Mainnet.

---

## 5. Website Deployment Notes

Per `AGENTS.md` and project topology:

- Production website is built on **Edge server** (`77.42.71.94`).
- Docker image is built from host artifacts (`.next` + `node_modules`) because `npm install` inside Docker fails on local `.tgz` dependency.
- Production compose file: `/root/zion-web/docker-compose.yml` uses `image: zion-website:<version>`.
- Caddy reverse proxies to `localhost:3000`.

### Deploy command sequence (Edge server)

```bash
ssh root@77.42.71.94
cd /root/zion-2.9.6-main/APP&WEB/website-v2.9
git pull origin main
npm install
npm run build
docker build -t zion-website:v3.0.2 .
docker compose -f /root/zion-web/docker-compose.yml up -d
```

> If SSH to Edge is unstable, the local build can be rsynced to Edge, or the build can be done on the Windows 11 dev machine and artifacts copied.

---

## 6. Risk Register

| Risk | Impact | Likelihood | Mitigation |
|------|--------|------------|------------|
| Validator addresses run out of ETH | Bridge stops signing | Medium | Top up to 0.01 ETH each; set low-balance alerts |
| Mainnet RPC rate-limited | Relay lag or outages | Medium | Use dedicated RPC (Alchemy/Ankr); add fallback |
| L1 node not synced | Bridge cannot process locks | High | Ensure L1 node (`zion-core`) is synced before full relay start |
| Website points to old contracts | Users interact with revoked bridge | Low (already fixed) | Double-check `bridge-api.ts` and `defi-contracts.ts` after deploy |
| Smart contract bug in new bridge | Fund loss | Low | External audit; test on Sepolia first |
| Key compromise of one validator | 5/5 still safe, but response needed | Medium | Hardware wallets; air-gapped keys; incident runbook |

---

## 7. Useful Commands

### Bridge

```bash
# Load mainnet config
cargo run --release --manifest-path V3/Cargo.toml -p zion-bridge -- --config V3/config/bridge-mainnet.toml

# Check metrics
curl http://127.0.0.1:9102/metrics

# Run tests
cargo test --manifest-path V3/Cargo.toml -p zion-bridge
```

### Website

```bash
cd APP&WEB/website-v2.9
npm install
npm run dev      # local dev
npm run build    # production build
npm run lint     # lint check
```

### On-chain verification

```bash
# ZIONBridge threshold
cast call 0x72c8f0Dc60E27aB7A83fe3B416fab4F0600a6467 "threshold()" --rpc-url https://mainnet.base.org

# BridgeValidator guardianCount
cast call 0x9C138dC6ebA8A883AB3802F6Dcb79C772a835627 "guardianCount()" --rpc-url https://mainnet.base.org

# wZION BRIDGE_ROLE for new bridge
cast call 0x0c493763d107ab0ABb0aee1Ca3999292d8202bb6 "hasRole(bytes32,address)" \
  0x884cd25c78fcaba8702ccc899479bf3878fb71f972b21ee3a9cc53627f13948a \
  0x72c8f0Dc60E27aB7A83fe3B416fab4F0600a6467 \
  --rpc-url https://mainnet.base.org
```

---

## 8. Links & References

- `BRIDGE_MAINNET_READINESS.md` — detailed deployment report
- `V3/docs/BRIDGE_MAINNET_DEPLOY.md` — deploy guide
- `V3/docs/BRIDGE_MAINNET_LAUNCH_CHECKLIST.md` — launch checklist
- `V3/docs/BRIDGE_MULTISIG.md` — multisig design
- `L2audit.md` — security audit findings
- `StatusV3.md` — overall project status
- `ZION_3.0.2_PLAN.md` — 3.0.2 plan
- `AGENTS.md` — agent operating rules

---

## 9. Decision Log

| Date | Decision | Rationale |
|------|----------|-----------|
| 2026-06-22 | Deploy new 5/5 mainnet bridge | Old bridge was single-sig (threshold=1) — critical security risk |
| 2026-06-22 | Keep wZION contract, replace bridge | wZION already has supply and liquidity; replacing bridge is lower risk than redeploying token |
| 2026-06-22 | Set mainnet `enabled=true` | New bridge is deployed and migrated; ready for relay start after funding top-up |
| 2026-06-22 | Use `https://mainnet.base.org` as primary RPC | Public RPC sufficient for deploy; recommend dedicated RPC for production relay |
| 2026-06-22 | Reduce `MAX_BLOCK_RANGE` to 1500 | Base public RPC returns errors at exactly 2000 blocks |

---

*Generated with [Devin](https://devin.ai)*
