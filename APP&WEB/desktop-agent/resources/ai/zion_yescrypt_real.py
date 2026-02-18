#!/usr/bin/env python3
"""
🚀 ZION Yescrypt CPU Miner - REAL Implementation
Uses cpuminer-opt (JayDDee) for actual Yescrypt mining
"""

import os
import sys
import subprocess
import platform
import urllib.request
import tarfile
import logging
from pathlib import Path
from typing import Optional

logger = logging.getLogger(__name__)

class RealYescryptMiner:
    """
    Real Yescrypt miner using cpuminer-opt binary
    No simulation - actual Yescrypt PoW algorithm
    """
    
    def __init__(self):
        self.cpuminer_path = None
        self.system = platform.system().lower()
        self.arch = platform.machine().lower()
        
        logger.info("🔍 Detecting system configuration...")
        logger.info(f"   OS: {self.system}")
        logger.info(f"   Arch: {self.arch}")
        
        # Setup cpuminer
        self._setup_cpuminer()
    
    def _setup_cpuminer(self):
        """Download and setup cpuminer-opt if needed"""
        
        # Check for existing cpuminer
        possible_paths = [
            './cpuminer',
            './cpuminer-opt',
            './miners/cpuminer',
            '/usr/local/bin/cpuminer',
            '/usr/bin/cpuminer',
        ]
        
        for path in possible_paths:
            if os.path.exists(path) and os.access(path, os.X_OK):
                self.cpuminer_path = path
                logger.info(f"✅ Found cpuminer at: {path}")
                return
        
        # If not found, provide instructions
        logger.error("❌ cpuminer-opt not found!")
        logger.error("")
        logger.error("📥 Please install cpuminer-opt:")
        logger.error("")
        
        if self.system == 'linux':
            logger.error("Ubuntu/Debian:")
            logger.error("  sudo apt-get install libcurl4-openssl-dev libssl-dev")
            logger.error("  git clone https://github.com/JayDDee/cpuminer-opt")
            logger.error("  cd cpuminer-opt")
            logger.error("  ./build.sh")
            logger.error("")
            logger.error("Or download pre-built:")
            logger.error("  wget https://github.com/JayDDee/cpuminer-opt/releases/download/v24.3/cpuminer-opt-24.3-linux.tar.gz")
            logger.error("  tar xzf cpuminer-opt-24.3-linux.tar.gz")
            logger.error("  chmod +x cpuminer")
            
        elif self.system == 'darwin':
            logger.error("macOS:")
            logger.error("  brew install automake autoconf pkg-config")
            logger.error("  git clone https://github.com/JayDDee/cpuminer-opt")
            logger.error("  cd cpuminer-opt")
            logger.error("  ./build.sh")
        
        elif self.system == 'windows':
            logger.error("Windows:")
            logger.error("  Download: https://github.com/JayDDee/cpuminer-opt/releases")
            logger.error("  Extract cpuminer.exe to this directory")
        
        logger.error("")
        logger.error("After installation, run this script again.")
        sys.exit(1)
    
    def start(self, 
             pool_url: str = "stratum+tcp://91.98.122.165:3333",
             wallet: str = "YOUR_ZION_ADDRESS",
             worker: str = "yescrypt_miner",
             threads: Optional[int] = None,
             algorithm: str = "yescrypt"):
        """
        Start real Yescrypt mining using cpuminer-opt
        
        Args:
            pool_url: Mining pool URL
            wallet: Your ZION wallet address
            worker: Worker name
            threads: Number of threads (None = auto)
            algorithm: yescrypt, yescryptr8, yescryptr16, yescryptr32
        """
        
        if not self.cpuminer_path:
            logger.error("❌ cpuminer not available")
            return
        
        logger.info("🚀 Starting REAL Yescrypt mining")
        logger.info(f"   Binary: {self.cpuminer_path}")
        logger.info(f"   Pool: {pool_url}")
        logger.info(f"   Wallet: {wallet}")
        logger.info(f"   Algorithm: {algorithm}")
        
        # Build command
        cmd = [
            self.cpuminer_path,
            '--algo', algorithm,
            '--url', pool_url,
            '--user', wallet,
            '--pass', worker,
        ]
        
        # Add thread count if specified
        if threads:
            cmd.extend(['--threads', str(threads)])
        
        # CPU affinity (pin threads to cores)
        cmd.append('--cpu-affinity')
        
        # Additional optimizations
        cmd.extend([
            '--cpu-priority', '3',  # Above normal priority
        ])
        
        logger.info(f"   Command: {' '.join(cmd)}")
        logger.info("")
        logger.info("=" * 60)
        logger.info("⛏️  MINING STARTED - Press Ctrl+C to stop")
        logger.info("=" * 60)
        logger.info("")
        
        try:
            # Run cpuminer
            process = subprocess.Popen(
                cmd,
                stdout=subprocess.PIPE,
                stderr=subprocess.STDOUT,
                universal_newlines=True,
                bufsize=1
            )
            
            # Stream output
            for line in process.stdout:
                print(line, end='')
            
            process.wait()
            
        except KeyboardInterrupt:
            logger.info("")
            logger.info("⏹️  Mining stopped by user")
            if process:
                process.terminate()
                process.wait()
        
        except Exception as e:
            logger.error(f"❌ Mining error: {e}")

def main():
    """Main entry point"""
    logging.basicConfig(
        level=logging.INFO,
        format='%(asctime)s [%(levelname)s] %(message)s'
    )
    
    print("=" * 60)
    print("🚀 ZION Yescrypt CPU Miner - REAL Implementation")
    print("=" * 60)
    print()
    print("Using: cpuminer-opt by JayDDee")
    print("Algorithm: Yescrypt (actual PoW, no simulation)")
    print()
    
    # Configuration
    POOL_URL = "stratum+tcp://91.98.122.165:3333"
    WALLET = "ZIONyourwalletaddresshere"  # CHANGE THIS!
    WORKER = "yescrypt_real"
    THREADS = None  # Auto-detect optimal
    
    # Create miner
    miner = RealYescryptMiner()
    
    # Start mining
    miner.start(
        pool_url=POOL_URL,
        wallet=WALLET,
        worker=WORKER,
        threads=THREADS,
        algorithm='yescrypt'
    )

if __name__ == "__main__":
    main()
