#!/bin/bash

# ZION WARP BRIDGE - LND Setup Script
# This script helps set up LND (Lightning Network Daemon) for ZION WARP Bridge

echo "🌌 ZION WARP BRIDGE - LND SETUP 🌌"
echo "=================================="
echo ""

# Check if LND is installed
if ! command -v lnd &> /dev/null; then
    echo "❌ LND is not installed. Installing..."
    echo ""

    # Install LND on macOS
    if [[ "$OSTYPE" == "darwin"* ]]; then
        echo "🍺 Installing LND via Homebrew..."
        brew install lightningnetwork/lnd/lnd
    else
        echo "❌ Unsupported OS. Please install LND manually:"
        echo "   https://github.com/lightningnetwork/lnd/releases"
        exit 1
    fi
else
    echo "✅ LND is already installed"
fi

echo ""
echo "📁 Setting up LND configuration..."

# Create LND config directory
LND_DIR="$HOME/.lnd"
mkdir -p "$LND_DIR"

# Create basic lnd.conf
cat > "$LND_DIR/lnd.conf" << EOF
[Application Options]
listen=0.0.0.0:9735
rpclisten=0.0.0.0:10009
restlisten=0.0.0.0:8080

[Bitcoin]
bitcoin.active=1
bitcoin.mainnet=0
bitcoin.testnet=1
bitcoin.node=bitcoind

[Bitcoind]
bitcoind.rpcuser=bitcoinrpc
bitcoind.rpcpass=bitcoinrpc
bitcoind.zmqpubrawblock=tcp://127.0.0.1:28332
bitcoind.zmqpubrawtx=tcp://127.0.0.1:28333
EOF

echo "✅ Created $LND_DIR/lnd.conf"

echo ""
echo "⚠️  IMPORTANT NOTES:"
echo "==================="
echo ""
echo "1. This setup uses Bitcoin TESTNET (not mainnet)"
echo "2. You'll need a Bitcoin node (bitcoind) running"
echo "3. For production, use mainnet and secure your macaroon"
echo ""
echo "🚀 TO START LND:"
echo "================"
echo ""
echo "# Start LND (in separate terminal)"
echo "lnd --configfile=$LND_DIR/lnd.conf"
echo ""
echo "# Create wallet (first time only)"
echo "lncli create"
echo ""
echo "# Get macaroon for API access"
echo "lncli bakemacaroon uri:/lnrpc.Lightning/ uri:/lnrpc.WalletUnlocker/ --save_to=$LND_DIR/admin.macaroon"
echo ""
echo "# Set environment variables for ZION WARP Bridge"
echo "export LND_RPC_URL='https://localhost:8080'"
echo "export LND_MACAROON='\$(xxd -ps -u -c 1000 $LND_DIR/admin.macaroon)'"
echo ""
echo "🔗 For full production setup, see:"
echo "   https://docs.lightning.engineering/lightning-network-tools/lnd"

echo ""
echo "🎉 LND setup complete! Ready for ZION WARP Bridge integration."