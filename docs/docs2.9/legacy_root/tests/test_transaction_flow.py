#!/usr/bin/env python3
"""
ZION Transaction Flow Test - TestNet
Tests: address creation, balance query, transaction submission, confirmation
NO MOCKS - Real TestNet at 91.98.122.165
"""

import requests
import json
import time
from typing import Dict, Any

# TestNet RPC endpoint
RPC_URL = "http://91.98.122.165:18081/json_rpc"

def rpc_call(method: str, params: Any = None) -> Dict[str, Any]:
    """Make RPC call to ZION blockchain."""
    payload = {
        "jsonrpc": "2.0",
        "id": 0,
        "method": method,
        "params": params or []
    }
    
    response = requests.post(
        RPC_URL,
        json=payload,
        headers={"Content-Type": "application/json"}
    )
    
    return response.json()

def create_address() -> Dict[str, str]:
    """Create new ZION address."""
    result = rpc_call("createaddress")
    if "result" in result:
        addr = result["result"]["address"]
        print(f"✅ Created address: {addr}")
        return result["result"]
    else:
        print(f"❌ Create address failed: {result}")
        return {}

def get_balance(address: str) -> float:
    """Get balance for address."""
    result = rpc_call("getbalance", [address])
    if "result" in result:
        balance = result["result"]["balance"]
        print(f"💰 Balance of {address}: {balance} ZION")
        return balance
    else:
        print(f"❌ Get balance failed: {result}")
        return 0.0

def send_transaction(from_addr: str, to_addr: str, amount: float) -> str:
    """Send transaction."""
    result = rpc_call("sendtransaction", {
        "from": from_addr,
        "to": to_addr,
        "amount": amount,
        "fee": 1.0
    })
    
    if "result" in result:
        tx_id = result["result"]["tx_id"]
        status = result["result"]["status"]
        print(f"📤 Transaction sent: {tx_id} ({status})")
        return tx_id
    else:
        print(f"❌ Send transaction failed: {result}")
        return ""

def get_transaction(tx_id: str) -> Dict[str, Any]:
    """Get transaction details."""
    result = rpc_call("gettransaction", [tx_id])
    if "result" in result:
        tx = result["result"]
        status = tx.get("status", "unknown")
        block_height = tx.get("block_height", None)
        amount = tx.get("amount", 0)
        print(f"🔍 Transaction {tx_id}:")
        print(f"   Status: {status}")
        print(f"   Block: {block_height}")
        print(f"   Amount: {amount} ZION")
        return tx
    else:
        print(f"❌ Get transaction failed: {result}")
        return {}

def get_blockchain_info() -> Dict[str, Any]:
    """Get blockchain info."""
    result = rpc_call("get_info")
    if "result" in result:
        info = result["result"]
        height = info["height"]
        tx_pool_size = info["tx_pool_size"]
        difficulty = info["difficulty"]
        print(f"⛓️  Blockchain: height={height}, mempool={tx_pool_size} txs, difficulty={difficulty}")
        return info
    else:
        print(f"❌ Get info failed: {result}")
        return {}

def wait_for_confirmation(tx_id: str, timeout: int = 120) -> bool:
    """Wait for transaction confirmation."""
    print(f"⏳ Waiting for confirmation of {tx_id}...")
    start_time = time.time()
    
    while time.time() - start_time < timeout:
        tx = get_transaction(tx_id)
        if tx.get("block_height"):
            print(f"✅ Transaction confirmed in block {tx['block_height']}")
            return True
        
        print(f"   Still pending... ({int(time.time() - start_time)}s elapsed)")
        time.sleep(10)
    
    print(f"❌ Timeout waiting for confirmation")
    return False

def main():
    print("=" * 70)
    print("ZION TRANSACTION FLOW TEST - TestNet")
    print("=" * 70)
    print()
    
    # Step 1: Get blockchain info
    print("📊 STEP 1: Blockchain Info")
    get_blockchain_info()
    print()
    
    # Step 2: Create test addresses
    print("🔑 STEP 2: Create Test Addresses")
    addr1 = create_address()
    addr2 = create_address()
    print()
    
    if not addr1 or not addr2:
        print("❌ Failed to create addresses")
        return
    
    # Step 3: Check pool address balance (sender)
    print("💰 STEP 3: Check Sender Balance")
    pool_addr = "zion1qyfe883hey23jwfj498djawe98rfu0w0j23p7f"
    sender_balance = get_balance(pool_addr)
    print()
    
    if sender_balance < 1000:
        print(f"❌ Insufficient balance: {sender_balance} ZION")
        return
    
    # Step 4: Send transaction
    print("📤 STEP 4: Send Transaction")
    tx_id = send_transaction(pool_addr, addr1["address"], 500.0)
    print()
    
    if not tx_id:
        print("❌ Transaction failed")
        return
    
    # Step 5: Wait for confirmation
    print("⏳ STEP 5: Wait for Confirmation")
    confirmed = wait_for_confirmation(tx_id, timeout=60)
    print()
    
    # Step 6: Verify balances
    print("✅ STEP 6: Verify Balances")
    get_balance(pool_addr)
    get_balance(addr1["address"])
    print()
    
    # Step 7: Test second transaction (if confirmed)
    if confirmed:
        print("📤 STEP 7: Test Second Transaction")
        tx_id2 = send_transaction(addr1["address"], addr2["address"], 100.0)
        print()
        
        if tx_id2:
            get_transaction(tx_id2)
    
    print()
    print("=" * 70)
    print("TEST COMPLETE")
    print("=" * 70)

if __name__ == "__main__":
    main()
