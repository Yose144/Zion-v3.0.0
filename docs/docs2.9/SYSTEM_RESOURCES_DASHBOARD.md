# System Resources Dashboard & Node Exporter Setup Guide

## 📋 Overview

The System Resources Dashboard provides real-time monitoring of server infrastructure: CPU, memory, disk, network, and Docker container metrics. Uses Prometheus `node-exporter` to collect system-level metrics.

**Status:** ✅ Dashboard JSON created | ⚙️ Node-exporter installation needed (optional but recommended)

---

## 🎯 Metrics Collected

### CPU Metrics
- CPU Usage % (aggregate)
- CPU per core
- CPU context switches
- CPU interrupts

### Memory Metrics
- Total memory
- Available memory
- Used memory %
- Buffered/Cached memory

### Disk Metrics
- Disk usage % (per filesystem)
- Disk read/write bytes per second
- Disk I/O operations per second
- Inode usage

### Network Metrics
- RX bytes/sec (received)
- TX bytes/sec (transmitted)
- Network errors/dropped packets
- TCP/UDP connection counts

### System Metrics
- Load average (1m, 5m, 15m)
- Uptime
- Process count (running/sleeping)
- Open file descriptors
- Socket statistics

### Docker Metrics
- Container memory usage
- Container CPU usage
- Container network I/O
- Container restart count

---

## 🚀 Installation & Setup

### Option 1: Docker-based Node Exporter (Recommended)

**Add to `docker-compose-v2.9-production.yml`:**

```yaml
node-exporter:
  image: prom/node-exporter:latest
  container_name: zion-node-exporter
  ports:
    - "9100:9100"
  volumes:
    - /proc:/host/proc:ro
    - /sys:/host/sys:ro
    - /:/rootfs:ro
  command:
    - --path.procfs=/host/proc
    - --path.rootfs=/rootfs
    - --path.sysfs=/host/sys
    - --collector.filesystem.mount-points-exclude=^/(sys|proc|dev|host|etc)($$|/)
  expose:
    - 9100
  networks:
    - zion-internal
  restart: always
```

**Deploy:**
```bash
docker compose up -d node-exporter
```

**Verify:**
```bash
curl http://localhost:9100/metrics | head -20
```

### Option 2: System-level Installation

**On Ubuntu/Debian:**
```bash
apt-get update
apt-get install -y prometheus-node-exporter
systemctl start prometheus-node-exporter
systemctl enable prometheus-node-exporter
```

**Verify:**
```bash
curl http://localhost:9100/metrics | head -20
```

---

## 🔄 Prometheus Configuration

### Add Node Exporter Target

**File:** `/etc/prometheus/prometheus.yml`

```yaml
scrape_configs:
  - job_name: 'node-exporter'
    static_configs:
      - targets: ['localhost:9100']
    scrape_interval: 30s
    scrape_timeout: 10s
```

**For Docker:**
```yaml
scrape_configs:
  - job_name: 'node-exporter'
    static_configs:
      - targets: ['node-exporter:9100']
    scrape_interval: 30s
```

**Reload Prometheus:**
```bash
curl -X POST http://localhost:9090/-/reload
```

---

## 📊 Dashboard Setup

### Import Dashboard into Grafana

**Manual Import:**
1. Open Grafana: http://91.98.122.165:3000
2. Navigate to: Dashboard → Import
3. Upload JSON: `monitoring/grafana/dashboards/system-resources.json`
4. Select data source: Prometheus
5. Click Import

**Via API:**
```bash
curl -X POST http://localhost:3000/api/dashboards/db \
  -H "Content-Type: application/json" \
  -d @monitoring/grafana/dashboards/system-resources.json
```

### Default Dashboard Panels

1. **CPU Usage %** - Real-time CPU utilization
2. **Memory Usage %** - RAM utilization trend
3. **Disk Usage %** - Root filesystem usage
4. **Disk I/O** - Read/write throughput
5. **Network Traffic** - RX/TX rates
6. **Load Average** - 1m/5m/15m load trends
7. **Docker Container Stats** - Per-container memory usage
8. **Uptime** - Server uptime counter
9. **Process Count** - Running process count
10. **Open Files** - File descriptor usage
11. **TCP Connections** - Active TCP connection count

---

## 🔔 Alerting Rules

### CPU Alert (Grafana)

Add to `monitoring/prometheus/rules/zion.rules.yml`:

```yaml
- alert: ZIONHighCPU
  expr: 100 * (1 - avg(rate(node_cpu_seconds_total{mode="idle"}[5m]))) > 80
  for: 5m
  labels:
    severity: warning
  annotations:
    summary: "High CPU usage detected ({{ $value | humanizePercentage }})"
    description: "{{ $labels.instance }} CPU is above 80% for last 5 minutes"
```

### Memory Alert

