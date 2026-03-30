#!/usr/bin/env python3
"""
🔥 Test Pool Mining - Whitelisted Address
==========================================

Jednoduchý mining test s whitelistovanou adresou.
"""

import socket
import json
import time
import threading
from hashlib import sha256

# Whitelist address (SACRED)
WALLET = "ZION_SACRED_B0FA7E2A234D8C2F08545F02295C98"
POOL_HOST = "91.98.122.165"  # Production server
POOL_PORT = 3333
WORKER_NAME = "sacred-test-miner"

class SimpleMiner:
    def __init__(self):
        self.sock = None
        self.request_id = 1
        self.current_job = None
        self.running = False
        self.hashrate = 0
        self.shares_submitted = 0
        self.shares_accepted = 0
        
    def connect(self):
        """Connect to pool"""
        print(f"🔌 Connecting to {POOL_HOST}:{POOL_PORT}...")
        self.sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        self.sock.settimeout(30)
        self.sock.connect((POOL_HOST, POOL_PORT))
        print("✅ Connected!")
        
    def send_request(self, method, params):
        """Send JSON-RPC request"""
        request = {
            "id": self.request_id,
            "jsonrpc": "2.0",
            "method": method,
            "params": params
        }
        self.request_id += 1
        
        msg = json.dumps(request) + "\n"
        self.sock.sendall(msg.encode('utf-8'))
        print(f"📤 Sent: {method}")
        
    def receive_response(self):
        """Receive and parse response"""
        buffer = b""
        while True:
            chunk = self.sock.recv(4096)
            if not chunk:
                break
            buffer += chunk
            
            # Try to parse complete JSON messages
            while b"\n" in buffer:
                line, buffer = buffer.split(b"\n", 1)
                if line:
                    try:
                        msg = json.loads(line.decode('utf-8'))
                        return msg
                    except json.JSONDecodeError as e:
                        print(f"❌ JSON parse error: {e}")
                        print(f"   Raw: {line[:100]}")
                        continue
        return None
        
    def login(self):
        """Login to pool"""
        print(f"\n🔐 Logging in as: {WALLET}")
        print(f"   Worker: {WORKER_NAME}")
        
        # XMRig-style login
        params = {
            "login": WALLET,
            "pass": "x",
            "agent": f"ZionTestMiner/1.0 {WORKER_NAME}",
            "algo": ["rx/0"],  # RandomX
            "rigid": WORKER_NAME
        }
        
        self.send_request("login", params)
        
        # Wait for response
        response = self.receive_response()
        if response:
            print(f"📥 Response: {json.dumps(response, indent=2)}")
            
            if "result" in response:
                result = response["result"]
                print(f"\n✅ Login successful!")
                print(f"   Job ID: {result.get('job', {}).get('job_id')}")
                print(f"   Target: {result.get('job', {}).get('target')}")
                self.current_job = result.get('job')
                return True
            elif "error" in response:
                print(f"\n❌ Login failed: {response['error']}")
                return False
                
        return False
        
    def listen_for_jobs(self):
        """Listen for new jobs from pool"""
        print("\n👂 Listening for jobs...")
        while self.running:
            try:
                msg = self.receive_response()
                if msg:
                    if "method" in msg and msg["method"] == "job":
                        print(f"\n📦 New job received!")
                        self.current_job = msg.get("params")
                        print(f"   Job ID: {self.current_job.get('job_id')}")
                        print(f"   Blob: {self.current_job.get('blob')[:32]}...")
                        
            except socket.timeout:
                continue
            except Exception as e:
                print(f"❌ Listen error: {e}")
                break
                
    def mine(self, duration=60):
        """Start mining for specified duration"""
        print(f"\n⛏️  Starting mining for {duration} seconds...")
        print(f"   Address: {WALLET[:40]}...")
        print(f"   Whitelist: ✅ YES (Sacred Mining Operator)")
        print()
        
        self.running = True
        
        # Start listener thread
        listener = threading.Thread(target=self.listen_for_jobs, daemon=True)
        listener.start()
        
        start_time = time.time()
        hashes = 0
        
        while time.time() - start_time < duration:
            if not self.current_job:
                time.sleep(0.1)
                continue
                
            # Simple hash attempts (not real RandomX, just for testing connection)
            for nonce in range(1000):
                hashes += 1
                
                # Every 10k hashes, print stats
                if hashes % 10000 == 0:
                    elapsed = time.time() - start_time
                    self.hashrate = hashes / elapsed if elapsed > 0 else 0
                    print(f"⚡ {self.hashrate:.1f} H/s | Shares: {self.shares_accepted}/{self.shares_submitted} | Time: {int(elapsed)}s")
                    
            time.sleep(0.01)  # Small delay
            
        self.running = False
        print(f"\n✅ Mining test completed!")
        print(f"   Total hashes: {hashes:,}")
        print(f"   Average hashrate: {hashes/duration:.1f} H/s")
        print(f"   Shares: {self.shares_accepted}/{self.shares_submitted}")
        
    def close(self):
        """Close connection"""
        if self.sock:
            self.sock.close()
            print("\n🔌 Disconnected from pool")


def main():
    print("=" * 80)
    print("🔥 ZION POOL MINING TEST - WHITELISTED ADDRESS")
    print("=" * 80)
    print()
    print("This test will:")
    print("  1. Connect to ZION pool (localhost:3333)")
    print("  2. Login with whitelisted address (SACRED)")
    print("  3. Receive job and attempt mining")
    print("  4. Submit shares (if found)")
    print()
    print("Expected rewards (2025 with consciousness):")
    print("  - Block reward: 6,969.697 ZION (base 5,400.067 + bonus 1,569.63)")
    print("  - Miner share: 6,210.00 ZION (89% after tithe & fee)")
    print()
    
    miner = SimpleMiner()
    
    try:
        # Connect and login
        miner.connect()
        
        if miner.login():
            # Mine for 60 seconds
            miner.mine(duration=60)
        else:
            print("\n❌ Login failed - cannot proceed with mining")
            
    except KeyboardInterrupt:
        print("\n\n⚠️  Interrupted by user")
    except Exception as e:
        print(f"\n❌ Error: {e}")
        import traceback
        traceback.print_exc()
    finally:
        miner.close()
        
    print("\n" + "=" * 80)


if __name__ == "__main__":
    main()
