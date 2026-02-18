# ZION Testnet Miner
# Simple CPU miner to connect to the local Testnet cluster

import requests
import time
import hashlib
import json
import random

NODE_URL = "http://localhost:8545"
WALLET_ADDRESS = "zion1testnet_miner_wallet"

def get_block_template():
    try:
        # Simulate getblocktemplate (since our simple RPC might not have it fully implemented yet)
        # We'll use getmininginfo to get difficulty and block count
        response = requests.post(
            NODE_URL,
            json={"jsonrpc": "2.0", "method": "getmininginfo", "params": [], "id": 1},
            timeout=5
        )
        data = response.json()
        if 'result' in data and data['result']:
            return data['result']
    except Exception as e:
        print(f"Error connecting to node: {e}")
    return None

def submit_block(block_data):
    try:
        response = requests.post(
            NODE_URL,
            json={"jsonrpc": "2.0", "method": "submitblock", "params": [block_data], "id": 1},
            timeout=5
        )
        print(f"Submit response: {response.json()}")
    except Exception as e:
        print(f"Error submitting block: {e}")

def mine():
    print(f"⛏️  Starting ZION Miner connected to {NODE_URL}")
    print(f"👛 Wallet: {WALLET_ADDRESS}")
    
    hashes = 0
    start_time = time.time()
    
    while True:
        # 1. Get mining info
        info = get_block_template()
        if not info:
            time.sleep(2)
            continue
            
        difficulty = info.get('difficulty', 4)
        target_prefix = "0" * difficulty
        
        # 2. Mining loop (simplified)
        # In a real miner, we would construct a full block header.
        # Here we are just simulating the RPC interaction for the user to see "activity".
        # To actually mine on the node, we should use the 'generatetoaddress' RPC method 
        # which is implemented in the standalone_rpc_server.py
        
        print(f"🔨 Mining block at height {info.get('blocks', '?')} (Diff: {difficulty})...")
        
        # Use the node's internal miner via RPC for simplicity in this test script
        try:
            response = requests.post(
                NODE_URL,
                json={"jsonrpc": "2.0", "method": "generatetoaddress", "params": [1, WALLET_ADDRESS], "id": 1},
                timeout=30
            )
            result = response.json().get('result')
            if result:
                print(f"✅ BLOCK FOUND! Hash: {result[0]}")
            else:
                print("⏳ No block found this round.")
        except Exception as e:
            print(f"Mining error: {e}")
            
        time.sleep(1)

if __name__ == "__main__":
    mine()
