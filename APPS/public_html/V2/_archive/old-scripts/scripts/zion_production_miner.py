#!/usr/bin/env python3
"""
🔥 ZION Production CPU Miner 🔥
Standalone miner pro production testnet s RPC submission
Verze: 1.0.0 (2025-10-30)

Features:
- SHA256 POW mining
- RPC block submission
- Real-time metrics
- Performance monitoring
- Background daemon mode
"""

import hashlib
import json
import time
import requests
import sys
import signal
import argparse
from datetime import datetime
from typing import Optional, Dict, Any

class ZionProductionMiner:
    """Production-ready ZION miner with metrics"""
    
    def __init__(self, 
                 rpc_url: str = "http://localhost:8332",
                 miner_address: str = "",
                 threads: int = 1,
                 log_interval: int = 10):
        """
        Initialize production miner
        
        Args:
            rpc_url: ZION RPC endpoint
            miner_address: Payout address for block rewards
            threads: Number of mining threads (currently single-threaded)
            log_interval: Seconds between status logs
        """
        self.rpc_url = rpc_url
        self.miner_address = miner_address
        self.threads = threads
        self.log_interval = log_interval
        
        # Mining state
        self.is_mining = False
        self.should_stop = False
        
        # Statistics
        self.blocks_found = 0
        self.total_hashes = 0
        self.start_time = None
        self.last_block_time = None
        self.current_height = 0
        self.current_difficulty = 0
        
        # Performance metrics
        self.hashrate_samples = []
        self.max_hashrate = 0
        self.avg_hashrate = 0
        
        # Setup signal handlers
        signal.signal(signal.SIGINT, self._signal_handler)
        signal.signal(signal.SIGTERM, self._signal_handler)
    
    def _signal_handler(self, signum, frame):
        """Handle shutdown signals gracefully"""
        print(f"\n\n⚠️  Received signal {signum}, shutting down...")
        self.should_stop = True
        self._print_final_stats()
        sys.exit(0)
    
    def _log(self, message: str, level: str = "INFO"):
        """Structured logging"""
        timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        print(f"[{timestamp}] [{level}] {message}")
    
    def _get_block_template(self) -> Optional[Dict[str, Any]]:
        """Get block template from RPC"""
        try:
            # Get blockchain info from root endpoint
            response = requests.get(f"{self.rpc_url}/", timeout=5)
            if response.status_code != 200:
                return None
                
            data = response.json()
            
            # Get current blockchain state
            height = data.get('blocks', 0) + 1
            prev_hash = data.get('bestblockhash', '0' * 64)
            difficulty = data.get('difficulty', 4)
            
            return {
                'height': height,
                'prev_hash': prev_hash,
                'difficulty': difficulty,
                'timestamp': int(time.time())
            }
            
        except Exception as e:
            self._log(f"Failed to get block template: {e}", "ERROR")
            return None
    
    def _submit_block(self, block_data: Dict[str, Any]) -> bool:
        """
        Submit mined block to blockchain via RPC
        """
        try:
            # Prepare JSON-RPC request
            rpc_request = {
                "jsonrpc": "2.0",
                "id": 1,
                "method": "submitblock",
                "params": [json.dumps(block_data)]
            }
            
            # Submit to RPC endpoint
            response = requests.post(
                self.rpc_url,
                json=rpc_request,
                headers={'Content-Type': 'application/json'},
                timeout=10
            )
            
            if response.status_code == 200:
                result = response.json()
                if result.get('error') is None:
                    self._log(f"✅ BLOCK SUBMITTED TO BLOCKCHAIN", "SUCCESS")
                    self._log(f"   Height: {block_data['height']}", "SUCCESS")
                    self._log(f"   Hash: {block_data['hash']}", "SUCCESS")
                    self._log(f"   Block hash from RPC: {result.get('result')}", "SUCCESS")
                    return True
                else:
                    self._log(f"❌ Block submission error: {result.get('error')}", "ERROR")
                    return False
            else:
                self._log(f"❌ HTTP error {response.status_code}", "ERROR")
                return False
            
        except Exception as e:
            self._log(f"❌ Block submission failed: {e}", "ERROR")
            return False
    
    def _mine_block(self, template: Dict[str, Any], max_time: int = 60) -> Optional[Dict[str, Any]]:
        """
        Mine a single block
        
        Args:
            template: Block template with height, prev_hash, difficulty
            max_time: Maximum mining time in seconds
            
        Returns:
            Block data if found, None if timeout
        """
        height = template['height']
        prev_hash = template['prev_hash']
        difficulty = template['difficulty']
        target_prefix = '0' * difficulty
        
        self.current_height = height
        self.current_difficulty = difficulty
        
        nonce = 0
        start_time = time.time()
        hashes_this_block = 0
        last_log = start_time
        
        while (time.time() - start_time) < max_time and not self.should_stop:
            # Create block data
            block_data = f"{height}{prev_hash}{nonce}{self.miner_address}".encode()
            block_hash = hashlib.sha256(block_data).hexdigest()
            
            hashes_this_block += 1
            self.total_hashes += 1
            
            # Check if hash meets difficulty
            if block_hash.startswith(target_prefix):
                elapsed = time.time() - start_time
                hashrate = int(hashes_this_block / elapsed) if elapsed > 0 else 0
                
                # Update max hashrate
                if hashrate > self.max_hashrate:
                    self.max_hashrate = hashrate
                
                return {
                    'height': height,
                    'hash': block_hash,
                    'prev_hash': prev_hash,
                    'nonce': nonce,
                    'miner': self.miner_address,
                    'timestamp': int(time.time()),
                    'difficulty': difficulty,
                    'mining_time': elapsed,
                    'hashrate': hashrate
                }
            
            # Periodic logging
            now = time.time()
            if now - last_log >= self.log_interval:
                elapsed = now - start_time
                hashrate = int(hashes_this_block / elapsed) if elapsed > 0 else 0
                self.hashrate_samples.append(hashrate)
                
                # Calculate average
                if self.hashrate_samples:
                    self.avg_hashrate = sum(self.hashrate_samples) // len(self.hashrate_samples)
                
                self._log(
                    f"⛏️  Block #{height} | {hashes_this_block:,} hashes | "
                    f"{hashrate:,} H/s | {elapsed:.0f}s elapsed"
                )
                last_log = now
            
            nonce += 1
        
        # Timeout
        if not self.should_stop:
            elapsed = time.time() - start_time
            hashrate = int(hashes_this_block / elapsed) if elapsed > 0 else 0
            self._log(
                f"⏰ Block #{height} timeout after {elapsed:.0f}s "
                f"({hashes_this_block:,} hashes, {hashrate:,} H/s)"
            )
        
        return None
    
    def _print_stats(self):
        """Print current statistics"""
        if not self.start_time:
            return
            
        uptime = time.time() - self.start_time
        uptime_str = self._format_uptime(uptime)
        
        self._log("=" * 60)
        self._log(f"📊 MINING STATISTICS")
        self._log(f"   Uptime: {uptime_str}")
        self._log(f"   Blocks found: {self.blocks_found}")
        self._log(f"   Total hashes: {self.total_hashes:,}")
        self._log(f"   Current hashrate: {self.avg_hashrate:,} H/s")
        self._log(f"   Max hashrate: {self.max_hashrate:,} H/s")
        self._log(f"   Current height: {self.current_height}")
        self._log(f"   Current difficulty: {self.current_difficulty}")
        self._log("=" * 60)
    
    def _print_final_stats(self):
        """Print final statistics on shutdown"""
        if not self.start_time:
            return
            
        uptime = time.time() - self.start_time
        uptime_str = self._format_uptime(uptime)
        avg_hashrate = self.total_hashes / uptime if uptime > 0 else 0
        
        print("\n" + "=" * 60)
        print("🏁 FINAL MINING STATISTICS")
        print("=" * 60)
        print(f"   Total uptime: {uptime_str}")
        print(f"   Blocks found: {self.blocks_found}")
        print(f"   Total hashes: {self.total_hashes:,}")
        print(f"   Average hashrate: {avg_hashrate:,.0f} H/s")
        print(f"   Max hashrate: {self.max_hashrate:,} H/s")
        print("=" * 60)
    
    def _format_uptime(self, seconds: float) -> str:
        """Format uptime in human-readable format"""
        hours = int(seconds // 3600)
        minutes = int((seconds % 3600) // 60)
        secs = int(seconds % 60)
        return f"{hours}h {minutes}m {secs}s"
    
    def start(self):
        """Start mining"""
        self._log("=" * 60)
        self._log("🌟 ZION PRODUCTION MINER STARTING 🌟")
        self._log("=" * 60)
        self._log(f"RPC Endpoint: {self.rpc_url}")
        self._log(f"Miner Address: {self.miner_address or 'Default'}")
        self._log(f"Threads: {self.threads}")
        self._log(f"Log Interval: {self.log_interval}s")
        self._log("=" * 60)
        
        # Test RPC connection
        self._log("🔌 Testing RPC connection...")
        template = self._get_block_template()
        if not template:
            self._log("❌ Failed to connect to RPC endpoint", "ERROR")
            return False
        
        self._log(f"✅ Connected! Current height: {template['height'] - 1}", "SUCCESS")
        self._log(f"✅ Difficulty: {template['difficulty']}", "SUCCESS")
        
        # Start mining
        self.is_mining = True
        self.start_time = time.time()
        
        self._log("\n⛏️  MINING STARTED\n")
        
        try:
            while not self.should_stop:
                # Get fresh block template
                template = self._get_block_template()
                if not template:
                    self._log("⚠️  Failed to get block template, retrying in 10s...", "WARNING")
                    time.sleep(10)
                    continue
                
                # Mine block
                result = self._mine_block(template, max_time=60)
                
                if result:
                    # Block found!
                    self.blocks_found += 1
                    self.last_block_time = time.time()
                    
                    # Log success
                    self._log("\n" + "🎉" * 30, "SUCCESS")
                    self._log(f"✅ BLOCK #{result['height']} FOUND!", "SUCCESS")
                    self._log(f"   Hash: {result['hash']}", "SUCCESS")
                    self._log(f"   Nonce: {result['nonce']}", "SUCCESS")
                    self._log(f"   Mining time: {result['mining_time']:.2f}s", "SUCCESS")
                    self._log(f"   Hashrate: {result['hashrate']:,} H/s", "SUCCESS")
                    self._log("🎉" * 30 + "\n", "SUCCESS")
                    
                    # Submit block
                    self._submit_block(result)
                    
                    # Print stats
                    self._print_stats()
                
                # Brief pause between blocks
                time.sleep(2)
                
        except KeyboardInterrupt:
            self._log("\n⚠️  Mining interrupted by user", "WARNING")
        except Exception as e:
            self._log(f"❌ Mining error: {e}", "ERROR")
            import traceback
            traceback.print_exc()
        finally:
            self.is_mining = False
            self._print_final_stats()
        
        return True


def main():
    """Main entry point"""
    parser = argparse.ArgumentParser(
        description='ZION Production Miner - CPU Mining with Metrics',
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  # Start mining with defaults
  python3 zion_production_miner.py
  
  # Custom RPC endpoint
  python3 zion_production_miner.py --rpc http://localhost:8332
  
  # Set miner address for rewards
  python3 zion_production_miner.py --address Z3YourAddressHere
  
  # Adjust logging frequency
  python3 zion_production_miner.py --log-interval 30
        """
    )
    
    parser.add_argument(
        '--rpc',
        default='http://localhost:8332',
        help='RPC endpoint URL (default: http://localhost:8332)'
    )
    
    parser.add_argument(
        '--address',
        default='',
        help='Miner address for block rewards'
    )
    
    parser.add_argument(
        '--threads',
        type=int,
        default=1,
        help='Number of mining threads (default: 1)'
    )
    
    parser.add_argument(
        '--log-interval',
        type=int,
        default=10,
        help='Seconds between status logs (default: 10)'
    )
    
    args = parser.parse_args()
    
    # Create and start miner
    miner = ZionProductionMiner(
        rpc_url=args.rpc,
        miner_address=args.address,
        threads=args.threads,
        log_interval=args.log_interval
    )
    
    miner.start()


if __name__ == "__main__":
    main()
