#!/usr/bin/env python3
"""
Quick test script to submit a share to remote pool
Tests share validation with current algorithms
"""
import socket
import json
import time
import sys
from pathlib import Path

# Add workspace to path
sys.path.insert(0, str(Path(__file__).parent))

from src.core.algorithms import get_hash

def test_pool_share(host="91.98.122.165", port=3333):
    """Submit a test share to the pool"""
    print(f"🔌 Connecting to {host}:{port}...")
    
    sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    sock.settimeout(10)
    
    try:
        sock.connect((host, port))
        print("✅ Connected!")
        
        # 1. Login
        login_msg = {
            "id": 1,
            "method": "login",
            "params": {
                "login": "ZIONTestMiner",
                "pass": "x",
                "agent": "test-script/1.0"
            }
        }
        
        print(f"\n📤 Sending login...")
        sock.sendall((json.dumps(login_msg) + "\n").encode())
        
        response = sock.recv(4096).decode().strip()
        print(f"📥 Login response: {response[:200]}...")
        
        login_data = json.loads(response)
        if "result" not in login_data:
            print(f"❌ Login failed: {login_data}")
            return False
            
        result = login_data["result"]
        session_id = result["id"]
        job = result["job"]
        
        print(f"\n✅ Login successful!")
        print(f"   Session ID: {session_id}")
        print(f"   Job ID: {job['job_id']}")
        print(f"   Algorithm: {job.get('algo', 'randomx')}")
        print(f"   Difficulty: {job['target']}")
        print(f"   Blob: {job['blob'][:64]}...")
        
        # 2. Mine a share (do some actual work)
        print(f"\n⛏️  Mining share...")
        blob_bytes = bytes.fromhex(job["blob"])
        algo = job.get("algo", "randomx")
        
        # Map XMRig algorithm names to our internal names
        algo_map = {
            "rx/0": "randomx",
            "rx/zion": "randomx",
            "cosmic": "cosmic_harmony",
            "cosmic_harmony": "cosmic_harmony"
        }
        algo = algo_map.get(algo, algo)
        
        # Try nonces until we find one that meets difficulty
        start_time = time.time()
        for nonce in range(1000000):
            result_hash = get_hash(algo, blob_bytes, nonce)
            
            # Check if hash meets difficulty (quick check - first bytes should be low)
            if isinstance(result_hash, bytes):
                hash_int = int.from_bytes(result_hash[:8], 'little')
            else:
                hash_int = int(result_hash[:16], 16)
            
            if nonce % 10000 == 0:
                elapsed = time.time() - start_time
                hashrate = nonce / elapsed if elapsed > 0 else 0
                print(f"   Tried {nonce} nonces ({hashrate:.0f} H/s)...", end="\r")
            
            # Difficulty check - target is in little-endian hex
            # Lower hash value = higher difficulty met
            target_int = int(job["target"], 16)
            if hash_int < target_int:
                if isinstance(result_hash, bytes):
                    result_hex = result_hash.hex()
                else:
                    result_hex = result_hash
                    
                elapsed = time.time() - start_time
                print(f"\n\n✅ Found valid share! (nonce={nonce}, time={elapsed:.1f}s)")
                print(f"   Hash: {result_hex[:32]}...")
                print(f"   Hash int: {hash_int}")
                print(f"   Target: {target_int}")
                print(f"\n📤 Submitting share...")
                submit_msg = {
                    "id": 2,
                    "method": "submit",
                    "params": {
                        "id": session_id,
                        "job_id": job["job_id"],
                        "nonce": hex(nonce)[2:].zfill(8),
                        "result": result_hex
                    }
                }
                
                sock.sendall((json.dumps(submit_msg) + "\n").encode())
                
                submit_response = sock.recv(4096).decode().strip()
                print(f"📥 Submit response: {submit_response}")
                
                submit_data = json.loads(submit_response)
                if "result" in submit_data and submit_data["result"].get("status") == "OK":
                    print(f"\n✅ SHARE ACCEPTED!")
                    return True
                else:
                    print(f"\n❌ SHARE REJECTED: {submit_data}")
                    return False
        
        print(f"\n⚠️  No valid share found in 1M nonces")
        return False
        
    except Exception as e:
        print(f"\n❌ Error: {e}")
        import traceback
        traceback.print_exc()
        return False
    finally:
        sock.close()

if __name__ == "__main__":
    success = test_pool_share()
    sys.exit(0 if success else 1)
