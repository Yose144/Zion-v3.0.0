# 📊 ZION Pool Monitoring & Alerting Setup

> **Day 2 Completed:** Prometheus metrics, Grafana dashboard, Discord alerting  
> **Date:** 13. října 2025

---

## ✅ What Was Implemented

### 1. **Prometheus Metrics** ✅
Added comprehensive metrics to `zion_universal_pool_v2.py`:

**Metrics Exposed:**
- `zion_pool_info` - Pool version and configuration (Info)
- `zion_pool_shares_total{algorithm, status}` - Total shares (Counter)
- `zion_pool_blocks_found_total{algorithm}` - Blocks found (Counter)
- `zion_pool_connections_total` - Total connections (Counter)
- `zion_pool_errors_total{type}` - Errors by type (Counter)
- `zion_pool_active_miners{algorithm}` - Active miners (Gauge)
- `zion_pool_hashrate{algorithm}` - Pool hashrate H/s (Gauge)
- `zion_pool_difficulty{algorithm}` - Pool difficulty (Gauge)
- `zion_pool_pending_balance` - Pending payouts (Gauge)
- `zion_pool_connected_miners` - Connected count (Gauge)
- `zion_pool_banned_ips` - Banned IPs (Gauge)
- `zion_pool_share_processing_seconds` - Processing time (Histogram)
- `zion_pool_block_time_seconds` - Time between blocks (Histogram)
- `zion_pool_consciousness_level{address, level_name}` - Miner consciousness (Gauge)
- `zion_pool_consciousness_multiplier{address}` - Mining multiplier (Gauge)
- `zion_pool_meditation_sessions_total{address}` - Meditation sessions (Counter)

**Metrics Server:**
- Runs on port `9090` (configurable)
- Endpoint: `http://localhost:9090/metrics`
- Auto-starts with pool

### 2. **Grafana Dashboard** ✅
Created professional dashboard: `config/grafana-dashboard-zion-pool.json`

**Panels:**
1. 🚀 Pool Hashrate by Algorithm (line chart)
2. 👷 Connected Miners (gauge)
3. ⛏️ Miners by Algorithm (donut chart)
4. 🎉 Blocks Found (stat)
5. 📊 Share Submission Rate (line chart)
6. ✅ Share Acceptance Rate (gauge)
7. 💰 Pending Payouts (stat)
8. ⚡ Share Processing Time (histogram)
9. ⏱️ Block Discovery Time (histogram)
10. 🚫 Banned IPs (stat)
11. ⚠️ Error Rate (stat)

**Features:**
- Auto-refresh every 10 seconds
- Last 1 hour time window (adjustable)
- Dark theme
- PromQL queries optimized

### 3. **Discord Alerting System** ✅
Created `zion_pool_alerting.py` with real-time monitoring:

**Alerts:**
- ⚠️ Hashrate drop > 50%
- 🚫 No blocks found in 24 hours
- 💔 No shares submitted in 10 minutes
- 🔥 High error rate (>10 errors/min)
- 💾 Database health issues
- 👷 Low miner count (< 1)

**Features:**
- 5-minute cooldown between same alerts
- Startup notification
- Rich embeds with current stats
- Color-coded severity (red/orange/yellow/green)

---

## 🚀 Setup Instructions

### Step 1: Install Dependencies

```bash
cd /Users/yeshuae/Desktop/ZION/Zion-TestNet-2.7.5-github
source .venv/bin/activate
pip install prometheus_client aiohttp
```

### Step 2: Configure Discord Webhook

1. Create Discord webhook:
   - Open your Discord server
   - Go to Server Settings → Integrations → Webhooks
   - Click "New Webhook"
   - Name it "ZION Pool Monitor"
   - Copy webhook URL

2. Add to `seednodes.py`:
```python
# In ZionNetworkConfig.POOL_CONFIG
POOL_CONFIG = {
    # ... existing config ...
    'discord_webhook_url': 'https://discord.com/api/webhooks/YOUR_WEBHOOK_ID/YOUR_TOKEN',
    'prometheus_port': 9090,
}
```

### Step 3: Install Prometheus

**macOS:**
```bash
brew install prometheus
```

**Ubuntu:**
```bash
sudo apt-get update
sudo apt-get install prometheus
```

**Configure Prometheus:**
Edit `/opt/homebrew/etc/prometheus.yml` (macOS) or `/etc/prometheus/prometheus.yml` (Linux):

```yaml
global:
  scrape_interval: 15s

scrape_configs:
  - job_name: 'zion_pool'
    static_configs:
      - targets: ['localhost:9090']
        labels:
          pool: 'zion_testnet'
```

**Start Prometheus:**
```bash
# macOS
brew services start prometheus

# Linux
sudo systemctl start prometheus
sudo systemctl enable prometheus
```

Prometheus UI: http://localhost:9090

### Step 4: Install Grafana

**macOS:**
```bash
brew install grafana
brew services start grafana
```

**Ubuntu:**
```bash
sudo apt-get install -y software-properties-common
sudo add-apt-repository "deb https://packages.grafana.com/oss/deb stable main"
wget -q -O - https://packages.grafana.com/gpg.key | sudo apt-key add -
sudo apt-get update
sudo apt-get install grafana
sudo systemctl start grafana-server
sudo systemctl enable grafana-server
```

