#!/usr/bin/env python3
"""
ZION Production Blockchain Runner (Simplified - RPC Only)
"""

import signal
import sys
import time
from new_zion_blockchain import NewZionBlockchain

blockchain = None

def signal_handler(sig, frame):
    print('\n🛑 Shutting down...')
    if blockchain and blockchain.rpc_server:
        blockchain.rpc_server.stop()
    sys.exit(0)

if __name__ == "__main__":
    print("🚀 ZION Blockchain - RPC Mode")
    print("=" * 50)
    
    # Initialize blockchain with RPC only (P2P disabled for simplicity)
    blockchain = NewZionBlockchain(
        enable_p2p=False,  # Disabled for now
        enable_rpc=True, 
        rpc_port=18081
    )
    
    print(f"✅ Blockchain: Height {len(blockchain.blocks)}, {len(blockchain.balances)} balances")
    
    # Start RPC server
    blockchain.rpc_server.start()
    print(f"🌐 RPC Server: http://0.0.0.0:18081")
    print("=" * 50)
    print("✅ Ready! Press Ctrl+C to stop\n")
    
    signal.signal(signal.SIGINT, signal_handler)
    signal.signal(signal.SIGTERM, signal_handler)
    
    try:
        while True:
            time.sleep(30)
            print(f"[OK] Height: {len(blockchain.blocks)}, Mempool: {len(blockchain.pending_transactions)}")
    except KeyboardInterrupt:
        signal_handler(None, None)
