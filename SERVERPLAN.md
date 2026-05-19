# ZION V3 Mainnet — Server Infrastructure Plan

**Version:** 1.0  
**Date:** 2026-05-19  
**Scope:** Hardware sizing, topology, and cost estimate for full mainnet stack

---

## 1. Executive Summary

| Topology | Est. Monthly Cost | Complexity | Recommended For |
|----------|-------------------|------------|---------------|
| **A. Local PC (Greenfield) + Cloud Backup** | ~$15–40 | Low | Solo operators, home miners |
| **B. Two Cloud VPS (Hetzner/Contabo)** | ~$80–150 | Low | No local hardware |
| **C. Local PC (Greenfield) + Cloud Pool + Cloud Inference** | ~$50–100 | Medium | Splitting heavy GPU work |
| **D. Colocation (1U server)** | ~$80–120 + hw | Medium | Long-term serious operator |

**Our recommendation:** **Topology A** — use your existing local PC as the Greenfield node + pool, with a cheap cloud VPS as a follower/backup node. This gives you physical control of the chain-of-truth machine at the lowest cost.

---

## 2. Full Stack Component Breakdown

From `V3/docker/docker-compose.yml` (profiles `mainnet` + `monitoring`):

| Service | Role | CPU | RAM | Disk | Network | GPU |
|---------|------|-----|-----|------|---------|-----|
| **zion-node** | Chain truth, P2P, RPC | 2–4 cores | 4–8 GB | 200 GB → 1 TB SSD | Public IP, 8333+8443 | No |
| **zion-pool** | Stratum, PPLNS, share validation | 2–4 cores | 4–8 GB | 20 GB SSD | Public IP, 8444 | No |
| **zion-miner** | Hash producer (optional local) | 2–8 cores | 2–4 GB | 5 GB | LAN → pool | Optional |
| **zion-oasis** | L4 game server, XP sync | 2 cores | 4 GB | 50 GB SSD | 8094 | No |
| **hiran-inference** | AI model inference (LLM) | 2–4 cores | 16–32 GB | 100 GB SSD | 8002 | **Yes — 16GB+ VRAM** |
| **prometheus** | Metrics TSDB | 1 core | 2 GB | 100 GB SSD | Internal | No |
| **grafana** | Dashboards | 0.5 core | 1 GB | 5 GB SSD | 3000 | No |

### 2.1 Disk Growth Projection

| Component | Start | Year 1 | Year 5 | Notes |
|-----------|-------|--------|--------|-------|
| Blockchain (node) | ~1 GB | ~50 GB | ~300 GB | 60s block time, ~1 KB avg block |
| Pool journal + logs | ~100 MB | ~5 GB | ~25 GB | Depends on miner count |
| Prometheus TSDB | ~1 GB | ~20 GB | ~50 GB | 30s scrape interval default |
| Hiran models | ~15 GB | ~20 GB | ~30 GB | Quantized GGUF files |
| **Total (provisioned)** | **~20 GB** | **~100 GB** | **~400 GB** | |

**Recommendation:** Start with 1 TB NVMe SSD. It gives you 5+ years of headroom.

---

## 3. Topology A — Local PC + Cloud Backup (Recommended)

### 3.1 Local PC (Greenfield Node)

Runs the critical path: **node + pool + oasis + monitoring**. Inference can be optional or moved to a second local GPU machine.

| Spec | Minimum | Recommended |
|------|---------|-------------|
| **CPU** | Intel i5 / Ryzen 5 (4c/8t) | Intel i7 / Ryzen 7 (8c/16t) |
| **RAM** | 16 GB DDR4 | 32 GB DDR4/DDR5 |
| **OS Disk** | 256 GB SATA SSD | 512 GB NVMe SSD |
| **Data Disk** | 512 GB SATA SSD | 1 TB NVMe SSD |
| **Network** | 100 Mbps / NAT | 1 Gbps / public IP or port forwarding |
| **GPU** | — | NVIDIA RTX 4060 Ti 16GB (for inference) |
| **PSU** | 500 W | 750 W (if GPU) |

#### How to Separate from Windows 11

Your PC currently runs Windows 11. You have four options:

| Option | Effort | Isolation | Performance | Recommendation |
|--------|--------|-----------|-------------|----------------|
| **WSL2 + Docker Desktop** | 30 min | Poor (shared kernel) | Medium (9P FS overhead) | **Not for production** |
| **Hyper-V VM (Windows Pro)** | 2 h | Good | Good (80–95% bare metal) | **Acceptable if no GPU passthrough needed** |
| **Dual-boot Ubuntu Server** | 3 h | Excellent (100%) | 100% bare metal | **Best for node + pool** |
| **Second physical machine** | $300–800 | Excellent | 100% | **Best if you have spare hardware** |

**Our recommendation:** Option 3 — **dual-boot** or **dedicated second disk** with **Ubuntu Server 24.04 LTS**.

- Install Ubuntu on a second NVMe SSD (or partition).
- Keep Windows 11 on the primary disk for daily use.
- Boot into Ubuntu Server when running mainnet.
- If you need 24/7 uptime, consider a cheap used SFF PC (~$150) as a dedicated node.

#### Public IP / Port Forwarding

Most ISPs assign dynamic IPs. You need:

1. **Port forwarding** on your router:
   - `8333/tcp` → Ubuntu PC (P2P)
   - `8443/tcp` → Ubuntu PC (RPC, internal only — firewall!)
   - `8444/tcp` → Ubuntu PC (Pool stratum)
   - `3000/tcp` → Ubuntu PC (Grafana, restrict to your IP)

