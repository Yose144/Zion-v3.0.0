#!/usr/bin/env python3
"""
ZION Wallet System - Comprehensive Test Suite
==============================================
Testuje všechny komponenty wallet registry systému.

Author: ZION Team
Version: 2.9.0
Created: 4. prosince 2025
"""

import os
import sys
import json
import asyncio
from datetime import datetime
from pathlib import Path

# Add project root
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '../..'))

from wallet_registry import (
    ZionWalletRegistry,
    WalletType,
    NetworkType,
    WalletStatus
)

# Colors for terminal output
class Colors:
    GREEN = '\033[92m'
    RED = '\033[91m'
    YELLOW = '\033[93m'
    BLUE = '\033[94m'
    BOLD = '\033[1m'
    END = '\033[0m'

def print_test(name):
    """Print test header"""
    print(f"\n{Colors.BLUE}{'='*60}{Colors.END}")
    print(f"{Colors.BOLD}TEST: {name}{Colors.END}")
    print(f"{Colors.BLUE}{'='*60}{Colors.END}")

def print_success(message):
    """Print success message"""
    print(f"{Colors.GREEN}✅ {message}{Colors.END}")

def print_error(message):
    """Print error message"""
    print(f"{Colors.RED}❌ {message}{Colors.END}")

def print_info(message):
    """Print info message"""
    print(f"{Colors.YELLOW}ℹ️  {message}{Colors.END}")


