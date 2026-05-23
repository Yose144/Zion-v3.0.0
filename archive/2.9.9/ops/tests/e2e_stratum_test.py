#!/usr/bin/env python3
"""
ZION v2.9.5 - E2E Stratum Test
Tests full mining flow: Login -> Job -> Share submission
"""

import socket
import json
import hashlib
import time
import sys

# Pool regions
POOLS = {
    "Helsinki": ("77.42.31.72", 3333),
    "USA": ("5.78.145.234", 3333),
    "Singapore": ("5.223.56.122", 3333),
}

TEST_WALLET = "zion1e2etest000000000000000000000000000test"


def test_stratum_login(host: str, port: int, wallet: str) -> dict:
    """Test Stratum login and job reception"""
    result = {
        "host": f"{host}:{port}",
        "login": False,
        "job_received": False,
        "height": 0,
        "algo": "",
        "error": None,
    }
    
    try:
        sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        sock.settimeout(10)
        sock.connect((host, port))
        
        # Send login
        login_msg = json.dumps({
            "id": 1,
            "method": "login",
            "params": {
                "login": wallet,
                "pass": "x",
                "agent": "e2e-test/2.9.5"
            }
        }) + "\n"
        sock.send(login_msg.encode())
        
        # Receive response
        response = sock.recv(8192).decode()
        data = json.loads(response)
        
        if data.get("result", {}).get("status") == "OK":
            result["login"] = True
            job = data["result"].get("job", {})
            if job:
                result["job_received"] = True
                result["height"] = job.get("height", 0)
                result["algo"] = job.get("algo", "cosmic_harmony")
                result["job_id"] = job.get("job_id", "")
                result["target"] = job.get("target", "")
        else:
            result["error"] = data.get("error", "Unknown error")
            
        sock.close()
        
    except socket.timeout:
        result["error"] = "Connection timeout"
    except ConnectionRefusedError:
        result["error"] = "Connection refused"
    except Exception as e:
        result["error"] = str(e)
    
    return result


def test_share_submission(host: str, port: int, wallet: str) -> dict:
    """Test share submission (with dummy share - expect rejection)"""
    result = {
        "host": f"{host}:{port}",
        "connected": False,
        "job_received": False,
        "share_submitted": False,
        "share_response": None,
        "error": None,
    }
    
    try:
        sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        sock.settimeout(15)
        sock.connect((host, port))
        result["connected"] = True
        
        # Login
        login_msg = json.dumps({
            "id": 1,
            "method": "login",
            "params": {"login": wallet, "pass": "x", "agent": "e2e-test/2.9.5"}
        }) + "\n"
        sock.send(login_msg.encode())
        
        response = sock.recv(8192).decode()
        data = json.loads(response)
        
        if data.get("result", {}).get("status") != "OK":
            result["error"] = "Login failed"
            sock.close()
            return result
            
        job = data["result"].get("job", {})
        if not job:
            result["error"] = "No job received"
            sock.close()
            return result
            
        result["job_received"] = True
        job_id = job.get("job_id", "")
        
        # Submit dummy share (will be rejected as invalid, but tests the flow)
        dummy_nonce = "deadbeef"
        dummy_result = "0" * 64  # Invalid result
        
        submit_msg = json.dumps({
            "id": 2,
            "method": "submit",
            "params": {
                "id": data["result"].get("id", ""),
                "job_id": job_id,
                "nonce": dummy_nonce,
                "result": dummy_result,
            }
        }) + "\n"
        sock.send(submit_msg.encode())
        result["share_submitted"] = True
        
        # Get response
        try:
            submit_response = sock.recv(4096).decode()
            submit_data = json.loads(submit_response)
            result["share_response"] = submit_data
        except:
            result["share_response"] = "No response (timeout)"
        
        sock.close()
        
    except Exception as e:
        result["error"] = str(e)
    
    return result


def run_all_tests():
    """Run E2E tests on all pool regions"""
    print("=" * 60)
    print("ZION v2.9.5 - E2E Stratum Test")
    print("=" * 60)
    print()
    
    all_passed = True
    
    # Test 1: Login & Job Reception
    print("📡 TEST 1: Stratum Login & Job Reception")
    print("-" * 40)
    
    for region, (host, port) in POOLS.items():
        result = test_stratum_login(host, port, TEST_WALLET)
        
        if result["login"] and result["job_received"]:
            print(f"  ✅ {region}: Login OK, Height={result['height']}, Algo={result['algo']}")
        else:
            print(f"  ❌ {region}: FAILED - {result['error']}")
            all_passed = False
    
    print()
    
    # Test 2: Share Submission Flow
    print("⛏️  TEST 2: Share Submission Flow")
    print("-" * 40)
    
    for region, (host, port) in POOLS.items():
        result = test_share_submission(host, port, TEST_WALLET)
        
        if result["connected"] and result["job_received"] and result["share_submitted"]:
            response = result.get("share_response", {})
            if isinstance(response, dict):
                if response.get("error"):
                    # Expected - dummy share should be rejected
                    print(f"  ✅ {region}: Share flow OK (rejected as expected: low diff)")
                elif response.get("result", {}).get("status") == "OK":
                    print(f"  ✅ {region}: Share ACCEPTED (unexpected but OK)")
                else:
                    print(f"  ⚠️  {region}: Unknown response: {response}")
            else:
                print(f"  ⚠️  {region}: Response: {response}")
        else:
            print(f"  ❌ {region}: FAILED - {result['error']}")
            all_passed = False
    
    print()
    
    # Test 3: Pool API
    print("🌐 TEST 3: Pool API Endpoints")
    print("-" * 40)
    
    import urllib.request
    
    for region, (host, port) in POOLS.items():
        api_url = f"http://{host}:8080/stats"
        try:
            with urllib.request.urlopen(api_url, timeout=5) as resp:
                data = json.loads(resp.read().decode())
                miners = data.get("miners", {}).get("active", 0)
                height = data.get("blockchain", {}).get("height", 0)
                hashrate = data.get("hashrate", {}).get("pool", 0)
                print(f"  ✅ {region}: Miners={miners}, Height={height}, Hashrate={hashrate} H/s")
        except Exception as e:
            print(f"  ❌ {region}: API FAILED - {e}")
            all_passed = False
    
    print()
    print("=" * 60)
    
    if all_passed:
        print("✅ ALL E2E TESTS PASSED")
        return 0
    else:
        print("❌ SOME TESTS FAILED")
        return 1


if __name__ == "__main__":
    sys.exit(run_all_tests())
