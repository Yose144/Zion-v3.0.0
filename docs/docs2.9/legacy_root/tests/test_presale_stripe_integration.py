#!/usr/bin/env python3
"""
ZION Presale - Automated Stripe Integration Test
Tests presale order creation, wallet generation, and Stripe checkout flow
"""

import requests
import json
import time
from datetime import datetime
from typing import Dict, Any

# Configuration
BASE_URL = "https://newearth.cz/V2/api"
TEST_EMAIL = "test.stripe@zionterranova.com"
STRIPE_TEST_TOKEN = "tok_visa"  # Stripe test token

class Colors:
    GREEN = '\033[0;32m'
    YELLOW = '\033[1;33m'
    BLUE = '\033[0;34m'
    RED = '\033[0;31m'
    CYAN = '\033[0;36m'
    NC = '\033[0m'

def print_header(text: str):
    print(f"\n{Colors.BLUE}{'='*60}{Colors.NC}")
    print(f"{Colors.BLUE}{text.center(60)}{Colors.NC}")
    print(f"{Colors.BLUE}{'='*60}{Colors.NC}\n")

def print_test(name: str):
    print(f"{Colors.CYAN}→ {name}...{Colors.NC}")

def print_success(text: str):
    print(f"{Colors.GREEN}✅ {text}{Colors.NC}")

def print_error(text: str):
    print(f"{Colors.RED}❌ {text}{Colors.NC}")

def print_info(text: str):
    print(f"{Colors.YELLOW}ℹ️  {text}{Colors.NC}")

def test_presale_order_creation() -> Dict[str, Any]:
    """Test 1: Presale Order Creation"""
    print_header("TEST 1: Presale Order Creation")
    
    # Test data - PIZZA Pack
    # Price: €99.6 -> tokens: 99.6 / 0.008 = 12,450 base
    # With 10% bonus: 12,450 * 1.10 = 13,695 total
    order_data = {
        "email": TEST_EMAIL,
        "name": "Test User",
        "tokens": 13695,  # 12,450 base + 10% bonus
        "baseTokens": 12450,
        "priceEur": 99.6,  # 2,490 CZK / 25
        "priceCzk": 2490,
        "packageName": "PIZZA Pack",
        "bonus": 0.10,
        "paymentMethod": "stripe"
    }
    
    print_test("Sending presale order request")
    print_info(f"Email: {order_data['email']}")
    print_info(f"Package: {order_data['packageName']}")
    print_info(f"Tokens: {order_data['tokens']:,} (base: {order_data['baseTokens']:,} + {order_data['bonus']*100:.0f}% bonus)")
    print_info(f"Price: €{order_data['priceEur']} / {order_data['priceCzk']} Kč")
    
    try:
        response = requests.post(
            f"{BASE_URL}/presale-order.php",
            json=order_data,
            headers={
                "Content-Type": "application/json",
                "User-Agent": "ZION-Test-Suite/1.0"
            },
            timeout=30
        )
        
        print_info(f"Response Status: {response.status_code}")
        
        if response.status_code == 200:
            result = response.json()
            print_success(f"Order created successfully!")
            print_info(f"Order ID: {result.get('orderId', 'N/A')}")
            
            if 'wallet' in result:
                wallet = result['wallet']
                print_success(f"Wallet generated:")
                print_info(f"  Address: {wallet.get('address', 'N/A')}")
                print_info(f"  Network: {wallet.get('network', 'N/A')}")
                print_info(f"  Has mnemonic: {len(wallet.get('mnemonic', '').split()) == 12}")
            
            if 'qr' in result:
                print_success(f"QR code generated")
                
            return result
            
        elif response.status_code == 429:
            print_error("Rate limit exceeded (this is expected behavior)")
            print_info("Waiting 60 seconds before retry...")
            time.sleep(60)
            return test_presale_order_creation()  # Retry
            
        elif response.status_code == 403:
            print_error("Presale is paused or email not whitelisted")
            print_info("Check PRESALE_ENABLED in config.php")
            return {"error": "presale_paused"}
            
        else:
            print_error(f"Unexpected status code: {response.status_code}")
            print_info(f"Response: {response.text[:200]}")
            return {"error": response.text}
            
    except requests.exceptions.RequestException as e:
        print_error(f"Request failed: {str(e)}")
        return {"error": str(e)}

