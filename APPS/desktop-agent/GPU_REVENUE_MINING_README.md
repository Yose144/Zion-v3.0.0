# GPU Revenue Mining Integration

## Overview

The ZION Desktop Agent v2.9.5 now supports advanced GPU revenue mining with automatic profit switching between multiple GPU coins (ERG, RVN, KAS, ALPH) based on real-time profitability data from WhatToMine API.

## Features

### Mining Modes
- **CPU Only**: Traditional CPU mining with Cosmic Harmony
- **GPU Only**: GPU mining with Cosmic Harmony
- **Dual (CPU + GPU)**: Simultaneous CPU + GPU mining
- **GPU Revenue Mining**: Automatic profit switching between GPU coins

### GPU Revenue Mining
- **Automatic Coin Switching**: Switches between ETC, ERG, RVN, KAS, and ALPH based on profitability
- **Real-time Updates**: Uses WhatToMine API for live profitability data
- **Hysteresis Protection**: Prevents excessive switching with cooldown periods
- **Configurable Coins**: Default set to ETC, ERG, RVN, KAS, ALPH

## Configuration

### Desktop Agent Settings
```json
{
  "miningMode": "gpu-revenue",
  "gpuRevenue": true,
  "gpuRevenueCoins": ["ERG", "RVN", "KAS", "ALPH"],
  "wallet": "your_zion_wallet_address",
  "threads": 4
}
```

### Environment Variables
- `ZION_GPU_REVENUE=1`: Enable GPU revenue mining
- `ZION_GPU_REVENUE_COINS=ERG,RVN,KAS,ALPH`: Comma-separated list of coins

## Architecture

### Pool System Integration
The desktop agent integrates with the ZION pool system's dynamic GPU infrastructure:

1. **Profit Switcher** (`pool/src/profit_switcher.rs`):
   - Fetches profitability data from WhatToMine API
   - Determines most profitable GPU coin
   - Broadcasts coin switching events

2. **Revenue Proxy** (`pool/src/revenue_proxy.rs`):
   - Manages connections to external GPU coin pools
   - Routes jobs based on active coin
   - Handles different stratum protocols (EthStratum, StandardStratum, etc.)

3. **Stream Scheduler** (`pool/src/stream_scheduler.rs`):
   - Allocates compute resources between ZION, Revenue, and NCL streams
   - Routes jobs to appropriate miners

### Supported GPU Coins

| Coin | Algorithm | Protocol | Pool Example | Status |
|------|-----------|----------|--------------|---------|
| ETC | Etchash (Ethash) | EthStratum | etc.2miners.com:1010 | ✅ **Highest Profitability** |
| ERG | Autolykos v2 | EthStratum | erg.2miners.com:8888 | ✅ Active |
| RVN | KawPow | EthStratum | rvn.2miners.com:6060 | ✅ Active |
| KAS | kHeavyHash | StandardStratum | pool.woolypooly.com:3112 | ✅ Active |
| ALPH | Blake3 | StandardStratum | alph.2miners.com:2020 | ✅ Active |

## Usage

1. **Enable GPU Revenue Mining**:
   - Open Desktop Agent settings
   - Select "GPU Revenue Mining" mode
   - Ensure GPU is detected and available

2. **Monitor Performance**:
   - Check mining logs for coin switching events
   - View hashrate and profitability in real-time
   - Monitor accepted/rejected shares per coin

3. **Configuration**:
   - Default coins: ERG, RVN, KAS, ALPH
   - Automatic switching every 5 minutes
   - 10% profit advantage threshold
   - 30-minute cooldown between switches

## Technical Details

### Mining Allocation (CH3 Architecture)
- **50% ZION**: Cosmic Harmony mining
- **25% Revenue**: CPU (XMR) + GPU (profit-switched coins)
- **25% NCL AI**: Neural Compute Layer processing

### GPU Detection
- **NVIDIA**: nvidia-smi detection
- **AMD**: rocm-smi detection
- **Metal**: macOS system_profiler
- **Environment Override**: `ZION_HAS_GPU=1/0`

### Profit Switching Logic
```rust
// Simplified switching logic
if new_coin_profit > current_coin_profit * (1.0 + threshold) {
    if time_since_last_switch > cooldown {
        switch_to_new_coin();
    }
}
```

**Priority Order**: ETC → ERG → RVN → KAS → ALPH (ETC has highest priority due to Etchash profitability)

## Troubleshooting

### GPU Not Detected
- Check `ZION_HAS_GPU` environment variable
- Verify GPU drivers are installed
- Check system GPU detection commands

### No Coin Switching
- Verify internet connection for WhatToMine API
- Check pool connectivity for configured coins
- Review mining logs for error messages

### Low Hashrate
- Ensure GPU is not overheating
- Check power settings and GPU utilization
- Verify mining software compatibility

## Future Enhancements

- **Additional Coins**: Support for more GPU coins (CFX, IRON, etc.)
- **Custom Pools**: User-configurable pool settings
- **Advanced Switching**: Machine learning-based switching predictions
- **Multi-GPU Support**: Individual GPU coin assignment
- **Profit History**: Historical profitability tracking and analytics</content>
<parameter name="filePath">/Users/yeshuae/Desktop/ZION/Zion-2.9.5-main/desktop-agent/GPU_REVENUE_MINING_README.md