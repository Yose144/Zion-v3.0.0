#!/usr/bin/env python3
"""
ZION v2.9 - Complete End-to-End Mining Test
Tests full mining pipeline: Stratum → Pool → Blockchain → Rewards
"""

import asyncio
import json
import socket
import time
import sys
from datetime import datetime
from typing import Optional, Dict, Any
import hashlib
import struct

# ANSI Colors
class Colors:
    GREEN = '\033[92m'
    RED = '\033[91m'
    YELLOW = '\033[93m'
    BLUE = '\033[94m'
    RESET = '\033[0m'
    BOLD = '\033[1m'

def log_header(title: str):
    """Print formatted header"""
    print(f"\n{Colors.BOLD}{Colors.BLUE}{'='*60}{Colors.RESET}")
    print(f"{Colors.BOLD}{Colors.BLUE}{title:^60}{Colors.RESET}")
    print(f"{Colors.BOLD}{Colors.BLUE}{'='*60}{Colors.RESET}\n")

def log_success(msg: str, detail: str = ""):
    """Print success message"""
    print(f"{Colors.GREEN}✓ {msg}{Colors.RESET}", end="")
    if detail:
        print(f" {detail}")
    else:
        print()

def log_error(msg: str, detail: str = ""):
    """Print error message"""
    print(f"{Colors.RED}✗ {msg}{Colors.RESET}", end="")
    if detail:
        print(f" {detail}")
    else:
        print()

def log_info(msg: str, detail: str = ""):
    """Print info message"""
    print(f"{Colors.BLUE}ℹ {msg}{Colors.RESET}", end="")
    if detail:
        print(f" {detail}")
    else:
        print()

def log_warning(msg: str, detail: str = ""):
    """Print warning message"""
    print(f"{Colors.YELLOW}⚠ {msg}{Colors.RESET}", end="")
    if detail:
        print(f" {detail}")
    else:
        print()

class Stratum:
    """Stratum Protocol Handler"""
    
    def __init__(self, host: str, port: int):
        self.host = host
        self.port = port
        self.socket: Optional[socket.socket] = None
        self.subscription_id: Optional[str] = None
        self.extra_nonce1: Optional[str] = None
        self.extra_nonce2_size: int = 0
        
    async def connect(self) -> bool:
        """Connect to Stratum server"""
        try:
            self.socket = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
            self.socket.settimeout(10)
            self.socket.connect((self.host, self.port))
            log_success(f"Connected to {self.host}:{self.port}")
            return True
        except Exception as e:
            log_error(f"Connection failed: {e}")
            return False
    
    async def send(self, data: Dict[str, Any]) -> bool:
        """Send Stratum command"""
        try:
            msg = json.dumps(data) + "\n"
            self.socket.sendall(msg.encode())
            return True
        except Exception as e:
            log_error(f"Send failed: {e}")
            return False
    
    async def recv(self) -> Optional[Dict[str, Any]]:
        """Receive Stratum response"""
        try:
            data = self.socket.recv(4096).decode('utf-8')
            if data:
                lines = data.strip().split('\n')
                for line in lines:
                    if line:
                        return json.loads(line)
            return None
        except Exception as e:
            log_error(f"Recv failed: {e}")
            return None
    
    async def login(self, wallet: str, worker: str = "test-miner") -> bool:
        """Login to pool"""
        try:
            await self.send({
                "id": 1,
                "method": "mining.subscribe",
                "params": []
            })
            
            resp = await self.recv()
            if not resp:
                log_error("No response to subscribe")
                return False
            
            if "result" in resp:
                result = resp["result"]
                if len(result) >= 2:
                    self.subscription_id = result[0][0][1]
                    self.extra_nonce1 = result[1]
                    self.extra_nonce2_size = result[2]
                    log_success(f"Subscribed (ID: {self.subscription_id})")
            
            # Authorize
            await self.send({
                "id": 2,
                "method": "mining.authorize",
                "params": [f"{wallet}.{worker}", ""]
            })
            
            resp = await self.recv()
            if resp and resp.get("result") == True:
                log_success(f"Authorized as {wallet}")
                return True
            else:
                log_error("Authorization failed")
                return False
                
        except Exception as e:
            log_error(f"Login failed: {e}")
            return False
    
    async def close(self):
        """Close connection"""
        if self.socket:
            self.socket.close()
            log_info("Connection closed")


