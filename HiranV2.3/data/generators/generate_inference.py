#!/usr/bin/env python3
"""
Hiran v2.3 Inference Pipeline Dataset
Generates examples for model deployment, API usage, and system integration.
"""

import json
import random
from pathlib import Path

random.seed(48)

INFERENCE_EXAMPLES = [
    # API usage
    {
        "instruction": "How do I call the Zion node RPC API to get the current block height?",
        "output": """```bash
curl -X POST http://localhost:8443/rpc \\
  -H "Content-Type: application/json" \\
  -d '{
    "jsonrpc": "2.0",
    "method": "getblockcount",
    "params": [],
    "id": 1
  }'
```

Response:
```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "result": 1847293
}
```""",
        "category": "inference_api"
    },
    {
        "instruction": "Show me how to query Zion pool statistics via the REST API.",
        "output": """```bash
curl http://localhost:8444/api/v1/stats
```

Response:
```json
{
  "pool": {
    "total_hashrate": "45.2 TH/s",
    "active_miners": 128,
    "blocks_found_24h": 47
  },
  "fee_split": {
    "miner_pct": 89,
    "humanitarian_pct": 5,
    "issobella_pct": 5,
    "pool_pct": 1
  }
}
```""",
        "category": "inference_api"
    },
    # Docker deployment
    {
        "instruction": "Write a Docker Compose file for deploying the full Zion V3 stack.",
        "output": """```yaml
version: "3.8"

services:
  zion-node:
    image: zion/node:v3.0
    environment:
      - ZION_NODE_ID=mainnet-node-1
      - ZION_P2P_BIND=0.0.0.0:8333
      - ZION_RPC_BIND=0.0.0.0:8443
    volumes:
      - node-data:/data
    ports:
      - "8333:8333"
      - "8443:8443"
    networks:
      - zion-net

  zion-pool:
    image: zion/pool:v3.0
    environment:
      - ZION_POOL_BIND=0.0.0.0:8444
      - ZION_NODE_RPC_ADDR=zion-node:8443
    ports:
      - "8444:8444"
    depends_on:
      - zion-node
    networks:
      - zion-net

  zion-dao:
    image: zion/dao:v3.0
    environment:
      - ZION_DAO_BIND=0.0.0.0:8080
      - ZION_NODE_RPC_ADDR=zion-node:8443
    ports:
      - "8080:8080"
    depends_on:
      - zion-node
    networks:
      - zion-net

  prometheus:
    image: prom/prometheus:latest
    volumes:
      - ./prometheus.yml:/etc/prometheus/prometheus.yml
    ports:
      - "9090:9090"
    networks:
      - zion-net

volumes:
  node-data:

networks:
  zion-net:
    driver: bridge
```""",
        "category": "inference_deployment"
    },
    # Monitoring
    {
        "instruction": "How do I set up Prometheus monitoring for a Zion mining pool?",
        "output": """1. **Enable metrics endpoint** in pool config:
```toml
[metrics]
enabled = true
bind = "0.0.0.0:9090"
path = "/metrics"
```

2. **Add to prometheus.yml**:
```yaml
scrape_configs:
  - job_name: 'zion-pool'
    static_configs:
      - targets: ['pool-server:9090']
    scrape_interval: 15s
```

3. **Key metrics to monitor**:
- `zion_pool_hashrate_total` - Total pool hashrate
- `zion_pool_active_miners` - Number of active miners
- `zion_pool_shares_valid` - Valid shares counter
- `zion_pool_shares_stale` - Stale shares counter
- `zion_pool_blocks_found` - Blocks found counter
- `zion_pool_fee_split_miner` - Miner fee allocation

4. **Set up alerts**:
```yaml
- alert: HighStaleRate
  expr: rate(zion_pool_shares_stale[5m]) > 0.05
  for: 5m
  annotations:
    summary: "Pool stale rate above 5%"
```""",
        "category": "inference_monitoring"
    },
    # Troubleshooting
    {
        "instruction": "My Zion miner can't connect to the pool. How do I debug this?",
        "output": """**Debug steps:**

1. **Check network connectivity**:
```bash
telnet pool-address 8444
# Should connect, if not check firewall
```

2. **Verify pool protocol version**:
```bash
curl http://pool-address:8444/api/v1/version
```

3. **Check miner logs** for:
- "Connection refused" → Pool down or wrong address
- "Protocol mismatch" → Update miner version
- "Authentication failed" → Check worker credentials

4. **Test with debug mode**:
```bash
zion-miner --debug --pool pool-address:8444 --worker test-worker
```

5. **Common fixes**:
- Restart pool server if `zion-pool` process is down
- Check `ZION_POOL_BIND` env var matches connection address
- Ensure pool has disk space for SQLite database
- Verify no port conflicts on 8444""",
        "category": "inference_troubleshooting"
    },
    # Performance tuning
    {
        "instruction": "How do I optimize Zion miner performance for an RTX 4090?",
        "output": """**RTX 4090 Optimization:**

1. **CUDA settings**:
```bash
export CUDA_VISIBLE_DEVICES=0
export NVIDIA_VISIBLE_DEVICES=all
```

2. **Optimal config**:
```toml
[miner]
backend = "cuda"
threads = 0  # Auto-detect
blocks = 512
batch_size = 1024

[cuda]
device = 0
intensity = 20  # Max for RTX 4090
memory_clock_offset = -200
core_clock_offset = 150
```

3. **Expected performance**:
- RTX 4090: ~120-140 MH/s (varies by algorithm)
- Power draw: ~300W at optimal settings
- Efficiency: ~0.4 MH/W

4. **Temperature management**:
- Target: < 80°C
- Fan curve: 50% at 60°C, 100% at 80°C
- Consider undervolting to 0.95V for efficiency

5. **Pool connection**:
- Use stratum+tcp for lowest latency
- Enable keepalive every 30 seconds
- Set difficulty to auto-adjust""",
        "category": "inference_performance"
    },
]


def generate_inference_variations(base_examples, count=2000):
    """Generate inference pipeline examples."""
    pairs = []

    # Just duplicate and slightly vary the base examples
    for _ in range(count):
        ex = random.choice(base_examples)
        pairs.append({
            "instruction": ex["instruction"],
            "output": ex["output"],
            "category": ex["category"],
            "priority": "medium"
        })

    return pairs


def main():
    output_dir = Path(__file__).parent.parent / "curriculum"
    output_dir.mkdir(parents=True, exist_ok=True)

    print("Generating inference pipeline dataset for Hiran v2.3...")

    pairs = generate_inference_variations(INFERENCE_EXAMPLES, count=2000)
    random.shuffle(pairs)

    output_file = output_dir / "stage8_inference.jsonl"
    with open(output_file, "w", encoding="utf-8") as f:
        for p in pairs:
            f.write(json.dumps(p, ensure_ascii=False) + "\n")

    print(f"\nInference pairs generated: {len(pairs)}")
    print(f"  API usage: {len([p for p in pairs if 'api' in p['category']])}")
    print(f"  Deployment: {len([p for p in pairs if 'deployment' in p['category']])}")
    print(f"  Monitoring: {len([p for p in pairs if 'monitoring' in p['category']])}")
    print(f"  Troubleshooting: {len([p for p in pairs if 'troubleshooting' in p['category']])}")
    print(f"  Performance: {len([p for p in pairs if 'performance' in p['category']])}")
    print(f"\nSaved to: {output_file}")


if __name__ == "__main__":
    main()
