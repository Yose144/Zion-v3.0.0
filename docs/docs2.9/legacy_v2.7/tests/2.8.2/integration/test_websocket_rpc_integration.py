#!/usr/bin/env python3
"""
Test WebSocket-RPC Integration
Simple test to verify WebSocket server integration with RPC server
"""

import sys
import os
import time
import json
import subprocess
import signal

def test_websocket_rpc_integration():
    """Test WebSocket-RPC server integration using subprocess"""
    print("🧪 Testing WebSocket-RPC Integration...")

    # Start the RPC server in background
    print("🚀 Starting RPC server...")
    server_process = subprocess.Popen([
        sys.executable, '-c',
        '''
import sys
sys.path.insert(0, "src")
from core.zion_rpc_server import ZIONRPCServer
from core.new_zion_blockchain import NewZionBlockchain

blockchain = NewZionBlockchain()
rpc_server = ZIONRPCServer(blockchain)
rpc_server.start()

print("✅ RPC + WebSocket servers started")
print("🌐 HTTP RPC: http://localhost:8545")
print("🌐 WebSocket: ws://localhost:8080")

# Keep running
try:
    while True:
        import time
        time.sleep(1)
except KeyboardInterrupt:
    rpc_server.stop()
'''
    ], cwd='/Users/yeshuae/Desktop/ZION/Zion-2.8-main')

    # Wait for server to start
    time.sleep(3)

    try:
        # Test RPC methods using curl
        print("\n📡 Testing RPC methods...")

        # Test get_websocket_status RPC method
        import requests
        rpc_payload = {
            'jsonrpc': '2.0',
            'method': 'get_websocket_status',
            'params': [],
            'id': 1
        }

        try:
            response = requests.post('http://localhost:8545', json=rpc_payload, timeout=5)
            if response.status_code == 200:
                result = response.json()
                print("✅ WebSocket status RPC call successful:")
                print(json.dumps(result, indent=2))
            else:
                print(f"❌ RPC call failed: {response.status_code}")
        except requests.exceptions.RequestException as e:
            print(f"❌ HTTP request failed: {e}")

        # Test subscribe_events RPC method
        rpc_payload = {
            'jsonrpc': '2.0',
            'method': 'subscribe_events',
            'params': [['blockchain', 'mining']],
            'id': 2
        }

        try:
            response = requests.post('http://localhost:8545', json=rpc_payload, timeout=5)
            if response.status_code == 200:
                result = response.json()
                print("✅ Subscribe events RPC call successful:")
                print(json.dumps(result, indent=2))
            else:
                print(f"❌ RPC call failed: {response.status_code}")
        except requests.exceptions.RequestException as e:
            print(f"❌ HTTP request failed: {e}")

    except Exception as e:
        print(f"❌ Test failed: {e}")

    finally:
        # Stop the server
        print("\n🛑 Stopping server...")
        server_process.terminate()
        try:
            server_process.wait(timeout=5)
        except subprocess.TimeoutExpired:
            server_process.kill()

    print("\n📋 Manual Testing Instructions:")
    print("1. Run: python3 -c 'import sys; sys.path.insert(0, \"src\"); from core.zion_rpc_server import ZIONRPCServer; from core.new_zion_blockchain import NewZionBlockchain; b = NewZionBlockchain(); s = ZIONRPCServer(b); s.start(); input(\"Press Enter to stop\")'")
    print("2. Test WebSocket: wscat -c ws://localhost:8080")
    print("3. Send: {\"type\": \"ping\"}")
    print("4. Send: {\"type\": \"get_status\"}")
    print("5. Test RPC: curl -X POST http://localhost:8545 -H 'Content-Type: application/json' -d '{\"jsonrpc\":\"2.0\",\"method\":\"getblockcount\",\"params\":[],\"id\":1}'")

if __name__ == '__main__':
    test_websocket_rpc_integration()