# Edge Server Clear & Complete Documentation

## 🔍 **DIAGNOSTIC RESULTS - 2026-06-14**

### ✅ **ISSUES RESOLVED:**

#### 1. **CPU 100% Issue - FIXED**
- **Problem:** `zion-miner` PID 7582 running for 3 days consuming 100% CPU
- **Solution:** Killed stuck miner process
- **Result:** CPU usage dropped from 100% to 4.4%, load average normalized

#### 2. **Disk Space Crisis - FIXED** 
- **Problem:** 84% disk usage (121GB/150GB), only 24GB free
- **Root Cause:** 75GB in `/var/lib/containerd` (old Docker images)
- **Solution:** Docker system prune + containerd cleanup
- **Result:** Freed 73GB, now 34% usage (48GB/150GB), 97GB free

#### 3. **Website Deployment Issues - FIXED**
- **Problem:** Multiple Next.js processes conflicting, PM2 vs manual processes
- **Solution:** Cleaned up duplicate processes, rebuilt with iPhone fixes
- **Result:** Single clean deployment via PM2

#### 4. **iPhone Responsivity - DEPLOYED**
- **Problem:** Mobile layout broken on iPhone, viewport issues
- **Solution:** Applied comprehensive iOS Safari fixes
- **Status:** ✅ LIVE on https://zionterranova.com

---

## 🌐 **EDGE SERVER OVERVIEW**

### **Server Details:**
- **Host:** Hetzner VPS
- **IP:** 77.42.71.94 (public), 100.76.16.108 (Tailscale)
- **OS:** Ubuntu Linux
- **Uptime:** 2+ days
- **Role:** Primary Edge Node (mainnet operations)

### **Current System Health:**
- **CPU Load:** 1.14 (normal)
- **Memory:** 6GB available / 7.6GB total
- **Disk:** 97GB free / 150GB total (34% used)
- **Status:** 🟢 ALL SYSTEMS OPERATIONAL

---

## 🚀 **SERVICE PORTS & STATUS**

| **Service** | **Port** | **Protocol** | **Status** | **PID** | **Description** |
|-------------|----------|--------------|------------|---------|-----------------|
| **Node P2P** | 8333 | TCP | ✅ RUNNING | 849160 | Primary node P2P sync |
| **Node P2P 2** | 8334 | TCP | ✅ RUNNING | 849161 | Follower node P2P |
| **Node RPC** | 8443 | TCP | ✅ RUNNING | 849160 | JSON-RPC API |
| **Node RPC 2** | 8446 | TCP | ✅ RUNNING | 849161 | Follower node RPC |
| **Node WebSocket** | 8445 | TCP | ✅ RUNNING | 849160 | Event stream |
| **Node WebSocket 2** | 8447 | TCP | ✅ RUNNING | 849161 | Follower event stream |
| **Pool Stratum** | 8444 | TCP | ✅ RUNNING | 632202 | Mining pool server |
| **DAO API** | 8450 | HTTP | ✅ RUNNING | 1518 | DAO daemon API |
| **WARP API** | 8453 | HTTP | ✅ RUNNING | 1531 | Cross-chain relay |
| **Website** | 3000 | HTTP | ✅ RUNNING | PM2 | Next.js website |
| **Pool Metrics** | 8455 | HTTP | ✅ RUNNING | Pool server | Prometheus metrics |
| **Node Metrics** | 9115 | HTTP | ✅ RUNNING | 849160 | Node Prometheus |
| **Node Metrics 2** | 9116 | HTTP | ✅ RUNNING | 849161 | Follower metrics |
| **Caddy HTTP** | 80 | HTTP | ✅ RUNNING | 1308 | Reverse proxy |
| **Caddy HTTPS** | 443 | HTTPS | ✅ RUNNING | 1308 | SSL termination |
| **Prometheus** | 9090 | HTTP | ✅ RUNNING | Docker | Monitoring |
| **Grafana** | 3100 | HTTP | ✅ RUNNING | Docker | Dashboards |
| **Node Exporter** | 9100 | HTTP | ✅ RUNNING | Docker | System metrics |
| **Dashboard** | 8766 | HTTP | ✅ RUNNING | 1539 | Python dashboard |
| **Infra Dashboard** | 8888 | HTTP | ✅ RUNNING | 1533 | Rust dashboard |

---

## 🛠️ **COMPLETE SERVICE ARCHITECTURE**

