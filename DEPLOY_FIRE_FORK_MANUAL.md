# Fire Algorithm Hard Fork - Manual Deployment Instructions

## Current Status
- ✅ Code changes committed and pushed to GitHub
- ✅ Fork height set to block 5000
- ❌ SSH access to Edge server (77.42.71.94) unavailable (timeout + Tailscale auth required)

## Manual Deployment Steps

### Option 1: SSH via Tailscale (Recommended)
1. Open browser and authenticate Tailscale: https://login.tailscale.com/a/l1d5795783b3cda
2. SSH to Edge server:
   ```bash
   ssh -i ssh-key-zion-edge root@100.76.16.108
   ```
3. Run deployment script:
   ```bash
   cd /root/zion-2.9.6-main
   bash deploy-fire-fork-edge.sh
   ```

### Option 2: SSH via Public IP
1. Try SSH with longer timeout:
   ```bash
   ssh -i ssh-key-zion-edge -o ConnectTimeout=60 root@77.42.71.94
   ```
2. If successful, run deployment script as above

### Option 3: Direct Console Access
If SSH is completely unavailable:
1. Access Edge server console directly (Hetzner panel)
2. Run deployment script manually

## Deployment Script Contents

The script `deploy-fire-fork-edge.sh` performs:
1. Git pull latest changes
2. Build V3 workspace with Fire fork
3. Stop zion-node and zion-pool services
4. Start services with new code
5. Verify Fire fork activation

## Verification After Deployment

### Check Consensus Profile
```bash
curl -s -X POST http://127.0.0.1:8443/jsonrpc -H "Content-Type: application/json" -d '{"jsonrpc":"2.0","method":"getChainInfo","params":[],"id":1}' | jq '.result.consensus_profile'
```

Expected output:
- Before block 5000: `"deeksha_lite_v1"`
- After block 5000: `"deeksha_lite_fire"`

### Check Chain Height
```bash
curl -s -X POST http://127.0.0.1:8443/jsonrpc -H "Content-Type: application/json" -d '{"jsonrpc":"2.0","method":"getChainInfo","params":[],"id":1}' | jq '.result.chain_height'
```

### Monitor Logs
```bash
journalctl -u zion-node -f
journalctl -u zion-pool -f
```

## Current Chain Status
- Current height: 2001
- Fork height: 5000
- Blocks until fork: 2999
- Estimated time to fork: ~2-3 days (at current rate)

## Rollback Plan

If issues occur after deployment:
```bash
cd /root/zion-2.9.6-main
git revert HEAD
cargo build --release --manifest-path V3/Cargo.toml --workspace
systemctl restart zion-node zion-pool
```

## Success Criteria

1. ✅ Build completes without errors
2. ✅ Services start successfully
3. ✅ Consensus profile shows "deeksha_lite_v1" before block 5000
4. ✅ Consensus profile switches to "deeksha_lite_fire" at block 5000
5. ✅ No GPU_CPU_MISMATCH errors in miner logs
6. ✅ Pool accepts Fire shares after fork
