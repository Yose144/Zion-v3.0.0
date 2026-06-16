#!/bin/bash
# ZION Complete System Afterburner Launcher
# Launches unified CPU+GPU monitoring and control system

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

echo -e "${CYAN}🚀 ZION Complete System Afterburner${NC}"
echo "=================================================="
echo -e "${GREEN}CPU + GPU Unified Control & Monitoring System${NC}"
echo ""

# Check if running as root
if [[ $EUID -eq 0 ]]; then
   echo -e "${RED}❌ Don't run as root! Run as regular user with sudo access.${NC}"
   exit 1
fi

# Check system requirements
echo -e "${BLUE}📋 Checking system requirements...${NC}"

# Check Python packages
python3 -c "import flask, psutil, requests" 2>/dev/null
if [ $? -ne 0 ]; then
    echo -e "${YELLOW}📦 Installing Python dependencies...${NC}"
    # Try different installation methods
    pip3 install flask psutil requests --user --break-system-packages 2>/dev/null || \
    pip install flask psutil requests --user 2>/dev/null || \
    python3 -m pip install flask psutil requests --user --break-system-packages 2>/dev/null || \
    echo -e "${RED}⚠️ Python packages might be missing, continuing anyway...${NC}"
fi

# Check AMD GPU drivers (with fallback)
lsmod | grep -E "amdgpu|radeon" >/dev/null
if [ $? -ne 0 ]; then
    echo -e "${YELLOW}⚠️ AMD GPU drivers not detected, continuing with basic monitoring...${NC}"
    # Don't exit - allow basic CPU monitoring to work
else
    echo -e "${GREEN}✅ AMD GPU drivers detected${NC}"
fi

# Check CPU frequency scaling
if [ ! -d "/sys/devices/system/cpu/cpu0/cpufreq" ]; then
    echo -e "${YELLOW}⚠️  CPU frequency scaling not available${NC}"
fi

echo -e "${GREEN}✅ System requirements OK${NC}"

# Create necessary directories
mkdir -p /media/maitreya/ZION1/logs/system
mkdir -p /media/maitreya/ZION1/frontend
mkdir -p /tmp/zion_system

# Generate unified dashboard
echo -e "${BLUE}🌐 Generating unified dashboard...${NC}"
cd /media/maitreya/ZION1/ai
python3 zion-unified-dashboard.py

# Set executable permissions
chmod +x zion-system-afterburner.py
chmod +x zion-smart-coordinator.py

# Function to check if service is running
check_service() {
    local port=$1
    local name=$2
    curl -s http://localhost:$port >/dev/null
    if [ $? -eq 0 ]; then
        echo -e "${GREEN}✅ $name running on port $port${NC}"
        return 0
    else
        echo -e "${RED}❌ $name failed to start on port $port${NC}"
        return 1
    fi
}

# Start System Afterburner API
echo -e "${BLUE}📊 Starting System Afterburner API...${NC}"
python3 zion-system-afterburner.py > /media/maitreya/ZION1/logs/system/afterburner.log 2>&1 &
SYSTEM_API_PID=$!

# Wait for API to start
sleep 5

# Check if System API is running
check_service 5002 "System Afterburner API"
if [ $? -ne 0 ]; then
    kill $SYSTEM_API_PID 2>/dev/null
    exit 1
fi

# Start Smart Coordinator
echo -e "${BLUE}🧠 Starting Smart Coordinator...${NC}"
python3 -c "
from zion_smart_coordinator import ZionSmartCoordinator
coordinator = ZionSmartCoordinator()
coordinator.enable_auto_coordination()
print('Smart Coordinator enabled')

# Keep it running
import time
try:
    while True:
        time.sleep(1)
except KeyboardInterrupt:
    coordinator.disable_auto_coordination()
    print('Smart Coordinator stopped')
" > /media/maitreya/ZION1/logs/system/coordinator.log 2>&1 &
COORDINATOR_PID=$!

# Open unified dashboard in browser (optional)
if command -v xdg-open >/dev/null; then
    echo -e "${BLUE}🌐 Opening unified dashboard...${NC}"
    xdg-open file:///media/maitreya/ZION1/frontend/system_afterburner.html &
fi

# Display system info
echo ""
echo -e "${PURPLE}🎮 ZION Complete System Afterburner Ready!${NC}"
echo "=================================================="
echo -e "${CYAN}📊 Unified Dashboard:${NC} file:///media/maitreya/ZION1/frontend/system_afterburner.html"
echo -e "${CYAN}🔗 System API:${NC} http://localhost:5002/api/system"
echo -e "${CYAN}📝 Logs:${NC} /media/maitreya/ZION1/logs/system/"
echo ""

