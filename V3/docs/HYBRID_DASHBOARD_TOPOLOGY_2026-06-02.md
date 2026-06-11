# Hybrid Dashboard Topology Implementation

**Date**: 2026-06-02  
**Purpose**: Enable dashboard to support both Edge-primary (production) and local-dev (testing) topologies via dynamic configuration

## Overview

The dashboard now supports two operational topologies that can be switched via the UI settings or `config.json`:

1. **Edge-primary**: Production topology where Edge server runs primary node + pool with active payouts, local PC acts as backup node + miner host
2. **Local-dev**: Testing topology with local genesis node, follower node, and local pool

## Configuration

### Topology Selection

**File**: `dashboard/config.json`

```json
{
  "topology": "edge-primary"  // or "local-dev"
}
```

**UI Settings**: Dashboard → Settings → Topology dropdown

### Service Registries

**File**: `dashboard/app.py`

Two service registries defined:

- `SERVICE_REGISTRY_EDGE_PRIMARY`: Edge node (100.76.16.108), pool-edge, local backup node
- `SERVICE_REGISTRY_LOCAL_DEV`: node1 (genesis), node2 (follower), local pool

Dynamic selection based on `TOPOLOGY` config variable.

## Changes Summary

### 1. Payout Section (`build_payout_status()`)

**File**: `dashboard/app.py` lines 2512-2648

**Edge-primary mode**:
- Uses hardcoded Edge wallet addresses (fallback from env vars):
  - Pool wallet: `zion1a6z5a4m830w6s6k7r508n300n6z30022q6qt0n7`
  - Miner wallet: `zion1f8m55606u500z8l7f8p7n85588s3x70048c66j3`
  - Humanitarian: `zion1m4v5z8z850u480c5c208z274e334369275n5y20`
  - Issobella: `zion19242q4x0l3785003n8l0s873k3f5v8d4d8wz702`
- Fee split: `89/5/5/1` (burn model)
- Payouts enabled: `true`

**Local-dev mode**:
- Parses `pool.log` for startup config (pool_wallet, fee_split, wallets)
- Parses `node1.log` for miner_address
- Falls back to env vars if log parsing fails

**Common to both**:
- Parses local `pool.log` for miner performance data (hashrate, shares)
- Parses local `pool.log` for block events (BLOCK_FOUND, payout_submitted)
- Builds structured payouts array for charts
- Fetches pool stats and miners via `fetch_pool_stats()` and `fetch_pool_miners()`

### 2. Wallets Section (`build_wallets()`)

**File**: `dashboard/app.py` lines 2040-2170

- No changes needed - already topology-aware
- Queries local node RPC (127.0.0.1:8443) for wallet balances
- In edge-primary mode, local backup node syncs from Edge and has correct balances
- Returns premine wallets + operational wallets with live balances

### 3. Explorer Section (`build_explorer()`)

**File**: `dashboard/app.py` lines 2279-2345

- Already topology-aware
- Both topologies query local backup node (127.0.0.1:8443)
- Returns chain info, recent blocks, mempool data, supply estimates

### 4. Charts Section

**File**: `dashboard/dashboard.js` lines 1537-1634

- No changes needed
- Uses `/api/history` which samples from `build_status()`
- `build_status()` is already topology-aware
- Charts render hashrate, height, shares, sessions, block time, resources

### 5. Alerts Section (`build_alerts()`)

**File**: `dashboard/app.py` lines 1680-1777

- Already topology-aware
- Different alert logic per topology:

**Edge-primary alerts**:
- Edge node not reachable (critical)
- Edge chain stuck at height 0 (warning)
- Local backup node not running (critical)
- Backup node far behind Edge (warning, gap > 10 blocks)

**Local-dev alerts**:
- Node 1 (Genesis) not running (critical)
- Genesis chain stuck at height 0 (warning)
- Follower node far behind genesis (warning, gap > 10 blocks)

**Common alerts** (both topologies):
- Wrong fee split (critical, must be 89/5/5/1)
- Payouts disabled (warning)
- Low GPU nonce window (info)
- Miner not hashing (warning)
- Low hashrate (info)
- High share rejection rate (warning)
- Node1 error in logs (info)

### 6. Dashboard UI (`dashboard.js`)

**File**: `dashboard/dashboard.js`

- Added topology badge in header showing current topology
- Added settings modal with topology selector dropdown
- `saveSettings()` function calls `/api/config` to persist topology changes
- Stores `window.currentStatus` for topology-aware functions
- `updatePayouts()` function accepts topology parameter

### 7. Configuration API (`/api/config`)

**File**: `dashboard/app.py`

- GET: Returns current config (including topology)
- POST: Updates config (including topology) and saves to `config.json`
- Reloads `SERVICE_REGISTRY` after topology change

## Testing Results

### Edge-primary Topology

Tested with `config.json` set to `"topology": "edge-primary"`:

- `/api/status` ✅ Shows topology: edge-primary, edge_node data, local backup node syncing
- `/api/payout` ✅ Shows Edge wallet addresses, fee_split: 89/5/5/1, payouts enabled
- `/api/wallets` ✅ Shows premine wallets + operational wallets
- `/api/explorer` ✅ Returns chain data (RPC reachable via local backup)
- `/api/alerts` ✅ Shows "All systems nominal" when stack healthy
- `/api/history` ✅ Returns metrics samples with hashrate, height, shares

### Local-dev Topology

Tested with `config.json` set to `"topology": "local-dev"`:

- `/api/status` ✅ Shows topology: local-dev, node1 (genesis), node2 (follower)
- `/api/payout` ✅ Parses from pool.log (when pool running locally)
- `/api/wallets` ✅ Shows premine + operational wallets
- `/api/explorer` ✅ Returns chain data from local genesis node
- `/api/alerts` ✅ Shows local-dev specific alerts

## Edge Server Configuration

The Edge server (100.76.16.108) runs the primary node + pool with:

- **Pool wallet**: `zion1a6z5a4m830w6s6k7r508n300n6z30022q6qt0n7`
- **Payout execution**: enabled
- **Fee split**: 89/5/5/1 (burn model)
- **Public pool**: `77.42.71.94:8444`
- **Public RPC**: `http://77.42.71.94:8443/jsonrpc`

## Local PC Configuration

The local PC acts as:

- **Backup node**: Syncs from Edge via Tailscale VPN (100.76.16.108:8333)
- **Miner host**: CPU + GPU miners connect to Edge pool (100.76.16.108:8444)
- **Dashboard**: Monitors both Edge and local services

## Deployment Notes

1. **Dashboard service**: Restart after config changes
   ```bash
   systemctl --user restart zion-dashboard.service
   ```

2. **Topology switching**: Can be done via UI settings or by editing `config.json`

3. **Environment variables**: Not required locally for edge-primary mode (hardcoded fallbacks)

4. **Log files**: Dashboard parses local log files (`pool.log`, `node1.log`) for performance data

## Future Enhancements

- Consider fetching Edge pool metrics directly via HTTP API for more accurate data
- Add topology-specific dashboard layouts (e.g., show Edge node status prominently in edge-primary mode)
- Add automated topology detection based on running services
- Add topology migration wizard for transitioning between modes

## Related Documentation

- `V3/docs/EDGE_PRIMARY_DEPLOY_2026-06-02.md` - Edge server deployment details
- `V3/docs/FEE_SPLIT_BURN_REPORT_2026-06-02.md` - Fee split burn model details
- `dashboard/config.json` - Dashboard configuration
- `dashboard/services.json` - Service definitions for both topologies
