# ZION v2.9 Backup Automation Guide

## 📋 Overview

Automated daily backup system for ZION v2.9 production stack with 30-day retention and integrity verification.

**Status:** ✅ Active | **Schedule:** 02:00 UTC daily | **Retention:** 30 days rolling

---

## 🎯 What Gets Backed Up

### 1. **Blockchain Data** (~30-50 MB)
- Complete blockchain state from `zion-v29_blockchain-data` volume
- Includes: blocks, chain state, genesis data
- Recovery: Full node restoration point

### 2. **Pool Database** (~5-10 MB)
- Mining pool SQLite database
- Includes: miner sessions, share history, block records
- Recovery: Pool state and statistics

### 3. **Prometheus Data** (~2-5 GB, compressed to ~100-200 MB)
- Time-series metrics database
- Includes: 30 days of pool, blockchain, API metrics
- Recovery: Historical monitoring data, alert rules

### 4. **Grafana Dashboards & Config** (~20-50 MB)
- Dashboard definitions, data source configs
- Includes: all custom dashboards (pool, blockchain, system)
- Recovery: Restore monitoring visualization setup

### 5. **Configuration Files** (~1 MB)
- `config/*.json` directory
- Includes: pool config, blockchain config, API settings
- Recovery: Service configuration state

### 6. **Docker Compose Stack** (~50 KB)
- `docker-compose-v2.9-production.yml`
- `monitoring/` directory (prometheus.yml, alert rules)
- Recovery: Full service orchestration setup

---

## 📊 Backup Statistics

| Component | Size (Raw) | Compressed | Interval |
|-----------|-----------|-----------|----------|
| Blockchain | 30-50 MB | 10-15 MB | Daily @ 2 AM |
| Pool DB | 5-10 MB | 2-3 MB | Daily @ 2 AM |
| Prometheus | 2-5 GB | 100-200 MB | Daily @ 2 AM |
| Grafana | 20-50 MB | 5-10 MB | Daily @ 2 AM |
| Configs | 1-2 MB | <1 MB | Daily @ 2 AM |
| Compose | 50 KB | <50 KB | Daily @ 2 AM |
| **Total** | **~2.5-5.5 GB** | **~120-230 MB** | **Daily** |

**Storage Required:** ~7 GB for 30-day rolling window (30 × 230 MB)

---

## 🔧 Script Details

**Location:** `/root/zion-v2.9/scripts/backup-zion-v2.9.sh`

**Key Features:**
- ✅ Atomic backups using Docker volume mounts
- ✅ Compression with gzip (tar.gz format)
- ✅ Integrity verification before retention
- ✅ Automatic rotation (deletes backups older than 30 days)
- ✅ Structured logging to `/var/log/zion-backup.log`
- ✅ Error handling with email alerts (requires mail configured)

**Backup Naming Convention:**
```
zion-backup-20251218_232255.tar.gz
                ├─ Date: 2025-12-18
                └─ Time: 23:22:55 UTC
```

---

## ⏰ Cron Configuration

**Schedule:** Daily at 02:00 UTC

```bash
0 2 * * * /root/zion-v2.9/scripts/backup-zion-v2.9.sh >> /var/log/zion-backup.log 2>&1
```

**View Configured Cron Jobs:**
```bash
ssh root@91.98.122.165 "crontab -l | grep backup"
```

**Expected Output:**
```
0 2 * * * /root/zion-v2.9/scripts/backup-zion-v2.9.sh >> /var/log/zion-backup.log 2>&1
```

---

## 📁 Backup Directory Structure

```
/root/zion-v2.9/backups/
├── zion-backup-20251218_020000.tar.gz  (41 MB)
├── zion-backup-20251217_020000.tar.gz  (41 MB)
├── zion-backup-20251216_020000.tar.gz  (41 MB)
└── ... (up to 30 most recent days)
```

**Monitor Backup Directory:**
```bash
# Check disk usage
du -sh /root/zion-v2.9/backups

# List recent backups
ls -lh /root/zion-v2.9/backups | tail -10

# Count backups
ls /root/zion-v2.9/backups/zion-backup-*.tar.gz | wc -l
```

---

## 🔍 Viewing Backup Logs

**Real-time Monitoring:**
```bash
tail -f /var/log/zion-backup.log
```

**View Last 50 Backup Entries:**
```bash
tail -50 /var/log/zion-backup.log
```

**Search for Errors:**
```bash
grep ERROR /var/log/zion-backup.log
```

**Sample Log Output:**
```
[2025-12-18 23:22:55] ====== ZION v2.9 Backup Start ======
[2025-12-18 23:22:55] Backup destination: /root/zion-v2.9/backups/zion-backup-20251218_232255.tar.gz
[2025-12-18 23:22:55] Staging backup in: /tmp/tmp.sFtoiyoxyu
[2025-12-18 23:22:56] Backing up blockchain data...
[2025-12-18 23:22:58] ✓ Blockchain data backed up
[2025-12-18 23:23:00] ✓ Pool database backed up
[2025-12-18 23:23:01] ✓ Prometheus data backed up
[2025-12-18 23:23:10] ✓ Grafana dashboards backed up
[2025-12-18 23:23:10] ✓ Configuration files backed up
[2025-12-18 23:23:12] ✓ Backup archive created: 41M
[2025-12-18 23:23:13] ====== ZION v2.9 Backup Complete ======
```

---

## 🚨 Manual Backup Execution

**Trigger Immediate Backup (outside cron schedule):**
```bash
ssh root@91.98.122.165 "/root/zion-v2.9/scripts/backup-zion-v2.9.sh"
```

