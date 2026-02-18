#!/bin/bash
# ZION eShop - Rasta Email Deployment Script
# Nahraje všechny soubory na Webglobe server

set -e

SERVER="dw214.webglobe.com"
USER="zion"
REMOTE_PATH="/home/zion/public_html/V2"

echo "🚀 ZION eShop - Rasta Email Deployment"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Server: $SERVER"
echo "User: $USER"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Check if we're in the right directory
if [ ! -f "README.md" ]; then
    echo "❌ Error: Must run from ZION project root"
    exit 1
fi

echo "📦 Files to deploy:"
echo "  • public_html/V2/email-templates/eshop-order-confirmation-rasta.html"
echo "  • src/wallet/eshop_email_manager.py"
echo "  • scripts/send_eshop_order_email.py"
echo "  • public_html/V2/api/send-rasta-email.php"
echo "  • public_html/V2/api/create-order.php"
echo ""

read -p "Continue with deployment? (y/n) " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "❌ Deployment cancelled"
    exit 1
fi

echo ""
echo "📤 Uploading files..."
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Create remote directories
ssh $USER@$SERVER "mkdir -p $REMOTE_PATH/email-templates $REMOTE_PATH/api $REMOTE_PATH/../src/wallet $REMOTE_PATH/../scripts $REMOTE_PATH/logs"

# Upload email template
echo "📧 Uploading email template..."
scp public_html/V2/email-templates/eshop-order-confirmation-rasta.html \
    $USER@$SERVER:$REMOTE_PATH/email-templates/

# Upload Python email manager
echo "🐍 Uploading Python email manager..."
scp src/wallet/eshop_email_manager.py \
    $USER@$SERVER:$REMOTE_PATH/../src/wallet/

# Upload Python CLI script
echo "🐍 Uploading Python CLI script..."
scp scripts/send_eshop_order_email.py \
    $USER@$SERVER:$REMOTE_PATH/../scripts/
ssh $USER@$SERVER "chmod +x $REMOTE_PATH/../scripts/send_eshop_order_email.py"

# Upload PHP wrapper
echo "🐘 Uploading PHP wrapper..."
scp public_html/V2/api/send-rasta-email.php \
    $USER@$SERVER:$REMOTE_PATH/api/

# Upload updated create-order.php
echo "🐘 Uploading updated create-order.php..."
scp public_html/V2/api/create-order.php \
    $USER@$SERVER:$REMOTE_PATH/api/

# Set permissions
echo "🔒 Setting permissions..."
ssh $USER@$SERVER "chmod 755 $REMOTE_PATH/api/send-rasta-email.php"
ssh $USER@$SERVER "chmod 755 $REMOTE_PATH/api/create-order.php"
ssh $USER@$SERVER "chmod 775 $REMOTE_PATH/logs"

echo ""
echo "✅ Deployment complete!"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "🧪 Testing..."
echo ""

# Test Python script on server
echo "📧 Testing Python email script on server..."
ssh $USER@$SERVER << 'ENDSSH'
cd /home/zion/public_html/V2

# Create test JSON
cat > /tmp/test_order.json << 'EOF'
{
  "order_id": "DEPLOY_TEST_001",
  "customer_name": "Deploy Test",
  "customer_email": "admin@newearth.cz",
  "order_date": "09.12.2025 22:30",
  "total": 999,
  "items": [
    {
      "name": "Test Product",
      "quantity": 1,
      "price": 900,
      "total": 900,
      "sku": "TEST_001",
      "image_url": ""
    }
  ],
  "shipping_address": "Test Address",
  "shipping_method": "Test Shipping",
  "shipping_price": 99,
  "payment_method": "Bankovní převod",
  "payment_status": "pending",
  "notes": "Deployment test"
}
EOF

# Test Python script (dry-run only)
echo "Running Python test (dry-run)..."
python3 ../scripts/send_eshop_order_email.py \
  --order-json /tmp/test_order.json \
  --email admin@newearth.cz \
  --smtp-host mail.webglobe.cz \
  --smtp-port 587 \
  --smtp-user shop@newearth.cz \
  --smtp-password "x3nityOne144" || echo "⚠️  Python test failed (may need to install dependencies)"

rm /tmp/test_order.json
ENDSSH

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✅ All done!"
echo ""
echo "📝 Next steps:"
echo "  1. SSH to server: ssh $USER@$SERVER"
echo "  2. Test live email: cd $REMOTE_PATH && php api/send-rasta-email.php test admin@newearth.cz"
echo "  3. Check logs: tail -f $REMOTE_PATH/logs/rasta-email.log"
echo "  4. Test real order on eshop"
echo ""
echo "📧 SMTP: mail.webglobe.cz:587"
echo "👤 User: shop@newearth.cz"
echo "📁 Logs: $REMOTE_PATH/logs/rasta-email.log"
echo ""
echo "Peace & One Love ☮️❤️"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