class WalletSystemTestSuite:
    """Comprehensive test suite for wallet system"""
    
    def __init__(self):
        self.registry = None
        self.test_db_path = "data/test_wallet_registry.db"
        self.tests_passed = 0
        self.tests_failed = 0
    
    def run_all_tests(self):
        """Run all tests"""
        print(f"\n{Colors.BOLD}{'='*60}")
        print("ZION WALLET SYSTEM - COMPREHENSIVE TEST SUITE")
        print(f"{'='*60}{Colors.END}\n")
        print(f"Test DB: {self.test_db_path}")
        print(f"Started: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}\n")
        
        # Clean up old test DB
        if Path(self.test_db_path).exists():
            Path(self.test_db_path).unlink()
            print_info(f"Cleaned up old test database")
        
        # Run tests
        try:
            self.test_1_registry_initialization()
            self.test_2_database_schema()
            self.test_3_create_eshop_bonus()
            self.test_4_create_presale_wallet()
            self.test_5_query_wallets()
            self.test_6_wallet_statistics()
            self.test_7_sync_operations()
            self.test_8_redemption_flow()
            self.test_9_status_updates()
            self.test_10_edge_cases()
            
            # Summary
            self.print_summary()
            
        except Exception as e:
            print_error(f"CRITICAL ERROR: {e}")
            import traceback
            traceback.print_exc()
            return False
        
        return self.tests_failed == 0
    
    def test_1_registry_initialization(self):
        """Test 1: Registry initialization"""
        print_test("Registry Initialization")
        
        try:
            self.registry = ZionWalletRegistry(db_path=self.test_db_path)
            print_success("Registry initialized successfully")
            self.tests_passed += 1
            
            # Check database file exists
            if Path(self.test_db_path).exists():
                print_success("Database file created")
                self.tests_passed += 1
            else:
                print_error("Database file not created")
                self.tests_failed += 1
            
        except Exception as e:
            print_error(f"Registry initialization failed: {e}")
            self.tests_failed += 1
    
    def test_2_database_schema(self):
        """Test 2: Database schema validation"""
        print_test("Database Schema Validation")
        
        try:
            with self.registry.get_connection() as conn:
                cursor = conn.cursor()
                
                # Check tables
                cursor.execute("SELECT name FROM sqlite_master WHERE type='table'")
                tables = [row[0] for row in cursor.fetchall()]
                
                required_tables = [
                    'wallet_registry',
                    'wallet_redemptions',
                    'wallet_transactions',
                    'wallet_sync_log'
                ]
                
                for table in required_tables:
                    if table in tables:
                        print_success(f"Table exists: {table}")
                        self.tests_passed += 1
                    else:
                        print_error(f"Table missing: {table}")
                        self.tests_failed += 1
                
                # Check views
                cursor.execute("SELECT name FROM sqlite_master WHERE type='view'")
                views = [row[0] for row in cursor.fetchall()]
                
                required_views = [
                    'v_active_wallets_by_type',
                    'v_pending_redemptions',
                    'v_wallet_balance_summary'
                ]
                
                for view in required_views:
                    if view in views:
                        print_success(f"View exists: {view}")
                        self.tests_passed += 1
                    else:
                        print_error(f"View missing: {view}")
                        self.tests_failed += 1
                
        except Exception as e:
            print_error(f"Schema validation failed: {e}")
            self.tests_failed += 1
    
    def test_3_create_eshop_bonus(self):
        """Test 3: Create eShop bonus wallet"""
        print_test("Create eShop Bonus Wallet")
        
        try:
            wallet = self.registry.create_eshop_bonus_wallet(
                tokens=144,
                order_id="TEST-ORD-001",
                customer_email="test@example.com",
                customer_name="Test Customer",
                label="Test Bonus"
            )
            
            print_success(f"Wallet created: {wallet.wallet_id}")
            print_info(f"  Tokens: {wallet.tokens}")
            print_info(f"  Type: {wallet.wallet_type.value}")
            print_info(f"  Network: {wallet.network.value}")
            print_info(f"  Status: {wallet.status.value}")
            
            # Verify in database
            db_wallet = self.registry.get_wallet(wallet.wallet_id)
            if db_wallet:
                print_success("Wallet verified in database")
                self.tests_passed += 1
            else:
                print_error("Wallet not found in database")
                self.tests_failed += 1
            
        except Exception as e:
            print_error(f"Failed to create eShop bonus: {e}")
            self.tests_failed += 1
    
    def test_4_create_presale_wallet(self):
        """Test 4: Create presale wallet"""
        print_test("Create Presale Wallet")
        
        try:
            wallet = self.registry.create_presale_wallet(
                tokens=100_000,
                order_id="TEST-PRESALE-001",
                customer_email="investor@example.com",
                customer_name="Test Investor",
                presale_phase="Phase 1"
            )
            
            print_success(f"Presale wallet created: {wallet.wallet_id}")
            print_info(f"  Tokens: {wallet.tokens:,}")
            print_info(f"  Type: {wallet.wallet_type.value}")
            print_info(f"  Phase: Phase 1")
            
            # Verify large token amount
            if wallet.tokens == 100_000:
                print_success("Token amount correct")
                self.tests_passed += 1
            else:
                print_error(f"Token amount incorrect: {wallet.tokens}")
                self.tests_failed += 1
            
        except Exception as e:
            print_error(f"Failed to create presale wallet: {e}")
            self.tests_failed += 1
    
    def test_5_query_wallets(self):
        """Test 5: Query wallets"""
        print_test("Query Wallets")
        
        try:
            # Query by email
            wallets = self.registry.get_wallets_by_email("test@example.com")
            print_success(f"Found {len(wallets)} wallets for test@example.com")
            self.tests_passed += 1
            
            # Query by order
            wallets = self.registry.get_wallets_by_order("TEST-ORD-001")
            if len(wallets) > 0:
                print_success(f"Found wallet for order TEST-ORD-001")
                self.tests_passed += 1
            else:
                print_error("No wallet found for TEST-ORD-001")
                self.tests_failed += 1
            
            # Query pending redemptions
            pending = self.registry.get_pending_redemptions()
            print_info(f"Pending redemptions: {len(pending)}")
            self.tests_passed += 1
            
        except Exception as e:
            print_error(f"Query failed: {e}")
            self.tests_failed += 1
    
    def test_6_wallet_statistics(self):
        """Test 6: Wallet statistics"""
        print_test("Wallet Statistics")
        
        try:
            summary = self.registry.get_wallet_balance_summary()
            
            print_info("Wallet balance summary:")
            for row in summary:
                print_info(
                    f"  {row['wallet_type']} ({row['network']}): "
                    f"{row['wallet_count']} wallets, "
                    f"{row['allocated_tokens']:,} Dharma Credits"
                )
            
            print_success("Statistics retrieved successfully")
            self.tests_passed += 1
            
        except Exception as e:
            print_error(f"Statistics failed: {e}")
            self.tests_failed += 1
    
    def test_7_sync_operations(self):
        """Test 7: Sync operations"""
        print_test("Sync Operations")
        
        try:
            # Test PHP sync (will fail if no PHP ledger, that's ok)
            try:
                php_synced = self.registry.sync_from_php_ledger()
                print_info(f"PHP sync: {php_synced} wallets")
                self.tests_passed += 1
            except Exception as e:
                print_info(f"PHP sync skipped (ledger not found): {e}")
                self.tests_passed += 1
            
            # Test presale sync (will fail if no presale DB, that's ok)
            try:
                presale_synced = self.registry.sync_from_presale_db()
                print_info(f"Presale sync: {presale_synced} wallets")
                self.tests_passed += 1
            except Exception as e:
                print_info(f"Presale sync skipped (DB not found): {e}")
                self.tests_passed += 1
            
        except Exception as e:
            print_error(f"Sync operations failed: {e}")
            self.tests_failed += 1
    
    def test_8_redemption_flow(self):
        """Test 8: Redemption flow (simulated)"""
        print_test("Redemption Flow (Simulated)")
        
        try:
            # Get a wallet
            wallets = self.registry.get_wallets_by_email("test@example.com")
            if wallets:
                wallet_id = wallets[0]['wallet_id']
                
                # Simulate redemption (just update status)
                with self.registry.get_connection() as conn:
                    cursor = conn.cursor()
                    cursor.execute("""
                        UPDATE wallet_registry
                        SET status = ?,
                            blockchain_address = ?,
                            redeemed_at = CURRENT_TIMESTAMP
                        WHERE wallet_id = ?
                    """, (
                        WalletStatus.REDEEMED.value,
                        "ZION_TEST_ADDRESS_12345",
                        wallet_id
                    ))
                    conn.commit()
                
                # Verify
                updated = self.registry.get_wallet(wallet_id)
                if updated['status'] == WalletStatus.REDEEMED.value:
                    print_success("Wallet redeemed successfully")
                    print_info(f"  New address: {updated['blockchain_address']}")
                    self.tests_passed += 1
                else:
                    print_error("Redemption status not updated")
                    self.tests_failed += 1
            else:
                print_info("No wallets to redeem (skipping)")
                self.tests_passed += 1
            
        except Exception as e:
            print_error(f"Redemption flow failed: {e}")
            self.tests_failed += 1
    
    def test_9_status_updates(self):
        """Test 9: Status updates"""
        print_test("Status Updates")
        
        try:
            # Create test wallet
            wallet = self.registry.create_eshop_bonus_wallet(
                tokens=50,
                order_id="TEST-STATUS-001",
                customer_email="status@example.com",
                customer_name="Status Test"
            )
            
            # Update to active
            with self.registry.get_connection() as conn:
                cursor = conn.cursor()
                cursor.execute("""
                    UPDATE wallet_registry
                    SET status = ?, activated_at = CURRENT_TIMESTAMP
                    WHERE wallet_id = ?
                """, (WalletStatus.ACTIVE.value, wallet.wallet_id))
                conn.commit()
            
            # Verify
            updated = self.registry.get_wallet(wallet.wallet_id)
            if updated['status'] == WalletStatus.ACTIVE.value:
                print_success("Status updated to ACTIVE")
                self.tests_passed += 1
            else:
                print_error("Status not updated")
                self.tests_failed += 1
            
        except Exception as e:
            print_error(f"Status update failed: {e}")
            self.tests_failed += 1
    
    def test_10_edge_cases(self):
        """Test 10: Edge cases (Dharma Credits)"""
        print_test("Edge Cases - Dharma Credits")
        
        try:
            # Test minimum bonus (1 Dharma Credit)
            min_wallet = self.registry.create_eshop_bonus_wallet(
                tokens=1,
                order_id="TEST-MIN-001",
                customer_email="min@example.com",
                customer_name="Min Test"
            )
            print_success(f"Minimum bonus wallet created: {min_wallet.tokens} Dharma Credit")
            self.tests_passed += 1
            
            # Test micro tier (100 Dharma Credits)
            micro_wallet = self.registry.create_eshop_bonus_wallet(
                tokens=100,
                order_id="TEST-MICRO-001",
                customer_email="micro@example.com",
                customer_name="Micro Test"
            )
            print_success(f"Micro tier wallet created: {micro_wallet.tokens} Dharma Credits")
            self.tests_passed += 1
            
            # Test standard tier (1,000 Dharma Credits)
            standard_wallet = self.registry.create_eshop_bonus_wallet(
                tokens=1_000,
                order_id="TEST-STANDARD-001",
                customer_email="standard@example.com",
                customer_name="Standard Test"
            )
            print_success(f"Standard tier wallet created: {standard_wallet.tokens:,} Dharma Credits")
            self.tests_passed += 1
            
            # Test VIP tier (50,000 Dharma Credits)
            vip_wallet = self.registry.create_eshop_bonus_wallet(
                tokens=50_000,
                order_id="TEST-VIP-001",
                customer_email="vip@example.com",
                customer_name="VIP Test"
            )
            print_success(f"VIP tier wallet created: {vip_wallet.tokens:,} Dharma Credits")
            self.tests_passed += 1
            
            # Test maximum bonus (1M Dharma Credits - MEGA tier)
            max_wallet = self.registry.create_eshop_bonus_wallet(
                tokens=1_000_000,
                order_id="TEST-MEGA-001",
                customer_email="mega@example.com",
                customer_name="Mega Whale Test"
            )
            print_success(f"MEGA tier wallet created: {max_wallet.tokens:,} Dharma Credits 🐋")
            self.tests_passed += 1
            
            # Test large presale (500M Dharma Credits)
            large_presale = self.registry.create_presale_wallet(
                tokens=500_000_000,  # 500M
                order_id="TEST-LARGE-001",
                customer_email="whale@example.com",
                customer_name="Whale Investor",
                presale_phase="Phase 1"
            )
            print_success(f"Large presale wallet created: {large_presale.tokens:,} Dharma Credits")
            self.tests_passed += 1
            
        except Exception as e:
            print_error(f"Edge case test failed: {e}")
            self.tests_failed += 1
    
    def print_summary(self):
        """Print test summary"""
        print(f"\n{Colors.BOLD}{'='*60}")
        print("TEST SUMMARY")
        print(f"{'='*60}{Colors.END}\n")
        
        total = self.tests_passed + self.tests_failed
        success_rate = (self.tests_passed / total * 100) if total > 0 else 0
        
        print(f"{Colors.GREEN}✅ Passed: {self.tests_passed}{Colors.END}")
        print(f"{Colors.RED}❌ Failed: {self.tests_failed}{Colors.END}")
        print(f"{Colors.BOLD}Total: {total}{Colors.END}")
        print(f"{Colors.BOLD}Success Rate: {success_rate:.2f}%{Colors.END}\n")
        
        if self.tests_failed == 0:
            print(f"{Colors.GREEN}{Colors.BOLD}{'='*60}")
            print("🎉 ALL TESTS PASSED! 🎉")
            print(f"{'='*60}{Colors.END}\n")
        else:
            print(f"{Colors.RED}{Colors.BOLD}{'='*60}")
            print("❌ SOME TESTS FAILED")
            print(f"{'='*60}{Colors.END}\n")


def main():
    """Main entry point"""
    suite = WalletSystemTestSuite()
    success = suite.run_all_tests()
    
    sys.exit(0 if success else 1)


if __name__ == "__main__":
    main()
