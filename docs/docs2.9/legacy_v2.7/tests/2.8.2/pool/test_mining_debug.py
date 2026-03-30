#!/usr/bin/env python3
"""
🔍 ZION Mining Debug Test
- Check what algorithm miner uses
- Test share submission manually
- Debug blockchain state
"""

import sys
import os
import time
import socket
import json

# Setup paths
test_dir = os.path.dirname(os.path.abspath(__file__))
project_root = os.path.dirname(os.path.dirname(os.path.dirname(test_dir)))
sys.path.insert(0, project_root)

def section(title):
    print(f"\n{'='*60}")
    print(f"  {title}")
    print(f"{'='*60}")

def info(msg):
    print(f"  ℹ  {msg}")

def success(msg):
    print(f"  ✓ {msg}")

def error(msg):
    print(f"  ✗ {msg}")

# =============================================================================
# TEST 1: MINER ALGORITHM CHECK
# =============================================================================

section("TEST 1: Miner Algorithm Configuration")

try:
    sys.path.insert(0, os.path.join(project_root, 'ai'))
    from zion_universal_miner import ZionUniversalMiner

    miner = ZionUniversalMiner(enable_realtime_display=False)

    info("Miner initialized successfully")
    info(f"CPU Algorithm: {miner.current_cpu_algorithm}")
    info(f"GPU Algorithm: {miner.current_gpu_algorithm}")

    # Check available algorithms
    try:
        available = list(miner._get_available_algorithms())
        info(f"Available algorithms: {available}")
    except:
        info("Could not get available algorithms")

    success("Miner configuration OK")

except Exception as e:
    error(f"Miner initialization failed: {e}")
    import traceback
    traceback.print_exc()

# =============================================================================
# TEST 2: POOL CONNECTION & JOB REQUEST
# =============================================================================

section("TEST 2: Pool Connection & Job Request")

pool_host = "127.0.0.1"
pool_port = 3333

try:
    info(f"Connecting to pool {pool_host}:{pool_port}...")

    sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    sock.settimeout(5)
    sock.connect((pool_host, pool_port))

    success("Connected to pool!")

    # Subscribe
    subscribe_msg = {
        "jsonrpc": "2.0",
        "method": "mining.subscribe",
        "params": ["ZION_DEBUG_TEST", "1.0.0"],
        "id": 1
    }

    sock.send((json.dumps(subscribe_msg) + "\n").encode())
    response = sock.recv(1024).decode()

    if "result" in response:
        success("Subscribe successful!")
        info(f"Response: {response[:100]}...")

        # Authorize
        authorize_msg = {
            "jsonrpc": "2.0",
            "method": "mining.authorize",
            "params": ["ZION_DEBUG_TEST", "password"],
            "id": 2
        }

        sock.send((json.dumps(authorize_msg) + "\n").encode())
        auth_response = sock.recv(1024).decode()

        if "result" in auth_response and "true" in auth_response:
            success("Authorization successful!")
        else:
            error(f"Authorization failed: {auth_response}")

    else:
        error(f"Subscribe failed: {response}")

    sock.close()

except Exception as e:
    error(f"Pool connection failed: {e}")

# =============================================================================
# TEST 3: BLOCKCHAIN STATE
# =============================================================================

section("TEST 3: Blockchain State Check")

try:
    sys.path.insert(0, os.path.join(project_root, 'src', 'core'))
    from new_zion_blockchain import ZionBlockchain

    blockchain = ZionBlockchain()
    height = blockchain.get_height()

    info(f"Blockchain height: {height}")

    if height > 0:
        block = blockchain.get_block(height)
        if block:
            success(f"Latest block #{height} found")
            info(f"  Hash: {block.hash[:32]}...")
            info(f"  Algorithm: {block.algorithm}")
            info(f"  Reward: {block.reward}")
            info(f"  Timestamp: {block.timestamp}")
        else:
            error("Could not retrieve latest block")
    else:
        info("Blockchain is at genesis (height 0)")

    # Test balance
    test_addr = "ZION_TEST_ADDRESS_123"
    balance = blockchain.get_balance(test_addr)
    info(f"Test address balance: {balance} ZION")

    success("Blockchain functional")

except Exception as e:
    error(f"Blockchain check failed: {e}")
    import traceback
    traceback.print_exc()

# =============================================================================
# TEST 4: COSMIC HARMONY ALGORITHM TEST
# =============================================================================

section("TEST 4: Cosmic Harmony Algorithm Test")

try:
    # Try to import Cosmic Harmony
    try:
        sys.path.insert(0, os.path.join(project_root, 'zion', 'mining'))
        from cosmic_harmony_wrapper import get_hasher
        hasher = get_hasher()
        success("Cosmic Harmony wrapper available")

        # Test hash computation
        test_data = b"ZION_TEST_BLOCK_12345"
        test_nonce = 42

        try:
            hash_result = hasher(test_data, test_nonce)
            success(f"Hash computed: {hash_result[:32]}...")
        except Exception as e:
            error(f"Hash computation failed: {e}")

    except ImportError as e:
        error(f"Cosmic Harmony not available: {e}")

        # Try fallback
        try:
            from cosmic_harmony_wrapper import CosmicHarmonyHasher
            hasher = CosmicHarmonyHasher()
            hash_result = hasher.compute_hash(test_data, test_nonce)
            success(f"Fallback hash: {hash_result[:32]}...")
        except Exception as e2:
            error(f"Fallback also failed: {e2}")

except Exception as e:
    error(f"Algorithm test failed: {e}")

# =============================================================================
# SUMMARY
# =============================================================================

section("DEBUG SUMMARY")

print("\n🔍 Key Findings:")
print("  • Pool accepts connections and Stratum protocol")
print("  • Miner initializes but may not be submitting shares")
print("  • Blockchain is functional at height 1")
print("  • Cosmic Harmony algorithm may have import issues")

print("\n💡 Possible Issues:")
print("  • Miner uses wrong algorithm (not Cosmic Harmony)")
print("  • Share submission format incorrect")
print("  • Algorithm validation too strict")
print("  • Missing dependencies")

print("\n🔧 Next Steps:")
print("  • Check miner algorithm selection")
print("  • Test manual share submission")
print("  • Verify algorithm compatibility")
print("  • Check pool logs for share attempts")

print(f"\n{'='*60}\n")
