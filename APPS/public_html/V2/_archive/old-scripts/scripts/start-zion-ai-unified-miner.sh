#!/bin/bash
# 🚀 ZION AI Unified Miner - Start Script
# Revolutionary AI-powered multi-algorithm mining launcher

echo "🚀 ZION AI UNIFIED MINER 2025 🚀"
echo "GPU/Autolykos v2 + CPU/RandomX + CPU/Yescrypt with AI Afterburner"
echo "================================================================="

# Set script directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Configuration
DEFAULT_POOL="127.0.0.1:3333"
DEFAULT_WALLET="Z3NDN97SeT1Apeb4t3z1TFhBb7qr58pTQTjm9PWKFmhQWNWfeFKdEhVj6x2QDATBsuxYzUTKnS4Y42kXArkzJU5X2Vj1NMBc6Y"
DEFAULT_WORKER="zion-ai-unified"
MINER_SCRIPT="$PROJECT_ROOT/mining/zion_ai_unified_miner.py"

# Functions
print_header() {
    echo -e "${CYAN}🔥 $1 🔥${NC}"
    echo -e "${BLUE}$(printf '%*s' 60 | tr ' ' '=')${NC}"
}

print_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

print_error() {
    echo -e "${RED}❌ $1${NC}"
}

print_info() {
    echo -e "${BLUE}ℹ️  $1${NC}"
}

check_dependencies() {
    print_header "Checking Dependencies"
    
    # Check Python
    if command -v python3 &> /dev/null; then
        PYTHON_VERSION=$(python3 --version | cut -d' ' -f2)
        print_success "Python 3 found: $PYTHON_VERSION"
    else
        print_error "Python 3 not found!"
        return 1
    fi
    
    # Check required Python packages
    python3 -c "import psutil, numpy, GPUtil" 2>/dev/null
    if [ $? -eq 0 ]; then
        print_success "Required Python packages available"
    else
        print_warning "Some Python packages may be missing"
        print_info "Installing required packages..."
        pip3 install psutil numpy gputil
    fi
    
    # Check for GPU miners
    if command -v srbminer-multi &> /dev/null; then
        print_success "SRBMiner-Multi found (GPU mining available)"
    else
        print_warning "SRBMiner-Multi not found (GPU mining disabled)"
    fi
    
    # Check for CPU miners  
    if command -v xmrig &> /dev/null; then
        print_success "XMRig found (RandomX mining available)"
    else
        print_warning "XMRig not found (RandomX mining disabled)"
    fi
    
    # Check ZION miner files
    if [ -f "$MINER_SCRIPT" ]; then
        print_success "ZION AI Unified Miner found"
    else
        print_error "ZION AI Unified Miner script not found!"
        return 1
    fi
    
    return 0
}

show_profiles() {
    print_header "Available Mining Profiles"
    
    echo -e "${GREEN}1. Eco Champion${NC} - Yescrypt focus, 15% eco-bonus, 80W power"
    echo -e "${BLUE}2. Profit Maximizer${NC} - All algorithms, maximum hashrate"  
    echo -e "${YELLOW}3. Balanced Hybrid${NC} - CPU + GPU, balanced performance"
    echo -e "${PURPLE}4. CPU Only${NC} - Yescrypt optimized, ultra-efficient"
    echo -e "${CYAN}5. GPU Only${NC} - Autolykos v2, high hashrate"
    echo -e "${RED}6. Low Power${NC} - Under 100W, maximum efficiency"
    echo
}

get_profile_config() {
    case $1 in
        1|eco|eco_champion)
            AI_MODE="eco_bonus"
            POWER_LIMIT="150"
            PROFILE_NAME="Eco Champion"
            ;;
        2|profit|profit_maximizer)
            AI_MODE="profit_first"
            POWER_LIMIT="400"
            PROFILE_NAME="Profit Maximizer"
            ;;
        3|balanced|balanced_hybrid)
            AI_MODE="balanced"
            POWER_LIMIT="250"
            PROFILE_NAME="Balanced Hybrid"
            ;;
        4|cpu|cpu_only)
            AI_MODE="efficiency_first"
            POWER_LIMIT="120"
            PROFILE_NAME="CPU Only"
            AFTERBURNER_OPTS="--no-afterburner"
            ;;
        5|gpu|gpu_only)
            AI_MODE="profit_first"
            POWER_LIMIT="200"
            PROFILE_NAME="GPU Only"
            ;;
        6|low|low_power)
            AI_MODE="efficiency_first"
            POWER_LIMIT="100"
            PROFILE_NAME="Low Power"
            ;;
        *)
            AI_MODE="balanced"
            POWER_LIMIT="250"
            PROFILE_NAME="Balanced (Default)"
            ;;
    esac
}

