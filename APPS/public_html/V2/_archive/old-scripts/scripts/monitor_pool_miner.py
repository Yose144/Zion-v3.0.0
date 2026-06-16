#!/usr/bin/env python3
"""
🚀 ZION Mining Pool Monitor
Real-time monitoring of pool + miner interaction
"""

import subprocess
import json
import time
import sys
from datetime import datetime

# SSH Server
SSH_HOST = "91.98.122.165"
SSH_USER = "root"
POOL_PORT = 4444
MINER_WALLET = "ZionTESTADDRESS_MINER_001"

def ssh_cmd(cmd):
    """Execute command on SSH server"""
    try:
        result = subprocess.run(
            ['ssh', '-o', 'StrictHostKeyChecking=no', f'{SSH_USER}@{SSH_HOST}', cmd],
            capture_output=True,
            text=True,
            timeout=5
        )
        return result.stdout
    except Exception as e:
        return f"SSH Error: {e}"

def get_pool_stats():
    """Get pool statistics"""
    stats = ssh_cmd("python3 -c \"import sqlite3; db = sqlite3.connect('/root/.zion_pool.db'); c = db.cursor(); c.execute('SELECT COUNT(*) FROM miners'); print(c.fetchone()[0])\" 2>/dev/null || echo '0'")
    return stats.strip()

def get_pool_process():
    """Get pool process info"""
    ps_output = ssh_cmd("ps aux | grep 'zion_universal_pool_v2' | grep -v grep | awk '{print $3, $4}'")
    return ps_output.strip()

def get_miner_status():
    """Check if miner connected"""
    logs = ssh_cmd("tail -20 /tmp/miner.log 2>/dev/null || echo 'No miner logs'")
    return "Connected" in logs or "Mining" in logs

def get_blocks_found():
    """Get found blocks count"""
    blocks = ssh_cmd("python3 -c \"import sqlite3; db = sqlite3.connect('/root/.zion_pool.db'); c = db.cursor(); c.execute('SELECT COUNT(*) FROM blocks WHERE found=1'); print(c.fetchone()[0])\" 2>/dev/null || echo '0'")
    return blocks.strip()

def monitor_loop():
    """Main monitoring loop"""
    print("""
╔══════════════════════════════════════════════════════════════════╗
║          🚀 ZION Mining Pool + Miner Monitor 🚀                 ║
║                  Real-time Statistics                           ║
╚══════════════════════════════════════════════════════════════════╝
""")
    
    iteration = 0
    while True:
        try:
            iteration += 1
            timestamp = datetime.now().strftime("%H:%M:%S")
            
            print(f"\n[{timestamp}] Update #{iteration}")
            print("-" * 60)
            
            # Pool status
            print("📊 POOL STATUS:")
            proc_info = get_pool_process()
            if proc_info:
                cpu_usage, mem_usage = proc_info.split()
                print(f"   ✅ Running (CPU: {cpu_usage}%, Mem: {mem_usage}%)")
            else:
                print(f"   ❌ Pool not running!")
            
            # Active miners
            miner_count = get_pool_stats()
            print(f"   👥 Active Miners: {miner_count}")
            
            # Miner status
            print("\n💻 MINER STATUS:")
            if get_miner_status():
                print(f"   ✅ Miner Connected")
            else:
                print(f"   ⏳ Connecting...")
            
            # Blocks
            print("\n⛏️ MINING STATS:")
            blocks = get_blocks_found()
            print(f"   ⛏️ Blocks Found: {blocks}")
            
            # Real-time pool check
            print("\n🔌 POOL CONNECTION:")
            connections = ssh_cmd("lsof -i :4444 2>/dev/null | wc -l || echo 'N/A'").strip()
            if connections != "N/A":
                conn_count = int(connections) - 1  # Minus header
                print(f"   🔗 Active Connections: {conn_count}")
            
            print("\n" + "=" * 60)
            
            # Sleep before next update
            time.sleep(5)
            
        except KeyboardInterrupt:
            print("\n\n✋ Monitoring stopped.")
            sys.exit(0)
        except Exception as e:
            print(f"⚠️ Error: {e}")
            time.sleep(5)

if __name__ == "__main__":
    print("\n📡 Connecting to pool server at 91.98.122.165...\n")
    time.sleep(1)
    monitor_loop()
