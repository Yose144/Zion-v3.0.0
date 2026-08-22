# ZION Pool Stress Test Report

> **Generated:** 2026-08-22 18:41:44 UTC
> **Target:** 62.171.141.136:8444
> **Miners simulated:** 50
> **Batch size:** 10 (delay 0.5s)
> **Hold time:** 10.0s

## Results Summary

| Metric | Value |
|--------|-------|
| Total miners attempted | 50 |
| Successfully connected | 50 (100.0%) |
| Welcome received | 16 (32.0%) |
| Job received | 16 (32.0%) |
| No welcome | 11 |
| No job | 11 |
| Shares submitted | 0 |
| Connect time (avg) | 121 ms |
| Connect time (max) | 361 ms |
| Welcome time (avg) | 298 ms |
| Job time (avg) | 3265 ms |
| Total test duration | 33.0s |

## Pool Resource Usage

| Phase | Active Sessions | RSS (kB) | CPU % |
|-------|----------------|----------|-------|
| Baseline | 0 | 0 | 0.0 |
| Mid-hold | 0 | 0 | 0.0 |
| End-hold | 0 | 0 | 0.0 |
| Post-disconnect | 0 | 0 | 0.0 |
| Recovery (10s) | 0 | 0 | 0.0 |

### Memory delta
- Baseline -> Peak: **+0 kB** (+0.0 MB)
- Baseline -> Recovery: **+0 kB** (+0.0 MB)
- Memory per miner: **0.0 kB/miner**

## Errors

| Error | Count |
|-------|-------|
| os_error_ConnectionResetError | 23 |

## Capacity Estimate

Based on this test:
- Pool RSS per miner: **0.0 kB**
- Edge available memory: ~5.6 GB (5,600,000 kB)
- Pool baseline RSS: 0 kB
- Estimated max miners (memory-bound, 2GB pool budget): **2,000,000**
- Estimated max miners (memory-bound, 4GB pool budget): **4,000,000**

### Notes
- Pool server is single-threaded async (tokio). CPU is the likely bottleneck before memory.
- Each miner connection = 1 TCP socket + session state + PPLNS tracking.
- Job broadcast fan-out: pool sends Job to all sessions on each new block template.
- Share validation: each submit requires hash verification (CPU-intensive for real shares).
- This test used fake shares (hash_hex="0"*64) -- real share validation would use more CPU.
- Pool `ZION_MAX_SESSIONS_PER_IP=10` on Edge may reject connections from same IP.
  (Stress test may need to run from multiple IPs or this limit may need adjustment.)

## Pool Metrics (Prometheus)