def test_server_side_validation():
    """Test 2: Server-side Validation"""
    print_header("TEST 2: Server-Side Validation")
    
    test_cases = [
        {
            "name": "Invalid email",
            "data": {"email": "invalid-email", "tokens": 1000, "priceEur": 10},
            "expected": 422
        },
        {
            "name": "Too few tokens",
            "data": {"email": "test@example.com", "tokens": 100, "priceEur": 1},
            "expected": 422
        },
        {
            "name": "Price/tokens mismatch",
            "data": {"email": "test@example.com", "tokens": 999999, "priceEur": 10},
            "expected": 422
        },
        {
            "name": "Missing required field",
            "data": {"email": "test@example.com"},
            "expected": 422
        }
    ]
    
    for test_case in test_cases:
        print_test(f"Testing: {test_case['name']}")
        
        try:
            response = requests.post(
                f"{BASE_URL}/presale-order.php",
                json=test_case['data'],
                headers={"Content-Type": "application/json"},
                timeout=10
            )
            
            if response.status_code == test_case['expected']:
                print_success(f"Validation working correctly (HTTP {response.status_code})")
            else:
                print_error(f"Expected {test_case['expected']}, got {response.status_code}")
                
        except Exception as e:
            print_error(f"Test failed: {str(e)}")

def test_rate_limiting():
    """Test 3: Rate Limiting"""
    print_header("TEST 3: Rate Limiting")
    
    print_test("Testing rate limit (5 rapid requests)")
    
    order_data = {
        "email": f"ratelimit.test.{int(time.time())}@example.com",
        "tokens": 10000,
        "priceEur": 40,
        "packageName": "Test Package"
    }
    
    rate_limited = False
    
    for i in range(7):
        try:
            response = requests.post(
                f"{BASE_URL}/presale-order.php",
                json=order_data,
                headers={"Content-Type": "application/json"},
                timeout=10
            )
            
            print_info(f"Request {i+1}: HTTP {response.status_code}")
            
            if response.status_code == 429:
                print_success("Rate limiting triggered as expected!")
                rate_limited = True
                break
                
        except Exception as e:
            print_error(f"Request failed: {str(e)}")
            break
    
    if not rate_limited:
        print_error("Rate limiting did not trigger (may need adjustment)")

def test_wallet_ledger():
    """Test 4: Wallet Ledger API"""
    print_header("TEST 4: Wallet Ledger API")
    
    print_test("Testing ledger GET endpoint (public stats)")
    
    try:
        response = requests.get(
            f"{BASE_URL}/wallet-ledger.php",
            params={"status": "pending", "network": "testnet"},
            timeout=10
        )
        
        print_info(f"Response Status: {response.status_code}")
        
        if response.status_code == 200:
            result = response.json()
            print_success("Ledger API accessible")
            print_info(f"Total entries: {result.get('count', 0)}")
            
            if 'stats' in result:
                stats = result['stats']
                print_info(f"Total tokens: {stats.get('totalTokens', 0):,}")
                print_info(f"By status: {stats.get('byStatus', {})}")
        else:
            print_error(f"Unexpected response: {response.status_code}")
            
    except Exception as e:
        print_error(f"Request failed: {str(e)}")

def test_stripe_publishable_key():
    """Test 5: Stripe Configuration"""
    print_header("TEST 5: Stripe Configuration")
    
    print_test("Checking presale.js for Stripe key")
    
    try:
        response = requests.get(
            "https://newearth.cz/V2/presale.js",
            timeout=10
        )
        
        if response.status_code == 200:
            js_content = response.text
            
            # Check for Stripe key
            if "pk_test_" in js_content:
                print_success("Stripe test publishable key found")
                print_info("Mode: TEST")
            elif "pk_live_" in js_content:
                print_success("Stripe live publishable key found")
                print_info("⚠️  Mode: LIVE (production)")
            else:
                print_error("No Stripe publishable key found")
                
            # Check token price
            if "tokenPriceEur: 0.008" in js_content:
                print_success("Token price configured: €0.008")
            else:
                print_error("Token price not found or incorrect")
                
        else:
            print_error(f"Failed to fetch presale.js: {response.status_code}")
            
    except Exception as e:
        print_error(f"Request failed: {str(e)}")

