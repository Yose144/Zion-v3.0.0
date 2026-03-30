# 🏋️ FÁZE 4: Pool Hardening — Technická Specifikace

**Priorita:** P1  
**Trvání:** 2-3 týdny  
**Owner:** Pool Lead

---

## 🎯 Cíl

Připravit mining pool na produkční zátěž:
1. Stabilita pod zátěží (100+ minerů)
2. Spolehlivé payouty
3. Ochrana proti zneužití

---

## 📋 Task Breakdown

### Task 4.1: Stress Testing Framework

**Čas:** 8h

Vytvořit `tests/stress/` framework:

```python
#!/usr/bin/env python3
"""
tests/stress/pool_stress_test.py

Simulate N concurrent miners hitting the pool.
"""

import asyncio
import random
import json
from dataclasses import dataclass

@dataclass
class StressMiner:
    id: int
    address: str
    hashrate: int  # H/s simulated
    
    async def connect(self, host: str, port: int):
        """Connect to pool via Stratum."""
        reader, writer = await asyncio.open_connection(host, port)
        self.reader = reader
        self.writer = writer
        
        # Login
        await self.send({
            "id": 1,
            "method": "mining.subscribe",
            "params": [f"StressMiner/{self.id}"]
        })
        
        response = await self.recv()
        
        await self.send({
            "id": 2,
            "method": "mining.authorize",
            "params": [self.address, "x"]
        })
        
    async def run(self, duration_seconds: int):
        """Submit shares at simulated hashrate."""
        shares_per_second = self.hashrate / 1_000_000  # assume 1M diff
        interval = 1.0 / shares_per_second if shares_per_second > 0 else 60
        
        start = asyncio.get_event_loop().time()
        shares_submitted = 0
        
        while asyncio.get_event_loop().time() - start < duration_seconds:
            # Submit share
            await self.send({
                "id": shares_submitted + 100,
                "method": "mining.submit",
                "params": [
                    self.address,
                    "job_id",
                    "nonce",
                    "hash"
                ]
            })
            shares_submitted += 1
            await asyncio.sleep(interval + random.uniform(-0.1, 0.1))
        
        return shares_submitted

async def stress_test(
    host: str,
    port: int,
    num_miners: int,
    duration_seconds: int
):
    """Run stress test with N miners."""
    miners = [
        StressMiner(
            id=i,
            address=f"zion1test{i:04d}...",
            hashrate=random.randint(100, 1000)
        )
        for i in range(num_miners)
    ]
    
    # Connect all
    await asyncio.gather(*[m.connect(host, port) for m in miners])
    
    # Run workload
    results = await asyncio.gather(*[
        m.run(duration_seconds) for m in miners
    ])
    
    total_shares = sum(results)
    print(f"Total shares: {total_shares}")
    print(f"Shares/second: {total_shares / duration_seconds}")

if __name__ == "__main__":
    asyncio.run(stress_test(
        host="localhost",
        port=3333,
        num_miners=100,
        duration_seconds=300  # 5 minutes
    ))
```

### Task 4.2: Stress Test Metrics

**Čas:** 4h

Sledované metriky během stress testu:

```yaml
# config/prometheus/pool_alerts.yml
groups:
  - name: pool_stress
    rules:
      # Share accept rate
      - alert: LowAcceptRate
        expr: pool_share_accept_rate < 0.95
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "Share accept rate below 95%"
      
      # Connection handling
      - alert: TooManyPendingConnections
        expr: pool_pending_connections > 50
        for: 1m
        labels:
          severity: critical
      
      # Memory usage
      - alert: HighMemoryUsage
        expr: process_resident_memory_bytes > 2e9
        for: 5m
        labels:
          severity: warning
      
      # Latency
      - alert: HighShareLatency
        expr: pool_share_processing_latency_p99 > 100
        for: 5m
        labels:
          severity: warning
```

### Task 4.3: 72h Stability Test

**Čas:** Ongoing (automated)

```bash
#!/bin/bash
# scripts/72h_stability_test.sh

echo "=== 72 Hour Pool Stability Test ==="

POOL_HOST="localhost"
POOL_PORT="3333"
MINERS=50
DURATION=259200  # 72 hours in seconds

# Start metrics collection
docker-compose up -d prometheus grafana

# Start simulated miners
python tests/stress/pool_stress_test.py \
    --host $POOL_HOST \
    --port $POOL_PORT \
    --miners $MINERS \
    --duration $DURATION &

STRESS_PID=$!

# Monitor every hour
while kill -0 $STRESS_PID 2>/dev/null; do
    echo "[$(date)] Collecting metrics..."
    
    # Check pool health
    curl -s http://localhost:8080/api/pool/stats > "metrics/$(date +%s).json"
    
    # Check memory
    docker stats --no-stream zion-pool >> metrics/docker_stats.log
    
    sleep 3600  # 1 hour
done

echo "=== Test Complete ==="
echo "Generating report..."
python scripts/analyze_stability_test.py metrics/
```

