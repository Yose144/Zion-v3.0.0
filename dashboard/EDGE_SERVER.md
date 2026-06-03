# ZION V3 Edge Server — Hetzner Management

## Server Details

| Property | Value |
|----------|-------|
| **ID** | 132255220 |
| **Name** | MainnetEdge |
| **IP** | 77.42.71.94 |
| **IPv6** | 2a01:4f9:c014:1692::/64 |
| **Status** | running |
| **Location** | Helsinki (hel1) |
| **Datacenter** | hel1-dc2 |
| **OS** | Ubuntu 26.04 |
| **Type** | CPX 22 |
| **Cores** | 2 (shared) |
| **RAM** | 4 GB |
| **Disk** | 80 GB (local) |
| **Created** | 2026-05-21T16:47:50Z |

## Network

| Port | Service | Status |
|------|---------|--------|
| 8333 | Node P2P | Closed |
| 8443 | Node RPC | Closed |
| 8444 | Pool Stratum | Closed |
| 8455 | Pool Metrics | Closed |
| 22 | SSH | Open (but auth failed) |

## Hetzner API

**API Key:** `rETfB9AQOUs3hbFkjZIkBZUnV1sqFc1ARSKMYuxl2qT7DCK7Oy0iCoVe7eLNQuvT`

**Permissions:** Write access (GET + POST)

**Available Actions:**
- ✅ List servers
- ✅ Get server details
- ✅ Reset root password
- ✅ Enable rescue mode
- ✅ Reboot server

**Recent Actions:**
- Reset root password: ✅ Success (Action ID: 634108978070325)
- New password: `aKNadHWkFqW4`

## SSH Access Status

**Current Status:** ✅ Connected (SSH key auth)

**Root Password:** `aKNadHWkFqW4` (reset via Hetzner API)

**SSH Key:** `~/.ssh/zion_hetzner_key` (added to authorized_keys)

**SSH Config:**
```
Host edge edge-server
    HostName 77.42.71.94
    User root
    IdentityFile ~/.ssh/zion_hetzner_key
    Port 22
    StrictHostKeyChecking accept-new
```

**Test:**
```bash
ssh edge "hostname && uptime"
# Output: MainnetEdge, up 10 days, 6:25
```

## Edge Server Services Status

**Systemd Services:**
- `zion-node.service`: ⚠️ Manual control (auto-restart disabled)
  - Status: Active (running)
  - Issue: Auto-restart loop due to port conflicts
  - Fix: Disabled auto-restart, manual control only
- `zion-pool.service`: ⚠️ Manual control (auto-restart disabled)
  - Status: Active (running)
  - Issue: Auto-restart loop due to port conflicts
  - Fix: Disabled auto-restart, manual control only

**Active Processes:**
- `zion-node` (PID 2056960): Listening on 8333, 8443
- `zion-pool` (PID 2056176): Listening on 8444, 8455

**Issue Resolved:** Disabled systemd auto-restart to prevent port conflicts. Services now stable under manual control.

**Ports Status:**
- 8333 (P2P): ✅ Open (zion-node)
- 8443 (RPC): ✅ Open (zion-node)
- 8444 (Pool): ✅ Open (zion-pool)
- 8455 (Pool Metrics): ❌ Closed (zion-pool)

**RPC Test:** Method not found errors (API may not be fully implemented or uses different method names)

**Seed Peer:** 100.74.34.40:8333 (configured in systemd env)

## Alternative Access Methods

### 1. Tailscale SSH (✅ Recommended)

**Status:** ✅ Installed and connected

**Tailnet Devices:**
- `100.100.46.39` — jose--macbook-pro (macOS) — current machine
- `100.76.16.108` — mainnetedge (linux) — **active**, relay "hel" (Helsinki)
- `100.74.34.40` — zionserver-144 (linux) — offline, last seen 23h ago
- `100.86.102.5` — zionserver (windows)

**SSH via Tailscale:**
```bash
tailscale ssh root@100.76.16.108

# Example output
# MainnetEdge
# 20:30:35 up 10 days,  6:34,  4 users,  load average: 0.27, 0.17, 0.11
```

**Advantages:**
- No SSH keys needed
- Automatic authentication via Tailscale
- End-to-end encryption
- Works even when public IP changes

### 2. Hetzner Rescue Mode (requires higher API permissions)
```bash
# Enable rescue mode
curl -X POST -H "Authorization: Bearer <API_KEY>" \
  -d "type=linux64" \
  "https://api.hetzner.cloud/v1/servers/132255220/actions/enable_rescue"

# Reboot into rescue
curl -X POST -H "Authorization: Bearer <API_KEY>" \
  "https://api.hetzner.cloud/v1/servers/132255220/actions/reboot"
```

### 3. Hetzner Console
- Access via Hetzner Cloud Console
- VNC console access
- Root password reset via console

## Dashboard Integration

**Edge Server in Dashboard:**
- Topology: `edge-primary`
- VPN IP: `100.76.16.108` (Tailscale)
- Public IP: `77.42.71.94`
- Pool Bind: `100.76.16.108:8444`
- RPC Bind: `100.76.16.108:8443`

**Dashboard API Endpoints:**
- `/api/topology` — Real topology check
- `/api/status` — Edge node status
- `/api/services` — Edge services health

## Hetzner API Helper Script

```bash
cd dashboard/MacOS
./hetzner-api.sh list                    # List all servers
./hetzner-api.sh get-by-ip 77.42.71.94  # Get Edge server details
```

## Troubleshooting

### SSH Permission Denied
1. Verify correct SSH key is in `~/.ssh/authorized_keys` on Edge server
2. Check Hetzner Console for VNC access
3. Use rescue mode to reset SSH keys

### API Permission Denied
1. Current API key is read-only
2. Request API key with write permissions from Hetzner
3. Use Hetzner Console for server management

### Ports Closed
1. Check Hetzner Firewall rules (ID: 2428080)
2. Ensure services are running on Edge server
3. Verify firewall allows required ports

## Next Steps

1. **Obtain API key with write permissions** for Hetzner
2. **Reset root password** via Hetzner Console or rescue mode
3. **Add SSH key** to Edge server's `~/.ssh/authorized_keys`
4. **Configure Tailscale** for VPN access
5. **Open required ports** in Hetzner Firewall (8333, 8443, 8444, 8455)