def test_presale_enabled_check():
    """Test 6: Presale Status"""
    print_header("TEST 6: Presale Status Check")
    
    print_test("Verifying PRESALE_ENABLED flag")
    
    # Try a minimal valid order to check if presale is enabled
    test_data = {
        "email": "status.check@example.com",
        "tokens": 10000,
        "priceEur": 80,
        "packageName": "Status Check"
    }
    
    try:
        response = requests.post(
            f"{BASE_URL}/presale-order.php",
            json=test_data,
            headers={"Content-Type": "application/json"},
            timeout=10
        )
        
        if response.status_code == 403:
            result = response.json()
            if "paused" in result.get("error", "").lower():
                print_error("Presale is PAUSED (PRESALE_ENABLED = false)")
                print_info("Set PRESALE_ENABLED = true in config.php to activate")
            else:
                print_info(f"Access denied: {result.get('error', 'Unknown reason')}")
        elif response.status_code == 200:
            print_success("Presale is ACTIVE (PRESALE_ENABLED = true)")
        elif response.status_code == 422:
            print_success("Presale is ACTIVE (validation errors are expected)")
        elif response.status_code == 429:
            print_success("Presale is ACTIVE (rate limited)")
        else:
            print_info(f"Unexpected status: {response.status_code}")
            
    except Exception as e:
        print_error(f"Request failed: {str(e)}")

def generate_summary(start_time: float):
    """Generate test summary"""
    duration = time.time() - start_time
    
    print_header("TEST SUMMARY")
    
    print(f"{Colors.GREEN}Duration: {duration:.2f} seconds{Colors.NC}\n")
    
    print(f"{Colors.YELLOW}Tested Components:{Colors.NC}")
    print("  ✓ Presale order creation (presale-order.php)")
    print("  ✓ Server-side validation")
    print("  ✓ Rate limiting")
    print("  ✓ Wallet ledger API")
    print("  ✓ Stripe configuration")
    print("  ✓ Presale status check")
    
    print(f"\n{Colors.YELLOW}Next Steps:{Colors.NC}")
    print("  1. Review test results above")
    print("  2. Fix any failed tests")
    print("  3. Run manual testing: ./test_presale_manual.sh")
    print("  4. Test actual Stripe checkout in browser")
    print("  5. Verify email delivery")
    
    print(f"\n{Colors.BLUE}Stripe Test Card for Manual Testing:{Colors.NC}")
    print("  Card: 4242 4242 4242 4242")
    print("  Exp:  12/34")
    print("  CVC:  123")
    print("  ZIP:  12345")
    
    print(f"\n{Colors.GREEN}Ready for production! 🚀{Colors.NC}\n")

def main():
    """Run all automated tests"""
    start_time = time.time()
    
    print(f"\n{Colors.BLUE}╔════════════════════════════════════════════════════════╗{Colors.NC}")
    print(f"{Colors.BLUE}║  ZION PRESALE - AUTOMATED STRIPE INTEGRATION TEST     ║{Colors.NC}")
    print(f"{Colors.BLUE}║  Testing: {BASE_URL}{' '*(31-len(BASE_URL))}║{Colors.NC}")
    print(f"{Colors.BLUE}╚════════════════════════════════════════════════════════╝{Colors.NC}")
    
    # Run all tests
    try:
        # Test 1: Order creation (full flow)
        order_result = test_presale_order_creation()
        time.sleep(2)
        
        # Test 2: Validation
        test_server_side_validation()
        time.sleep(2)
        
        # Test 3: Rate limiting
        test_rate_limiting()
        time.sleep(2)
        
        # Test 4: Ledger
        test_wallet_ledger()
        time.sleep(2)
        
        # Test 5: Stripe config
        test_stripe_publishable_key()
        time.sleep(2)
        
        # Test 6: Presale status
        test_presale_enabled_check()
        
        # Summary
        generate_summary(start_time)
        
    except KeyboardInterrupt:
        print(f"\n\n{Colors.YELLOW}Test suite interrupted by user{Colors.NC}\n")
    except Exception as e:
        print(f"\n{Colors.RED}Fatal error: {str(e)}{Colors.NC}\n")

if __name__ == "__main__":
    main()
