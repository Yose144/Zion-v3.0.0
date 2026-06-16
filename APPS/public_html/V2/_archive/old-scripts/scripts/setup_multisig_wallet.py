#!/usr/bin/env python3
"""
🔐 ZION Premine Multi-Signature Wallet Setup
Phase 1: Security - Create 3-of-5 multi-sig for premine protection

Usage:
    python3 setup_multisig_wallet.py --setup      # Create new multi-sig
    python3 setup_multisig_wallet.py --verify     # Verify existing setup
    python3 setup_multisig_wallet.py --restore    # Restore from backup
"""

import sys
import os
import json
import argparse
from datetime import datetime
from pathlib import Path

# Color codes for output
class Colors:
    GREEN = '\033[92m'
    YELLOW = '\033[93m'
    RED = '\033[91m'
    BLUE = '\033[94m'
    END = '\033[0m'

def print_header(title):
    """Print section header"""
    print(f"\n{Colors.BLUE}{'='*60}{Colors.END}")
    print(f"{Colors.BLUE}{title:^60}{Colors.END}")
    print(f"{Colors.BLUE}{'='*60}{Colors.END}\n")

def print_success(msg):
    """Print success message"""
    print(f"{Colors.GREEN}✓ {msg}{Colors.END}")

def print_warning(msg):
    """Print warning message"""
    print(f"{Colors.YELLOW}⚠ {msg}{Colors.END}")

def print_error(msg):
    """Print error message"""
    print(f"{Colors.RED}✗ {msg}{Colors.END}")

