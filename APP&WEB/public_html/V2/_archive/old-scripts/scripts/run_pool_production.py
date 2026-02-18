#!/usr/bin/env python3
"""
Simple ZION Pool Runner - Synchronous version for production
"""

import asyncio
import signal
import sys
import logging

sys.path.insert(0, '/root')
from zion_universal_pool_v2 import ZionUniversalPool

# Setup logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)

logger = logging.getLogger(__name__)

# Global pool instance
pool = None
running = True

def signal_handler(signum, frame):
    """Handle shutdown signals"""
    global running
    logger.info("🛑 Shutdown signal received...")
    running = False

async def main():
    """Main async function"""
    global pool, running
    
    # Setup signal handlers
    signal.signal(signal.SIGINT, signal_handler)
    signal.signal(signal.SIGTERM, signal_handler)
    
    try:
        logger.info("🚀 Starting ZION Universal Pool v2...")
        logger.info("=" * 80)
        
        # Initialize pool
        pool = ZionUniversalPool(port=3333)
        
        logger.info("✅ Pool initialized successfully!")
        logger.info(f"📊 Port: 3333 (Stratum)")
        logger.info(f"📊 API Port: 3334")
        logger.info(f"📊 Metrics: 9090 (Prometheus)")
        logger.info(f"🔧 Algorithms: RandomX, Yescrypt, Autolykos v2, KawPow")
        logger.info("=" * 80)
        
        # Start server - wait forever
        logger.info("🌐 Starting server...")
        await pool.start_server()
        
    except KeyboardInterrupt:
        logger.info("\n⏹️  Interrupted by user")
    except Exception as e:
        logger.error(f"❌ Fatal error: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)
    finally:
        logger.info("👋 Pool shutdown complete")

if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        logger.info("\n⏹️  Pool stopped")
        sys.exit(0)