**Run with Custom Output:**
```bash
ssh root@91.98.122.165 "/root/zion-v2.9/scripts/backup-zion-v2.9.sh 2>&1 | tee /tmp/backup-manual.log"
```

---

## 🔐 Backup Recovery

### Quick Verification

**Verify Backup Integrity:**
```bash
ssh root@91.98.122.165 "tar -tzf /root/zion-v2.9/backups/zion-backup-20251218_232255.tar.gz | head -20"
```

**List Backup Contents:**
```bash
ssh root@91.98.122.165 "tar -tzf /root/zion-v2.9/backups/zion-backup-20251218_232255.tar.gz | grep -E '(blockchain|pool|prometheus|grafana)' | head -30"
```

### Full Recovery Process

**Step 1: Stop Services**
```bash
ssh root@91.98.122.165 "cd /root/zion-v2.9 && docker compose stop"
```

**Step 2: Extract Backup**
```bash
ssh root@91.98.122.165 "cd /tmp && tar -xzf /root/zion-v2.9/backups/zion-backup-20251218_232255.tar.gz"
```

**Step 3: Restore Volumes** (Example for blockchain)
```bash
ssh root@91.98.122.165 "docker run --rm \
  -v zion-v29_blockchain-data:/restore \
  -v /tmp/blockchain-data:/backup \
  alpine:latest \
  tar xzf /backup/blockchain-data.tar.gz -C /restore"
```

**Step 4: Restart Services**
```bash
ssh root@91.98.122.165 "cd /root/zion-v2.9 && docker compose up -d"
```

**Step 5: Verify Recovery**
```bash
ssh root@91.98.122.165 "docker compose ps"
```

---

## 📈 Backup Retention Policy

**Default:** 30-day rolling window

**Current Backups:**
```bash
ssh root@91.98.122.165 "ls -lh /root/zion-v2.9/backups/zion-backup-*.tar.gz | wc -l"
```

**Manual Cleanup (Remove backups older than 30 days):**
```bash
ssh root@91.98.122.165 "find /root/zion-v2.9/backups -name 'zion-backup-*.tar.gz' -mtime +30 -delete"
```

**Modify Retention Policy:**

Edit `backup-zion-v2.9.sh`:
```bash
RETENTION_DAYS=60  # Change from 30 to 60 days
```

---

## 🔔 Monitoring & Alerts

### Email Alerts (Optional)

Script supports email notifications for backup failures. To enable:

1. **Install Mail Utility:**
   ```bash
   apt-get install mailutils
   ```

2. **Set Alert Email:**
   ```bash
   ssh root@91.98.122.165 "sed -i 's/admin@zionterranova.com/YOUR_EMAIL@example.com/g' /root/zion-v2.9/scripts/backup-zion-v2.9.sh"
   ```

### Prometheus Monitoring

**Alert for Backup Failure:** Add to `monitoring/prometheus/rules/zion.rules.yml`:

```yaml
- alert: ZIONBackupMissing
  expr: time() - max(zion_backup_timestamp) > 86400
  for: 1h
  labels:
    severity: critical
  annotations:
    summary: "No ZION backup in last 24 hours"
    description: "Backup script may have failed. Check /var/log/zion-backup.log"
```

---

## 🌐 Remote Backup Upload (Optional)

To enable automatic upload to remote storage (S3, FTP, etc.):

1. Set environment variable:
   ```bash
   export BACKUP_REMOTE_URL="https://backup-api.example.com/upload"
   ```

2. Add to cron:
   ```bash
   0 2 * * * BACKUP_REMOTE_URL="https://..." /root/zion-v2.9/scripts/backup-zion-v2.9.sh
   ```

Script will automatically POST backup to remote URL if available.

---

## 📝 Troubleshooting

### Backup Fails with "Volume not found"
- Verify Docker volumes exist: `docker volume ls | grep zion-v29`
- Ensure Docker daemon is running: `docker ps`
- Check volume names in `docker-compose-v2.9-production.yml`

### Backup Takes Too Long
- Expected time: 15-30 seconds
- If longer, check disk I/O: `iostat -x 1 5`
- Verify network: `ping -c 1 8.8.8.8`

### Disk Space Running Low
- Check backup disk usage: `du -sh /root/zion-v2.9/backups`
- Reduce retention: `RETENTION_DAYS=14`
- Compress further or delete old backups manually

### Restore Fails
- Verify backup integrity: `tar -tzf backup.tar.gz >/dev/null`
- Check available disk space: `df -h`
- Ensure volumes are stopped before restoring
- Check Docker logs: `docker logs <container>`

---

## ✅ Verification Checklist

- [ ] Backup script deployed at `/root/zion-v2.9/scripts/backup-zion-v2.9.sh`
- [ ] Script is executable: `ls -l /root/zion-v2.9/scripts/backup-zion-v2.9.sh`
- [ ] Cron job configured: `crontab -l | grep backup`
- [ ] Backup directory exists: `ls -ld /root/zion-v2.9/backups`
- [ ] Log file exists: `ls -l /var/log/zion-backup.log`
- [ ] Manual test successful: Check logs in `/var/log/zion-backup.log`
- [ ] Backups created: `ls /root/zion-v2.9/backups/zion-backup-*.tar.gz`

---

## 📞 Support

For backup issues, check:
1. `/var/log/zion-backup.log` for detailed error messages
2. Cron job status: `systemctl status cron`
3. Docker daemon: `systemctl status docker`
4. Disk space: `df -h /root/zion-v2.9/backups`

---

**Last Updated:** 18 Dec 2025 | **Status:** ✅ Operational