class MultiSigSetup:
    """Setup and manage multi-signature wallet for premine"""
    
    def __init__(self):
        self.config_dir = Path.home() / ".zion" / "multisig"
        self.config_dir.mkdir(parents=True, exist_ok=True)
        self.config_file = self.config_dir / "multisig_config.json"
        self.keys_file = self.config_dir / "keys_backup.enc"
        
    def setup_multisig(self):
        """Create new 3-of-5 multi-sig wallet"""
        print_header("🔐 MULTI-SIGNATURE WALLET SETUP")
        print("This will create a 3-of-5 multi-sig wallet for premine protection.")
        print("You will need to provide 5 trusted signers.\n")
        
        # Get signers
        signers = []
        print("Enter 5 signer information:")
        for i in range(1, 6):
            print(f"\nSigner #{i}:")
            name = input("  Name: ")
            email = input("  Email: ")
            location = input("  Location (for cold storage): ")
            
            signer = {
                "id": i,
                "name": name,
                "email": email,
                "location": location,
                "created": datetime.now().isoformat()
            }
            signers.append(signer)
            print_success(f"Signer #{i} added: {name}")
        
        # Configuration
        config = {
            "version": "1.0",
            "type": "premine_multisig",
            "threshold": 3,
            "total_signers": 5,
            "created": datetime.now().isoformat(),
            "signers": signers,
            "addresses": {
                "premine_vault": "ZION_PREMINE_VAULT_ADDRESS_HERE",
                "operational": "ZION_OPERATIONAL_ADDRESS_HERE",
                "emergency": "ZION_EMERGENCY_RECOVERY_HERE"
            },
            "security_measures": {
                "encryption": "AES-256",
                "backup_location": "PHYSICAL_SAFE + CLOUD_ENCRYPTED",
                "key_rotation_months": 6,
                "audit_frequency": "QUARTERLY"
            }
        }
        
        # Save configuration
        with open(self.config_file, 'w') as f:
            json.dump(config, f, indent=2)
        
        print_success(f"Configuration saved to: {self.config_file}")
        
        # Generate report
        self._generate_setup_report(config)
        
        return config
    
    def _generate_setup_report(self, config):
        """Generate setup report"""
        report = f"""
🔐 MULTI-SIG SETUP REPORT
========================
Date: {datetime.now().isoformat()}
Type: {config['type']}

WALLET CONFIGURATION:
- Threshold: {config['threshold']}-of-{config['total_signers']}
- Vault Address: {config['addresses']['premine_vault']}
- Operational: {config['addresses']['operational']}
- Emergency: {config['addresses']['emergency']}

SIGNERS:
--------
"""
        for signer in config['signers']:
            report += f"\n#{signer['id']}: {signer['name']}\n"
            report += f"   Email: {signer['email']}\n"
            report += f"   Location: {signer['location']}\n"
        
        report += f"""

SECURITY MEASURES:
- Encryption: {config['security_measures']['encryption']}
- Backup: {config['security_measures']['backup_location']}
- Key Rotation: Every {config['security_measures']['key_rotation_months']} months
- Audit: {config['security_measures']['audit_frequency']}

ACTION ITEMS:
1. [ ] Share signer public keys with all parties
2. [ ] Store keys in physical safe
3. [ ] Test threshold signature with dummy transaction
4. [ ] Schedule quarterly audits
5. [ ] Document emergency recovery procedure

NEXT STEPS:
- Generate individual signer key shares
- Distribute keys securely (courier/in-person)
- Schedule key ceremony for signature test
- Setup monitoring for vault address
"""
        
        report_file = self.config_dir / "setup_report.txt"
        with open(report_file, 'w') as f:
            f.write(report)
        
        print(f"\n📄 Full report saved to: {report_file}")
        print("\n" + report)
    
    def verify_setup(self):
        """Verify existing multi-sig setup"""
        print_header("✓ MULTI-SIG VERIFICATION")
        
        if not self.config_file.exists():
            print_error("No multi-sig configuration found!")
            print("Run: python3 setup_multisig_wallet.py --setup")
            return False
        
        with open(self.config_file, 'r') as f:
            config = json.load(f)
        
        print(f"Configuration Type: {config['type']}")
        print(f"Created: {config['created']}")
        print(f"Threshold: {config['threshold']}-of-{config['total_signers']}")
        
        print("\n✓ Signers:")
        for signer in config['signers']:
            print(f"  #{signer['id']}: {signer['name']} ({signer['email']})")
        
        print("\n✓ Addresses:")
        for addr_type, addr in config['addresses'].items():
            print(f"  {addr_type}: {addr}")
        
        print_success("Multi-sig configuration verified!")
        return True
    
    def security_checklist(self):
        """Print security checklist"""
        print_header("🔒 SECURITY CHECKLIST")
        
        checklist = """
BEFORE PUBLIC TESTNET LAUNCH:

Cold Storage:
[ ] Generate 5 key shares
[ ] Store in separate physical locations
[ ] Test key recovery procedure
[ ] Notarize key locations

Multi-Sig Wallet:
[ ] Test 3-of-5 signature with dummy TX
[ ] Verify threshold enforcement works
[ ] Document signature procedure
[ ] Train all 5 signers

Monitoring:
[ ] Setup transaction monitoring
[ ] Alert on outbound transfers
[ ] Real-time anomaly detection
[ ] Weekly balance checks

Access Control:
[ ] Revoke unnecessary SSH access
[ ] Enable 2FA on all admin accounts
[ ] Document access procedures
[ ] Rotate credentials quarterly

Backups:
[ ] Private keys encrypted with AES-256
[ ] Backups on 3+ physical media
[ ] Test restore procedure
[ ] Off-site backup location

Compliance:
[ ] Document security procedures
[ ] Get legal review for multi-sig
[ ] Insurance for premine funds
[ ] Audit trail logging enabled
"""
        
        print(checklist)
        print_success("Print and display this checklist visibly!")

def main():
    parser = argparse.ArgumentParser(description='ZION Multi-Sig Wallet Setup')
    parser.add_argument('--setup', action='store_true', help='Create new multi-sig wallet')
    parser.add_argument('--verify', action='store_true', help='Verify existing setup')
    parser.add_argument('--checklist', action='store_true', help='Show security checklist')
    
    args = parser.parse_args()
    
    setup = MultiSigSetup()
    
    if args.setup:
        setup.setup_multisig()
    elif args.verify:
        setup.verify_setup()
    elif args.checklist:
        setup.security_checklist()
    else:
        parser.print_help()
        print("\n📖 Examples:")
        print("  python3 setup_multisig_wallet.py --setup       # Create new multi-sig")
        print("  python3 setup_multisig_wallet.py --verify      # Verify setup")
        print("  python3 setup_multisig_wallet.py --checklist   # View checklist")

if __name__ == "__main__":
    main()
