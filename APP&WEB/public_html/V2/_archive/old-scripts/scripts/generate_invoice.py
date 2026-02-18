#!/usr/bin/env python3
"""
ZION eShop - Invoice Generator CLI
===================================
Generuje PDF faktury z příkazové řádky pro integraci s PHP.

Usage:
    python3 scripts/generate_invoice.py \
        --invoice-number "2025/001" \
        --order-id "ORD123456" \
        --customer-name "Jan Novák" \
        --customer-email "jan@example.com" \
        --customer-address "Ulice 123, Praha" \
        --items '[{"name":"Product 1","quantity":2,"unit_price":500}]' \
        --output-path "/path/to/invoice.pdf"

Author: ZION Team
Created: 2025-12-09
"""

import sys
import os
import json
import argparse
from pathlib import Path
from datetime import datetime, timedelta

# Add correct project src to sys.path (works under public_html and server root)
script_path = Path(__file__).resolve()
public_html_root = script_path.parents[2]  # .../public_html
server_root = public_html_root.parent      # .../newearth.cz

# Prefer server_root/src if exists, else fallback to public_html/src
src_candidates = [
    server_root / "src",
    public_html_root / "src",
]
for cand in src_candidates:
    if cand.exists():
        sys.path.insert(0, str(cand))
        break

# Optional override via env var
env_src = os.environ.get("ZION_SRC_PATH")
if env_src:
    sys.path.insert(0, env_src)

from wallet.rasta_invoice_generator import (
    RastaInvoiceGenerator,
    InvoiceData,
    InvoiceItem,
    CompanyInfo
)


def parse_items(items_json: str) -> list:
    """Parse items from JSON string.
    
    Args:
        items_json: JSON array of items
        
    Returns:
        List of InvoiceItem objects
    """
    try:
        items_data = json.loads(items_json)
        items = []
        for item_data in items_data:
            items.append(InvoiceItem(
                name=item_data['name'],
                quantity=int(item_data['quantity']),
                unit_price=float(item_data['unit_price']),
                vat_rate=float(item_data.get('vat_rate', 0.21))
            ))
        return items
    except Exception as e:
        print(f"❌ Error parsing items: {e}", file=sys.stderr)
        sys.exit(1)


def main():
    """Main CLI entry point."""
    parser = argparse.ArgumentParser(description='Generate ZION Rasta-themed invoice PDF')
    
    # Invoice details
    parser.add_argument('--invoice-number', required=True, help='Invoice number (e.g., 2025/001)')
    parser.add_argument('--order-id', required=True, help='Order ID')
    parser.add_argument('--issue-date', help='Issue date (YYYY-MM-DD, default: today)')
    parser.add_argument('--due-date', help='Due date (YYYY-MM-DD, default: +14 days)')
    
    # Customer info
    parser.add_argument('--customer-name', required=True, help='Customer name')
    parser.add_argument('--customer-email', required=True, help='Customer email')
    parser.add_argument('--customer-address', required=True, help='Customer address')
    parser.add_argument('--customer-ico', help='Customer IČO')
    parser.add_argument('--customer-dic', help='Customer DIČ')
    
    # Items
    parser.add_argument('--items', required=True, help='Items JSON array')
    
    # Payment
    parser.add_argument('--payment-method', default='Bankovní převod', help='Payment method')
    parser.add_argument('--variable-symbol', help='Variable symbol (default: invoice number)')
    
    # Output
    parser.add_argument('--output-path', required=True, help='Output PDF path')
    parser.add_argument('--logo-path', help='Path to company logo (optional)')
    
    # Optional
    parser.add_argument('--notes', help='Additional notes')
    
    # Currency (presale support)
    parser.add_argument("--currency", default="CZK", help="Currency code (CZK, EUR)")
    parser.add_argument("--exchange-rate", type=float, default=25.0, help="EUR to CZK exchange rate")
    parser.add_argument("--dual-currency", type=int, default=0, help="Show both currencies (0 or 1)")
    
    args = parser.parse_args()
    
    # Parse dates
    issue_date = args.issue_date or datetime.now().strftime('%Y-%m-%d')
    due_date = args.due_date or (datetime.now() + timedelta(days=14)).strftime('%Y-%m-%d')
    
    # Parse items
    items = parse_items(args.items)
    
    # Create invoice data
    invoice = InvoiceData(
        invoice_number=args.invoice_number,
        order_id=args.order_id,
        issue_date=issue_date,
        due_date=due_date,
        customer_name=args.customer_name,
        customer_address=args.customer_address,
        customer_ico=args.customer_ico,
        customer_dic=args.customer_dic,
        items=items,
        payment_method=args.payment_method,
        variable_symbol=args.variable_symbol,
        notes=args.notes
    )
    
    # Generate invoice
    try:
        generator = RastaInvoiceGenerator(logo_path=args.logo_path)
        output_path = generator.generate(invoice, args.output_path)
        
        # Success output (JSON for PHP parsing)
        result = {
            'success': True,
            'output_path': output_path,
            'invoice_number': invoice.invoice_number,
            'total': invoice.total,
            'total_formatted': f"{invoice.total:,.2f} Kč"
        }
        print(json.dumps(result, ensure_ascii=False))
        sys.exit(0)
        
    except Exception as e:
        # Error output (JSON)
        error = {
            'success': False,
            'error': str(e)
        }
        print(json.dumps(error, ensure_ascii=False), file=sys.stderr)
        sys.exit(1)


if __name__ == '__main__':
    main()
