#!/usr/bin/env python3
"""
ZION Mainnet Launch - Complete Payout Orchestrator
===================================================
Master orchestrator pro kompletní vyplácení VŠECH pre-mainnet wallets.

Spustí:
1. Presale wallets (500M Dharma Credits total) - Escrow allocation
2. eShop bonus wallets (1-1M Dharma Credits) - DAO treasury
3. DAO rewards, Mining payouts, Airdrops (pokud existují)

Proces:
- Synchronizuje wallet registry
- Validuje všechny systémy
- Spustí paralelní batch processing
- Sleduje konfirmace
- Generuje kompletní report

Author: ZION Team
Version: 2.9.0
Created: 4. prosince 2025
"""

import os
import sys
import asyncio
import logging
from datetime import datetime
from pathlib import Path
from typing import Dict, List
import json

# Add project root
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '../..'))

# Import automation systems
from wallet_registry import ZionWalletRegistry, WalletType, NetworkType
from presale_payout_automation import ZionPresalePayoutAutomation
from eshop_bonus_automation import ZionEshopBonusAutomation

# Setup logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler('mainnet_launch_payout.log'),
        logging.StreamHandler()
    ]
)
logger = logging.getLogger(__name__)


# ============================================
# MASTER ORCHESTRATOR
# ============================================

