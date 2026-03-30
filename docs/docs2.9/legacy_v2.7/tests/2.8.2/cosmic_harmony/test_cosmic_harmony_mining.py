#!/usr/bin/env python3
"""
🌟 Test Cosmic Harmony Real Mining Mode 🌟
Tests actual Stratum protocol mining without simulation
"""

import sys
import os
import time
import logging

# Setup logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Add path for imports
sys.path.insert(0, os.path.dirname(__file__))
sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'ai'))
sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'zion', 'mining'))

def test_cosmic_harmony_mining():
    """Test Cosmic Harmony mining"""
    try:
        logger.info("\n" + "=" * 80)
        logger.info("🌟 TESTING COSMIC HARMONY REAL MINING MODE 🌟")
        logger.info("=" * 80)
        
        # Import miner
        from ai.zion_universal_miner import ZionUniversalMiner, MiningMode, MiningAlgorithm
        
        # Create miner
        logger.info("\n1️⃣  Creating Universal Miner...")
        miner = ZionUniversalMiner(mode=MiningMode.CPU_ONLY)
        logger.info(f"   Mode: {miner.mode.value}")
        logger.info(f"   CPU available: {miner.cpu_available}")
        logger.info(f"   Optimal threads: {miner.optimal_cpu_threads}")
        
        # Check Cosmic Harmony availability
        logger.info("\n2️⃣  Checking Cosmic Harmony availability...")
        from ai.zion_universal_miner import COSMIC_HARMONY_AVAILABLE
        if COSMIC_HARMONY_AVAILABLE:
            logger.info("   ✅ Cosmic Harmony wrapper available!")
        else:
            logger.warning("   ⚠️  Cosmic Harmony wrapper not available")
        
        # Start Cosmic Harmony mining
        logger.info("\n3️⃣  Starting Cosmic Harmony mining...")
        logger.info("   Pool: 127.0.0.1:3336 (localhost)")
        logger.info("   Wallet: ZION_TEST_WALLET")
        logger.info("   Worker: test_worker")
        
        result = miner.start_mining(
            pool_url="stratum+tcp://127.0.0.1:3336",
            wallet_address="ZION_TEST_WALLET",
            worker_name="test_worker",
            algorithm="cosmic_harmony"
        )
        
        logger.info(f"\n   Result: {result['success']}")
        logger.info(f"   Message: {result['message']}")
        
        if not result['success']:
            logger.warning(f"   ⚠️  Mining start failed!")
            return False
        
        # Monitor mining for 10 seconds
        logger.info("\n4️⃣  Mining for 10 seconds...")
        for i in range(10):
            time.sleep(1)
            status = miner.get_status()
            logger.info(f"   [{i+1}s] Hashrate: {status.get('cpu_hashrate', 0):.0f} H/s | Shares: {status.get('shares_found', 0)}")
        
        # Stop mining
        logger.info("\n5️⃣  Stopping mining...")
        stop_result = miner.stop_mining()
        logger.info(f"   Result: {stop_result['success']}")
        logger.info(f"   Message: {stop_result['message']}")
        
        final_status = miner.get_status()
        logger.info(f"\n   Final Stats:")
        logger.info(f"   - Hashrate: {final_status.get('cpu_hashrate', 0):.0f} H/s")
        logger.info(f"   - Shares: {final_status.get('shares_found', 0)}")
        logger.info(f"   - Algorithm: {final_status.get('cpu_algorithm', 'N/A')}")
        
        logger.info("\n" + "=" * 80)
        logger.info("✅ COSMIC HARMONY MINING TEST COMPLETED")
        logger.info("=" * 80 + "\n")
        
        return True
        
    except Exception as e:
        logger.error(f"Test failed: {e}")
        import traceback
        traceback.print_exc()
        return False

if __name__ == "__main__":
    success = test_cosmic_harmony_mining()
    sys.exit(0 if success else 1)
