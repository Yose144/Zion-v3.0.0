#!/usr/bin/env python3
"""
ZION Lightweight Background Miner - Pro TestNet
Běží s 1 thread, nízká zátěž, neustálé těžení pro potvrzování transakcí
"""

import socket
import json
import time
import hashlib
import struct
import sys
from datetime import datetime

POOL_HOST = "localhost"
POOL_PORT = 3333
WALLET = "zion1qyfe883hey23jwfj498djawe98rfu0w0j23p7f"
WORKER = "bg-light-miner"

class LightweightMiner:
    def __init__(self):
        self.sock = None
        self.job = None
        self.connected = False
        
    def connect(self):
        """Připoj se k pool"""
        try:
            self.sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
            self.sock.settimeout(30)
            self.sock.connect((POOL_HOST, POOL_PORT))
            self.connected = True
            print(f"[{self.timestamp()}] ✅ Connected to {POOL_HOST}:{POOL_PORT}")
            return True
        except Exception as e:
            print(f"[{self.timestamp()}] ❌ Connection failed: {e}")
            return False
    
    def send(self, data):
        """Pošli JSON zprávu"""
        msg = json.dumps(data) + "\n"
        self.sock.sendall(msg.encode())
    
    def recv(self):
        """Přijmi JSON odpověď"""
        buffer = b""
        while True:
            chunk = self.sock.recv(1024)
            if not chunk:
                return None
            buffer += chunk
            if b"\n" in buffer:
                line, buffer = buffer.split(b"\n", 1)
                return json.loads(line.decode())
    
    def login(self):
        """Přihlaš se do pool"""
        self.send({
            "id": 1,
            "method": "login",
            "params": {
                "login": WALLET,
                "pass": WORKER,
                "agent": "ZION-Light/1.0"
            }
        })
        
        response = self.recv()
        if response and response.get("result"):
            self.job = response["result"]["job"]
            print(f"[{self.timestamp()}] ✅ Logged in, got job: height={self.job.get('height', '?')}")
            return True
        return False
    
    def mine_simple(self):
        """Těž s jednoduchou metodou (pro testování)"""
        if not self.job:
            return
        
        blob = bytes.fromhex(self.job["blob"])
        target = bytes.fromhex(self.job["target"])
        target_int = int.from_bytes(target, byteorder='big')
        
        # Těž max 100 pokusů, pak čekej na nový job
        for nonce in range(100):
            # Nahraď nonce v blobu (bytes 39-43)
            test_blob = blob[:39] + struct.pack("<I", nonce) + blob[43:]
            
            # Hash
            hash_result = hashlib.sha256(test_blob).digest()
            hash_int = int.from_bytes(hash_result, byteorder='big')
            
            # Zkontroluj target
            if hash_int < target_int:
                # Našli jsme share!
                result_hex = test_blob.hex()
                self.submit_share(result_hex, self.job["job_id"])
                return True
        
        return False
    
    def submit_share(self, result, job_id):
        """Odešli share"""
        try:
            self.send({
                "id": 2,
                "method": "submit",
                "params": {
                    "id": WALLET,
                    "job_id": job_id,
                    "nonce": "00000000",
                    "result": result
                }
            })
            
            response = self.recv()
            if response and response.get("result", {}).get("status") == "OK":
                print(f"[{self.timestamp()}] ✅ Share accepted!")
            else:
                error = response.get("error", {}).get("message", "Unknown error")
                print(f"[{self.timestamp()}] ❌ Share rejected: {error}")
        except Exception as e:
            print(f"[{self.timestamp()}] ⚠️  Submit failed: {e}")
    
    def get_new_job(self):
        """Čekej na nový job"""
        try:
            self.sock.settimeout(5)
            response = self.recv()
            if response and "method" in response and response["method"] == "job":
                self.job = response["params"]
                print(f"[{self.timestamp()}] 🔄 New job: height={self.job.get('height', '?')}")
                return True
        except socket.timeout:
            pass
        except Exception as e:
            print(f"[{self.timestamp()}] ⚠️  Job receive error: {e}")
        return False
    
    def timestamp(self):
        """Vrať timestamp"""
        return datetime.now().strftime("%H:%M:%S")
    
    def run(self):
        """Hlavní loop"""
        print("="*50)
        print("ZION Lightweight Miner - TestNet")
        print("="*50)
        
        while True:
            try:
                if not self.connected:
                    if not self.connect():
                        print(f"[{self.timestamp()}] Reconnecting in 30s...")
                        time.sleep(30)
                        continue
                    
                    if not self.login():
                        print(f"[{self.timestamp()}] Login failed, reconnecting...")
                        self.connected = False
                        time.sleep(10)
                        continue
                
                # Těž trochu
                self.mine_simple()
                
                # Krátká pauza (light mode)
                time.sleep(2)
                
                # Zkontroluj nový job
                self.get_new_job()
                
            except KeyboardInterrupt:
                print(f"\n[{self.timestamp()}] Stopping miner...")
                break
            except Exception as e:
                print(f"[{self.timestamp()}] ⚠️  Error: {e}")
                self.connected = False
                time.sleep(10)
        
        if self.sock:
            self.sock.close()

if __name__ == "__main__":
    miner = LightweightMiner()
    miner.run()
