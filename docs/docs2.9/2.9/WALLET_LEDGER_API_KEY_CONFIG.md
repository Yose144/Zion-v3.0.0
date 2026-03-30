# 🔐 WALLET_LEDGER_API_KEY Configuration

## Overview

The `WALLET_LEDGER_API_KEY` protects the wallet-ledger.php POST endpoint from unauthorized access.

## Current Status

| Environment | Status | Key Hash |
|-------------|--------|----------|
| **Production** | ✅ Configured | `4ae61f...4684` |
| **Staging** | ✅ Configured | Same as production |
| **Local Dev** | ⚠️ Optional | Dev mode allows empty |

## Configuration

### Option 1: In config.php (Recommended)

Edit `/var/www/zion/public_html/V2/api/config.php`:

```php
<?php
// Production WALLET_LEDGER_API_KEY
define('WALLET_LEDGER_API_KEY', '4ae61f159832b0c5102779ebf7f6527ef951db9d6f6f1551a0cade3995494684');
```

### Option 2: Environment Variable

```bash
# Add to /root/zion-v2.9/.env
export WALLET_LEDGER_API_KEY="4ae61f159832b0c5102779ebf7f6527ef951db9d6f6f1551a0cade3995494684"
```

Then modify config.php:
```php
define('WALLET_LEDGER_API_KEY', getenv('WALLET_LEDGER_API_KEY') ?: '');
```

## Usage

### Making Authorized Requests

Include the API key in the `X-API-Key` header:

```bash
curl -X POST https://zionterranova.com/V2/api/wallet-ledger.php \
  -H "Content-Type: application/json" \
  -H "X-API-Key: 4ae61f159832b0c5102779ebf7f6527ef951db9d6f6f1551a0cade3995494684" \
  -d '{
    "wallet": "zion1abc123...",
    "action": "update_balance",
    "amount": 1000
  }'
```

### From Python

```python
import requests

API_KEY = "4ae61f159832b0c5102779ebf7f6527ef951db9d6f6f1551a0cade3995494684"

response = requests.post(
    "https://zionterranova.com/V2/api/wallet-ledger.php",
    headers={
        "Content-Type": "application/json",
        "X-API-Key": API_KEY
    },
    json={
        "wallet": "zion1abc123...",
        "action": "update_balance",
        "amount": 1000
    }
)
```

## Verification

### Check if Key is Set

```bash
# SSH to production
ssh root@91.98.122.165

# Check config.php
grep -i "WALLET_LEDGER_API_KEY" /var/www/zion/public_html/V2/api/config.php
```

### Test Endpoint

```bash
# Without key (should fail with 403)
curl -X POST https://zionterranova.com/V2/api/wallet-ledger.php \
  -H "Content-Type: application/json" \
  -d '{"wallet": "test"}'

# With key (should succeed)
curl -X POST https://zionterranova.com/V2/api/wallet-ledger.php \
  -H "Content-Type: application/json" \
  -H "X-API-Key: 4ae61f159832b0c5102779ebf7f6527ef951db9d6f6f1551a0cade3995494684" \
  -d '{"wallet": "test"}'
```

## Security Notes

1. **Never commit the key** to public repositories
2. **Rotate periodically** - Generate new key with:
   ```bash
   openssl rand -hex 32
   ```
3. **Monitor logs** for unauthorized access attempts:
   ```bash
   tail -f /var/log/apache2/error.log | grep "WALLET_LEDGER"
   ```
4. **Rate limiting** - Consider adding rate limiting via nginx

## Key Rotation

To rotate the API key:

1. Generate new key:
   ```bash
   NEW_KEY=$(openssl rand -hex 32)
   echo "New key: $NEW_KEY"
   ```

2. Update config.php on server:
   ```bash
   ssh root@91.98.122.165
   nano /var/www/zion/public_html/V2/api/config.php
   # Update WALLET_LEDGER_API_KEY value
   ```

3. Update all clients using the old key

4. Test with new key

5. Log old key usage to detect missed clients

## Troubleshooting

| Error | Cause | Solution |
|-------|-------|----------|
| 403 Forbidden | Missing or invalid key | Check X-API-Key header |
| Key not configured | Empty in config.php | Set the key in config |
| Dev mode warning | Key empty intentionally | Set key for production |

## Related Files

- [wallet-ledger.php](../../public_html/V2/api/wallet-ledger.php) - Endpoint implementation
- [config.php](../../public_html/V2/api/config.php) - API configuration
- [PRESALE_DEPLOYMENT_REPORT](./PRESALE_DEPLOYMENT_REPORT_22_12_2025.md) - Deployment notes