**Acceptance Criteria:**
- [ ] Uptime: 99.9%+ (max 4.3 minutes downtime)
- [ ] Share accept rate: >98%
- [ ] Memory growth: <10% over 72h
- [ ] No crashes or restarts needed
- [ ] P99 latency: <100ms

### Task 4.4: Payout E2E Testing

**Čas:** 12h

```rust
// tests/payout_e2e.rs
use zion_pool::payout::PayoutManager;

#[tokio::test]
async fn test_payout_flow() {
    // Setup
    let pool = create_test_pool().await;
    let core = create_test_core().await;
    let test_wallet = create_funded_wallet().await;
    
    // 1. Simulate mining session
    let miner_address = "zion1testminer...";
    
    for _ in 0..100 {
        pool.submit_valid_share(miner_address).await;
    }
    
    // 2. Mine a block
    let block = mine_block(&core).await;
    pool.process_block_found(block).await;
    
    // 3. Wait for payout threshold
    pool.wait_for_payout_cycle().await;
    
    // 4. Verify payout transaction
    let payouts = pool.get_pending_payouts().await;
    assert!(!payouts.is_empty());
    
    // 5. Execute payout
    let tx_result = pool.execute_payouts().await;
    assert!(tx_result.is_ok());
    
    // 6. Verify on-chain
    let txid = tx_result.unwrap();
    let tx = core.wait_for_tx_confirmation(&txid, 6).await;
    assert!(tx.is_some());
    
    // 7. Verify balance increased
    let balance = core.get_balance(miner_address).await;
    assert!(balance > 0);
}

#[tokio::test]
async fn test_payout_partial_failure() {
    // Test that partial failures don't lose funds
    // ...
}

#[tokio::test]
async fn test_payout_retry_mechanism() {
    // Test retry on temporary failures
    // ...
}
```

### Task 4.5: Anti-Spam Implementation

**Čas:** 8h

```rust
// src/pool/security/anti_spam.rs
use std::collections::HashMap;
use std::time::{Duration, Instant};

pub struct AntiSpam {
    /// Track invalid shares per IP
    invalid_shares: HashMap<String, Vec<Instant>>,
    /// Track login attempts per IP
    login_attempts: HashMap<String, Vec<Instant>>,
    /// Banned IPs
    banned: HashMap<String, Instant>,
    /// Configuration
    config: AntiSpamConfig,
}

pub struct AntiSpamConfig {
    /// Max invalid shares in window before ban
    pub max_invalid_shares: u32,      // default: 50
    /// Time window for invalid shares
    pub invalid_window: Duration,     // default: 60s
    /// Max login attempts in window
    pub max_login_attempts: u32,      // default: 10
    /// Login window
    pub login_window: Duration,       // default: 60s
    /// Ban duration
    pub ban_duration: Duration,       // default: 3600s
}

impl AntiSpam {
    /// Check if connection should be rejected
    pub fn should_reject(&self, ip: &str) -> bool {
        if let Some(banned_at) = self.banned.get(ip) {
            if banned_at.elapsed() < self.config.ban_duration {
                return true;
            }
        }
        false
    }
    
    /// Record invalid share
    pub fn record_invalid_share(&mut self, ip: &str) -> AntiSpamAction {
        let now = Instant::now();
        let shares = self.invalid_shares.entry(ip.to_string()).or_default();
        
        // Remove old entries
        shares.retain(|t| now.duration_since(*t) < self.config.invalid_window);
        
        shares.push(now);
        
        if shares.len() as u32 >= self.config.max_invalid_shares {
            self.ban(ip);
            return AntiSpamAction::Ban;
        }
        
        // Warning threshold at 50%
        if shares.len() as u32 >= self.config.max_invalid_shares / 2 {
            return AntiSpamAction::Warn;
        }
        
        AntiSpamAction::Allow
    }
    
    /// Categorize traffic type
    pub fn categorize_traffic(&self, share: &Share) -> TrafficType {
        // Scanner detection heuristics
        if share.nonce == 0 || share.nonce == u64::MAX {
            return TrafficType::Scanner;
        }
        
        if share.job_id.is_empty() || !self.job_exists(&share.job_id) {
            return TrafficType::Stale;
        }
        
        // Check for impossibly fast submissions
        // ...
        
        TrafficType::Normal
    }
    
    fn ban(&mut self, ip: &str) {
        self.banned.insert(ip.to_string(), Instant::now());
        tracing::warn!(ip = %ip, "IP banned for excessive invalid shares");
    }
}

pub enum AntiSpamAction {
    Allow,
    Warn,
    Ban,
}

pub enum TrafficType {
    Normal,
    Scanner,
    Stale,
    Suspicious,
}
```

### Task 4.6: VarDiff Optimization

**Čas:** 8h

