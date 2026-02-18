#!/usr/bin/env python3
"""
⛏️ ZION Universal Miner Launcher
================================

Quick start for testing pool connection.
"""

import asyncio
import sys
from pathlib import Path

# Add project root to path
sys.path.insert(0, str(Path(__file__).parent))

from src.miners.zion_universal_miner import ZionUniversalMiner, MinerConfig, Algorithm


async def main():
    """Main entry point"""
    
    # Parse arguments
    pool_host = sys.argv[1] if len(sys.argv) > 1 else "localhost"
    pool_port = int(sys.argv[2]) if len(sys.argv) > 2 else 3335
    wallet = sys.argv[3] if len(sys.argv) > 3 else "zion1testminerwalletaddress123456789012345678901234"
    algo = sys.argv[4] if len(sys.argv) > 4 else "cosmic_harmony"
    
    print(f"""
╔═══════════════════════════════════════════════════════════╗
║         🔥 ZION Universal Miner v2.9 🔥                  ║
╠═══════════════════════════════════════════════════════════╣
║  Pool:      {pool_host}:{pool_port:<39} ║
║  Wallet:    {wallet[:20]}...{wallet[-10:]:<15} ║
║  Algorithm: {algo:<47} ║
╚═══════════════════════════════════════════════════════════╝
""")
    
    # Map algorithm name
    algo_map = {
        "cosmic_harmony": Algorithm.COSMIC_HARMONY,
        "cosmic": Algorithm.COSMIC_HARMONY,
        "randomx": Algorithm.RANDOMX,
        "rx": Algorithm.RANDOMX,
        "yescrypt": Algorithm.YESCRYPT,
    }
    
    selected_algo = algo_map.get(algo.lower())
    if not selected_algo:
        print(f"❌ Unknown algorithm: {algo}")
        print(f"Available: {', '.join(algo_map.keys())}")
        sys.exit(1)
    
    # Create miner config
    config = MinerConfig(
        pool_host=pool_host,
        pool_port=pool_port,
        wallet_address=wallet,
        worker_name="test-worker",
        algorithms=[selected_algo],
        threads=1,
        submit_interval=5.0
    )
    
    # Create and run miner
    miner = ZionUniversalMiner(config)
    
    try:
        await miner.run()
    except KeyboardInterrupt:
        print("\n🛑 Miner stopped by user")
    except Exception as e:
        print(f"❌ Miner error: {e}")
        import traceback
        traceback.print_exc()


if __name__ == "__main__":
    print("\n🚀 Starting miner...")
    asyncio.run(main())