```yaml
- alert: ZIONHighMemory
  expr: 100 * (1 - (node_memory_MemAvailable_bytes / node_memory_MemTotal_bytes)) > 85
  for: 5m
  labels:
    severity: warning
  annotations:
    summary: "High memory usage detected ({{ $value | humanizePercentage }})"
```

### Disk Alert

```yaml
- alert: ZIONLowDiskSpace
  expr: 100 * (node_filesystem_avail_bytes / node_filesystem_size_bytes) < 15
  for: 10m
  labels:
    severity: critical
  annotations:
    summary: "Low disk space on {{ $labels.mountpoint }}"
    description: "Only {{ $value | humanizePercentage }} disk space remaining"
```

---

## 📈 Sample Queries (PromQL)

### CPU Queries
```promql
# CPU Usage %
100 * (1 - avg(rate(node_cpu_seconds_total{mode="idle"}[5m])))

# CPU per core
rate(node_cpu_seconds_total{mode="system"}[1m]) * 100

# Context switches per second
rate(node_context_switches_total[1m])
```

### Memory Queries
```promql
# Memory usage %
100 * (1 - (node_memory_MemAvailable_bytes / node_memory_MemTotal_bytes))

# Available memory (GB)
node_memory_MemAvailable_bytes / 1024 / 1024 / 1024

# Cache hit ratio
node_memory_Cached_bytes / node_memory_MemTotal_bytes
```

### Disk Queries
```promql
# Disk usage %
100 * (node_filesystem_avail_bytes / node_filesystem_size_bytes)

# Read throughput (MB/s)
rate(node_disk_read_bytes_total[1m]) / 1024 / 1024

# Disk I/O operations per second
rate(node_disk_reads_completed_total[1m])
```

### Network Queries
```promql
# RX throughput (MB/s)
rate(node_network_receive_bytes_total[1m]) / 1024 / 1024

# TX throughput (MB/s)
rate(node_network_transmit_bytes_total[1m]) / 1024 / 1024

# Total network errors
increase(node_network_receive_errs_total[1m])
```

---

## 🔍 Troubleshooting

### Node Exporter Not Responding

**Check if running:**
```bash
curl http://localhost:9100/metrics 2>&1 | head -5
```

**Expected output:**
```
# HELP node_cpu_seconds_total Seconds the CPUs spent in each mode.
# TYPE node_cpu_seconds_total counter
node_cpu_seconds_total{cpu="0",mode="idle"} 1234567.89
```

**If not responding:**
```bash
# Docker
docker logs zion-node-exporter

# System service
systemctl status prometheus-node-exporter
journalctl -u prometheus-node-exporter -n 20
```

### Metrics Not Appearing in Prometheus

**Verify target is UP:**
```bash
curl -s http://localhost:9090/api/v1/targets | grep node-exporter
```

**Expected:** `"health": "up"`

**If DOWN:**
1. Check node-exporter is running: `docker ps | grep node-exporter`
2. Check port binding: `netstat -tlnp | grep 9100`
3. Check firewall: `ufw status`

### Missing Metrics

**Check available metrics:**
```bash
curl http://localhost:9100/metrics | grep 'node_' | head -20
```

**Common missing metrics:**
- CPU: Check `--collector.cpu` flag
- Disk: Check `--collector.filesystem` flag
- Network: Check `--collector.netdev` flag

---

## 📋 Implementation Checklist

- [ ] Node-exporter installed/running on port 9100
- [ ] Prometheus configured to scrape node-exporter
- [ ] Prometheus target shows as UP
- [ ] Dashboard JSON imported into Grafana
- [ ] Dashboard displays all 11 panels
- [ ] Alerting rules configured (optional)
- [ ] Test dashboard with `localhost:9100/metrics`
- [ ] Verify metrics flowing into Prometheus

---

## 🔐 Security Notes

### Network Access
- Node-exporter should only be accessible from Prometheus
- Use firewall rules to restrict port 9100

**Example UFW rule:**
```bash
ufw allow from 172.29.0.0/16 to any port 9100  # Docker network
```

### Sensitive Data
Node-exporter exposes system metrics that could be used for reconnaissance:
- CPU/Memory/Disk capacity
- Network configuration
- Process names

**Recommendation:** Only expose metrics internally, not to internet.

---

## 📞 Support

### Verify Installation
```bash
# Check node-exporter version
curl http://localhost:9100/metrics | grep 'node_exporter_build_info'

# Check collection time
curl http://localhost:9100/metrics | grep 'scrape_duration_seconds'

# List all available metrics
curl http://localhost:9100/metrics | grep '^node_' | awk '{print $1}' | sort | uniq
```

### Debug Dashboard Issues
1. Check Prometheus data source is configured
2. Verify time range includes data collection period
3. Test individual queries in Prometheus UI
4. Check browser console for JavaScript errors

---

**Last Updated:** 18 Dec 2025 | **Status:** ✅ Ready for deployment | **Metrics:** 50+ available
