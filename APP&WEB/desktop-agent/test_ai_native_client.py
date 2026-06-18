#!/usr/bin/env python3
"""
Quick test for AI Native Client integration
Run: python3 test_ai_native_client.py
"""

import asyncio
import sys
import os

# Add desktop-agent/resources to path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'resources'))

from ai_native_client import AINativeClient


async def main():
    print("🧪 Testing AI Native Client Integration\n")
    local_url = os.getenv("ZION_AI_NATIVE_URL", "http://localhost:8001")
    primary_host = os.getenv("ZION_PRIMARY_TESTNET_HOST", "91.98.122.165")
    
    # Use local test server for now
    # For production, Desktop Agent targets the current Zion2 host.
    print("⚠️  Testing with localhost (requires SSH tunnel):")
    print(f"   ssh -i ~/.ssh/zion_hetzner_key -L 8001:localhost:8001 root@{primary_host} -N &")
    print()
    
    client = AINativeClient(server_url=local_url)
    
    try:
        # Test 1: Connection
        print("Test 1: Connection")
        print(f"   Connecting to {local_url}...")
        result = await client.connect()
        if result.get("success"):
            print(f"✅ PASS: Connected to {result['server'].get('service', 'N/A')}")
            print(f"   Version: {result['server'].get('version', 'N/A')}")
        else:
            error = result.get('error', 'Unknown error')
            print(f"❌ FAIL: {error}")
            print("\n⚠️  Make sure SSH tunnel is running!")
            return
        
        # Test 2: Knowledge search
        print("\nTest 2: Knowledge Search")
        kb = await client.search_knowledge("mining pool")
        if "error" not in kb:
            print(f"✅ PASS: Found {kb.get('count', 0)} documents")
            if kb.get('results'):
                print(f"   First: {kb['results'][0].get('filename', 'N/A')}")
        else:
            print(f"❌ FAIL: {kb.get('error')}")
        
        # Test 3: Memory stats
        print("\nTest 3: Memory System")
        mem = await client.get_memory_stats()
        if "error" not in mem:
            print(f"✅ PASS: Memory stats retrieved")
            print(f"   Conversations: {mem.get('conversations', {}).get('total', 0)}")
            print(f"   Learnings: {mem.get('learnings', {}).get('total', 0)}")
        else:
            print(f"❌ FAIL: {mem.get('error')}")
        
        # Test 4: System health
        print("\nTest 4: System Health")
        health = await client.get_system_health()
        if "error" not in health:
            print(f"✅ PASS: Health score {health.get('health_score', 0)}/100")
            print(f"   Status: {health.get('overall_health', 'N/A')}")
        else:
            print(f"❌ FAIL: {health.get('error')}")
        
        # Test 5: Blockchain status
        print("\nTest 5: Blockchain Status")
        blockchain = await client.get_blockchain_status()
        if "error" not in blockchain:
            bc_data = blockchain.get('blockchain', {})
            print(f"✅ PASS: Blockchain height {bc_data.get('height', 0)}")
            print(f"   Status: {bc_data.get('status', 'N/A')}")
        else:
            print(f"❌ FAIL: {blockchain.get('error')}")
        
        # Test 6: Pool monitoring
        print("\nTest 6: Pool Monitoring")
        pools = await client.monitor_pools()
        if "error" not in pools:
            summary = pools.get('summary', {})
            print(f"✅ PASS: {summary.get('online_pools', 0)}/{summary.get('total_pools', 0)} pools online")
            print(f"   Total miners: {summary.get('total_miners', 0)}")
        else:
            print(f"❌ FAIL: {pools.get('error')}")
        
        # Test 7: Dashboard data (comprehensive)
        print("\nTest 7: Dashboard Data")
        dashboard = await client.get_dashboard_data()
        if dashboard.get("success"):
            print(f"✅ PASS: Dashboard data retrieved")
            print(f"   Components: {len([k for k in dashboard if k != 'success' and k != 'timestamp'])}")
        else:
            print(f"❌ FAIL: {dashboard.get('error')}")
        
        # Test 8: AI Chat
        print("\nTest 8: AI Chat")
        chat_resp = await client.chat([
            {"role": "user", "content": "What is ZION TerraNova?"}
        ])
        if "error" not in chat_resp:
            answer = chat_resp.get("answer", "")
            print(f"✅ PASS: AI responded")
            print(f"   Answer: {answer[:100]}..." if len(answer) > 100 else f"   Answer: {answer}")
        else:
            print(f"❌ FAIL: {chat_resp.get('error')}")
        
        # Test 9: Client stats
        print("\nTest 9: Client Stats")
        stats = await client.get_stats()
        print(f"✅ Stats:")
        print(f"   Connected: {stats.get('connected')}")
        print(f"   Queries: {stats.get('queries')}")
        print(f"   Errors: {stats.get('errors')}")
        print(f"   Error rate: {stats.get('error_rate', 0):.2%}")
        
    finally:
        # Cleanup
        await client.disconnect()
        print("\n✅ All tests completed!")


if __name__ == "__main__":
    asyncio.run(main())