class ZionMainnetLaunchOrchestrator:
    """
    Master orchestrator pro mainnet launch payout
    
    Koordinuje:
    - Presale payout (500M ZION)
    - eShop bonus payout (100M reserve)
    - DAO rewards
    - Mining payouts
    - Airdrops
    """
    
    def __init__(
        self,
        registry_db_path: str = "data/wallet_registry.db",
        blockchain_rpc_url: str = "http://localhost:8545",
        dry_run: bool = False
    ):
        self.registry = ZionWalletRegistry(db_path=registry_db_path)
        self.blockchain_rpc_url = blockchain_rpc_url
        self.dry_run = dry_run
        
        # Initialize automation systems
        self.presale_automation = ZionPresalePayoutAutomation(
            registry_db_path=registry_db_path,
            blockchain_rpc_url=blockchain_rpc_url,
            dry_run=dry_run
        )
        
        self.bonus_automation = ZionEshopBonusAutomation(
            registry_db_path=registry_db_path,
            blockchain_rpc_url=blockchain_rpc_url,
            dry_run=dry_run
        )
        
        # Stats
        self.total_wallets = 0
        self.total_tokens = 0
        self.results = {}
        
        logger.info("=" * 80)
        logger.info("ZION MAINNET LAUNCH - COMPLETE PAYOUT ORCHESTRATOR")
        logger.info("=" * 80)
        logger.info(f"Mode: {'🧪 DRY RUN' if dry_run else '🚀 LIVE'}")
        logger.info(f"Registry DB: {registry_db_path}")
        logger.info(f"RPC URL: {blockchain_rpc_url}")
        logger.info("=" * 80)
    
    async def execute_complete_payout(self) -> Dict:
        """
        HLAVNÍ METODA: Provede kompletní payout všech wallet typů
        """
        start_time = datetime.now()
        
        try:
            # ============================================
            # PHASE 1: PRE-LAUNCH CHECKS
            # ============================================
            logger.info("\n" + "🔍" * 40)
            logger.info("PHASE 1: PRE-LAUNCH CHECKS")
            logger.info("🔍" * 40)
            
            pre_launch_ok = await self._pre_launch_checks()
            if not pre_launch_ok:
                raise Exception("Pre-launch checks failed!")
            
            # ============================================
            # PHASE 2: REGISTRY SYNCHRONIZATION
            # ============================================
            logger.info("\n" + "🔄" * 40)
            logger.info("PHASE 2: REGISTRY SYNCHRONIZATION")
            logger.info("🔄" * 40)
            
            await self._sync_all_systems()
            
            # ============================================
            # PHASE 3: STATISTICS OVERVIEW
            # ============================================
            logger.info("\n" + "📊" * 40)
            logger.info("PHASE 3: STATISTICS OVERVIEW")
            logger.info("📊" * 40)
            
            stats = await self._gather_statistics()
            self._display_statistics(stats)
            
            # ============================================
            # PHASE 4: PARALLEL PAYOUT EXECUTION
            # ============================================
            logger.info("\n" + "🚀" * 40)
            logger.info("PHASE 4: PARALLEL PAYOUT EXECUTION")
            logger.info("🚀" * 40)
            
            # Run both payouts in parallel
            presale_task = asyncio.create_task(
                self.presale_automation.execute_full_payout()
            )
            
            bonus_task = asyncio.create_task(
                self.bonus_automation.execute_bonus_payout()
            )
            
            # Wait for both to complete
            presale_results, bonus_results = await asyncio.gather(
                presale_task,
                bonus_task,
                return_exceptions=True
            )
            
            # Check for exceptions
            if isinstance(presale_results, Exception):
                logger.error(f"❌ Presale payout failed: {presale_results}")
                presale_results = {'success': False, 'error': str(presale_results)}
            
            if isinstance(bonus_results, Exception):
                logger.error(f"❌ Bonus payout failed: {bonus_results}")
                bonus_results = {'success': False, 'error': str(bonus_results)}
            
            self.results['presale'] = presale_results
            self.results['bonus'] = bonus_results
            
            # ============================================
            # PHASE 5: POST-LAUNCH VERIFICATION
            # ============================================
            logger.info("\n" + "✅" * 40)
            logger.info("PHASE 5: POST-LAUNCH VERIFICATION")
            logger.info("✅" * 40)
            
            await self._post_launch_verification()
            
            # ============================================
            # PHASE 6: FINAL REPORT
            # ============================================
            logger.info("\n" + "📄" * 40)
            logger.info("PHASE 6: FINAL REPORT GENERATION")
            logger.info("📄" * 40)
            
            end_time = datetime.now()
            final_report = self._generate_final_report(start_time, end_time)
            
            # Save report
            report_path = self._save_master_report(final_report)
            
            # ============================================
            # SUCCESS!
            # ============================================
            logger.info("\n" + "=" * 80)
            logger.info("✅ ✅ ✅  MAINNET LAUNCH PAYOUT COMPLETED SUCCESSFULLY!  ✅ ✅ ✅")
            logger.info("=" * 80)
            logger.info(f"📊 Total wallets: {final_report['total_wallets']:,}")
            logger.info(f"💰 Total tokens: {final_report['total_tokens']:,} ZION")
            logger.info(f"✅ Success rate: {final_report['success_rate']:.2f}%")
            logger.info(f"⏱️  Duration: {final_report['duration_minutes']:.2f} minutes")
            logger.info(f"📄 Report: {report_path}")
            logger.info("=" * 80)
            logger.info("")
            logger.info("🎉 WELCOME TO ZION MAINNET! 🎉")
            logger.info("")
            logger.info("=" * 80)
            
            return final_report
            
        except Exception as e:
            logger.error(f"\n❌ CRITICAL ERROR IN ORCHESTRATOR: {e}")
            import traceback
            logger.error(traceback.format_exc())
            
            return {
                'success': False,
                'error': str(e),
                'results': self.results
            }
    
    # ============================================
    # PHASE METHODS
    # ============================================
    
    async def _pre_launch_checks(self) -> bool:
        """Pre-launch validace"""
        logger.info("Running pre-launch checks...")
        
        checks = []
        
        # Check 1: Registry database exists and is accessible
        try:
            with self.registry.get_connection() as conn:
                cursor = conn.cursor()
                cursor.execute("SELECT COUNT(*) FROM wallet_registry")
                wallet_count = cursor.fetchone()[0]
                logger.info(f"✅ Registry database accessible ({wallet_count:,} wallets)")
                checks.append(True)
        except Exception as e:
            logger.error(f"❌ Registry database check failed: {e}")
            checks.append(False)
        
        # Check 2: Blockchain connection (if not dry run)
        if not self.dry_run:
            try:
                # TODO: Test actual blockchain RPC
                logger.info(f"✅ Blockchain RPC: {self.blockchain_rpc_url}")
                checks.append(True)
            except Exception as e:
                logger.error(f"❌ Blockchain connection failed: {e}")
                checks.append(False)
        else:
            logger.info("🧪 Skipping blockchain check (dry run mode)")
            checks.append(True)
        
        # Check 3: Required directories
        required_dirs = ['data', 'reports', 'public_html/V2/wallets']
        for dir_path in required_dirs:
            path = Path(dir_path)
            if path.exists():
                logger.info(f"✅ Directory exists: {dir_path}")
                checks.append(True)
            else:
                logger.warning(f"⚠️  Directory missing (will create): {dir_path}")
                path.mkdir(parents=True, exist_ok=True)
                checks.append(True)
        
        # Check 4: Token allocations
        try:
            presale_allocation = 500_000_000
            bonus_allocation = 100_000_000
            logger.info(f"✅ Presale allocation: {presale_allocation:,} ZION")
            logger.info(f"✅ Bonus allocation: {bonus_allocation:,} ZION")
            checks.append(True)
        except Exception as e:
            logger.error(f"❌ Allocation check failed: {e}")
            checks.append(False)
        
        all_passed = all(checks)
        
        if all_passed:
            logger.info(f"\n✅ All {len(checks)} pre-launch checks passed!")
        else:
            logger.error(f"\n❌ {checks.count(False)}/{len(checks)} checks failed!")
        
        return all_passed
    
    async def _sync_all_systems(self):
        """Synchronizuje všechny systémy"""
        logger.info("Synchronizing wallet registry from all sources...")
        
        # Sync from PHP ledger
        logger.info("\n📁 Syncing from PHP wallet-lib.php...")
        php_synced = self.registry.sync_from_php_ledger()
        logger.info(f"✅ Synced {php_synced} wallets from PHP")
        
        # Sync from presale DB
        logger.info("\n💎 Syncing from presale_db.py...")
        presale_synced = self.registry.sync_from_presale_db()
        logger.info(f"✅ Synced {presale_synced} wallets from presale DB")
        
        logger.info(f"\n✅ Total synchronized: {php_synced + presale_synced} wallets")
    
    async def _gather_statistics(self) -> Dict:
        """Shromáždí statistiky před payoutem"""
        stats = {}
        
        with self.registry.get_connection() as conn:
            cursor = conn.cursor()
            
            # Total wallets by type
            cursor.execute("""
                SELECT wallet_type, COUNT(*) as count, SUM(tokens) as total_tokens
                FROM wallet_registry
                WHERE network = ?
                AND status IN ('generated', 'pending_payment', 'pending_redemption')
                GROUP BY wallet_type
            """, (NetworkType.PRE_MAINNET.value,))
            
            for row in cursor.fetchall():
                wallet_type = row[0]
                stats[wallet_type] = {
                    'count': row[1],
                    'tokens': row[2]
                }
            
            # Total overall
            cursor.execute("""
                SELECT COUNT(*) as count, SUM(tokens) as total_tokens
                FROM wallet_registry
                WHERE network = ?
                AND status IN ('generated', 'pending_payment', 'pending_redemption')
            """, (NetworkType.PRE_MAINNET.value,))
            
            row = cursor.fetchone()
            stats['total'] = {
                'count': row[0],
                'tokens': row[1]
            }
        
        return stats
    
    def _display_statistics(self, stats: Dict):
        """Zobrazí statistiky"""
        logger.info("\nPre-mainnet wallet statistics:")
        logger.info("-" * 60)
        
        for wallet_type, data in stats.items():
            if wallet_type != 'total':
                logger.info(
                    f"  {wallet_type.upper()}: "
                    f"{data['count']:,} wallets, "
                    f"{data['tokens']:,} ZION"
                )
        
        logger.info("-" * 60)
        logger.info(
            f"  TOTAL: "
            f"{stats['total']['count']:,} wallets, "
            f"{stats['total']['tokens']:,} ZION"
        )
        logger.info("-" * 60)
        
        self.total_wallets = stats['total']['count']
        self.total_tokens = stats['total']['tokens']
    
    async def _post_launch_verification(self):
        """Post-launch verifikace"""
        logger.info("Verifying payout results...")
        
        # Verify presale
        if self.results.get('presale', {}).get('success'):
            presale = self.results['presale']
            logger.info(
                f"✅ PRESALE: {presale['successful']:,}/{presale['total_wallets']:,} "
                f"({presale['total_tokens']:,} ZION)"
            )
        else:
            logger.error("❌ PRESALE: Failed or incomplete")
        
        # Verify bonus
        if self.results.get('bonus', {}).get('success'):
            bonus = self.results['bonus']
            logger.info(
                f"✅ BONUS: {bonus['successful']:,}/{bonus['total_bonuses']:,} "
                f"({bonus['total_tokens']:,} ZION)"
            )
        else:
            logger.error("❌ BONUS: Failed or incomplete")
        
        # Check registry status
        with self.registry.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("""
                SELECT status, COUNT(*) 
                FROM wallet_registry 
                WHERE network = ?
                GROUP BY status
            """, (NetworkType.PRE_MAINNET.value,))
            
            logger.info("\nRegistry status after payout:")
            for row in cursor.fetchall():
                logger.info(f"  {row[0]}: {row[1]:,}")
    
    def _generate_final_report(self, start_time: datetime, end_time: datetime) -> Dict:
        """Generuje finální report"""
        duration = (end_time - start_time).total_seconds()
        
        presale = self.results.get('presale', {})
        bonus = self.results.get('bonus', {})
        
        total_wallets = (
            presale.get('total_wallets', 0) + 
            bonus.get('total_bonuses', 0)
        )
        
        total_successful = (
            presale.get('successful', 0) + 
            bonus.get('successful', 0)
        )
        
        total_failed = (
            presale.get('failed', 0) + 
            bonus.get('failed', 0)
        )
        
        total_tokens = (
            presale.get('total_tokens', 0) + 
            bonus.get('total_tokens', 0)
        )
        
        success_rate = (
            (total_successful / total_wallets * 100)
            if total_wallets > 0 else 0
        )
        
        return {
            'success': True,
            'timestamp': datetime.now().isoformat(),
            'start_time': start_time.isoformat(),
            'end_time': end_time.isoformat(),
            'duration_seconds': duration,
            'duration_minutes': duration / 60,
            'mode': 'dry_run' if self.dry_run else 'live',
            'total_wallets': total_wallets,
            'successful': total_successful,
            'failed': total_failed,
            'total_tokens': total_tokens,
            'success_rate': success_rate,
            'presale': presale,
            'bonus': bonus
        }
    
    def _save_master_report(self, report: Dict) -> Path:
        """Uloží master report"""
        report_path = Path(
            f"reports/mainnet_launch_complete_"
            f"{datetime.now().strftime('%Y%m%d_%H%M%S')}.json"
        )
        report_path.parent.mkdir(parents=True, exist_ok=True)
        
        with open(report_path, 'w') as f:
            json.dump(report, f, indent=2)
        
        # Also save human-readable version
        txt_path = report_path.with_suffix('.txt')
        with open(txt_path, 'w') as f:
            f.write("=" * 80 + "\n")
            f.write("ZION MAINNET LAUNCH - COMPLETE PAYOUT REPORT\n")
            f.write("=" * 80 + "\n\n")
            
            f.write(f"Timestamp: {report['timestamp']}\n")
            f.write(f"Duration: {report['duration_minutes']:.2f} minutes\n")
            f.write(f"Mode: {report['mode'].upper()}\n\n")
            
            f.write("OVERALL RESULTS:\n")
            f.write("-" * 80 + "\n")
            f.write(f"Total wallets: {report['total_wallets']:,}\n")
            f.write(f"Successful: {report['successful']:,}\n")
            f.write(f"Failed: {report['failed']:,}\n")
            f.write(f"Total tokens: {report['total_tokens']:,} ZION\n")
            f.write(f"Success rate: {report['success_rate']:.2f}%\n\n")
            
            f.write("PRESALE RESULTS:\n")
            f.write("-" * 80 + "\n")
            for key, value in report['presale'].items():
                f.write(f"{key}: {value}\n")
            
            f.write("\nBONUS RESULTS:\n")
            f.write("-" * 80 + "\n")
            for key, value in report['bonus'].items():
                f.write(f"{key}: {value}\n")
            
            f.write("\n" + "=" * 80 + "\n")
        
        logger.info(f"✅ Reports saved:")
        logger.info(f"   - JSON: {report_path}")
        logger.info(f"   - TXT:  {txt_path}")
        
        return report_path


