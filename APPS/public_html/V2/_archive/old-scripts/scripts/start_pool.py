#!/usr/bin/env python3
"""
🏊 ZION Pool v2.9 Launcher
=========================

Start pool with configuration file.
"""

import asyncio
import json
import logging
import sys
from pathlib import Path

# Add project root to path
sys.path.insert(0, str(Path(__file__).parent))

from src.pool import ZionUniversalPool


async def main():
    """Main entry point"""
    
    # Parse arguments
    if len(sys.argv) < 2:
        print("Usage: python start_pool.py <config.json>")
        print("\nExample:")
        print("  python start_pool.py config/pool_local_test.json")
        sys.exit(1)
    
    config_path = sys.argv[1]
    
    # Load configuration
    try:
        with open(config_path, 'r') as f:
            config = json.load(f)
        print(f"✅ Loaded config from: {config_path}")
    except Exception as e:
        print(f"❌ Failed to load config: {e}")
        sys.exit(1)
    
    # Configure logging
    logging.basicConfig(
        level=logging.INFO,
        format='%(asctime)s | %(levelname)-8s | %(name)s | %(message)s',
        datefmt='%Y-%m-%d %H:%M:%S'
    )
    
    # Create data directory
    Path("data").mkdir(exist_ok=True)
    
    # Create and run pool
    print("\n" + "=" * 60)
    pool = ZionUniversalPool(config)
    
    try:
        await pool.run()
    except KeyboardInterrupt:
        print("\n🛑 Received interrupt signal")
    except Exception as e:
        logging.error(f"❌ Pool error: {e}", exc_info=True)
    finally:
        await pool.stop()


if __name__ == "__main__":
    asyncio.run(main())