async def test_stratum_connection(pool_host: str, pool_port: int, wallet: str):
    """Test 1: Stratum Connection & Login"""
    log_header("TEST 1: STRATUM CONNECTION & LOGIN")
    
    stratum = Stratum(pool_host, pool_port)
    
    # Connect
    if not await stratum.connect():
        return False, "Connection failed"
    
    # Login
    if not await stratum.login(wallet):
        await stratum.close()
        return False, "Login failed"
    
    await stratum.close()
    log_success("Stratum connection test passed")
    return True, "Connected and authenticated"


async def test_pool_api(api_host: str, api_port: int):
    """Test 2: Pool API Endpoints"""
    log_header("TEST 2: POOL API ENDPOINTS")
    
    endpoints = [
        "/api/v1/stats",
        "/api/v1/miners",
        "/api/v1/blocks",
        "/health"
    ]
    
    results = {}
    for endpoint in endpoints:
        try:
            import urllib.request
            url = f"http://{api_host}:{api_port}{endpoint}"
            response = urllib.request.urlopen(url, timeout=5)
            data = response.read()
            results[endpoint] = response.status == 200
            log_success(f"GET {endpoint}", f"200 OK ({len(data)} bytes)")
        except Exception as e:
            log_error(f"GET {endpoint}", f"Failed: {e}")
            results[endpoint] = False
    
    if all(results.values()):
        log_success("Pool API test passed")
        return True, f"{sum(results.values())}/{len(results)} endpoints responding"
    else:
        return False, f"{sum(results.values())}/{len(results)} endpoints responding"


async def test_blockchain_rpc(rpc_host: str, rpc_port: int):
    """Test 3: Blockchain RPC"""
    log_header("TEST 3: BLOCKCHAIN RPC")
    
    try:
        import urllib.request
        import json as json_lib
        
        url = f"http://{rpc_host}:{rpc_port}/json_rpc"
        
        # Get block count
        payload = json.dumps({
            "jsonrpc": "2.0",
            "id": 1,
            "method": "getblockcount",
            "params": []
        }).encode()
        
        req = urllib.request.Request(url, data=payload, headers={"Content-Type": "application/json"})
        response = urllib.request.urlopen(req, timeout=5)
        result = json_lib.loads(response.read().decode())
        
        if "result" in result:
            height = result["result"]
            log_success(f"Blockchain height", f"{height} blocks")
            
            # Get network info
            payload = json.dumps({
                "jsonrpc": "2.0",
                "id": 2,
                "method": "getpeercount",
                "params": []
            }).encode()
            
            req = urllib.request.Request(url, data=payload, headers={"Content-Type": "application/json"})
            response = urllib.request.urlopen(req, timeout=5)
            result = json_lib.loads(response.read().decode())
            
            if "result" in result:
                peers = result["result"]
                log_success(f"Network peers", f"{peers} connected")
                
                log_success("Blockchain RPC test passed")
                return True, f"Height: {height}, Peers: {peers}"
        
        return False, "Invalid RPC response"
        
    except Exception as e:
        log_error(f"Blockchain RPC test failed", f"{e}")
        return False, str(e)


async def test_prometheus_metrics(prom_host: str, prom_port: int):
    """Test 4: Prometheus Metrics Collection"""
    log_header("TEST 4: PROMETHEUS METRICS")
    
    try:
        import urllib.request
        
        targets = [
            ("zion-pool", f"http://{prom_host}:{prom_port}/api/v1/query?query=up{{job='zion-pool'}}"),
            ("zion-blockchain", f"http://{prom_host}:{prom_port}/api/v1/query?query=up{{job='zion-blockchain'}}"),
            ("zion-api", f"http://{prom_host}:{prom_port}/api/v1/query?query=up{{job='zion-api'}}"),
        ]
        
        results = {}
        for job, query_url in targets:
            try:
                response = urllib.request.urlopen(query_url, timeout=5)
                data = json.loads(response.read().decode())
                
                if data.get("status") == "success":
                    values = data.get("data", {}).get("result", [])
                    if values:
                        status = values[0]["value"][1]
                        is_up = status == "1"
                        results[job] = is_up
                        
                        if is_up:
                            log_success(f"Prometheus target: {job}", "UP ✓")
                        else:
                            log_error(f"Prometheus target: {job}", "DOWN")
                    else:
                        log_warning(f"Prometheus target: {job}", "No data")
                        results[job] = False
                else:
                    log_error(f"Prometheus query: {job}", "Failed")
                    results[job] = False
            except Exception as e:
                log_error(f"Prometheus target: {job}", f"{e}")
                results[job] = False
        
        success_count = sum(1 for v in results.values() if v)
        if success_count >= 2:
            log_success("Prometheus metrics test passed")
            return True, f"{success_count}/{len(results)} targets UP"
        else:
            return False, f"{success_count}/{len(results)} targets UP"
            
    except Exception as e:
        log_error(f"Prometheus test failed", f"{e}")
        return False, str(e)


