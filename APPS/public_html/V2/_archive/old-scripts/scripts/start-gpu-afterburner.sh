#!/bin/bash
"""
ZION AI GPU Afterburner - Startup Script
Complete GPU tuning system launcher
"""

# ZION AI GPU Afterburner Startup
echo "🚀 Starting ZION AI GPU Afterburner System..."
echo "================================================"

# Check if running as root
if [[ $EUID -eq 0 ]]; then
   echo "❌ Don't run as root! Run as regular user with sudo access."
   exit 1
fi

# Check dependencies
echo "📋 Checking dependencies..."

# Check Python packages
python3 -c "import flask, psutil" 2>/dev/null
if [ $? -ne 0 ]; then
    echo "📦 Installing Python dependencies..."
    pip3 install flask psutil requests --user
fi

# Check AMD GPU drivers
lsmod | grep amdgpu >/dev/null
if [ $? -ne 0 ]; then
    echo "❌ AMDGPU drivers not loaded! Install AMD drivers first."
    exit 1
fi

echo "✅ Dependencies OK"

# Create necessary directories
mkdir -p /media/maitreya/ZION1/logs/gpu
mkdir -p /media/maitreya/ZION1/frontend
mkdir -p /tmp/zion_gpu

# Generate GPU dashboard HTML
echo "🌐 Generating GPU dashboard..."
cd /media/maitreya/ZION1/ai
python3 zion-gpu-dashboard.py

# Set executable permissions
chmod +x zion-ai-gpu-afterburner.py
chmod +x zion-gpu-power-manager.py  
chmod +x zion-mining-gpu-optimizer.py

# Start GPU monitoring API in background
echo "📊 Starting GPU monitoring API..."
python3 zion-ai-gpu-afterburner.py > /media/maitreya/ZION1/logs/gpu/afterburner.log 2>&1 &
GPU_API_PID=$!

# Wait for API to start
sleep 3

# Check if API is running
curl -s http://localhost:5001/api/gpu/status >/dev/null
if [ $? -eq 0 ]; then
    echo "✅ GPU API running on http://localhost:5001"
else
    echo "❌ GPU API failed to start"
    kill $GPU_API_PID 2>/dev/null
    exit 1
fi

# Open dashboard in browser (optional)
if command -v xdg-open >/dev/null; then
    echo "🌐 Opening dashboard in browser..."
    xdg-open file:///media/maitreya/ZION1/frontend/gpu_dashboard.html &
fi

echo ""
echo "🎮 ZION AI GPU Afterburner System Ready!"
echo "================================================"
echo "📊 GPU Dashboard: file:///media/maitreya/ZION1/frontend/gpu_dashboard.html"
echo "🔗 API Endpoint: http://localhost:5001/api/gpu"
echo "📝 Logs: /media/maitreya/ZION1/logs/gpu/"
echo ""
echo "🎯 Available Profiles:"
echo "  • ECO Mode - Ultra power saving (40W)"
echo "  • Balanced - Default performance" 
echo "  • Mining - Mining optimized (6K+ hashrate)"
echo "  • Gaming - Maximum performance"
echo ""
echo "🤖 AI Features:"
echo "  • Auto temperature management"
echo "  • Dynamic power optimization"  
echo "  • Mining hashrate optimization"
echo "  • Learning-based tuning"
echo ""
echo "📱 Frontend Integration Ready:"
echo "  GET  /api/gpu/stats      - Real-time GPU stats"
echo "  POST /api/gpu/profile/X  - Apply profile"
echo "  GET  /api/gpu/mining/optimize - Auto mining optimize"
echo ""
echo "Press Ctrl+C to stop all services"

# Keep script running and handle cleanup
trap cleanup EXIT

cleanup() {
    echo ""
    echo "🛑 Shutting down ZION GPU Afterburner..."
    kill $GPU_API_PID 2>/dev/null
    echo "👋 All services stopped"
}

# Wait for user interrupt
while true; do
    sleep 1
done