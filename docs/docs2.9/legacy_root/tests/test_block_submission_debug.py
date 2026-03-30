#!/usr/bin/env python3
"""
🔍 Block Submission Debug Test
================================

Quick test to debug pool → blockchain block submission issue.

Usage:
    python test_block_submission_debug.py
"""

import asyncio
import logging
import sys
from pathlib import Path

# Add src to path
sys.path.insert(0, str(Path(__file__).parent / "src"))

from pool.blockchain.rpc_client import ZionRPCClient
from pool.mining.share_validator import ShareValidator

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s [%(levelname)s] %(name)s: %(message)s'
)
logger = logging.getLogger("BlockSubmissionDebug")


async def test_block_submission():
    """Test block submission flow"""
    
    logger.info("="*80)
    logger.info("🔍 STARTING BLOCK SUBMISSION DEBUG TEST")
    logger.info("="*80)
    
    # Initialize RPC client
    rpc = ZionRPCClient(host="localhost", port=18081)
    await rpc.start()
    
    try:
        # Step 1: Get block template
        logger.info("\n📋 STEP 1: Get block template from blockchain")
        template = await rpc.get_block_template("ZION_WALLET_ADDRESS_123")
        
        logger.info(f"Template received:")
        logger.info(f"  - height: {template.get('height')}")
        logger.info(f"  - difficulty: {template.get('difficulty')}")
        logger.info(f"  - seed_hash: {template.get('seed_hash', '')[:16]}...")
        
        # Check blob
        blob = template.get('blockhashing_blob') or template.get('blocktemplate_blob')
        if not blob:
            logger.error("❌ No blob in template!")
            return False
        
        logger.info(f"  - blob length: {len(blob)} hex chars ({len(blob)//2} bytes)")
        logger.info(f"  - blob: {blob}")
        
        # Step 2: Simulate mining (apply nonce)
        logger.info("\n⛏️  STEP 2: Simulate mining (apply nonce)")
        
        # Test nonce
        test_nonce = "12345678"  # 8 hex chars = 4 bytes
        
        logger.info(f"  - Test nonce: {test_nonce}")
        
        # Apply nonce to blob manually (without ShareValidator)
        import struct
        
        try:
            # Pack nonce as little-endian 4 bytes
            nonce_int = int(test_nonce, 16)
            nonce_packed = struct.pack("<I", nonce_int)
            nonce_hex = nonce_packed.hex()
            
            logger.info(f"  - Nonce int: {nonce_int}")
            logger.info(f"  - Nonce packed: {nonce_hex}")
            logger.info(f"  - Blob length: {len(blob)} chars")
            
            # Apply nonce at position 76-83 (bytes 38-41)
            blob_with_nonce = blob[:76] + nonce_hex + blob[84:]
            
            logger.info(f"✅ Nonce applied successfully")
            logger.info(f"  - Result blob length: {len(blob_with_nonce)} hex chars ({len(blob_with_nonce)//2} bytes)")
            logger.info(f"  - Result blob: {blob_with_nonce}")
        except Exception as e:
            logger.error(f"❌ Failed to apply nonce: {e}")
            return False
        
        # Step 3: Submit block to blockchain
        logger.info("\n📤 STEP 3: Submit block to blockchain")
        logger.info(f"  - Submitting blob: {blob_with_nonce}")
        
        # Note: This will likely fail because we didn't actually mine
        # But we'll see the blockchain parsing logic in action
        try:
            result = await rpc.submit_block(blob_with_nonce)
            logger.info(f"✅ Block submission result: {result}")
        except Exception as e:
            logger.warning(f"⚠️  Block submission error (expected): {e}")
            logger.info(f"   This is OK - we didn't actually mine, just testing format")
        
        logger.info("\n" + "="*80)
        logger.info("🔍 DEBUG TEST COMPLETE")
        logger.info("="*80)
        logger.info("\nCheck logs above for:")
        logger.info("1. Pool blob format (_apply_nonce)")
        logger.info("2. Blockchain parsing (validate_and_add_block)")
        logger.info("3. Any length/format mismatches")
        
        return True
        
    finally:
        await rpc.stop()


def main():
    """Main entry point"""
    logger.info("🚀 Starting block submission debug test...")
    
    try:
        result = asyncio.run(test_block_submission())
        return 0 if result else 1
    except KeyboardInterrupt:
        logger.info("\n⏹️  Interrupted by user")
        return 1
    except Exception as e:
        logger.error(f"\n❌ Fatal error: {e}")
        import traceback
        traceback.print_exc()
        return 1


if __name__ == "__main__":
    sys.exit(main())
