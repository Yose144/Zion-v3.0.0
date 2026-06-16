#!/usr/bin/env python3
"""
🔑 ZION WARP Bridge API Key Validator
Validates API keys for production deployment

Usage: python3 validate_api_keys.py
"""

import os
import asyncio
import aiohttp
import time
from typing import Dict, Optional
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class APIKeyValidator:
    """Validates WARP Bridge API keys"""

    def __init__(self):
        self.results = {}

    async def validate_ankr_key(self, api_key: str) -> Dict:
        """Validate Ankr API key"""
        print("🔍 Validating Ankr API key...")

        try:
            timeout = aiohttp.ClientTimeout(total=10)
            async with aiohttp.ClientSession(timeout=timeout) as session:
                # Ankr typically authenticates via URL path, e.g.:
                #   https://rpc.ankr.com/eth/<API_KEY>
                # (Public endpoints without a key exist, but here we're validating a key.)
                base_url = "https://rpc.ankr.com/eth"
                if not api_key or api_key in {"YOUR_ANKR_API_KEY", "your_ankr_api_key"}:
                    return {
                        'valid': False,
                        'response_time_ms': None,
                        'error': "ANKR_API_KEY not set"
                    }

                url = f"{base_url}/{api_key}"
                headers = {"Content-Type": "application/json"}
                payload = {
                    "jsonrpc": "2.0",
                    "id": 1,
                    "method": "eth_blockNumber",
                    "params": []
                }

                start_time = time.time()
                async with session.post(url, json=payload, headers=headers) as resp:
                    response_time = time.time() - start_time

                    if resp.status == 200:
                        result = await resp.json()
                        if isinstance(result, dict) and 'result' in result:
                            block_num = int(result['result'], 16)
                        elif isinstance(result, dict) and 'error' in result:
                            return {
                                'valid': False,
                                'response_time_ms': int(response_time * 1000),
                                'error': f"RPC error: {result['error']}"
                            }
                        else:
                            return {
                                'valid': False,
                                'response_time_ms': int(response_time * 1000),
                                'error': f"Unexpected response: {result}"
                            }
                        return {
                            'valid': True,
                            'response_time_ms': int(response_time * 1000),
                            'latest_block': block_num,
                            'error': None
                        }
                    else:
                        error_text = await resp.text()
                        return {
                            'valid': False,
                            'response_time_ms': int(response_time * 1000),
                            'error': f"HTTP {resp.status}: {error_text}"
                        }

        except Exception as e:
            return {
                'valid': False,
                'response_time_ms': None,
                'error': str(e)
            }

    async def validate_voltage_key(self, api_key: str) -> Dict:
        """Validate Voltage API key"""
        print("🔍 Validating Voltage API key...")

        try:
            timeout = aiohttp.ClientTimeout(total=10)
            async with aiohttp.ClientSession(timeout=timeout) as session:
                url = "https://api.voltage.cloud/v1/nodes"
                headers = {"Authorization": f"Bearer {api_key}"}

                start_time = time.time()
                async with session.get(url, headers=headers) as resp:
                    response_time = time.time() - start_time

                    if resp.status == 200:
                        result = await resp.json()
                        return {
                            'valid': True,
                            'response_time_ms': int(response_time * 1000),
                            'nodes_count': len(result) if isinstance(result, list) else 0,
                            'error': None
                        }
                    elif resp.status == 401:
                        return {
                            'valid': False,
                            'response_time_ms': int(response_time * 1000),
                            'error': "Invalid API key (401 Unauthorized)"
                        }
                    else:
                        error_text = await resp.text()
                        return {
                            'valid': False,
                            'response_time_ms': int(response_time * 1000),
                            'error': f"HTTP {resp.status}: {error_text}"
                        }

        except Exception as e:
            return {
                'valid': False,
                'response_time_ms': None,
                'error': str(e)
            }

    async def validate_opennode_key(self, api_key: str) -> Dict:
        """Validate OpenNode API key"""
        print("🔍 Validating OpenNode API key...")

        try:
            timeout = aiohttp.ClientTimeout(total=10)
            async with aiohttp.ClientSession(timeout=timeout) as session:
                url = "https://api.opennode.com/v1/account/balance"
                headers = {"Authorization": api_key}

                start_time = time.time()
                async with session.get(url, headers=headers) as resp:
                    response_time = time.time() - start_time

                    if resp.status == 200:
                        result = await resp.json()
                        return {
                            'valid': True,
                            'response_time_ms': int(response_time * 1000),
                            'balance_sats': result.get('balance', {}).get('total', 0),
                            'error': None
                        }
                    elif resp.status == 401:
                        return {
                            'valid': False,
                            'response_time_ms': int(response_time * 1000),
                            'error': "Invalid API key (401 Unauthorized)"
                        }
                    else:
                        error_text = await resp.text()
                        return {
                            'valid': False,
                            'response_time_ms': int(response_time * 1000),
                            'error': f"HTTP {resp.status}: {error_text}"
                        }

        except Exception as e:
            return {
                'valid': False,
                'response_time_ms': None,
                'error': str(e)
            }

    async def validate_all_keys(self) -> Dict:
        """Validate all API keys"""
        print("\n🔑 ZION WARP Bridge API Key Validation")
        print("=" * 50)

        # Get API keys from environment
        ankr_key = os.getenv('ANKR_API_KEY', 'YOUR_ANKR_API_KEY')
        voltage_key = os.getenv('VOLTAGE_API_KEY', 'YOUR_VOLTAGE_API_KEY')
        opennode_key = os.getenv('OPENNODE_API_KEY', 'YOUR_OPENNODE_API_KEY')

        results = {
            'ankr': await self.validate_ankr_key(ankr_key),
            'voltage': await self.validate_voltage_key(voltage_key),
            'opennode': await self.validate_opennode_key(opennode_key)
        }

        # Summary
        print("\n📊 VALIDATION RESULTS:")
        print("-" * 30)

        all_valid = True
        for service, result in results.items():
            status = "✅ VALID" if result['valid'] else "❌ INVALID"
            response_time = f"{result['response_time_ms']}ms" if result['response_time_ms'] else "N/A"
            print(f"{service.upper():10} | {status:8} | {response_time}")

            if not result['valid']:
                all_valid = False
                print(f"             Error: {result['error']}")

        print("\n" + "=" * 50)
        if all_valid:
            print("🎉 ALL API KEYS VALID! Ready for production deployment.")
            print("\n🚀 You can now run:")
            print("   python3 warp_bridge_production.py --test-basic")
        else:
            print("⚠️  SOME API KEYS INVALID. Please check and update:")
            print("   1. Register at the respective services")
            print("   2. Update .env.production with real API keys")
            print("   3. Run this validator again")
            print("\n🔗 Registration links:")
            print("   Ankr:     https://www.ankr.com")
            print("   Voltage:  https://www.voltage.cloud")
            print("   OpenNode: https://opennode.com")

        return results

async def main():
    """Main validation function"""
    validator = APIKeyValidator()
    await validator.validate_all_keys()

if __name__ == '__main__':
    asyncio.run(main())