2. **Dynamic DNS** (if no static IP):
   - Use Cloudflare or No-IP: `node.yourdomain.com` → your dynamic IP.
   - Set `ZION_SEED_PEERS=node.yourdomain.com:8333` on follower nodes.

3. **Firewall (ufw on Ubuntu)**:
   ```bash
   ufw default deny incoming
   ufw allow 8333/tcp   # P2P — must be public
   ufw allow 8444/tcp   # Pool — must be public
   ufw allow from YOUR_HOME_IP to any port 8443  # RPC — restrict!
   ufw allow from YOUR_HOME_IP to any port 3000  # Grafana — restrict!
   ufw enable
   ```

### 3.2 Cloud Backup / Follower Node

A cheap VPS that syncs from your local node. Provides redundancy if your local ISP goes down.

| Provider | Spec | Monthly Cost |
|----------|------|--------------|
| **Hetzner** CX21 (2 vCPU, 4 GB, 40 GB) | €5.35 (~$6) |
| **Contabo** VPS S (4 vCPU, 8 GB, 200 GB) | €6.99 (~$8) |
| **Vultr** Cloud 2 vCPU, 4 GB | $24 |

**Recommended:** Hetzner CX31 (2 vCPU, 8 GB, 80 GB NVMe) — €8.90/mo. Add 160 GB volume for blockchain data (~€5).

**This follower runs:** node only (no pool, no inference). It syncs via P2P from your local Greenfield node.

```bash
# On follower node
ZION_SEED_PEERS=<your-public-ip-or-ddns>:8333
```

---

## 4. Topology B — Two Cloud VPS (No Local Hardware)

If you do not want to run anything locally:

| Server | Role | Provider / Spec | Monthly |
|--------|------|-----------------|---------|
| **Primary** | Node + Pool + Oasis + Monitoring | Hetzner CPX31 (4 vCPU, 8 GB, 160 GB) | ~€15 |
| **Secondary** | Follower Node + Inference | Hetzner dedicated GPU (RTX 3080) | ~€80–120 |

**Total:** ~€100–140 / month.

Inference is the expensive part. If you skip Hiran inference entirely and run only node + pool, you can do it for **€15–25 / month** on a single VPS.

---

## 5. Inference-Specific Considerations

Hiran v2.2 inference requires:
- **GPU:** NVIDIA with CUDA 12+ support
- **VRAM:** 16 GB for FP16 merged model (~15 GB file)
- **RAM:** 16 GB system RAM minimum
- **Disk:** 50 GB for model + cache

### Options for Inference:

| Option | Cost | Uptime | Notes |
|--------|------|--------|-------|
| Local RTX 4060 Ti 16GB | $350 one-time | 24/7 if PC runs | Best value |
| Vast.ai / RunPod spot | $0.20–0.50/hr | On-demand | Good for training, not 24/7 inference |
| Vast.ai dedicated RTX 4090 | ~$0.46/hr (~$330/mo) | 24/7 | Expensive for inference only |
| Skip inference entirely | $0 | — | Node and pool work without it |

**Recommendation:** Buy a **used RTX 3060 12GB** (~$200) or **RTX 4060 Ti 16GB** (~$380) and run inference locally. It pays for itself in 1–2 months vs cloud rental.

---

## 6. Monitoring & Alerting

Prometheus + Grafana are lightweight but the TSDB grows. Set retention:

```yaml
# prometheus.yml
storage:
  tsdb:
    retention.time: 30d
    retention.size: 50GB
```

Alerts to configure:
- Node out of sync (`zion_node_height` lag > 10 blocks)
- Pool share rate drop (miner disconnect)
- Disk usage > 80%
- GPU temperature > 85°C (if inference running)

---

## 7. Cost Comparison Summary

| Scenario | Initial Investment | Monthly Recurring | 3-Year TCO |
|----------|-------------------|-------------------|------------|
| **A. Local PC + Hetzner backup** | $0 (use existing) + $200 GPU | ~$15 | ~$740 |
| **A. Local PC, no GPU** | $0 | ~$15 | ~$540 |
| **B. Two cloud VPS, no inference** | $0 | ~$40 | ~$1,440 |
| **B. Two cloud VPS + GPU cloud** | $0 | ~$140 | ~$5,040 |
| **D. Colocation 1U + own server** | $800 server | ~$80 | ~$3,680 |

---

## 8. Implementation Checklist

- [ ] Decide: dual-boot Ubuntu Server vs. dedicated second machine
- [ ] If dual-boot: buy second NVMe SSD (1 TB, ~$60)
- [ ] Configure router port forwarding (8333, 8444)
- [ ] Set up Dynamic DNS if no static IP
- [ ] Provision Hetzner/Contabo follower node
- [ ] Configure ufw firewall on local node
- [ ] (Optional) Buy used GPU for local inference
- [ ] Copy `V3/docker/.env.mainnet.example` → `.env.mainnet`, fill in real keys
- [ ] Run `docker compose -f V3/docker/docker-compose.yml --profile mainnet up -d`
- [ ] Verify P2P connectivity: `curl http://localhost:8443/health`
- [ ] Verify pool: `telnet <your-ip> 8444`

---

## 9. Security Notes

- **Never** commit `.env.mainnet` to git. It is already in `.gitignore`.
- **Never** run RPC (port 8443) publicly exposed. Restrict to localhost or VPN.
- **Always** firewall Grafana (port 3000) to your admin IP only.
- Rotate `ZION_POOL_PAYOUT_SK_HEX` if you ever suspect exposure.
- The follower node in the cloud does **not** need the pool payout key.

---

*Plan generated by Devin — 2026-05-19*