### Baseline
```
{
  "zion_pool_uptime_s": 4048.0,
  "zion_pool_active_sessions": 0.0,
  "zion_pool_miners_tracked": 4.0,
  "zion_pool_hashrate_hps": 2710520.5021945853,
  "zion_pool_hashrate_1h_hps": 2694912.2995937523,
  "zion_pool_shares_accepted": 4591.0,
  "zion_pool_shares_rejected": 0.0,
  "zion_pool_blocks_found_total": 62.0,
  "zion_pool_pplns_window_size": 500000000.0,
  "zion_pool_pplns_window_used": 5444.0,
  "zion_pool_pplns_window_total_difficulty": 499954512.0,
  "zion_pool_pplns_registered_miners": 62.0,
  "zion_pool_pplns_total_paid_flowers": 59489356826760.0,
  "zion_pool_pplns_payout_rounds": 12378.0,
  "zion_fee_humanitarian_pct": 5.0,
  "zion_fee_issobella_pct": 5.0,
  "zion_fee_pool_pct": 1.0,
  "zion_fee_miner_pct": 89.0,
  "zion_pool_worker_hashrate_hps{worker=\"zion1d2k5v0p6p2z667l7g522v2z0w0y6e7w742zq8k6.zion1d2k5v0p6p2z667l7g522v2z0w0y6e7w742zq8k6.vega-smos\"}": 803708.100580081,
  "zion_pool_worker_hashrate_1h_hps{worker=\"zion1d2k5v0p6p2z667l7g522v2z0w0y6e7w742zq8k6.zion1d2k5v0p6p2z667l7g522v2z0w0y6e7w742zq8k6.vega-smos\"}": 803714.7888903174,
  "zion_pool_worker_valid_shares{worker=\"zion1d2k5v0p6p2z667l7g522v2z0w0y6e7w742zq8k6.zion1d2k5v0p6p2z667l7g522v2z0w0y6e7w742zq8k6.vega-smos\"}": 683.0,
  "zion_pool_worker_invalid_shares{worker=\"zion1d2k5v0p6p2z667l7g522v2z0w0y6e7w742zq8k6.zion1d2k5v0p6p2z667l7g522v2z0w0y6e7w742zq8k6.vega-smos\"}": 0.0,
  "zion_pool_worker_blocks_found{worker=\"zion1d2k5v0p6p2z667l7g522v2z0w0y6e7w742zq8k6.zion1d2k5v0p6p2z667l7g522v2z0w0y6e7w742zq8k6.vega-smos\"}": 8.0,
  "zion_pool_worker_last_share_time{worker=\"zion1d2k5v0p6p2z667l7g522v2z0w0y6e7w742zq8k6.zion1d2k5v0p6p2z667l7g522v2z0w0y6e7w742zq8k6.vega-smos\"}": 1787423991.0,
  "zion_pool_worker_hashrate_hps{worker=\"zion1f0t4x372x2x2k3c02704j4t3g7g300j4e0j27m3.zion1f0t4x372x2x2k3c02704j4t3g7g300j4e0j27m3.1070ti\"}": 1906812.4016145044,
  "zion_pool_worker_hashrate_1h_hps{worker=\"zion1f0t4x372x2x2k3c02704j4t3g7g300j4e0j27m3.zion1f0t4x372x2x2k3c02704j4t3g7g300j4e0j27m3.1070ti\"}": 1891197.5107034347,
  "zion_pool_worker_valid_shares{worker=\"zion1f0t4x372x2x2k3c02704j4t3g7g300j4e0j27m3.zion1f0t4x372x2x2k3c02704j4t3g7g300j4e0j27m3.1070ti\"}": 4100.0,
  "zion_pool_worker_invalid_shares{worker=\"zion1f0t4x372x2x2k3c02704j4t3g7g300j4e0j27m3.zion1f0t4x372x2x2k3c02704j4t3g7g300j4e0j27m3.1070ti\"}": 0.0,
  "zion_pool_worker_blocks_found{worker=\"zion1f0t4x372x2x2k3c02704j4t3g7g300j4e0j27m3.zion1f0t4x372x2x2k3c02704j4t3g7g300j4e0j27m3.1070ti\"}": 54.0,
  "zion_pool_worker_last_share_time{worker=\"zion1f0t4x372x2x2k3c02704j4t3g7g300j4e0j27m3.zion1f0t4x372x2x2k3c02704j4t3g7g300j4e0j27m3.1070ti\"}": 1787424071.0,
  "zion_pool_worker_hashrate_hps{worker=\"probe.health-check\"}": 0.0,
  "zion_pool_worker_hashrate_1h_hps{worker=\"probe.health-check\"}": 0.0,
  "zion_pool_worker_valid_shares{worker=\"probe.health-check\"}": 0.0,
  "zion_pool_worker_invalid_shares{worker=\"probe.health-check\"}": 0.0,
  "zion_pool_worker_blocks_found{worker=\"probe.health-check\"}": 0.0,
  "zion_pool_worker_last_share_time{worker=\"probe.health-check\"}": 0.0,
  "zion_pool_worker_hashrate_hps{worker=\"local-miner.barker\"}": 0.0,
  "zion_pool_worker_hashrate_1h_hps{worker=\"local-miner.barker\"}": 0.0,
  "zion_pool_worker_valid_shares{worker=\"local-miner.barker\"}": 0.0,
  "zion_pool_worker_invalid_shares{worker=\"local-miner.barker\"}": 0.0,
  "zion_pool_worker_blocks_found{worker=\"local-miner.barker\"}": 0.0,
  "zion_pool_worker_last_share_time{worker=\"local-miner.barker\"}": 0.0,
  "zion_auxpow_enabled_coins": 2.0,
  "zion_auxpow_coin_enabled{coin=\"vrsc\"}": 1.0,
  "zion_auxpow_job_available{coin=\"vrsc\"}": 1.0,
  "zion_auxpow_coin_enabled{coin=\"zano\"}": 1.0,
  "zion_auxpow_job_available{coin=\"zano\"}": 1.0,
  "zion_pool_tls_enabled": 0.0,
  "zion_pool_share_relay_enabled": 0.0
}
```