**Access Grafana:**
- URL: http://localhost:3000
- Default login: `admin` / `admin`

### Step 5: Import ZION Dashboard

1. Login to Grafana
2. Go to Dashboards → Import
3. Click "Upload JSON file"
4. Select `config/grafana-dashboard-zion-pool.json`
5. Select Prometheus data source
6. Click "Import"

**Or via CLI:**
```bash
# Copy dashboard to Grafana
sudo cp config/grafana-dashboard-zion-pool.json /var/lib/grafana/dashboards/

# Configure provisioning (create if doesn't exist)
sudo cat > /etc/grafana/provisioning/dashboards/zion.yaml <<EOF
apiVersion: 1

providers:
  - name: 'ZION Pool'
    folder: 'ZION'
    type: file
    options:
      path: /var/lib/grafana/dashboards
EOF

sudo systemctl restart grafana-server
```

### Step 6: Start Pool with Monitoring

```bash
cd /Users/yeshuae/Desktop/ZION/Zion-TestNet-2.7.5-github
source .venv/bin/activate
python3 zion_unified.py
```

**Check Metrics:**
```bash
curl http://localhost:9090/metrics
```

**Expected output:**
```
# HELP zion_pool_info ZION Mining Pool Information
# TYPE zion_pool_info gauge
zion_pool_info{consciousness_mining="enabled",name="ZION Universal Pool",version="2.7.5"} 1.0
# HELP zion_pool_shares_total Total shares submitted
# TYPE zion_pool_shares_total counter
zion_pool_shares_total{algorithm="randomx",status="valid"} 1234.0
...
```

---

## 📊 Dashboard Access URLs

| Service | URL | Credentials |
|---------|-----|-------------|
| **Prometheus** | http://localhost:9090 | N/A |
| **Grafana** | http://localhost:3000 | admin/admin |
| **Pool Metrics** | http://localhost:9090/metrics | N/A |
| **Pool API** | http://localhost:11112/api/stats | N/A |

---

## 🔔 Testing Discord Alerts

**Manual test alert:**
```python
# Add this to test alerting
from zion_pool_alerting import ZionPoolAlerting, AlertConfig

config = AlertConfig(
    discord_webhook_url='YOUR_WEBHOOK_URL'
)
alerting = ZionPoolAlerting(pool, config)

# Send test alert
await alerting.send_discord_alert(
    "Test Alert",
    "This is a test notification from ZION Pool",
    color=0x00ff00
)
```

---

## 📈 Monitoring Best Practices

### 1. **Key Metrics to Watch:**
- **Pool Hashrate:** Should be stable, sudden drops indicate miner issues
- **Share Acceptance Rate:** Should be > 95%, lower indicates validation problems
- **Block Discovery Time:** Track for difficulty adjustment needs
- **Connected Miners:** Monitor for sudden disconnections

### 2. **Alert Response:**
- **Hashrate Drop:** Check miner logs, network connectivity
- **No Blocks:** May need difficulty adjustment
- **High Errors:** Check pool logs for recurring issues
- **Database Errors:** Check disk space, backup database

### 3. **Regular Maintenance:**
- Review Grafana dashboards daily
- Check Discord alerts channel
- Backup `zion_pool.db` weekly
- Monitor Prometheus disk usage

---

## 🐛 Troubleshooting

### Prometheus not scraping?
```bash
# Check Prometheus targets
open http://localhost:9090/targets

# If down, check pool metrics endpoint
curl http://localhost:9090/metrics
```

### Grafana dashboard empty?
1. Check Prometheus data source is configured
2. Verify pool is running and exposing metrics
3. Check PromQL queries in panel settings

### Discord alerts not working?
1. Verify webhook URL is correct in `seednodes.py`
2. Check pool logs for alerting errors
3. Test webhook manually:
```bash
curl -X POST YOUR_WEBHOOK_URL \
  -H "Content-Type: application/json" \
  -d '{"content": "Test from ZION Pool"}'
```

---

## 📁 Files Modified/Created

### Created:
- `config/grafana-dashboard-zion-pool.json` - Grafana dashboard
- `zion_pool_alerting.py` - Discord alerting system
- `docs/DAY2_MONITORING_SETUP.md` - This file

### Modified:
- `zion_universal_pool_v2.py`:
  - Added Prometheus metrics (lines 15-68)
  - Metrics server initialization (line 680)
  - Share metrics tracking (line 1455)
  - Connection metrics (line 1160)
  - Block metrics (line 924)
  - Periodic metrics update (line 2098)
  - Alerting integration (line 2183)

---

## ✅ Day 2 Completion Checklist

- [x] Prometheus metrics implemented in pool
- [x] Metrics server running on port 9090
- [x] Grafana dashboard created (11 panels)
- [x] Discord webhook alerting system
- [x] Alert cooldowns and thresholds configured
- [x] Startup notifications implemented
- [x] Documentation completed

---

## 🎯 Next Steps (Day 3)

According to `DALSI_POSTUP_VYVOJE.md`:
1. Write consciousness mining MVP (`consciousness_miner.py`)
2. Create meditation timer UI (React component)
3. Test karma multiplier calculation

**Ready to continue?** Let me know when you want to start Day 3! 🚀