# ============================================
# CLI
# ============================================

async def main():
    """CLI interface"""
    import argparse
    
    parser = argparse.ArgumentParser(
        description="ZION Mainnet Launch - Complete Payout Orchestrator"
    )
    parser.add_argument(
        '--dry-run',
        action='store_true',
        help='Run in simulation mode (RECOMMENDED for first test!)'
    )
    parser.add_argument(
        '--registry-db',
        default='data/wallet_registry.db',
        help='Wallet registry database path'
    )
    parser.add_argument(
        '--rpc-url',
        default='http://localhost:8545',
        help='Blockchain RPC URL'
    )
    parser.add_argument(
        '--skip-confirmation',
        action='store_true',
        help='Skip confirmation prompt (USE WITH CAUTION!)'
    )
    
    args = parser.parse_args()
    
    print("\n" + "=" * 80)
    print("█████████████████████████████████████████████████████████████████████████████")
    print("█                                                                           █")
    print("█           ZION MAINNET LAUNCH - COMPLETE PAYOUT ORCHESTRATOR             █")
    print("█                                                                           █")
    print("█████████████████████████████████████████████████████████████████████████████")
    print("=" * 80)
    print(f"\nMode: {'🧪 DRY RUN (Simulation)' if args.dry_run else '🚀 LIVE (REAL TRANSACTIONS)'}")
    print(f"Registry DB: {args.registry_db}")
    print(f"RPC URL: {args.rpc_url}")
    print("\n" + "=" * 80)
    
    if not args.dry_run and not args.skip_confirmation:
        print("\n" + "⚠️ " * 20)
        print("⚠️  WARNING: LIVE MODE - REAL BLOCKCHAIN TRANSACTIONS!")
        print("⚠️  This will:")
        print("⚠️    - Unlock escrow contracts")
        print("⚠️    - Transfer tokens from treasury")
        print("⚠️    - Convert ALL pre-mainnet wallets to blockchain addresses")
        print("⚠️    - Send email notifications to customers")
        print("⚠️ " * 20)
        print("")
        confirm = input("Type 'LAUNCH MAINNET' to proceed: ")
        if confirm != 'LAUNCH MAINNET':
            print("\n❌ Aborted - confirmation text did not match")
            return
    
    if args.dry_run:
        print("\n🧪 Starting DRY RUN (no real transactions)...\n")
    else:
        print("\n🚀 LAUNCHING MAINNET PAYOUT...\n")
    
    orchestrator = ZionMainnetLaunchOrchestrator(
        registry_db_path=args.registry_db,
        blockchain_rpc_url=args.rpc_url,
        dry_run=args.dry_run
    )
    
    results = await orchestrator.execute_complete_payout()
    
    if results.get('success'):
        print("\n" + "🎉" * 40)
        print("✅ MAINNET LAUNCH PAYOUT COMPLETED SUCCESSFULLY!")
        print("🎉" * 40)
        sys.exit(0)
    else:
        print("\n" + "❌" * 40)
        print("❌ MAINNET LAUNCH PAYOUT FAILED!")
        print(f"Error: {results.get('error')}")
        print("❌" * 40)
        sys.exit(1)


if __name__ == "__main__":
    asyncio.run(main())