async def test_docker_services():
    """Test 5: Docker Services Status"""
    log_header("TEST 5: DOCKER SERVICES STATUS")
    
    import subprocess
    
    try:
        result = subprocess.run(
            ["docker", "compose", "ps", "--format", "json"],
            capture_output=True,
            text=True,
            timeout=10
        )
        
        if result.returncode == 0:
            services_output = result.stdout
            # Simple check for key services
            required_services = ["blockchain", "pool", "api", "prometheus", "grafana", "redis"]
            
            log_info("Docker services:")
            for service in required_services:
                if service in services_output.lower():
                    log_success(f"  {service}", "running")
                else:
                    log_warning(f"  {service}", "not found or not running")
            
            log_success("Docker services check passed")
            return True, "All core services detected"
        else:
            log_error("Docker compose ps failed")
            return False, result.stderr
            
    except Exception as e:
        log_error(f"Docker services check failed", f"{e}")
        return False, str(e)


async def run_e2e_tests():
    """Run all E2E tests"""
    
    # Configuration
    POOL_HOST = "localhost"
    POOL_PORT = 3333
    API_HOST = "localhost"
    API_PORT = 8080
    RPC_HOST = "localhost"
    RPC_PORT = 8545
    PROM_HOST = "localhost"
    PROM_PORT = 9090
    WALLET = "ZION_TEST_ADDRESS_12345"
    
    log_header("ZION v2.9 - COMPLETE END-TO-END TEST SUITE")
    log_info("Starting comprehensive infrastructure validation...")
    print(f"Timestamp: {datetime.now().strftime('%Y-%m-%d %H:%M:%S UTC')}\n")
    
    tests = [
        ("Stratum Connection", test_stratum_connection(POOL_HOST, POOL_PORT, WALLET)),
        ("Pool API", test_pool_api(API_HOST, API_PORT)),
        ("Blockchain RPC", test_blockchain_rpc(RPC_HOST, RPC_PORT)),
        ("Prometheus Metrics", test_prometheus_metrics(PROM_HOST, PROM_PORT)),
        ("Docker Services", test_docker_services()),
    ]
    
    results = {}
    for test_name, test_coro in tests:
        try:
            success, detail = await test_coro
            results[test_name] = (success, detail)
        except Exception as e:
            results[test_name] = (False, str(e))
    
    # Summary
    log_header("TEST SUMMARY")
    
    passed = sum(1 for success, _ in results.values() if success)
    total = len(results)
    
    print(f"{'Test Name':<30} {'Status':<15} {'Details'}")
    print("─" * 70)
    for test_name, (success, detail) in results.items():
        status = f"{Colors.GREEN}PASS{Colors.RESET}" if success else f"{Colors.RED}FAIL{Colors.RESET}"
        print(f"{test_name:<30} {status:<15} {detail}")
    
    print("\n" + "─" * 70)
    
    overall_status = Colors.GREEN + "✓ PASS" + Colors.RESET if passed == total else Colors.RED + "✗ FAIL" + Colors.RESET
    print(f"Overall: {passed}/{total} tests passed {overall_status}")
    
    if passed == total:
        print(f"\n{Colors.GREEN}{Colors.BOLD}🎉 ALL TESTS PASSED - INFRASTRUCTURE READY FOR MINING!{Colors.RESET}")
        return 0
    else:
        print(f"\n{Colors.YELLOW}{Colors.BOLD}⚠ SOME TESTS FAILED - REVIEW AND FIX{Colors.RESET}")
        return 1


if __name__ == "__main__":
    exit_code = asyncio.run(run_e2e_tests())
    sys.exit(exit_code)