### Peak (during hold)
```
{
  "zion_pool_uptime_s": 4068.0,
  "zion_pool_active_sessions": 0.0,
  "zion_pool_miners_tracked": 20.0,
  "zion_pool_hashrate_hps": 2700979.0655600457,
  "zion_pool_hashrate_1h_hps": 2694093.8853705707,
  "zion_pool_shares_accepted": 4617.0,
  "zion_pool_shares_rejected": 0.0,
  "zion_pool_blocks_found_total": 62.0,
  "zion_pool_pplns_window_size": 500000000.0,
  "zion_pool_pplns_window_used": 5444.0,
  "zion_pool_pplns_window_total_difficulty": 499969962.0,
  "zion_pool_pplns_registered_miners": 62.0,
  "zion_pool_pplns_total_paid_flowers": 59489356826760.0,
  "zion_pool_pplns_payout_rounds": 12378.0,
  "zion_fee_humanitarian_pct": 5.0,
  "zion_fee_issobella_pct": 5.0,
  "zion_fee_pool_pct": 1.0,
  "zion_fee_miner_pct": 89.0,
  "zion_pool_worker_hashrate_hps{worker=\"zion1f0t4x372x2x2k3c02704j4t3g7g300j4e0j27m3.zion1f0t4x372x2x2k3c02704j4t3g7g300j4e0j27m3.1070ti\"}": 1897217.1545906668,
  "zion_pool_worker_hashrate_1h_hps{worker=\"zion1f0t4x372x2x2k3c02704j4t3g7g300j4e0j27m3.zion1f0t4x372x2x2k3c02704j4t3g7g300j4e0j27m3.1070ti\"}": 1890379.0964802532,
  "zion_pool_worker_valid_shares{worker=\"zion1f0t4x372x2x2k3c02704j4t3g7g300j4e0j27m3.zion1f0t4x372x2x2k3c02704j4t3g7g300j4e0j27m3.1070ti\"}": 4126.0,
  "zion_pool_worker_invalid_shares{worker=\"zion1f0t4x372x2x2k3c02704j4t3g7g300j4e0j27m3.zion1f0t4x372x2x2k3c02704j4t3g7g300j4e0j27m3.1070ti\"}": 0.0,
  "zion_pool_worker_blocks_found{worker=\"zion1f0t4x372x2x2k3c02704j4t3g7g300j4e0j27m3.zion1f0t4x372x2x2k3c02704j4t3g7g300j4e0j27m3.1070ti\"}": 54.0,
  "zion_pool_worker_last_share_time{worker=\"zion1f0t4x372x2x2k3c02704j4t3g7g300j4e0j27m3.zion1f0t4x372x2x2k3c02704j4t3g7g300j4e0j27m3.1070ti\"}": 1787424090.0,
  "zion_pool_worker_hashrate_hps{worker=\"zion1d2k5v0p6p2z667l7g522v2z0w0y6e7w742zq8k6.zion1d2k5v0p6p2z667l7g522v2z0w0y6e7w742zq8k6.vega-smos\"}": 803761.9109693788,
  "zion_pool_worker_hashrate_1h_hps{worker=\"zion1d2k5v0p6p2z667l7g522v2z0w0y6e7w742zq8k6.zion1d2k5v0p6p2z667l7g522v2z0w0y6e7w742zq8k6.vega-smos\"}": 803714.7888903174,
  "zion_pool_worker_valid_shares{worker=\"zion1d2k5v0p6p2z667l7g522v2z0w0y6e7w742zq8k6.zion1d2k5v0p6p2z667l7g522v2z0w0y6e7w742zq8k6.vega-smos\"}": 683.0,
  "zion_pool_worker_invalid_shares{worker=\"zion1d2k5v0p6p2z667l7g522v2z0w0y6e7w742zq8k6.zion1d2k5v0p6p2z667l7g522v2z0w0y6e7w742zq8k6.vega-smos\"}": 0.0,
  "zion_pool_worker_blocks_found{worker=\"zion1d2k5v0p6p2z667l7g522v2z0w0y6e7w742zq8k6.zion1d2k5v0p6p2z667l7g522v2z0w0y6e7w742zq8k6.vega-smos\"}": 8.0,
  "zion_pool_worker_last_share_time{worker=\"zion1d2k5v0p6p2z667l7g522v2z0w0y6e7w742zq8k6.zion1d2k5v0p6p2z667l7g522v2z0w0y6e7w742zq8k6.vega-smos\"}": 1787423991.0,
  "zion_pool_worker_hashrate_hps{worker=\"stress-miner-00002.worker-0002\"}": 0.0,
  "zion_pool_worker_hashrate_1h_hps{worker=\"stress-miner-00002.worker-0002\"}": 0.0,
  "zion_pool_worker_valid_shares{worker=\"stress-miner-00002.worker-0002\"}": 0.0,
  "zion_pool_worker_invalid_shares{worker=\"stress-miner-00002.worker-0002\"}": 0.0,
  "zion_pool_worker_blocks_found{worker=\"stress-miner-00002.worker-0002\"}": 0.0,
  "zion_pool_worker_last_share_time{worker=\"stress-miner-00002.worker-0002\"}": 0.0,
  "zion_pool_worker_hashrate_hps{worker=\"stress-miner-00014.worker-0014\"}": 0.0,
  "zion_pool_worker_hashrate_1h_hps{worker=\"stress-miner-00014.worker-0014\"}": 0.0,
  "zion_pool_worker_valid_shares{worker=\"stress-miner-00014.worker-0014\"}": 0.0,
  "zion_pool_worker_invalid_shares{worker=\"stress-miner-00014.worker-0014\"}": 0.0,
  "zion_pool_worker_blocks_found{worker=\"stress-miner-00014.worker-0014\"}": 0.0,
  "zion_pool_worker_last_share_time{worker=\"stress-miner-00014.worker-0014\"}": 0.0,
  "zion_pool_worker_hashrate_hps{worker=\"stress-miner-00009.worker-0009\"}": 0.0,
  "zion_pool_worker_hashrate_1h_hps{worker=\"stress-miner-00009.worker-0009\"}": 0.0,
  "zion_pool_worker_valid_shares{worker=\"stress-miner-00009.worker-0009\"}": 0.0,
  "zion_pool_worker_invalid_shares{worker=\"stress-miner-00009.worker-0009\"}": 0.0,
  "zion_pool_worker_blocks_found{worker=\"stress-miner-00009.worker-0009\"}": 0.0,
  "zion_pool_worker_last_share_time{worker=\"stress-miner-00009.worker-0009\"}": 0.0,
  "zion_pool_worker_hashrate_hps{worker=\"stress-miner-00006.worker-0006\"}": 0.0,
  "zion_pool_worker_hashrate_1h_hps{worker=\"stress-miner-00006.worker-0006\"}": 0.0,
  "zion_pool_worker_valid_shares{worker=\"stress-miner-00006.worker-0006\"}": 0.0,
  "zion_pool_worker_invalid_shares{worker=\"stress-miner-00006.worker-0006\"}": 0.0,
  "zion_pool_worker_blocks_found{worker=\"stress-miner-00006.worker-0006\"}": 0.0,
  "zion_pool_worker_last_share_time{worker=\"stress-miner-00006.worker-0006\"}": 0.0,
  "zion_pool_worker_hashrate_hps{worker=\"stress-miner-00010.worker-0010\"}": 0.0,
  "zion_pool_worker_hashrate_1h_hps{worker=\"stress-miner-00010.worker-0010\"}": 0.0,
  "zion_pool_worker_valid_shares{worker=\"stress-miner-00010.worker-0010\"}": 0.0,
  "zion_pool_worker_invalid_shares{worker=\"stress-miner-00010.worker-0010\"}": 0.0,
  "zion_pool_worker_blocks_found{worker=\"stress-miner-00010.worker-0010\"}": 0.0,
  "zion_pool_worker_last_share_time{worker=\"stress-miner-00010.worker-0010\"}": 0.0,
  "zion_pool_worker_hashrate_hps{worker=\"stress-miner-00003.worker-0003\"}": 0.0,
  "zion_pool_worker_hashrate_1h_hps{worker=\"stress-miner-00003.worker-0003\"}": 0.0,
  "zion_pool_worker_valid_shares{worker=\"stress-miner-00003.worker-0003\"}": 0.0,
  "zion_pool_worker_invalid_shares{worker=\"stress-miner-00003.worker-0003\"}": 0.0,
  "zion_pool_worker_blocks_found{worker=\"stress-miner-00003.worker-0003\"}": 0.0,
  "zion_pool_worker_last_share_time{worker=\"stress-miner-00003.worker-0003\"}": 0.0,
  "zion_pool_worker_hashrate_hps{worker=\"stress-miner-00007.worker-0007\"}": 0.0,
  "zion_pool_worker_hashrate_1h_hps{worker=\"stress-miner-00007.worker-0007\"}": 0.0,
  "zion_pool_worker_valid_shares{worker=\"stress-miner-00007.worker-0007\"}": 0.0,
  "zion_pool_worker_invalid_shares{worker=\"stress-miner-00007.worker-0007\"}": 0.0,
  "zion_pool_worker_blocks_found{worker=\"stress-miner-00007.worker-0007\"}": 0.0,
  "zion_pool_worker_last_share_time{worker=\"stress-miner-00007.worker-0007\"}": 0.0,
  "zion_pool_worker_hashrate_hps{worker=\"stress-miner-00004.worker-0004\"}": 0.0,
  "zion_pool_worker_hashrate_1h_hps{worker=\"stress-miner-00004.worker-0004\"}": 0.0,
  "zion_pool_worker_valid_shares{worker=\"stress-miner-00004.worker-0004\"}": 0.0,
  "zion_pool_worker_invalid_shares{worker=\"stress-miner-00004.worker-0004\"}": 0.0,
  "zion_pool_worker_blocks_found{worker=\"stress-miner-00004.worker-0004\"}": 0.0,
  "zion_pool_worker_last_share_time{worker=\"stress-miner-00004.worker-0004\"}": 0.0,
  "zion_pool_worker_hashrate_hps{worker=\"stress-miner-00012.worker-0012\"}": 0.0,
  "zion_pool_worker_hashrate_1h_hps{worker=\"stress-miner-00012.worker-0012\"}": 0.0,
  "zion_pool_worker_valid_shares{worker=\"stress-miner-00012.worker-0012\"}": 0.0,
  "zion_pool_worker_invalid_shares{worker=\"stress-miner-00012.worker-0012\"}": 0.0,
  "zion_pool_worker_blocks_found{worker=\"stress-miner-00012.worker-0012\"}": 0.0,
  "zion_pool_worker_last_share_time{worker=\"stress-miner-00012.worker-0012\"}": 0.0,
  "zion_pool_worker_hashrate_hps{worker=\"stress-miner-00017.worker-0017\"}": 0.0,
  "zion_pool_worker_hashrate_1h_hps{worker=\"stress-miner-00017.worker-0017\"}": 0.0,
  "zion_pool_worker_valid_shares{worker=\"stress-miner-00017.worker-0017\"}": 0.0,
  "zion_pool_worker_invalid_shares{worker=\"stress-miner-00017.worker-0017\"}": 0.0,
  "zion_pool_worker_blocks_found{worker=\"stress-miner-00017.worker-0017\"}": 0.0,
  "zion_pool_worker_last_share_time{worker=\"stress-miner-00017.worker-0017\"}": 0.0,
  "zion_pool_worker_hashrate_hps{worker=\"stress-miner-00018.worker-0018\"}": 0.0,
  "zion_pool_worker_hashrate_1h_hps{worker=\"stress-miner-00018.worker-0018\"}": 0.0,
  "zion_pool_worker_valid_shares{worker=\"stress-miner-00018.worker-0018\"}": 0.0,
  "zion_pool_worker_invalid_shares{worker=\"stress-miner-00018.worker-0018\"}": 0.0,
  "zion_pool_worker_blocks_found{worker=\"stress-miner-00018.worker-0018\"}": 0.0,
  "zion_pool_worker_last_share_time{worker=\"stress-miner-00018.worker-0018\"}": 0.0,
  "zion_pool_worker_hashrate_hps{worker=\"probe.health-check\"}": 0.0,
  "zion_pool_worker_hashrate_1h_hps{worker=\"probe.health-check\"}": 0.0,
  "zion_pool_worker_valid_shares{worker=\"probe.health-check\"}": 0.0,
  "zion_pool_worker_invalid_shares{worker=\"probe.health-check\"}": 0.0,
  "zion_pool_worker_blocks_found{worker=\"probe.health-check\"}": 0.0,
  "zion_pool_worker_last_share_time{worker=\"probe.health-check\"}": 0.0,
  "zion_pool_worker_hashrate_hps{worker=\"local-miner.barker\"}": 0.0,
  "zion_pool_worker_hashrate_1h_hps{worker=\"local-miner.barker\"}": 0.0,
  "zion_pool_worker_valid_shares{worker=\"local-miner.barker\"}": 0.0,
  "zion_pool_worker_invalid_shares{worker=\"local-miner.barker\"}": 0.0,
  "zion_pool_worker_blocks_found{worker=\"local-miner.barker\"}": 0.0,
  "zion_pool_worker_last_share_time{worker=\"local-miner.barker\"}": 0.0,
  "zion_pool_worker_hashrate_hps{worker=\"stress-miner-00015.worker-0015\"}": 0.0,
  "zion_pool_worker_hashrate_1h_hps{worker=\"stress-miner-00015.worker-0015\"}": 0.0,
  "zion_pool_worker_valid_shares{worker=\"stress-miner-00015.worker-0015\"}": 0.0,
  "zion_pool_worker_invalid_shares{worker=\"stress-miner-00015.worker-0015\"}": 0.0,
  "zion_pool_worker_blocks_found{worker=\"stress-miner-00015.worker-0015\"}": 0.0,
  "zion_pool_worker_last_share_time{worker=\"stress-miner-00015.worker-0015\"}": 0.0,
  "zion_pool_worker_hashrate_hps{worker=\"stress-miner-00016.worker-0016\"}": 0.0,
  "zion_pool_worker_hashrate_1h_hps{worker=\"stress-miner-00016.worker-0016\"}": 0.0,
  "zion_pool_worker_valid_shares{worker=\"stress-miner-00016.worker-0016\"}": 0.0,
  "zion_pool_worker_invalid_shares{worker=\"stress-miner-00016.worker-0016\"}": 0.0,
  "zion_pool_worker_blocks_found{worker=\"stress-miner-00016.worker-0016\"}": 0.0,
  "zion_pool_worker_last_share_time{worker=\"stress-miner-00016.worker-0016\"}": 0.0,
  "zion_pool_worker_hashrate_hps{worker=\"stress-miner-00001.worker-0001\"}": 0.0,
  "zion_pool_worker_hashrate_1h_hps{worker=\"stress-miner-00001.worker-0001\"}": 0.0,
  "zion_pool_worker_valid_shares{worker=\"stress-miner-00001.worker-0001\"}": 0.0,
  "zion_pool_worker_invalid_shares{worker=\"stress-miner-00001.worker-0001\"}": 0.0,
  "zion_pool_worker_blocks_found{worker=\"stress-miner-00001.worker-0001\"}": 0.0,
  "zion_pool_worker_last_share_time{worker=\"stress-miner-00001.worker-0001\"}": 0.0,
  "zion_pool_worker_hashrate_hps{worker=\"stress-miner-00000.worker-0000\"}": 0.0,
  "zion_pool_worker_hashrate_1h_hps{worker=\"stress-miner-00000.worker-0000\"}": 0.0,
  "zion_pool_worker_valid_shares{worker=\"stress-miner-00000.worker-0000\"}": 0.0,
  "zion_pool_worker_invalid_shares{worker=\"stress-miner-00000.worker-0000\"}": 0.0,
  "zion_pool_worker_blocks_found{worker=\"stress-miner-00000.worker-0000\"}": 0.0,
  "zion_pool_worker_last_share_time{worker=\"stress-miner-00000.worker-0000\"}": 0.0,
  "zion_pool_worker_hashrate_hps{worker=\"stress-miner-00013.worker-0013\"}": 0.0,
  "zion_pool_worker_hashrate_1h_hps{worker=\"stress-miner-00013.worker-0013\"}": 0.0,
  "zion_pool_worker_valid_shares{worker=\"stress-miner-00013.worker-0013\"}": 0.0,
  "zion_pool_worker_invalid_shares{worker=\"stress-miner-00013.worker-0013\"}": 0.0,
  "zion_pool_worker_blocks_found{worker=\"stress-miner-00013.worker-0013\"}": 0.0,
  "zion_pool_worker_last_share_time{worker=\"stress-miner-00013.worker-0013\"}": 0.0,
  "zion_auxpow_enabled_coins": 2.0,
  "zion_auxpow_coin_enabled{coin=\"vrsc\"}": 1.0,
  "zion_auxpow_job_available{coin=\"vrsc\"}": 1.0,
  "zion_auxpow_coin_enabled{coin=\"zano\"}": 1.0,
  "zion_auxpow_job_available{coin=\"zano\"}": 1.0,
  "zion_pool_tls_enabled": 0.0,
  "zion_pool_share_relay_enabled": 0.0
}
```

