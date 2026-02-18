#!/usr/bin/env python3
"""
ZION Production Blockchain Runner
Keeps blockchain, P2P, and RPC servers running
"""

import signal
import sys
import time
import asyncio
from new_zion_blockchain import NewZionBlockchain

blockchain = None
loop = None

def signal_handler(sig, frame):
    """Handle Ctrl+C gracefully"""
    print('\n🛑 Shutting down ZION blockchain...')
    if blockchain:
        if blockchain.rpc_server:
            blockchain.rpc_server.stop()
        if blockchain.p2p_network:
            # P2P network stop is sync
            try:
                loop.run_until_complete(blockchain.p2p_network.stop())
            except:
                pass
    sys.exit(0)

async def main():
    global blockchain, loop
    loop = asyncio.get_event_loop()
    
    print("🚀 Starting ZION Blockchain (Production Mode)")
    print("=" * 60)
    
    # Initialize blockchain with P2P and RPC
    blockchain = NewZionBlockchain(
        enable_p2p=True, 
        p2p_port=18080,
        enable_rpc=True, 
        rpc_port=18081
    )
    
    print(f"✅ Blockchain initialized")
    print(f"   Height: {len(blockchain.blocks)}")
    print(f"   Balances: {len(blockchain.balances)}")
    print(f"   P2P Network: {'Active' if blockchain.p2p_network else 'Disabled'}")
    print(f"   RPC Server: {'Active' if blockchain.rpc_server else 'Disabled'}")
    print("=" * 60)
    
    # Start RPC server (sync)
    if blockchain.rpc_server:
        blockchain.rpc_server.start()
        print(f"🌐 RPC Server listening on port 18081")
    
    # Start P2P network (async)
    if blockchain.p2p_network:
        await blockchain.p2p_network.start()
        print(f"🌐 P2P Network listening on port 18080")
    
    print("\n✅ ZION Blockchain is running!")
    print("   Press Ctrl+C to stop\n")
    
    # Keep alive - check status every 30 seconds
    try:
        while True:
            await asyncio.sleep(30)
            height = len(blockchain.blocks)
            mempool = len(blockchain.pending_transactions)
            print(f"[STATUS] Height: {height}, Mempool: {mempool} txs")
    except KeyboardInterrupt:
        signal_handler(None, None)

if __name__ == "__main__":
    # Register signal handler
    signal.signal(signal.SIGINT, signal_handler)
    signal.signal(signal.SIGTERM, signal_handler)
    
    # Run async main
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        signal_handler(None, None)