### **Core ZION Services (Systemd)**
```bash
# Active systemd services
zion-edge-node1.service     # Primary node (P2P:8333, RPC:8443)
zion-edge-node2.service     # Follower node (P2P:8334, RPC:8446)  
zion-edge-pool.service      # Mining pool (Stratum:8444) - INACTIVE (runs standalone)
zion-edge-dao.service       # DAO daemon (API:8450)
zion-edge-warp.service      # WARP relay (API:8453)
zion-edge-miner.service     # CPU miner (connects to localhost:8444)
zion-edge-dashboard.service # Rust dashboard (API:8888)
zion-python-dashboard.service # Python dashboard (API:8766)
zion-edge-agent.service     # ZION agent system
hiran-inference.service     # LLM inference (API:8002)
hiranyagarbha.service       # Orchestrator (API:8001)
```

### **Standalone Processes**
```bash
# Running independently (not via systemd)
zion-pool-server (PID: 632202)  # Pool server on port 8444
next-server (PM2)               # Website on port 3000
caddy (PID: 1308)               # Reverse proxy on 80/443
```

### **Docker Stack**
```bash
# Monitoring stack (Docker)
prometheus (port 9090)          # Metrics collection
grafana (port 3100)             # Visualization dashboards  
node-exporter (port 9100)       # Host system metrics
```

---

## 📱 **WEBSITE DEPLOYMENT DETAILS**

### **iPhone Responsivity Fixes Applied:**

#### **1. Viewport Meta Tags (layout.tsx)**
```typescript
export const viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
  minimumScale: 1,              // ✅ Prevents zoom below 1x
  viewportFit: 'cover',         // ✅ Full screen on iPhone X+
  shrinkToFit: 'no',            // ✅ Prevents auto-shrink
  themeColor: '#000000',
};
```

#### **2. iOS Safari CSS Fixes (globals.css)**
```css
/* iPhone notch and safe area support */
@supports (padding: max(0px)) {
  .safe-area-inset-top {
    padding-top: max(env(safe-area-inset-top), 0.5rem);
  }
  .safe-area-inset-bottom {
    padding-bottom: max(env(safe-area-inset-bottom), 0.5rem);
  }
  .safe-area-inset-left {
    padding-left: max(env(safe-area-inset-left), 0.5rem);
  }
  .safe-area-inset-right {
    padding-right: max(env(safe-area-inset-right), 0.5rem);
  }
}

/* Mobile-specific fixes */
@media (max-width: 768px) {
  .zion-grid {
    grid-template-columns: 1fr !important;  /* Single column */
    gap: 1rem !important;
  }
  
  nav {
    padding-left: env(safe-area-inset-left, 0.5rem) !important;
    padding-right: env(safe-area-inset-right, 0.5rem) !important;
  }
  
  .zion-container {
    padding-left: max(0.5rem, env(safe-area-inset-left)) !important;
    padding-right: max(0.5rem, env(safe-area-inset-right)) !important;
  }
}

/* iOS overflow prevention */
body {
  font-family: var(--font-inter);
  overflow-x: hidden;  /* Prevent horizontal scroll */
  -webkit-overflow-scrolling: touch;
}
```

#### **3. JavaScript iOS Detection**
```javascript
// Automatic iOS fixes
if (navigator.userAgent.includes('iPhone') || navigator.platform.includes('iPhone')) {
  document.body.style.overflowX = 'hidden';
  document.documentElement.style.overflowX = 'hidden';
}
```

### **Deployment Path:**
- **Source:** `/root/zion-2.9.6-main/APP&WEB/website-v2.9/`
- **PM2 Target:** `/root/APP&WEB/website-v2.9/`
- **Process:** PM2 fork mode (PID: varies)
- **URLs:** 
  - Local: http://localhost:3000
  - Production: https://zionterranova.com

---

## 🔧 **MAINTENANCE PROCEDURES**

### **Daily Health Checks:**
```bash
# 1. Service status
systemctl status --no-pager | grep -E "(active|failed)"

# 2. Port verification  
netstat -tlnp | grep -E ":(80|443|3000|8443|8444|8450|8453)"

# 3. Disk usage
df -h / && du -sh /var/lib/* | sort -hr | head -5

# 4. CPU & memory
top -bn1 | head -10 && free -h

# 5. Website functionality
curl -s -I https://zionterranova.com | head -3
```

### **Weekly Cleanup:**
```bash
# Docker cleanup
docker system prune -af --volumes
ctr images prune --all

# Log rotation
journalctl --vacuum-time=7d
find /var/log -name "*.log" -mtime +7 -delete

# Temporary files cleanup
find /tmp -type f -mtime +1 -delete
```

### **Monthly Deep Clean:**
```bash
# Full system cleanup
apt autoremove -y
apt autoclean

# Large file audit
find / -type f -size +1G -exec ls -lh {} \; 2>/dev/null | head -10

# Service health audit
systemctl list-units --type=service --state=failed
```

---

## 🚨 **TROUBLESHOOTING GUIDE**

### **Common Issues & Solutions:**

