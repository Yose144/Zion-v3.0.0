#!/usr/bin/env python3
"""
ZION Testing Node - Regtest Mode

Lightweight node for testing purposes.
Runs RPC server on localhost:8332 for integration tests.
"""

import sys
import os
import time
import signal
import logging

# Add src/core to path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'src', 'core'))

from new_zion_blockchain import NewZionBlockchain

# Setup logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s [%(levelname)s] %(name)s: %(message)s',
    handlers=[
        logging.FileHandler('zion_test_node.log'),
        logging.StreamHandler()
    ]
)
logger = logging.getLogger(__name__)


class TestNode:
    """ZION test node for regtest"""
    
    def __init__(self):
        self.blockchain = None
        self.running = False
        
    def start(self):
        """Start the test node"""
        logger.info("🚀 Starting ZION Test Node (Regtest Mode)")
        logger.info("=" * 60)
        
        try:
            # Initialize blockchain
            logger.info("📦 Initializing blockchain...")
            self.blockchain = NewZionBlockchain(
                db_file='zion_regtest.db',
                enable_p2p=False,  # No P2P for testing
                enable_rpc=False,  # We'll create custom RPC with higher rate limits
                network="regtest"  # Regtest mode
            )
            
            logger.info("✅ Blockchain initialized")
            logger.info(f"   Blocks: {len(self.blockchain.blocks)}")
            logger.info(f"   Network: regtest")
            logger.info(f"   Database: zion_regtest.db")
            
            # Start RPC server with high rate limits for testing
            logger.info("🌐 Starting RPC server...")
            import sys
            sys.path.insert(0, 'src/core')
            from zion_rpc_server import ZIONRPCServer
            self.blockchain.rpc_server = ZIONRPCServer(
                self.blockchain,
                port=8332,
                rate_limit_per_minute=10000,  # High limit for testing
                burst_limit=1000
            )
            self.blockchain.start_rpc_server()
            
            logger.info("=" * 60)
            logger.info("✅ ZION Test Node Running!")
            logger.info("=" * 60)
            logger.info("📡 RPC Server: http://localhost:8332")
            logger.info("👤 RPC User: zionrpc")
            logger.info("🔑 RPC Pass: zionpass")
            logger.info("=" * 60)
            logger.info("📝 Logs: zion_test_node.log")
            logger.info("💾 Database: zion_regtest.db")
            logger.info("=" * 60)
            logger.info("")
            logger.info("To run tests:")
            logger.info("  source venv_testing/bin/activate")
            logger.info("  pytest tests/integration/ -v")
            logger.info("")
            logger.info("To stop node: Ctrl+C")
            logger.info("=" * 60)
            
            self.running = True
            
            # Keep running
            try:
                while self.running:
                    time.sleep(1)
            except KeyboardInterrupt:
                logger.info("\n⚠️  Received shutdown signal...")
                self.stop()
                
        except Exception as e:
            logger.error(f"❌ Failed to start node: {e}")
            import traceback
            logger.error(traceback.format_exc())
            sys.exit(1)
    
    def stop(self):
        """Stop the test node"""
        logger.info("🛑 Stopping ZION Test Node...")
        self.running = False
        
        if self.blockchain:
            try:
                self.blockchain.stop_rpc_server()
                logger.info("✅ RPC server stopped")
            except Exception as e:
                logger.error(f"Error stopping RPC: {e}")
        
        logger.info("👋 ZION Test Node stopped")
        sys.exit(0)


def signal_handler(sig, frame):
    """Handle shutdown signals"""
    logger.info("\n⚠️  Received signal, shutting down...")
    if hasattr(signal_handler, 'node'):
        signal_handler.node.stop()
    else:
        sys.exit(0)


if __name__ == "__main__":
    # Setup signal handlers
    signal.signal(signal.SIGINT, signal_handler)
    signal.signal(signal.SIGTERM, signal_handler)
    
    # Create and start node
    node = TestNode()
    signal_handler.node = node  # Store reference for signal handler
    
    try:
        node.start()
    except Exception as e:
        logger.error(f"❌ Node crashed: {e}")
        import traceback
        logger.error(traceback.format_exc())
        sys.exit(1)
