#!/usr/bin/env python3
"""
ZION Mining Pool - Production Runner
"""

import signal
import sys
import asyncio
from zion_universal_pool_v2 import ZionUniversalPool

pool = None

def signal_handler(sig, frame):
    print('\n🛑 Shutting down pool...')
    sys.exit(0)

async def main():
    global pool
    
    print("🚀 ZION Mining Pool")
    print("=" * 50)
    
    # Initialize pool
    pool = ZionUniversalPool(port=3333)
    
    print(f"✅ Pool initialized")
    print(f"   Stratum: 0.0.0.0:3333")
    print(f"   Pool fee: {pool.pool_fee_percent * 100}%")
    print(f"   Base reward: {pool.base_block_reward} ZION")
    print("=" * 50)
    
    # Start pool server (async)
    await pool.start_server()

if __name__ == "__main__":
    signal.signal(signal.SIGINT, signal_handler)
    signal.signal(signal.SIGTERM, signal_handler)
    
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        print("\n🛑 Pool stopped")
