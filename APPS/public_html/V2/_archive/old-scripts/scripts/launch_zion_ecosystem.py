#!/usr/bin/env python3
"""
ZION 2.6.75 Ecosystem Launcher
Complete production deployment script for all ZION services
"""

import os
import sys
import time
import signal
import subprocess
import asyncio
import json
import argparse
from pathlib import Path
from typing import Dict, List, Optional


class ZionEcosystemLauncher:
    """Complete ZION ecosystem management"""
    
    def __init__(self, base_dir: str = None):
        self.base_dir = Path(base_dir or '/media/maitreya/ZION1/zion-2.6.75')
        self.processes: Dict[str, subprocess.Popen] = {}
        self.running = False
        
        # Service configurations
        self.services = {
            'zion_node': {
                'command': [sys.executable, '-m', 'zion.rpc.server'],
                'cwd': self.base_dir,
                'env': {
                    'ZION_RPC_PORT': '18089',
                    'ZION_WS_PORT': '18090',
                    'ZION_LOG_LEVEL': 'info',
                    'ZION_DATA_DIR': str(self.base_dir / 'data'),
                },
                'required': True,
                'startup_delay': 5
            },
            'seed_node_1': {
                'command': [sys.executable, '-m', 'zion.network.seed_node', '--seed-id', '1'],
                'cwd': self.base_dir,
                'env': {
                    'ZION_SEED_PORT': '19089',
                    'ZION_SEED_WS_PORT': '19090',
                },
                'required': False,
                'startup_delay': 3
            },
            'seed_node_2': {
                'command': [sys.executable, '-m', 'zion.network.seed_node', '--seed-id', '2', '--port', '19091'],
                'cwd': self.base_dir,
                'env': {
                    'ZION_SEED_PORT': '19091',
                    'ZION_SEED_WS_PORT': '19092',
                },
                'required': False,
                'startup_delay': 3
            },
            'mining_pool': {
                'command': [
                    sys.executable, '-m', 'zion.pool.mining_pool',
                    '--address', 'ZIONPOOL123456789ABCDEF',
                    '--stratum-port', '4444',
                    '--web-port', '8080'
                ],
                'cwd': self.base_dir,
                'env': {
                    'ZION_POOL_ADDRESS': 'ZIONPOOL123456789ABCDEF',
                    'ZION_NODE_RPC': 'http://localhost:18089',
                },
                'required': False,
                'startup_delay': 8
            },
            'rainbow_bridge': {
                'command': [
                    sys.executable, '-m', 'zion.bridge.rainbow_bridge',
                    '--private-key', 'bridge_key_2675_production',
                    '--web-port', '9000',
                    '--ws-port', '9001'
                ],
                'cwd': self.base_dir,
                'env': {
                    'ZION_BRIDGE_KEY': 'bridge_key_2675_production',
                    'SOLANA_RPC_URL': 'https://api.mainnet-beta.solana.com',
                    'STELLAR_NETWORK': 'mainnet',
                },
                'required': False,
                'startup_delay': 10
            },
            'frontend': {
                'command': ['npm', 'start'],
                'cwd': self.base_dir / 'frontend',
                'env': {
                    'ZION_RPC_URL': 'http://localhost:18089',
                    'ZION_WS_URL': 'ws://localhost:18090',
                    'ZION_POOL_URL': 'http://localhost:8080',
                    'NODE_ENV': 'production',
                },
                'required': False,
                'startup_delay': 15
            }
        }
    
    def start_ecosystem(self, services: List[str] = None, production: bool = False):
        """Start ZION ecosystem services"""
        print("🚀 Starting ZION 2.6.75 Ecosystem...")
        print("=" * 50)
        
        self.running = True
        
        # Setup signal handlers
        signal.signal(signal.SIGINT, self._signal_handler)
        signal.signal(signal.SIGTERM, self._signal_handler)
        
        # Determine services to start
        if services is None:
            if production:
                services_to_start = list(self.services.keys())
            else:
                # Development mode - start core services only
                services_to_start = ['zion_node', 'seed_node_1', 'mining_pool']
        else:
            services_to_start = services
        
        print(f"📋 Services to start: {', '.join(services_to_start)}")
        
        # Start services in order
        for service_name in services_to_start:
            if service_name in self.services:
                success = self._start_service(service_name)
                if not success and self.services[service_name]['required']:
                    print(f"❌ Failed to start required service: {service_name}")
                    self._shutdown_all()
                    return False
                
                # Wait for service startup
                startup_delay = self.services[service_name]['startup_delay']
                print(f"   ⏳ Waiting {startup_delay}s for {service_name} to initialize...")
                time.sleep(startup_delay)
        
        print("\n✅ ZION Ecosystem started successfully!")
        self._print_service_status()
        
        # Keep running and monitor services
        try:
            while self.running:
                self._monitor_services()
                time.sleep(30)  # Check every 30 seconds
        except KeyboardInterrupt:
            pass
        finally:
            self._shutdown_all()
        
        return True
    
    def _start_service(self, service_name: str) -> bool:
        """Start individual service"""
        if service_name in self.processes:
            print(f"   ⚠️  Service {service_name} already running")
            return True
        
        config = self.services[service_name]
        
        # Prepare environment
        env = os.environ.copy()
        env.update(config.get('env', {}))
        
        try:
            print(f"   🚀 Starting {service_name}...")
            
            process = subprocess.Popen(
                config['command'],
                cwd=config['cwd'],
                env=env,
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                text=True
            )
            
            self.processes[service_name] = process
            
            # Quick check if process started successfully
            time.sleep(1)
            if process.poll() is not None:
                stdout, stderr = process.communicate()
                print(f"   ❌ {service_name} failed to start")
                if stderr:
                    print(f"      Error: {stderr[:200]}...")
                return False
            
            print(f"   ✅ {service_name} started (PID: {process.pid})")
            return True
            
        except Exception as e:
            print(f"   ❌ Failed to start {service_name}: {e}")
            return False
    
    def _monitor_services(self):
        """Monitor running services and restart if needed"""
        for service_name, process in list(self.processes.items()):
            if process.poll() is not None:
                # Process has terminated
                stdout, stderr = process.communicate()
                print(f"\n⚠️  Service {service_name} terminated unexpectedly")
                
                if self.services[service_name]['required']:
                    print(f"   🔄 Restarting required service: {service_name}")
                    del self.processes[service_name]
                    self._start_service(service_name)
                else:
                    print(f"   ⏹️  Optional service {service_name} stopped")
                    del self.processes[service_name]
    
    def _print_service_status(self):
        """Print current service status"""
        print("\n📋 Service Status:")
        print("-" * 40)
        
        for service_name, config in self.services.items():
            if service_name in self.processes:
                process = self.processes[service_name]
                if process.poll() is None:
                    status = f"✅ Running (PID: {process.pid})"
                else:
                    status = "❌ Stopped"
            else:
                status = "⏸️ Not started"
            
            required = " (Required)" if config['required'] else ""
            print(f"   {service_name:<15}: {status}{required}")
        
        print("\n🔗 Access URLs:")
        print("   ZION RPC:        http://localhost:18089")
        print("   Mining Pool:     http://localhost:8080")
        print("   Rainbow Bridge:  http://localhost:9000")
        print("   Frontend:        http://localhost:3000")
        print("   Seed Node 1:     http://localhost:19089")
        print("   Seed Node 2:     http://localhost:19091")
    
    def _signal_handler(self, signum, frame):
        """Handle shutdown signals"""
        print(f"\n🚨 Received signal {signum}, shutting down...")
        self.running = False
    
    def _shutdown_all(self):
        """Shutdown all services gracefully"""
        print("\n🚨 Shutting down ZION ecosystem...")
        
        for service_name, process in self.processes.items():
            try:
                print(f"   🚫 Stopping {service_name}...")
                process.terminate()
                
                # Wait up to 10 seconds for graceful shutdown
                try:
                    process.wait(timeout=10)
                    print(f"   ✅ {service_name} stopped gracefully")
                except subprocess.TimeoutExpired:
                    print(f"   ⚠️  Force killing {service_name}...")
                    process.kill()
                    process.wait()
            
            except Exception as e:
                print(f"   ❌ Error stopping {service_name}: {e}")
        
        self.processes.clear()
        print("\n✅ ZION ecosystem shutdown complete")
    
    def check_dependencies(self) -> bool:
        """Check if all dependencies are installed"""
        print("🔍 Checking dependencies...")
        
        # Check Python version
        if sys.version_info < (3, 9):
            print("   ❌ Python 3.9+ required")
            return False
        print("   ✅ Python version OK")
        
        # Check if base directory exists
        if not self.base_dir.exists():
            print(f"   ❌ Base directory not found: {self.base_dir}")
            return False
        print("   ✅ Base directory OK")
        
        # Check for RandomX library
        try:
            import ctypes
            ctypes.CDLL('librandomx.so')
            print("   ✅ RandomX library OK")
        except OSError:
            print("   ⚠️  RandomX library not found (will use SHA256 fallback)")
        
        # Check Python packages
        required_packages = ['fastapi', 'uvicorn', 'websockets', 'aiohttp']
        missing_packages = []
        
        for package in required_packages:
            try:
                __import__(package)
            except ImportError:
                missing_packages.append(package)
        
        if missing_packages:
            print(f"   ❌ Missing packages: {', '.join(missing_packages)}")
            print("   📝 Run: pip install -r requirements.txt")
            return False
        
        print("   ✅ Python packages OK")
        
        # Check Node.js for frontend
        try:
            result = subprocess.run(['node', '--version'], capture_output=True, text=True)
            if result.returncode == 0:
                print("   ✅ Node.js OK")
            else:
                print("   ⚠️  Node.js not found (frontend won't start)")
        except FileNotFoundError:
            print("   ⚠️  Node.js not found (frontend won't start)")
        
        return True
    
    def run_tests(self):
        """Run integration tests"""
        print("🧪 Running ZION integration tests...")
        
        test_script = self.base_dir / 'tests' / 'test_integration.py'
        if not test_script.exists():
            print("   ❌ Integration test script not found")
            return False
        
        try:
            result = subprocess.run(
                [sys.executable, str(test_script)],
                cwd=self.base_dir,
                check=True
            )
            print("   ✅ Integration tests completed")
            return True
        except subprocess.CalledProcessError as e:
            print(f"   ❌ Integration tests failed: {e}")
            return False


def main():
    """Main entry point"""
    parser = argparse.ArgumentParser(description='ZION 2.6.75 Ecosystem Launcher')
    parser.add_argument('--services', nargs='*', help='Specific services to start')
    parser.add_argument('--production', action='store_true', help='Production mode (all services)')
    parser.add_argument('--check-deps', action='store_true', help='Check dependencies only')
    parser.add_argument('--run-tests', action='store_true', help='Run integration tests')
    parser.add_argument('--base-dir', help='Base directory path')
    
    args = parser.parse_args()
    
    launcher = ZionEcosystemLauncher(args.base_dir)
    
    if args.check_deps:
        success = launcher.check_dependencies()
        sys.exit(0 if success else 1)
    
    if args.run_tests:
        success = launcher.run_tests()
        sys.exit(0 if success else 1)
    
    # Check dependencies before starting
    if not launcher.check_dependencies():
        print("\n❌ Dependency check failed. Please resolve issues before starting.")
        sys.exit(1)
    
    # Start ecosystem
    try:
        success = launcher.start_ecosystem(args.services, args.production)
        sys.exit(0 if success else 1)
    except KeyboardInterrupt:
        print("\n🚫 Interrupted by user")
        sys.exit(0)


if __name__ == "__main__":
    main()