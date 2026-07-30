#!/bin/bash
# Helper script to set SMTP password in .env

if [ -z "$1" ]; then
    echo "Usage: ./set_smtp_password.sh 'YOUR_PASSWORD_FROM_WEBGLOBE'"
    echo ""
    echo "Get password from: https://admin.webglobe.cz"
    echo "Navigate to: Hosting → E-mail → eshop@newearth.cz"
    exit 1
fi

PASSWORD="$1"

# Backup .env
cp .env .env.backup.$(date +%s)

# Update SMTP_PASS
if grep -q "^SMTP_PASS=" .env; then
    sed -i "s/^SMTP_PASS=.*/SMTP_PASS=$PASSWORD/" .env
    echo "✅ SMTP_PASS updated in .env"
else
    echo "SMTP_PASS=$PASSWORD" >> .env
    echo "✅ SMTP_PASS added to .env"
fi

# Verify
echo ""
echo "Current .env SMTP settings:"
grep "^SMTP" .env

echo ""
echo "✅ Done! Test with:"
echo "curl -X POST https://newearth.cz/V2/api/create-order.php -H 'Content-Type: application/json' -d '{...}'"
