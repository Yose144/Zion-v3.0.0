#!/usr/bin/python3
"""
🚀 ZION Miner v2.9 Launcher
===========================

Quick start script for ZION mining.
"""

import asyncio
import sys
from pathlib import Path

# Add project root to path
sys.path.insert(0, str(Path(__file__).parent.parent))

from src.miner import ZionMiner
from src.miner.zion_miner_v2_9 import MinerConfig


async def main():
    """Main entry point"""
    import os
    
    # Defaults (can be overridden via env)
    wallet = os.environ.get("MINER_WALLET", "zion1qyfe883hey23jwfj498djawe98rfu0w0j23p7f")
    host = os.environ.get("MINER_POOL_HOST", "91.98.122.165")
    port = int(os.environ.get("MINER_POOL_PORT", "3333"))
    worker = os.environ.get("MINER_WORKER", "test-miner-v2.9")
    algo = os.environ.get("MINER_ALGO", "cosmic_harmony")
    threads = int(os.environ.get("MINER_THREADS", "2"))
    protocol = os.environ.get("MINER_PROTOCOL", "xmrig")
    stats_enabled = os.environ.get("MINER_STATS", "1") not in ("0", "false", "False")
    stats_interval = float(os.environ.get("MINER_STATS_INTERVAL", "10.0"))
    intensity = int(os.environ.get("MINER_INTENSITY", "1"))
    
    # Build config
    config = MinerConfig(
        wallet_address=wallet,
        pool_host=host,
        pool_port=port,
        worker_name=worker,
        algorithm=algo,
        threads=threads,
        protocol=protocol,
        intensity=intensity,
        stats_enabled=stats_enabled,
        stats_interval=stats_interval
    )
    
    print("\n" + "=" * 60)
    print("⛏️  ZION MINER v2.9")
    print("=" * 60)
    print(f"Pool:      {config.pool_host}:{config.pool_port}")
    print(f"Wallet:    {config.wallet_address}")
    print(f"Worker:    {config.worker_name}")
    print(f"Algorithm: {config.algorithm}")
    print(f"Threads:   {config.threads}")
    print(f"Protocol:  {config.protocol}")
    print("=" * 60 + "\n")
    
    miner = ZionMiner(config)
    await miner.start()


if __name__ == "__main__":
    import logging
    
    logging.basicConfig(
        level=logging.INFO,
        format='%(asctime)s [%(levelname)s] %(message)s',
        datefmt='%Y-%m-%d %H:%M:%S'
    )
    
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        print("\n🛑 Mining stopped by user")
    except Exception as e:
        print(f"\n❌ Error: {e}")
        sys.exit(1)
