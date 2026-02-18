#!/bin/bash
##
## 🔥 START ZION WARP ENGINE 🔥
## Production launch script for ZION 2.8.0 with WARP Engine
##
## Version: 2.8.0 "Ad Astra Per Estrella"
## Date: 2025-10-21
##

echo ""
echo "╔══════════════════════════════════════════════════════════════════════╗"
echo "║                                                                      ║"
echo "║              🔥 ZION WARP ENGINE LAUNCHER v2.8.0 🔥                  ║"
echo "║                                                                      ║"
echo "║                  'Ad Astra Per Estrella' 🌟                         ║"
echo "║                  To The Stars Through The Star                      ║"
echo "║                                                                      ║"
echo "╚══════════════════════════════════════════════════════════════════════╝"
echo ""

# Check if Python 3 is available
if ! command -v python3 &> /dev/null; then
    echo "❌ Python 3 is not installed!"
    exit 1
fi

# Check if WARP engine exists
if [ ! -f "zion_warp_engine_core.py" ]; then
    echo "❌ zion_warp_engine_core.py not found!"
    echo "   Run from ZION root directory"
    exit 1
fi

# Display options
echo "Select mode:"
echo "  1) Quick Test (verify components)"
echo "  2) Start WARP Engine (foreground)"
echo "  3) Start WARP Engine (background)"
echo "  4) Stop WARP Engine"
echo ""
read -p "Choice [1-4]: " choice

case $choice in
    1)
        echo ""
        echo "🔍 Running Quick Test..."
        echo ""
        python3 test_warp_engine_local.py
        ;;
    2)
        echo ""
        echo "🚀 Starting WARP Engine (foreground)..."
        echo "   Press Ctrl+C to stop"
        echo ""
        python3 zion_warp_engine_core.py
        ;;
    3)
        echo ""
        echo "🚀 Starting WARP Engine (background)..."
        nohup python3 -u zion_warp_engine_core.py > warp_engine.log 2>&1 &
        WARP_PID=$!
        echo "   PID: $WARP_PID"
        echo "   Log: warp_engine.log"
        echo ""
        sleep 2
        echo "✅ WARP Engine started!"
        echo ""
        echo "To view logs: tail -f warp_engine.log"
        echo "To stop: pkill -f zion_warp_engine_core.py"
        ;;
    4)
        echo ""
        echo "🛑 Stopping WARP Engine..."
        pkill -f zion_warp_engine_core.py
        if [ $? -eq 0 ]; then
            echo "✅ WARP Engine stopped"
        else
            echo "⚠️  No WARP Engine process found"
        fi
        ;;
    *)
        echo "Invalid choice!"
        exit 1
        ;;
esac

echo ""
echo "🌟 Ad Astra Per Estrella 🌟"
echo ""
