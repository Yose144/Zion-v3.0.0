#!/usr/bin/env python3
"""
🔥 REAL TestNet Integration Test - NO MOCKS!
==========================================
Test actual pool connection, real mining, real rewards.
"""

import asyncio
import json
import time
from src.pool.blockchain.rpc_client import ZionRPCClient
from src.pool.blockchain.reward_calculator import RewardCalculator

async def test_real_blockchain_connection():
    """Test REAL blockchain RPC"""
    print("\n🔗 Testing REAL blockchain connection...")
    
    # Try multiple RPC endpoints
    endpoints = [
        "http://91.98.122.165:18081/json_rpc",
        "http://91.98.122.165:8545",
    ]
    
    for endpoint in endpoints:
        try:
            print(f"   Trying: {endpoint}")
            async with ZionRPCClient(host=endpoint) as rpc:
                # Try get_height
                result = await rpc.call("get_height")
                print(f"   ✅ Height: {result}")
                return result
        except Exception as e:
            print(f"   ❌ Failed: {e}")
    
    print("   ⚠️  No RPC endpoint responding")
    return None

async def test_real_pool_stats():
    """Test REAL pool API"""
    print("\n📊 Testing REAL pool stats...")
    
    import aiohttp
    urls = [
        "http://91.98.122.165:8080/stats",
        "http://91.98.122.165:8080/api/stats",
    ]
    
    for url in urls:
        try:
            print(f"   Trying: {url}")
            async with aiohttp.ClientSession() as session:
                async with session.get(url, timeout=aiohttp.ClientTimeout(total=10)) as resp:
                    if resp.status == 200:
                        data = await resp.json()
                        print(f"   ✅ Pool stats: {json.dumps(data, indent=4)}")
                        return data
                    else:
                        print(f"   ❌ Status {resp.status}")
        except Exception as e:
            print(f"   ❌ Failed: {e}")
    
    print("   ⚠️  Pool API not responding")
    return None

def test_real_reward_calculator():
    """Test REAL reward calculations with actual config"""
    print("\n💰 Testing REAL reward calculator...")
    
    # Real config from pool
    real_config = {
        "fee_percent": 1.0,
        "humanitarian_tithe": 10.0,
        "humanitarian_address": "ZION_CHILDREN_FUTURE_FUND_1ECCB72BC30AADD086656A59"
    }
    
    calc = RewardCalculator(config=real_config)
    
    # Test with REAL whitelisted address
    real_whitelisted = "ZION_SACRED_B0FA7E2A234D8C2F08545F02295C98"
    
    print(f"   Testing with REAL address: {real_whitelisted}")
    
    # Calculate real block reward (2025 - in consciousness window)
    block_timestamp = int(time.time())
    reward = calc.calculate_block_reward(
        block_height=1000,
        miner_address=real_whitelisted,
        block_timestamp=block_timestamp
    )
    
    print(f"   ✅ Total block reward: {reward} ZION")
    
    # Calculate real distribution
    breakdown = calc.calculate_miner_reward(reward, miner_address=real_whitelisted)
    print(f"   ✅ Distribution:")
    print(f"      - Total: {reward} ZION")
    print(f"      - Humanitarian: {breakdown['humanitarian_tithe']} ZION")
    print(f"      - Pool Fee: {breakdown['pool_fee']} ZION")
    print(f"      - Miner Gets: {breakdown['miner_reward']} ZION")
    
    return breakdown

async def test_real_stratum_connection():
    """Test REAL stratum connection"""
    print("\n⛏️  Testing REAL stratum connection...")
    
    try:
        reader, writer = await asyncio.wait_for(
            asyncio.open_connection('91.98.122.165', 3333),
            timeout=10
        )
        
        # Send real login
        login_request = {
            "id": 1,
            "jsonrpc": "2.0",
            "method": "login",
            "params": {
                "login": "ZION_SACRED_B0FA7E2A234D8C2F08545F02295C98",
                "pass": "x",
                "agent": "test-real-miner/1.0"
            }
        }
        
        print(f"   Sending: {json.dumps(login_request)}")
        writer.write((json.dumps(login_request) + "\n").encode())
        await writer.drain()
        
        # Read response
        response = await asyncio.wait_for(reader.readline(), timeout=10)
        data = json.loads(response.decode())
        
        print(f"   ✅ Pool response: {json.dumps(data, indent=4)}")
        
        writer.close()
        await writer.wait_closed()
        
        return data
        
    except Exception as e:
        print(f"   ❌ Connection failed: {e}")
        return None

async def main():
    """Run ALL real tests - no mocks!"""
    print("="*60)
    print("🔥 REAL TestNet Integration Tests")
    print("="*60)
    print("Using REAL data from: 91.98.122.165")
    print("NO MOCKS - NO SIMULATIONS - ONLY REALITY!")
    print("="*60)
    
    results = {}
    
    # Test 1: Blockchain RPC
    results['blockchain'] = await test_real_blockchain_connection()
    
    # Test 2: Pool stats API
    results['pool_stats'] = await test_real_pool_stats()
    
    # Test 3: Reward calculator
    results['rewards'] = test_real_reward_calculator()
    
    # Test 4: Stratum connection
    results['stratum'] = await test_real_stratum_connection()
    
    print("\n" + "="*60)
    print("📊 REAL Test Results Summary:")
    print("="*60)
    for test, result in results.items():
        status = "✅ PASS" if result else "❌ FAIL"
        print(f"   {test}: {status}")
    
    print("="*60)
    
    # Count successes
    successes = sum(1 for r in results.values() if r)
    total = len(results)
    
    print(f"\n🎯 Score: {successes}/{total} tests passed")
    
    if successes == total:
        print("✅ ALL REAL TESTS PASSED!")
    else:
        print("⚠️  Some tests failed - TestNet may need initialization")

if __name__ == "__main__":
    asyncio.run(main())