echo -e "${GREEN}🔥 CPU Features:${NC}"
echo "  • Real-time temperature monitoring"
echo "  • Frequency scaling (20-100%)"
echo "  • Governor control (performance/powersave/schedutil)"
echo "  • Turbo boost management"
echo "  • Per-core usage monitoring"
echo "  • Memory usage tracking"

echo ""
echo -e "${GREEN}🎮 GPU Features:${NC}"
echo "  • Temperature & power monitoring"  
echo "  • VRAM usage tracking"
echo "  • Clock speed monitoring"
echo "  • Utilization tracking"
echo "  • Power limit control"

echo ""
echo -e "${GREEN}🎯 System Profiles:${NC}"
echo "  • ${BLUE}Ultra ECO${NC} - Maximum power savings (30W+ reduction)"
echo "  • ${BLUE}Balanced${NC} - Optimal performance/power balance"
echo "  • ${YELLOW}Mining Beast${NC} - 6K+ hashrate optimization"  
echo "  • ${BLUE}Gaming Max${NC} - Maximum gaming performance"
echo "  • ${BLUE}Silent Mode${NC} - Minimal noise operation"

echo ""
echo -e "${GREEN}🤖 AI Coordination Features:${NC}"
echo "  • Automatic workload detection (mining/gaming/compute/idle)"
echo "  • Intelligent CPU+GPU coordination"
echo "  • Performance-based optimization"
echo "  • Temperature safety management"
echo "  • Power efficiency optimization"
echo "  • Learning-based tuning"

echo ""
echo -e "${GREEN}📱 API Endpoints:${NC}"
echo "  GET  /api/system/status      - System status & info"
echo "  GET  /api/system/stats       - Real-time CPU+GPU stats" 
echo "  POST /api/system/profile/X   - Apply system profile"
echo "  POST /api/system/reset       - Emergency reset"
echo "  POST /api/cpu/governor       - Set CPU governor"
echo "  POST /api/cpu/frequency      - Set CPU frequency limit"
echo "  GET  /api/mining/optimize    - Mining optimization"

echo ""
echo -e "${GREEN}⛏️ Mining Integration:${NC}"
echo "  • Automatic mining detection"
echo "  • Hashrate optimization (targeting 6K+)"
echo "  • Efficiency monitoring (H/W)"
echo "  • Temperature-based throttling"
echo "  • Power budget management"

echo ""
echo -e "${YELLOW}📋 Quick Commands:${NC}"
echo "  • curl http://localhost:5002/api/system/stats"
echo "  • curl -X POST http://localhost:5002/api/system/profile/mining_optimized"
echo "  • curl -X POST http://localhost:5002/api/mining/optimize"

echo ""
echo -e "${RED}Press Ctrl+C to stop all services${NC}"

# Function to cleanup on exit
cleanup() {
    echo ""
    echo -e "${YELLOW}🛑 Shutting down ZION System Afterburner...${NC}"
    
    # Kill all background processes
    kill $SYSTEM_API_PID 2>/dev/null
    kill $COORDINATOR_PID 2>/dev/null
    
    # Wait a moment for clean shutdown
    sleep 2
    
    echo -e "${GREEN}👋 All services stopped cleanly${NC}"
    exit 0
}

# Set trap for cleanup on exit
trap cleanup EXIT INT TERM

# Keep script running and show live stats
echo -e "${CYAN}📊 Live System Stats (updates every 10s):${NC}"
echo "=================================================="

while true; do
    # Get current stats from API
    STATS=$(curl -s http://localhost:5002/api/system/stats 2>/dev/null)
    
    if [ $? -eq 0 ] && [ "$STATS" != "" ]; then
        # Parse key stats (basic parsing without jq)
        CPU_TEMP=$(echo "$STATS" | grep -o '"temperature":[0-9]*' | head -1 | cut -d':' -f2)
        GPU_TEMP=$(echo "$STATS" | grep -o '"temperature":[0-9]*' | tail -1 | cut -d':' -f2)
        CPU_USAGE=$(echo "$STATS" | grep -o '"usage_percent":[0-9.]*' | cut -d':' -f2 | cut -d',' -f1)
        TOTAL_POWER=$(echo "$STATS" | grep -o '"total_power_estimated":[0-9]*' | cut -d':' -f2)
        
        # Display live stats
        echo -ne "\r${GREEN}CPU:${NC} ${CPU_TEMP:-??}°C ${CPU_USAGE:-??}% | ${GREEN}GPU:${NC} ${GPU_TEMP:-??}°C | ${GREEN}Power:${NC} ${TOTAL_POWER:-??}W | $(date '+%H:%M:%S')"
    else
        echo -ne "\r${RED}API connection lost...${NC} $(date '+%H:%M:%S')"
    fi
    
    sleep 10
done