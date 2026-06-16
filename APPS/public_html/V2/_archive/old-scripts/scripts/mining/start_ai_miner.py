#!/usr/bin/env python3
"""
🔥 ZION AI Miner Startup Script
Connects to production pool at 91.98.122.165:3333
"""

import sys
import os
import logging
import time

# Add ai directory to path
sys.path.insert(0, '/media/maitreya/ZION1/ai')

from zion_universal_miner import ZionUniversalMiner, MiningMode

# Setup logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

def main():
    """Start AI miner and connect to production pool"""
    
    # Production pool configuration
    POOL_URL = "91.98.122.165:3333"
    WALLET_ADDRESS = "ZION_SACRED_B0FA7E2A234D8C2F08545F02295C98"
    WORKER_NAME = "ai_miner_001"
    
    logger.info("=" * 80)
    logger.info("🔥 ZION AI UNIVERSAL MINER - Production Test 🔥")
    logger.info("=" * 80)
    logger.info(f"📡 Pool: {POOL_URL}")
    logger.info(f"💰 Wallet: {WALLET_ADDRESS}")
    logger.info(f"🏷️  Worker: {WORKER_NAME}")
    logger.info("=" * 80)
    
    try:
        # Initialize miner in CPU-only mode (safer for testing)
        logger.info("🚀 Initializing AI miner (CPU mode)...")
        miner = ZionUniversalMiner(mode=MiningMode.CPU_ONLY)
        
        # Display hardware info
        logger.info(f"💻 CPU Available: {miner.cpu_available}")
        logger.info(f"🎮 GPU Available: {miner.gpu_available}")
        logger.info(f"🔧 GPU Count: {miner.gpu_count}")
        logger.info(f"⚡ Optimal CPU Threads: {miner.optimal_cpu_threads}")
        logger.info(f"📊 XMRig Path: {miner.xmrig_path or 'Simulated'}")
        logger.info(f"📊 SRBMiner Path: {miner.srbminer_path or 'Simulated'}")
        
        # Start mining
        logger.info("")
        logger.info("🔥 Starting mining operations...")
        result = miner.start_mining(
            pool_url=POOL_URL,
            wallet_address=WALLET_ADDRESS,
            worker_name=WORKER_NAME
        )
        
        if result['success']:
            logger.info("✅ Mining started successfully!")
            logger.info("")
            logger.info("📊 Initial Status:")
            logger.info(f"   Mode: {result['mode']}")
            logger.info(f"   Status: {result.get('status', {})}")
            logger.info("")
            logger.info("⏰ Mining for 60 seconds (testing)...")
            logger.info("   Press Ctrl+C to stop early")
            logger.info("")
            
            # Run for 60 seconds with status updates
            for i in range(12):  # 12 * 5 = 60 seconds
                time.sleep(5)
                status = miner.get_status()
                
                logger.info(f"📊 [{(i+1)*5}s] Status Update:")
                logger.info(f"   CPU Hashrate: {status.get('cpu_hashrate', 0):.2f} H/s")
                logger.info(f"   GPU Hashrate: {status.get('gpu_hashrate', 0):.2f} H/s")
                logger.info(f"   Total Hashrate: {status.get('total_hashrate', 0):.2f} H/s")
                logger.info(f"   Shares: {status.get('total_shares', 0)} ({status.get('accepted_shares', 0)} accepted)")
                logger.info("")
            
            # Stop mining
            logger.info("⏹️  Stopping mining...")
            miner.stop_mining()
            
            # Final stats
            final_status = miner.get_status()
            logger.info("")
            logger.info("=" * 80)
            logger.info("📊 FINAL MINING STATISTICS")
            logger.info("=" * 80)
            logger.info(f"Total Shares: {final_status.get('total_shares', 0)}")
            logger.info(f"Accepted Shares: {final_status.get('accepted_shares', 0)}")
            logger.info(f"Rejected Shares: {final_status.get('rejected_shares', 0)}")
            logger.info(f"Blocks Found: {final_status.get('blocks_found', 0)}")
            logger.info(f"Average Hashrate: {final_status.get('total_hashrate', 0):.2f} H/s")
            logger.info(f"Uptime: {final_status.get('uptime_seconds', 0):.0f} seconds")
            logger.info("=" * 80)
            
        else:
            logger.error(f"❌ Mining failed to start: {result.get('message')}")
            return 1
            
    except KeyboardInterrupt:
        logger.info("")
        logger.info("⏹️  Interrupted by user")
        if 'miner' in locals():
            miner.stop_mining()
    except Exception as e:
        logger.error(f"❌ Error: {e}")
        import traceback
        traceback.print_exc()
        return 1
    
    logger.info("")
    logger.info("✅ Test completed successfully!")
    return 0

if __name__ == "__main__":
    sys.exit(main())
