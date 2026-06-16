#!/usr/bin/env python3
"""
ZION eShop Email Tester
========================
Testuje odesílání emailů se skutečnými SMTP údaji.

Usage:
    python3 scripts/test_eshop_email.py --email your@email.com
    python3 scripts/test_eshop_email.py --email your@email.com --live
"""

import sys
import argparse
from pathlib import Path
from datetime import datetime

# Add project root to path
project_root = Path(__file__).parent.parent
sys.path.insert(0, str(project_root))

from src.wallet.eshop_email_manager import (
    EshopEmailManager,
    EmailConfig,
    OrderData,
    OrderItem
)


def create_test_order(email: str) -> OrderData:
    """Create test order data."""
    return OrderData(
        order_id=f"TEST_{datetime.now().strftime('%Y%m%d_%H%M%S')}",
        customer_name="Test Zákazník",
        customer_email=email,
        order_date=datetime.now().strftime("%d.%m.%Y %H:%M"),
        total_price=1599.00,
        items=[
            OrderItem(
                name="ZION T-Shirt - Rasta Edition",
                quantity=2,
                price=499.00,
                total=998.00,
                sku="ZION-TSHIRT-RASTA-L"
            ),
            OrderItem(
                name="ZION Logo Cap",
                quantity=1,
                price=299.00,
                total=299.00,
                sku="ZION-CAP-001"
            ),
            OrderItem(
                name="ZION Sticker Pack",
                quantity=1,
                price=99.00,
                total=99.00,
                sku="ZION-STICKERS-PACK"
            ),
        ],
        payment_method="Bankovní převod",
        payment_status="Čeká na platbu",
        shipping_address="Test Zákazník\nTestovací 123\n120 00 Praha 2\nČeská republika",
        shipping_method="Česká pošta - Balík na poštu",
        shipping_cost=99.00,
        notes="Testovací objednávka"
    )


def main():
    parser = argparse.ArgumentParser(
        description='Test ZION eShop email sending',
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  # Dry-run test (no actual email sent)
  python3 scripts/test_eshop_email.py --email test@example.com
  
  # Send real email
  python3 scripts/test_eshop_email.py --email test@example.com --live
  
  # With custom SMTP
  python3 scripts/test_eshop_email.py --email test@example.com --live \\
      --smtp-host smtp.gmail.com --smtp-port 587 \\
      --smtp-user your@gmail.com --smtp-password "app_password"
        """
    )
    
    parser.add_argument(
        '--email',
        required=True,
        help='Email address to send test to'
    )
    
    parser.add_argument(
        '--live',
        action='store_true',
        help='Actually send email (default is dry-run)'
    )
    
    parser.add_argument(
        '--smtp-host',
        default='smtp.forpsi.com',
        help='SMTP server host (default: smtp.forpsi.com)'
    )
    
    parser.add_argument(
        '--smtp-port',
        type=int,
        default=587,
        help='SMTP server port (default: 587)'
    )
    
    parser.add_argument(
        '--smtp-user',
        default='shop@newearth.cz',
        help='SMTP username (default: shop@newearth.cz)'
    )
    
    parser.add_argument(
        '--smtp-password',
        help='SMTP password (can also use ZION_SMTP_PASSWORD env var)'
    )
    
    args = parser.parse_args()
    
    # Print header
    print("=" * 80)
    print("🧪 ZION eShop Email Test")
    print("=" * 80)
    print()
    
    # Create config
    config = EmailConfig(
        smtp_host=args.smtp_host,
        smtp_port=args.smtp_port,
        smtp_user=args.smtp_user,
        smtp_password=args.smtp_password or ""
    )
    
    # Show configuration
    print(f"📧 Email Configuration:")
    print(f"   SMTP Host: {config.smtp_host}:{config.smtp_port}")
    print(f"   SMTP User: {config.smtp_user}")
    print(f"   Password: {'✅ SET' if config.smtp_password else '❌ NOT SET (will use env ZION_SMTP_PASSWORD)'}")
    print(f"   Test Email: {args.email}")
    print(f"   Mode: {'🔴 LIVE (will send real email)' if args.live else '🟡 DRY-RUN (no email sent)'}")
    print()
    
    # Create test order
    print("📦 Creating test order...")
    order = create_test_order(args.email)
    print(f"   Order ID: {order.order_id}")
    print(f"   Customer: {order.customer_name}")
    print(f"   Total: {order.total_price:,.2f} Kč")
    print(f"   Items: {len(order.items)}")
    print()
    
    # Create email manager
    print("🚀 Initializing email manager...")
    manager = EshopEmailManager(config)
    print()
    
    # Send email
    if args.live:
        if not config.smtp_password:
            print("❌ ERROR: SMTP password not provided!")
            print()
            print("Options:")
            print("  1. Use --smtp-password flag")
            print("  2. Set ZION_SMTP_PASSWORD environment variable")
            print()
            print("Example:")
            print(f"  export ZION_SMTP_PASSWORD='your_password'")
            print(f"  python3 {sys.argv[0]} --email {args.email} --live")
            print()
            sys.exit(1)
        
        print("📤 Sending LIVE email...")
        print("⚠️  This will send an actual email!")
        print()
        
        try:
            success = manager.send_order_confirmation(order, test_mode=False)
            
            if success:
                print()
                print("=" * 80)
                print("✅ EMAIL SENT SUCCESSFULLY!")
                print("=" * 80)
                print()
                print(f"Check your inbox at: {args.email}")
                print()
                print("Expected email:")
                print(f"  Subject: ✅ ZION eShop - Potvrzení objednávky #{order.order_id}")
                print(f"  From: ZION eShop <{config.sender_email}>")
                print(f"  To: {args.email}")
                print()
            else:
                print()
                print("=" * 80)
                print("❌ EMAIL SENDING FAILED!")
                print("=" * 80)
                print()
                print("Check logs above for error details")
                print()
                sys.exit(1)
                
        except Exception as e:
            print()
            print("=" * 80)
            print("❌ ERROR SENDING EMAIL!")
            print("=" * 80)
            print()
            print(f"Error: {e}")
            print()
            print("Common issues:")
            print("  • Wrong SMTP credentials")
            print("  • SMTP server blocked")
            print("  • Firewall/network issues")
            print("  • Invalid email address")
            print()
            sys.exit(1)
    else:
        print("🧪 Running DRY-RUN test...")
        success = manager.send_order_confirmation(order, test_mode=True)
        
        if success:
            print()
            print("=" * 80)
            print("✅ DRY-RUN TEST PASSED!")
            print("=" * 80)
            print()
            print("Template loaded and processed successfully.")
            print("No actual email was sent (dry-run mode).")
            print()
            print("To send a real email, add --live flag:")
            print(f"  python3 {sys.argv[0]} --email {args.email} --live \\")
            print(f"      --smtp-password 'your_password'")
            print()
        else:
            print()
            print("=" * 80)
            print("❌ DRY-RUN TEST FAILED!")
            print("=" * 80)
            print()
            sys.exit(1)


if __name__ == "__main__":
    main()