```rust
// src/pool/mining/vardiff.rs
pub struct VarDiff {
    config: VarDiffConfig,
    /// Per-miner state
    miners: HashMap<String, MinerDiffState>,
}

pub struct VarDiffConfig {
    /// Minimum difficulty
    pub min_diff: f64,           // default: 1000
    /// Maximum difficulty
    pub max_diff: f64,           // default: 1000000000
    /// Target time between shares (seconds)
    pub target_time: f64,        // default: 15.0
    /// Retarget check interval (seconds)
    pub retarget_time: f64,      // default: 90.0
    /// Allowed variance before adjust (percentage)
    pub variance_percent: f64,   // default: 30.0
    /// Max adjustment per retarget
    pub max_change: f64,         // default: 2.0
}

struct MinerDiffState {
    current_diff: f64,
    last_retarget: Instant,
    shares_since_retarget: u32,
}

impl VarDiff {
    pub fn get_next_difficulty(&mut self, miner_id: &str) -> Option<f64> {
        let state = self.miners.get_mut(miner_id)?;
        
        let elapsed = state.last_retarget.elapsed().as_secs_f64();
        if elapsed < self.config.retarget_time {
            return None;  // Not time yet
        }
        
        let actual_time = elapsed / state.shares_since_retarget.max(1) as f64;
        let ratio = self.config.target_time / actual_time;
        
        // Check if within variance
        let variance = (ratio - 1.0).abs() * 100.0;
        if variance < self.config.variance_percent {
            return None;  // Within acceptable range
        }
        
        // Calculate new difficulty
        let mut new_diff = state.current_diff * ratio;
        
        // Clamp change rate
        new_diff = new_diff.clamp(
            state.current_diff / self.config.max_change,
            state.current_diff * self.config.max_change,
        );
        
        // Clamp to limits
        new_diff = new_diff.clamp(self.config.min_diff, self.config.max_diff);
        
        // Update state
        state.current_diff = new_diff;
        state.last_retarget = Instant::now();
        state.shares_since_retarget = 0;
        
        Some(new_diff)
    }
}
```

### Task 4.7: Metrics Dashboard

**Čas:** 4h

Grafana dashboard pro pool monitoring:

```json
{
  "dashboard": {
    "title": "ZION Pool Monitoring",
    "panels": [
      {
        "title": "Active Miners",
        "type": "stat",
        "targets": [
          {"expr": "pool_active_miners"}
        ]
      },
      {
        "title": "Hashrate",
        "type": "graph",
        "targets": [
          {"expr": "pool_hashrate_total"}
        ]
      },
      {
        "title": "Share Rate",
        "type": "graph",
        "targets": [
          {"expr": "rate(pool_shares_accepted[5m])", "legendFormat": "Accepted"},
          {"expr": "rate(pool_shares_rejected[5m])", "legendFormat": "Rejected"}
        ]
      },
      {
        "title": "Blocks Found",
        "type": "stat",
        "targets": [
          {"expr": "pool_blocks_found_total"}
        ]
      },
      {
        "title": "Pending Payouts",
        "type": "table",
        "targets": [
          {"expr": "pool_pending_payouts"}
        ]
      },
      {
        "title": "Scanner Traffic %",
        "type": "gauge",
        "targets": [
          {"expr": "pool_scanner_traffic_ratio * 100"}
        ],
        "thresholds": [
          {"color": "green", "value": 0},
          {"color": "yellow", "value": 1},
          {"color": "red", "value": 5}
        ]
      }
    ]
  }
}
```

---

## 📊 Success Metrics

| Metrika | Cíl | Kritické |
|---------|-----|----------|
| Uptime | >99.9% | >99% |
| Share Accept Rate | >98% | >95% |
| P99 Latency | <100ms | <500ms |
| Memory Growth/72h | <10% | <50% |
| Scanner Traffic | <1% | <5% |
| Payout Success Rate | 100% | >99% |

---

## 📦 Deliverables

| Soubor | Popis |
|--------|-------|
| `tests/stress/` | Stress testing framework |
| `src/pool/security/anti_spam.rs` | Anti-spam module |
| `src/pool/mining/vardiff.rs` | Optimized VarDiff |
| `config/prometheus/pool_alerts.yml` | Alert rules |
| `config/grafana/pool_dashboard.json` | Monitoring dashboard |
| `reports/72h_stability_report.md` | Stability test report |

---

## ⏱️ Time Estimate

| Task | Čas |
|------|-----|
| Stress Framework | 8h |
| Metrics Setup | 4h |
| 72h Test (monitoring) | 8h |
| Payout E2E | 12h |
| Anti-Spam | 8h |
| VarDiff | 8h |
| Dashboard | 4h |
| Report Writing | 4h |
| **Total** | **56h (~2-3 týdny)** |

---

## ✅ Exit Criteria

1. 72h stability test passed
2. Payout E2E test verified
3. Scanner traffic <1%
4. All metrics within target
5. Monitoring dashboard live

---

*Dokument aktualizován: 2026-02-03*