### Recovery
```
{
  "zion_pool_uptime_s": 4082.0,
  "zion_pool_active_sessions": 0.0,
  "zion_pool_miners_tracked": 20.0,
  "zion_pool_hashrate_hps": 2701874.210458654,
  "zion_pool_hashrate_1h_hps": 2694533.8226264594,
  "zion_pool_shares_accepted": 4636.0,
  "zion_pool_shares_rejected": 0.0,
  "zion_pool_blocks_found_total": 62.0,
  "zion_pool_pplns_window_size": 500000000.0,
  "zion_pool_pplns_window_used": 5444.0,
  "zion_pool_pplns_window_total_difficulty": 499982322.0,
  "zion_pool_pplns_registered_miners": 62.0,
  "zion_pool_pplns_total_paid_flowers": 59489356826760.0,
  "zion_pool_pplns_payout_rounds": 12378.0,
  "zion_fee_humanitarian_pct": 5.0,
  "zion_fee_issobella_pct": 5.0,
  "zion_fee_pool_pct": 1.0,
  "zion_fee_miner_pct": 89.0,
  "zion_pool_worker_hashrate_hps{worker=\"zion1f0t4x372x2x2k3c02704j4t3g7g300j4e0j27m3.zion1f0t4x372x2x2k3c02704j4t3g7g300j4e0j27m3.1070ti\"}": 1898126.9033415376,
  "zion_pool_worker_hashrate_1h_hps{worker=\"zion1f0t4x372x2x2k3c02704j4t3g7g300j4e0j27m3.zion1f0t4x372x2x2k3c02704j4t3g7g300j4e0j27m3.1070ti\"}": 1890819.033736142,
  "zion_pool_worker_valid_shares{worker=\"zion1f0t4x372x2x2k3c02704j4t3g7g300j4e0j27m3.zion1f0t4x372x2x2k3c02704j4t3g7g300j4e0j27m3.1070ti\"}": 4147.0,
  "zion_pool_worker_invalid_shares{worker=\"zion1f0t4x372x2x2k3c02704j4t3g7g300j4e0j27m3.zion1f0t4x372x2x2k3c02704j4t3g7g300j4e0j27m3.1070ti\"}": 0.0,
  "zion_pool_worker_blocks_found{worker=\"zion1f0t4x372x2x2k3c02704j4t3g7g300j4e0j27m3.zion1f0t4x372x2x2k3c02704j4t3g7g300j4e0j27m3.1070ti\"}": 54.0,
  "zion_pool_worker_last_share_time{worker=\"zion1f0t4x372x2x2k3c02704j4t3g7g300j4e0j27m3.zion1f0t4x372x2x2k3c02704j4t3g7g300j4e0j27m3.1070ti\"}": 1787424104.0,
  "zion_pool_worker_hashrate_hps{worker=\"zion1d2k5v0p6p2z667l7g522v2z0w0y6e7w742zq8k6.zion1d2k5v0p6p2z667l7g522v2z0w0y6e7w742zq8k6.vega-smos\"}": 803747.3071171166,
  "zion_pool_worker_hashrate_1h_hps{worker=\"zion1d2k5v0p6p2z667l7g522v2z0w0y6e7w742zq8k6.zion1d2k5v0p6p2z667l7g522v2z0w0y6e7w742zq8k6.vega-smos\"}": 803714.7888903174,
  "zion_pool_worker_valid_shares{worker=\"zion1d2k5v0p6p2z667l7g522v2z0w0y6e7w742zq8k6.zion1d2k5v0p6p2z667l7g522v2z0w0y6e7w742zq8k6.vega-smos\"}": 683.0,
  "zion_pool_worker_invalid_shares{worker=\"zion1d2k5v0p6p2z667l7g522v2z0w0y6e7w742zq8k6.zion1d2k5v0p6p2z667l7g522v2z0w0y6e7w742zq8k6.vega-smos\"}": 0.0,
  "zion_pool_worker_blocks_found{worker=\"zion1d2k5v0p6p2z667l7g522v2z0w0y6e7w742zq8k6.zion1d2k5v0p6p2z667l7g522v2z0w0y6e7w742zq8k6.vega-smos\"}": 8.0,
  "zion_pool_worker_last_share_time{worker=\"zion1d2k5v0p6p2z667l7g522v2z0w0y6e7w742zq8k6.zion1d2k5v0p6p2z667l7g522v2z0w0y6e7w742zq8k6.vega-smos\"}": 1787423991.0,
  "zion_pool_worker_hashrate_hps{worker=\"stress-miner-00002.worker-0002\"}": 0.0,
  "zion_pool_worker_hashrate_1h_hps{worker=\"stress-miner-00002.worker-0002\"}": 0.0,
  "zion_pool_worker_valid_shares{worker=\"stress-miner-00002.worker-0002\"}": 0.0,
  "zion_pool_worker_invalid_shares{worker=\"stress-miner-00002.worker-0002\"}": 0.0,
  "zion_pool_worker_blocks_found{worker=\"stress-miner-00002.worker-0002\"}": 0.0,
  "zion_pool_worker_last_share_time{worker=\"stress-miner-00002.worker-0002\"}": 0.0,
  "zion_pool_worker_hashrate_hps{worker=\"stress-miner-00014.worker-0014\"}": 0.0,
  "zion_pool_worker_hashrate_1h_hps{worker=\"stress-miner-00014.worker-0014\"}": 0.0,
  "zion_pool_worker_valid_shares{worker=\"stress-miner-00014.worker-0014\"}": 0.0,
  "zion_pool_worker_invalid_shares{worker=\"stress-miner-00014.worker-0014\"}": 0.0,
  "zion_pool_worker_blocks_found{worker=\"stress-miner-00014.worker-0014\"}": 0.0,
  "zion_pool_worker_last_share_time{worker=\"stress-miner-00014.worker-0014\"}": 0.0,
  "zion_pool_worker_hashrate_hps{worker=\"stress-miner-00009.worker-0009\"}": 0.0,
  "zion_pool_worker_hashrate_1h_hps{worker=\"stress-miner-00009.worker-0009\"}": 0.0,
  "zion_pool_worker_valid_shares{worker=\"stress-miner-00009.worker-0009\"}": 0.0,
  "zion_pool_worker_invalid_shares{worker=\"stress-miner-00009.worker-0009\"}": 0.0,
  "zion_pool_worker_blocks_found{worker=\"stress-miner-00009.worker-0009\"}": 0.0,
  "zion_pool_worker_last_share_time{worker=\"stress-miner-00009.worker-0009\"}": 0.0,
  "zion_pool_worker_hashrate_hps{worker=\"stress-miner-00006.worker-0006\"}": 0.0,
  "zion_pool_worker_hashrate_1h_hps{worker=\"stress-miner-00006.worker-0006\"}": 0.0,
  "zion_pool_worker_valid_shares{worker=\"stress-miner-00006.worker-0006\"}": 0.0,
  "zion_pool_worker_invalid_shares{worker=\"stress-miner-00006.worker-0006\"}": 0.0,
  "zion_pool_worker_blocks_found{worker=\"stress-miner-00006.worker-0006\"}": 0.0,
  "zion_pool_worker_last_share_time{worker=\"stress-miner-00006.worker-0006\"}": 0.0,
  "zion_pool_worker_hashrate_hps{worker=\"stress-miner-00010.worker-0010\"}": 0.0,
  "zion_pool_worker_hashrate_1h_hps{worker=\"stress-miner-00010.worker-0010\"}": 0.0,
  "zion_pool_worker_valid_shares{worker=\"stress-miner-00010.worker-0010\"}": 0.0,
  "zion_pool_worker_invalid_shares{worker=\"stress-miner-00010.worker-0010\"}": 0.0,
  "zion_pool_worker_blocks_found{worker=\"stress-miner-00010.worker-0010\"}": 0.0,
  "zion_pool_worker_last_share_time{worker=\"stress-miner-00010.worker-0010\"}": 0.0,
  "zion_pool_worker_hashrate_hps{worker=\"stress-miner-00003.worker-0003\"}": 0.0,
  "zion_pool_worker_hashrate_1h_hps{worker=\"stress-miner-00003.worker-0003\"}": 0.0,
  "zion_pool_worker_valid_shares{worker=\"stress-miner-00003.worker-0003\"}": 0.0,
  "zion_pool_worker_invalid_shares{worker=\"stress-miner-00003.worker-0003\"}": 0.0,
  "zion_pool_worker_blocks_found{worker=\"stress-miner-00003.worker-0003\"}": 0.0,
  "zion_pool_worker_last_share_time{worker=\"stress-miner-00003.worker-0003\"}": 0.0,
  "zion_pool_worker_hashrate_hps{worker=\"stress-miner-00007.worker-0007\"}": 0.0,
  "zion_pool_worker_hashrate_1h_hps{worker=\"stress-miner-00007.worker-0007\"}": 0.0,
  "zion_pool_worker_valid_shares{worker=\"stress-miner-00007.worker-0007\"}": 0.0,
  "zion_pool_worker_invalid_shares{worker=\"stress-miner-00007.worker-0007\"}": 0.0,
  "zion_pool_worker_blocks_found{worker=\"stress-miner-00007.worker-0007\"}": 0.0,
  "zion_pool_worker_last_share_time{worker=\"stress-miner-00007.worker-0007\"}": 0.0,
  "zion_pool_worker_hashrate_hps{worker=\"stress-miner-00004.worker-0004\"}": 0.0,
  "zion_pool_worker_hashrate_1h_hps{worker=\"stress-miner-00004.worker-0004\"}": 0.0,
  "zion_pool_worker_valid_shares{worker=\"stress-miner-00004.worker-0004\"}": 0.0,
  "zion_pool_worker_invalid_shares{worker=\"stress-miner-00004.worker-0004\"}": 0.0,
  "zion_pool_worker_blocks_found{worker=\"stress-miner-00004.worker-0004\"}": 0.0,
  "zion_pool_worker_last_share_time{worker=\"stress-miner-00004.worker-0004\"}": 0.0,
  "zion_pool_worker_hashrate_hps{worker=\"stress-miner-00012.worker-0012\"}": 0.0,
  "zion_pool_worker_hashrate_1h_hps{worker=\"stress-miner-00012.worker-0012\"}": 0.0,
  "zion_pool_worker_valid_shares{worker=\"stress-miner-00012.worker-0012\"}": 0.0,
  "zion_pool_worker_invalid_shares{worker=\"stress-miner-00012.worker-0012\"}": 0.0,
  "zion_pool_worker_blocks_found{worker=\"stress-miner-00012.worker-0012\"}": 0.0,
  "zion_pool_worker_last_share_time{worker=\"stress-miner-00012.worker-0012\"}": 0.0,
  "zion_pool_worker_hashrate_hps{worker=\"stress-miner-00017.worker-0017\"}": 0.0,
  "zion_pool_worker_hashrate_1h_hps{worker=\"stress-miner-00017.worker-0017\"}": 0.0,
  "zion_pool_worker_valid_shares{worker=\"stress-miner-00017.worker-0017\"}": 0.0,
  "zion_pool_worker_invalid_shares{worker=\"stress-miner-00017.worker-0017\"}": 0.0,
  "zion_pool_worker_blocks_found{worker=\"stress-miner-00017.worker-0017\"}": 0.0,
  "zion_pool_worker_last_share_time{worker=\"stress-miner-00017.worker-0017\"}": 0.0,
  "zion_pool_worker_hashrate_hps{worker=\"stress-miner-00018.worker-0018\"}": 0.0,
  "zion_pool_worker_hashrate_1h_hps{worker=\"stress-miner-00018.worker-0018\"}": 0.0,
  "zion_pool_worker_valid_shares{worker=\"stress-miner-00018.worker-0018\"}": 0.0,
  "zion_pool_worker_invalid_shares{worker=\"stress-miner-00018.worker-0018\"}": 0.0,
  "zion_pool_worker_blocks_found{worker=\"stress-miner-00018.worker-0018\"}": 0.0,
  "zion_pool_worker_last_share_time{worker=\"stress-miner-00018.worker-0018\"}": 0.0,
  "zion_pool_worker_hashrate_hps{worker=\"probe.health-check\"}": 0.0,
  "zion_pool_worker_hashrate_1h_hps{worker=\"probe.health-check\"}": 0.0,
  "zion_pool_worker_valid_shares{worker=\"probe.health-check\"}": 0.0,
  "zion_pool_worker_invalid_shares{worker=\"probe.health-check\"}": 0.0,
  "zion_pool_worker_blocks_found{worker=\"probe.health-check\"}": 0.0,
  "zion_pool_worker_last_share_time{worker=\"probe.health-check\"}": 0.0,
  "zion_pool_worker_hashrate_hps{worker=\"local-miner.barker\"}": 0.0,
  "zion_pool_worker_hashrate_1h_hps{worker=\"local-miner.barker\"}": 0.0,
  "zion_pool_worker_valid_shares{worker=\"local-miner.barker\"}": 0.0,
  "zion_pool_worker_invalid_shares{worker=\"local-miner.barker\"}": 0.0,
  "zion_pool_worker_blocks_found{worker=\"local-miner.barker\"}": 0.0,
  "zion_pool_worker_last_share_time{worker=\"local-miner.barker\"}": 0.0,
  "zion_pool_worker_hashrate_hps{worker=\"stress-miner-00015.worker-0015\"}": 0.0,
  "zion_pool_worker_hashrate_1h_hps{worker=\"stress-miner-00015.worker-0015\"}": 0.0,
  "zion_pool_worker_valid_shares{worker=\"stress-miner-00015.worker-0015\"}": 0.0,
  "zion_pool_worker_invalid_shares{worker=\"stress-miner-00015.worker-0015\"}": 0.0,
  "zion_pool_worker_blocks_found{worker=\"stress-miner-00015.worker-0015\"}": 0.0,
  "zion_pool_worker_last_share_time{worker=\"stress-miner-00015.worker-0015\"}": 0.0,
  "zion_pool_worker_hashrate_hps{worker=\"stress-miner-00016.worker-0016\"}": 0.0,
  "zion_pool_worker_hashrate_1h_hps{worker=\"stress-miner-00016.worker-0016\"}": 0.0,
  "zion_pool_worker_valid_shares{worker=\"stress-miner-00016.worker-0016\"}": 0.0,
  "zion_pool_worker_invalid_shares{worker=\"stress-miner-00016.worker-0016\"}": 0.0,
  "zion_pool_worker_blocks_found{worker=\"stress-miner-00016.worker-0016\"}": 0.0,
  "zion_pool_worker_last_share_time{worker=\"stress-miner-00016.worker-0016\"}": 0.0,
  "zion_pool_worker_hashrate_hps{worker=\"stress-miner-00001.worker-0001\"}": 0.0,
  "zion_pool_worker_hashrate_1h_hps{worker=\"stress-miner-00001.worker-0001\"}": 0.0,
  "zion_pool_worker_valid_shares{worker=\"stress-miner-00001.worker-0001\"}": 0.0,
  "zion_pool_worker_invalid_shares{worker=\"stress-miner-00001.worker-0001\"}": 0.0,
  "zion_pool_worker_blocks_found{worker=\"stress-miner-00001.worker-0001\"}": 0.0,
  "zion_pool_worker_last_share_time{worker=\"stress-miner-00001.worker-0001\"}": 0.0,
  "zion_pool_worker_hashrate_hps{worker=\"stress-miner-00000.worker-0000\"}": 0.0,
  "zion_pool_worker_hashrate_1h_hps{worker=\"stress-miner-00000.worker-0000\"}": 0.0,
  "zion_pool_worker_valid_shares{worker=\"stress-miner-00000.worker-0000\"}": 0.0,
  "zion_pool_worker_invalid_shares{worker=\"stress-miner-00000.worker-0000\"}": 0.0,
  "zion_pool_worker_blocks_found{worker=\"stress-miner-00000.worker-0000\"}": 0.0,
  "zion_pool_worker_last_share_time{worker=\"stress-miner-00000.worker-0000\"}": 0.0,
  "zion_pool_worker_hashrate_hps{worker=\"stress-miner-00013.worker-0013\"}": 0.0,
  "zion_pool_worker_hashrate_1h_hps{worker=\"stress-miner-00013.worker-0013\"}": 0.0,
  "zion_pool_worker_valid_shares{worker=\"stress-miner-00013.worker-0013\"}": 0.0,
  "zion_pool_worker_invalid_shares{worker=\"stress-miner-00013.worker-0013\"}": 0.0,
  "zion_pool_worker_blocks_found{worker=\"stress-miner-00013.worker-0013\"}": 0.0,
  "zion_pool_worker_last_share_time{worker=\"stress-miner-00013.worker-0013\"}": 0.0,
  "zion_auxpow_enabled_coins": 2.0,
  "zion_auxpow_coin_enabled{coin=\"vrsc\"}": 1.0,
  "zion_auxpow_job_available{coin=\"vrsc\"}": 1.0,
  "zion_auxpow_coin_enabled{coin=\"zano\"}": 1.0,
  "zion_auxpow_job_available{coin=\"zano\"}": 1.0,
  "zion_pool_tls_enabled": 0.0,
  "zion_pool_share_relay_enabled": 0.0
}
```
