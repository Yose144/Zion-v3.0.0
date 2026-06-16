#!/usr/bin/env python3
"""
ZION eShop - Order Email Sender
Příjímá JSON s daty objednávky a odesílá Rasta-themed email zákazníkovi.

Usage:
    python send_eshop_order_email.py --order-json /path/to/order.json --email customer@example.com
    python send_eshop_order_email.py --order-json /path/to/order.json --email customer@example.com --smtp-host mail.example.com --smtp-port 587 --smtp-user shop@example.com --smtp-password secret
"""

import argparse
import json
import sys
from pathlib import Path
from typing import Optional
from datetime import datetime

# Import email manageru
project_root = Path(__file__).parent.parent
sys.path.insert(0, str(project_root / "src"))

from wallet.eshop_email_manager import (
    EshopEmailManager,
    EmailConfig,
    OrderData,
    OrderItem,
)


def load_order_from_json(json_path: str) -> dict:
    """Načte data objednávky z JSON souboru."""
    try:
        with open(json_path, "r", encoding="utf-8") as f:
            return json.load(f)
    except Exception as e:
        print(f"❌ Error loading JSON: {e}", file=sys.stderr)
        sys.exit(1)


def convert_json_to_order_data(data: dict) -> OrderData:
    """Konvertuje JSON data na OrderData objekt."""
    # Převést položky
    items = []
    for item_data in data.get("items", []):
        item = OrderItem(
            name=item_data.get("name", ""),
            quantity=item_data.get("quantity", 1),
            price=float(item_data.get("price", 0)),
            total=float(item_data.get("total", 0)),
            sku=item_data.get("sku", ""),
            image_url=item_data.get("image_url", ""),
        )
        items.append(item)

    # Sestavit OrderData (správná struktura podle eshop_email_manager.py)
    # Note: zion_qr_url was removed - QR is now generated from mnemonic directly
    order = OrderData(
        order_id=data.get("order_id", ""),
        customer_name=data.get("customer_name", ""),
        customer_email=data.get("customer_email", ""),
        order_date=data.get("order_date", datetime.now().strftime("%d.%m.%Y %H:%M")),
        total_price=float(data.get("total", 0)),
        items=items,
        payment_method=data.get("payment_method", ""),
        payment_status=data.get("payment_status", "pending"),
        shipping_address=data.get("shipping_address", ""),
        shipping_method=data.get("shipping_method", ""),
        shipping_cost=float(data.get("shipping_price", 0)),
        notes=data.get("notes", ""),
        zion_tokens=int(data.get("zion_tokens", 0)),
        zion_wallet_id=data.get("zion_wallet_id", ""),
        zion_wallet_address=data.get("zion_wallet_address", ""),
        zion_mnemonic=data.get("zion_mnemonic", ""),
        download_token=data.get("download_token", ""),
    )

    return order


def main():
    parser = argparse.ArgumentParser(
        description="Send Rasta-themed order confirmation email"
    )

    # Povinné argumenty
    parser.add_argument(
        "--order-json", required=True, help="Path to JSON file with order data"
    )
    parser.add_argument(
        "--email", required=True, help="Customer email address"
    )

    # SMTP konfigurace (volitelné)
    parser.add_argument("--smtp-host", default="mail.webglobe.cz", help="SMTP server")
    parser.add_argument("--smtp-port", type=int, default=587, help="SMTP port")
    parser.add_argument(
        "--smtp-user", default="shop@newearth.cz", help="SMTP username"
    )
    parser.add_argument("--smtp-password", help="SMTP password")
    
    # Invoice attachment (optional)
    parser.add_argument("--invoice-path", help="Path to PDF invoice to attach")

    args = parser.parse_args()

    # Načíst data objednávky
    print(f"📥 Loading order data from: {args.order_json}")
    json_data = load_order_from_json(args.order_json)

    # Konvertovat na OrderData
    order = convert_json_to_order_data(json_data)
    print(f"📦 Order ID: {order.order_id}")
    print(f"👤 Customer: {order.customer_name}")
    print(f"📧 Email: {args.email}")
    print(f"💰 Total: {order.total_price} Kč")

    # SMTP konfigurace
    email_config = EmailConfig(
        smtp_host=args.smtp_host,
        smtp_port=args.smtp_port,
        smtp_user=args.smtp_user,
        smtp_password=args.smtp_password or "",
        sender_email=args.smtp_user,
        sender_name="ZION eShop",
    )

    print(f"\n📮 SMTP: {email_config.smtp_host}:{email_config.smtp_port}")
    print(f"👤 User: {email_config.smtp_user}")

    # Vytvořit email manager
    email_manager = EshopEmailManager(config=email_config)

    # Odeslat email
    print(f"\n🚀 Sending email to {args.email}...")
    if args.invoice_path:
        print(f"📄 Attaching invoice: {args.invoice_path}")
    
    try:
        # Email je v order.customer_email, ale můžeme přepsat recipient
        # Zkopírujeme order a změníme customer_email na args.email
        order.customer_email = args.email
        
        result = email_manager.send_order_confirmation(
            order, 
            test_mode=False,
            invoice_path=args.invoice_path
        )

        if result:
            print(f"✅ Email sent successfully to {args.email}!")
            print(f"📧 Order: {order.order_id}")
            sys.exit(0)
        else:
            print(f"❌ Failed to send email to {args.email}", file=sys.stderr)
            sys.exit(1)

    except Exception as e:
        print(f"❌ Error sending email: {e}", file=sys.stderr)
        import traceback

        traceback.print_exc()
        sys.exit(1)


if __name__ == "__main__":
    main()