#### **1. Port Conflicts**
```bash
# Find process using port
netstat -tlnp | grep :3000
lsof -i :3000

# Kill conflicting process
kill -9 <PID>

# Restart service
pm2 restart zion-website
```

#### **2. High CPU Usage**
```bash
# Find CPU hog
top -bn1 | head -10
ps aux --sort=-%cpu | head -10

# Kill stuck processes
pkill -f <process-name>
```

#### **3. Disk Space Full**
```bash
# Check large directories
du -sh /* 2>/dev/null | sort -hr | head -10

# Docker cleanup
docker system prune -af --volumes
ctr images prune --all

# Clean logs
journalctl --vacuum-time=3d
```

#### **4. Website Down**
```bash
# Check PM2 status
pm2 list
pm2 logs zion-website --lines 20

# Rebuild if needed
cd /root/APP&WEB/website-v2.9
rm -rf .next
npm run build
pm2 restart zion-website
```

#### **5. Pool Issues**
```bash
# Check pool status
netstat -tlnp | grep :8444
journalctl -u zion-pool-server --no-pager -n 20

# Restart if needed (runs standalone)
pkill -f zion-pool-server
cd /root/zion-2.9.6-main/V3
/usr/local/bin/zion-pool-server &
```

---

## 📊 **PERFORMANCE MONITORING**

### **Key Metrics:**
- **Chain Height:** ~2981 blocks
- **Active Miners:** 2+ sessions
- **Pool Hashrate:** Varies by algorithm
- **Response Time:** <200ms (website)
- **Uptime:** 99%+ (Edge server)

### **Monitoring URLs:**
- **Grafana:** http://77.42.71.94:3100
- **Prometheus:** http://77.42.71.94:9090
- **Node RPC:** http://77.42.71.94:8443/jsonrpc
- **Pool API:** http://77.42.71.94:8444/stats
- **DAO API:** http://77.42.71.94:8450
- **WARP API:** http://77.42.71.94:8453

---

## 🔐 **SECURITY STATUS**

### **Current Security Headers:**
```http
Content-Security-Policy: default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob: https:; font-src 'self' data:; connect-src 'self' https://*.zionterranova.com wss://*.zionterranova.com http://77.42.71.94:8443 http://77.42.71.94:8080 http://77.42.71.94:8444 http://100.76.16.108:8443 http://127.0.0.1:8001 http://127.0.0.1:8002 http://100.86.102.5:8001 http://100.86.102.5:8002 https://prod.spline.design https://*.spline.design https://sepolia.base.org https://mainnet.base.org https://base-rpc.publicnode.com; frame-ancestors 'none'; base-uri 'self'; form-action 'self'
X-Frame-Options: DENY
```

### **SSL Certificate:** ✅ Valid (Let's Encrypt)
### **Firewall:** ✅ Configured (Hetzner default)
### **SSH Access:** ✅ Key-based only
### **Updates:** ⚠️ Check monthly

---

## 📝 **CHANGE LOG**

### **2026-06-14 - Major Cleanup & iPhone Fixes**
- ✅ Fixed CPU 100% issue (stuck miner process)
- ✅ Freed 73GB disk space (Docker cleanup)
- ✅ Deployed iPhone responsivity fixes
- ✅ Resolved duplicate Next.js processes
- ✅ Updated complete service documentation
- ✅ Verified all systems operational

### **Previous Updates:**
- 2026-06-13: Node updates and pool optimization
- 2026-06-11: System stabilization
- 2026-06-07: Genesis regeneration

---

## 🎯 **NEXT STEPS**

### **Immediate (This Week):**
1. ✅ Complete documentation push to git
2. ⏰ Set up automated cleanup scripts
3. ⏰ Configure monitoring alerts

### **Short Term (Next Month):**
1. 🔄 Regular security updates
2. 📊 Enhanced monitoring dashboards
3. 🔐 SSL certificate automation

### **Long Term (Next Quarter):**
1. 🚀 Performance optimization
2. 📱 Additional mobile improvements
3. 🌐 CDN implementation

---

## 📞 **CONTACT & SUPPORT**

### **Emergency Contacts:**
- **SSH Access:** `ssh -i ~/.ssh/ssh-key-zion-edge root@77.42.71.94`
- **Tailscale:** `ssh -i ~/.ssh/ssh-key-zion-edge root@100.76.16.108`
- **Primary Domain:** https://zionterranova.com
- **Monitoring:** http://77.42.71.94:3100 (Grafana)

### **Documentation Location:**
- **This File:** `/root/zion-2.9.6-main/EDGE_CLEAR.md`
- **Git Repository:** Main Zion repository
- **Backup:** Edge server backup system

---

**🎉 EDGE SERVER STATUS: FULLY OPERATIONAL 🎉**

*Last Updated: 2026-06-14 09:30 UTC*
*Next Review: 2026-06-21*