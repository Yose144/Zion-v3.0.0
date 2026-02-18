#!/usr/bin/env python3
"""
🔥 ZION Universal AI Miner - Autolykos v2 Edition
Quick start script for GPU/CPU hybrid mining
"""

import sys
import os
import time
import json
import argparse
import logging

# Add parent directory to path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from zion_universal_miner import (
    ZionUniversalMiner, 
    MiningMode, 
    MiningAlgorithm,
    quick_start_mining
)

# Setup logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

def print_banner():
    """Print ASCII banner"""
    banner = """
    ╔═══════════════════════════════════════════════════════════╗
    ║                                                           ║
    ║   🔥 ZION 2.8 UNIVERSAL AI MINER - AUTOLYKOS v2 🔥      ║
    ║                                                           ║
    ║   CPU + GPU Hybrid Mining with Consciousness Gaming     ║
    ║                                                           ║
    ╚═══════════════════════════════════════════════════════════╝
    """
    print(banner)

def main():
    parser = argparse.ArgumentParser(
        description='ZION Universal AI Miner - Autolykos v2'
    )
    
    parser.add_argument(
        '--mode',
        choices=['cpu', 'gpu', 'hybrid', 'auto'],
        default='auto',
        help='Mining mode (default: auto)'
    )
    
    parser.add_argument(
        '--pool',
        default='stratum+tcp://91.98.122.165:3333',
        help='Mining pool URL (default: ZION pool)'
    )
    
    parser.add_argument(
        '--wallet',
        default='Z32f72f93c095d78fc8a2fe01c0f97fd4a7f6d1bcd9b251f73b18b5625be654e84',
        help='Wallet address for payouts'
    )
    
    parser.add_argument(
        '--worker',
        default='zion_universal_ai_miner',
        help='Worker name'
    )
    
    parser.add_argument(
        '--algorithm',
        choices=['autolykos2', 'ethash', 'kawpow', 'randomx', 'yescrypt', 'auto'],
        default='autolykos2',
        help='Mining algorithm (default: autolykos2)'
    )
    
    parser.add_argument(
        '--duration',
        type=int,
        default=0,
        help='Mining duration in seconds (0 = infinite)'
    )
    
    parser.add_argument(
        '--ai-optimize',
        action='store_true',
        default=True,
        help='Enable AI optimization'
    )
    
    args = parser.parse_args()
    
    print_banner()
    
    try:
        # Initialize miner
        logger.info(f"🚀 Initializing miner in {args.mode} mode...")
        
        mode_map = {
            'cpu': MiningMode.CPU_ONLY,
            'gpu': MiningMode.GPU_ONLY,
            'hybrid': MiningMode.HYBRID,
            'auto': MiningMode.AUTO
        }
        
        miner = ZionUniversalMiner(mode=mode_map[args.mode])
        
        # Display initial status
        logger.info("\n" + "="*60)
        logger.info("📊 MINER STATUS")
        logger.info("="*60)
        
        status = miner.get_status()
        print(json.dumps(status, indent=2))
        
        # Start mining
        logger.info("\n" + "="*60)
        logger.info("🎯 STARTING MINING")
        logger.info("="*60)
        
        result = miner.start_mining(
            pool_url=args.pool,
            wallet_address=args.wallet,
            worker_name=args.worker,
            algorithm=args.algorithm
        )
        
        print(json.dumps(result, indent=2))
        
        if not result['success']:
            logger.error(f"Failed to start mining: {result['message']}")
            return 1
        
        logger.info(f"\n✅ Mining started successfully!")
        logger.info(f"   Mode: {args.mode}")
        logger.info(f"   Algorithm: {args.algorithm}")
        logger.info(f"   Pool: {args.pool}")
        logger.info(f"   Wallet: {args.wallet[:30]}...")
        logger.info(f"   Worker: {args.worker}")
        
        if args.ai_optimize:
            miner.toggle_ai_optimization(True)
            logger.info(f"   AI Optimization: ENABLED")
        
        # Mining loop
        if args.duration > 0:
            logger.info(f"\n⏳ Mining for {args.duration} seconds...")
            start_time = time.time()
            
            while (time.time() - start_time) < args.duration:
                time.sleep(10)
                
                # Print status every 30 seconds
                if int((time.time() - start_time) / 10) % 3 == 0:
                    status = miner.get_status()
                    elapsed = int(time.time() - start_time)
                    remaining = args.duration - elapsed
                    
                    logger.info(f"\n📊 Mining Status ({elapsed}s / {args.duration}s)")
                    logger.info(f"   CPU Hashrate: {status['performance']['cpu_hashrate']:.2f} H/s")
                    logger.info(f"   GPU Hashrate: {status['performance']['gpu_hashrate']:.2f} MH/s")
                    logger.info(f"   Total Hashrate: {status['performance']['total_hashrate']:.2f} H/s")
                    logger.info(f"   Power: {status['performance']['power_consumption']:.2f} W")
                    logger.info(f"   Efficiency: {status['performance']['efficiency_score']:.4f}")
                    logger.info(f"   Uptime: {status['statistics']['uptime_seconds']:.0f}s")
        else:
            logger.info(f"\n♾️  Mining indefinitely (Ctrl+C to stop)...")
            
            try:
                while True:
                    time.sleep(30)
                    
                    status = miner.get_status()
                    elapsed = status['statistics']['uptime_seconds']
                    
                    logger.info(f"\n📊 Mining Status (uptime: {elapsed:.0f}s)")
                    logger.info(f"   CPU: {status['performance']['cpu_hashrate']:.2f} H/s")
                    logger.info(f"   GPU: {status['performance']['gpu_hashrate']:.2f} MH/s")
                    logger.info(f"   Total: {status['performance']['total_hashrate']:.2f} H/s")
                    logger.info(f"   Power: {status['performance']['power_consumption']:.2f} W")
                    logger.info(f"   Efficiency: {status['performance']['efficiency_score']:.4f}")
                    
            except KeyboardInterrupt:
                logger.info("\n\n⏹️  Stopping mining...")
        
        # Stop mining
        result = miner.stop_mining()
        
        logger.info("\n" + "="*60)
        logger.info("📊 FINAL STATISTICS")
        logger.info("="*60)
        
        final_status = miner.get_status()
        print(json.dumps(final_status['statistics'], indent=2))
        
        logger.info("\n✅ Mining session complete!")
        
        return 0
        
    except Exception as e:
        logger.error(f"\n❌ Error: {e}")
        import traceback
        traceback.print_exc()
        return 1

if __name__ == "__main__":
    sys.exit(main())
