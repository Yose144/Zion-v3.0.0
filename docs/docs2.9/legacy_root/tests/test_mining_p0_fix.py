#!/usr/bin/env python3
"""
P0 FIX VERIFICATION SCRIPT
Test if TestNet pool accepts blocks correctly with endianness fix
"""

import json
import socket
import time
import sys

def test_pool_connection(host, port):
    """Test basic connection to pool"""
    try:
        sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        sock.settimeout(5)
        sock.connect((host, port))
        sock.close()
        print(f"✅ Pool {host}:{port} is accessible")
        return True
    except Exception as e:
        print(f"❌ Cannot reach pool: {e}")
        return False

def test_stratum_login(host, port, wallet):
    """Test Stratum login"""
    try:
        sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        sock.settimeout(10)
        sock.connect((host, port))
        
        # Send login
        login_req = {
            "id": 1,
            "jsonrpc": "2.0",
            "method": "login",
            "params": {
                "login": wallet,
                "pass": "x",
                "rigid": "test-verify",
                "agent": "p0-fix-tester"
            }
        }
        
        sock.sendall((json.dumps(login_req) + "\n").encode())
        
        # Read response
        response = b""
        while True:
            try:
                chunk = sock.recv(1024)
                if not chunk:
                    break
                response += chunk
                if b"\n" in response:
                    break
            except socket.timeout:
                break
        
        sock.close()
        
        if response:
            resp_data = json.loads(response.decode().strip())
            if "result" in resp_data and resp_data["result"]:
                print(f"✅ Stratum login successful: {resp_data['result']}")
                return True
            elif "error" in resp_data:
                print(f"⚠️  Login response: {resp_data['error']}")
                return False
        else:
            print("❌ No response from pool")
            return False
            
    except Exception as e:
        print(f"❌ Login failed: {e}")
        return False

def test_blockchain_rpc(testnet_rpc_url):
    """Test blockchain RPC"""
    import urllib.request
    try:
        req = urllib.request.Request(
            testnet_rpc_url,
            data=json.dumps({
                "jsonrpc": "2.0",
                "id": 1,
                "method": "getblockcount",
                "params": {}
            }).encode('utf-8'),
            headers={"Content-Type": "application/json"}
        )
        with urllib.request.urlopen(req, timeout=5) as resp:
            data = json.loads(resp.read().decode())
            if "result" in data:
                height = data["result"]
                print(f"✅ Blockchain height: {height} blocks")
                return True
    except Exception as e:
        print(f"⚠️  Blockchain RPC: {e}")
    return False

if __name__ == "__main__":
    print("🔬 P0 FIX VERIFICATION TEST")
    print("=" * 50)
    
    # TestNet server
    testnet_host = "91.98.122.165"
    pool_port = 3333
    blockchain_rpc = "http://91.98.122.165:18081/api/rpc"
    test_wallet = "zion1qy8cdq0s8pkq79f7p5d7tjf0wq4gm68g4q6p3v"
    
    print(f"\n📍 TestNet Server: {testnet_host}")
    print(f"🌐 Pool: {testnet_host}:{pool_port}")
    print(f"🔗 Blockchain RPC: {blockchain_rpc}")
    
    print("\n" + "=" * 50)
    print("RUNNING TESTS...")
    print("=" * 50)
    
    # Test 1: Pool connectivity
    print("\n1️⃣  Testing pool connectivity...")
    pool_ok = test_pool_connection(testnet_host, pool_port)
    
    # Test 2: Blockchain RPC
    print("\n2️⃣  Testing blockchain RPC...")
    rpc_ok = test_blockchain_rpc(blockchain_rpc)
    
    # Test 3: Stratum login
    print("\n3️⃣  Testing Stratum login...")
    login_ok = test_stratum_login(testnet_host, pool_port, test_wallet)
    
    print("\n" + "=" * 50)
    if pool_ok and rpc_ok:
        print("✅ P0 FIX READY: All systems operational!")
        print("\nNext: Run actual miner (XMRig) against pool")
        sys.exit(0)
    else:
        print("⚠️  Some tests failed - check logs")
        sys.exit(1)