interactive_setup() {
    print_header "Interactive Setup"
    
    # Show profiles
    show_profiles
    
    # Profile selection
    read -p "Select mining profile (1-6) [3]: " PROFILE_CHOICE
    PROFILE_CHOICE=${PROFILE_CHOICE:-3}
    get_profile_config $PROFILE_CHOICE
    
    # Pool configuration
    echo
    print_info "Pool Configuration"
    read -p "Pool address [$DEFAULT_POOL]: " POOL_INPUT
    POOL=${POOL_INPUT:-$DEFAULT_POOL}
    
    # Wallet configuration
    read -p "ZION wallet address [default]: " WALLET_INPUT
    WALLET=${WALLET_INPUT:-$DEFAULT_WALLET}
    
    # Worker name
    read -p "Worker name [$DEFAULT_WORKER]: " WORKER_INPUT
    WORKER=${WORKER_INPUT:-$DEFAULT_WORKER}
    
    # Advanced options
    echo
    read -p "Enable advanced monitoring? (y/N): " MONITORING
    if [[ $MONITORING =~ ^[Yy]$ ]]; then
        MONITORING_OPTS="--monitoring"
    fi
    
    echo
    print_success "Configuration complete!"
    echo -e "Profile: ${GREEN}$PROFILE_NAME${NC}"
    echo -e "Pool: ${BLUE}$POOL${NC}"
    echo -e "Wallet: ${CYAN}${WALLET:0:20}...${NC}"
    echo -e "AI Mode: ${YELLOW}$AI_MODE${NC}"
    echo -e "Power Limit: ${RED}${POWER_LIMIT}W${NC}"
    echo
}

start_mining() {
    print_header "Starting ZION AI Unified Miner"
    
    # Build command
    CMD="python3 $MINER_SCRIPT"
    CMD="$CMD --pool $POOL"
    CMD="$CMD --wallet $WALLET" 
    CMD="$CMD --worker $WORKER"
    CMD="$CMD --ai-mode $AI_MODE"
    CMD="$CMD --power-limit $POWER_LIMIT"
    
    if [ ! -z "$AFTERBURNER_OPTS" ]; then
        CMD="$CMD $AFTERBURNER_OPTS"
    fi
    
    if [ ! -z "$MONITORING_OPTS" ]; then
        CMD="$CMD $MONITORING_OPTS"
    fi
    
    print_info "Executing: $CMD"
    echo
    
    # Change to project directory
    cd "$PROJECT_ROOT"
    
    # Start mining
    exec $CMD
}

quick_start() {
    local profile=${1:-"balanced"}
    
    print_header "Quick Start - $profile Profile"
    
    get_profile_config $profile
    POOL=$DEFAULT_POOL
    WALLET=$DEFAULT_WALLET  
    WORKER=$DEFAULT_WORKER
    
    print_success "Using $PROFILE_NAME profile"
    start_mining
}

show_stats() {
    print_header "ZION AI Unified Miner Statistics"
    
    cd "$PROJECT_ROOT"
    python3 "$MINER_SCRIPT" --stats-only
}

show_help() {
    print_header "ZION AI Unified Miner Help"
    
    echo "Usage: $0 [OPTION]"
    echo
    echo "Options:"
    echo "  start                   Interactive setup and start mining"
    echo "  quick [profile]         Quick start with profile (eco|profit|balanced|cpu|gpu|low)"
    echo "  stats                   Show mining statistics"  
    echo "  profiles               Show available profiles"
    echo "  deps                   Check dependencies"
    echo "  help                   Show this help"
    echo
    echo "Examples:"
    echo "  $0 start               # Interactive setup"
    echo "  $0 quick eco           # Quick start eco-friendly mining"
    echo "  $0 quick profit        # Quick start profit maximization"
    echo "  $0 stats               # Show current stats"
    echo
    echo "Algorithms supported:"
    echo "  🖥️  RandomX (CPU) - 1.0x eco-bonus"
    echo "  ⚡ Yescrypt (CPU) - 1.15x eco-bonus (CHAMPION!)"
    echo "  🎮 Autolykos v2 (GPU) - 1.2x eco-bonus"
    echo
}

# Signal handler for graceful shutdown
cleanup() {
    echo
    print_info "Shutting down ZION AI Unified Miner..."
    exit 0
}
trap cleanup SIGINT SIGTERM

# Main execution
case "${1:-start}" in
    start)
        check_dependencies || exit 1
        interactive_setup
        start_mining
        ;;
    quick)
        check_dependencies || exit 1
        quick_start $2
        ;;
    stats)
        show_stats
        ;;
    profiles)
        show_profiles
        ;;
    deps|dependencies)
        check_dependencies
        ;;
    help|--help|-h)
        show_help
        ;;
    *)
        print_error "Unknown option: $1"
        show_help
        exit 1
        ;;
esac