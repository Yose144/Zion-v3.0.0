#!/usr/bin/env python3
"""
ZION Wallet Generator - CGI Wrapper
Volá Python backend přímo bez HTTP
"""

import sys
import json
import os

# Add project root to path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '../../..'))

try:
    from src.core.presale_wallet import (
        generate_presale_wallet,
        encrypt_private_key,
        generate_qr_code
    )
    
    # Parse query string or POST data
    import cgi
    form = cgi.FieldStorage()
    
    email = form.getvalue('email', 'unknown@example.com')
    tokens = int(form.getvalue('tokens', 0))
    order_id = form.getvalue('orderId', 'UNKNOWN')
    
    # Generate wallet
    address, private_key = generate_presale_wallet()
    wallet_id = f"zw_{order_id}_{address[:8]}"
    
    # Try to generate QR (optional)
    qr_path = None
    try:
        qr_dir = '/home/html/newearth.cz/data/presale_qr_codes'
        os.makedirs(qr_dir, exist_ok=True)
        qr_filename = f"{order_id}.png"
        qr_path = os.path.join(qr_dir, qr_filename)
        generate_qr_code(address, tokens, order_id, qr_path)
        qr_url = f"http://newearth.cz/data/presale_qr_codes/{qr_filename}"
    except Exception as e:
        qr_url = None
    
    # Return JSON
    result = {
        'success': True,
        'walletId': wallet_id,
        'address': address,
        'privateKey': private_key,
        'qrCodeUrl': qr_url,
        'qrCodePath': qr_path,
        'tokens': tokens
    }
    
    print("Content-Type: application/json")
    print()
    print(json.dumps(result))
    
except Exception as e:
    print("Content-Type: application/json")
    print()
    print(json.dumps({
        'success': False,
        'error': str(e)
    }))
