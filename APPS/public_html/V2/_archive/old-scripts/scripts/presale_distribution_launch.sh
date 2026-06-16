#!/bin/bash
#
# ZION Presale Distribution - Automated Launch Script
# ====================================================
# Spustí automatickou distribuci presale tokenů při MainNet launch
#
# CRON SETUP (spustit 1.1.2028 00:00 UTC):
# 0 0 1 1 2028 /path/to/presale_distribution_launch.sh
#
# Nebo manuálně po MainNet launch:
# ./presale_distribution_launch.sh --live
#

set -e  # Exit on error

# ============================================
# CONFIGURATION
# ============================================

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
PYTHON_BIN="${PROJECT_ROOT}/.venv/bin/python3"
DISTRIBUTION_SCRIPT="${PROJECT_ROOT}/src/wallet/presale_distribution_manager.py"
LOG_FILE="${PROJECT_ROOT}/data/presale_distribution_launch.log"
RESULTS_FILE="${PROJECT_ROOT}/data/distribution_results.json"

# Database paths
PRESALE_DB="${PROJECT_ROOT}/data/presale.db"
BLOCKCHAIN_DB="${PROJECT_ROOT}/zion_mainnet_blockchain.db"

# Email notification
ADMIN_EMAIL="admin@newearth.cz"
NOTIFICATION_ENABLED=true

# ============================================
# FUNCTIONS
# ============================================

log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" | tee -a "$LOG_FILE"
}

send_notification() {
    local subject="$1"
    local message="$2"
    
    if [ "$NOTIFICATION_ENABLED" = true ]; then
        echo "$message" | mail -s "$subject" "$ADMIN_EMAIL" || true
    fi
}

check_prerequisites() {
    log "Checking prerequisites..."
    
    # Check Python
    if [ ! -f "$PYTHON_BIN" ]; then
        log "❌ ERROR: Python not found at $PYTHON_BIN"
        exit 1
    fi
    
    # Check distribution script
    if [ ! -f "$DISTRIBUTION_SCRIPT" ]; then
        log "❌ ERROR: Distribution script not found at $DISTRIBUTION_SCRIPT"
        exit 1
    fi
    
    # Check presale DB
    if [ ! -f "$PRESALE_DB" ]; then
        log "⚠️  WARNING: Presale DB not found at $PRESALE_DB"
    fi
    
    # Check blockchain DB
    if [ ! -f "$BLOCKCHAIN_DB" ]; then
        log "⚠️  WARNING: Blockchain DB not found at $BLOCKCHAIN_DB"
        log "   MainNet might not be running yet!"
    fi
    
    log "✅ Prerequisites check passed"
}

backup_databases() {
    log "Creating database backups..."
    
    local timestamp=$(date '+%Y%m%d_%H%M%S')
    
    if [ -f "$PRESALE_DB" ]; then
        cp "$PRESALE_DB" "${PRESALE_DB}.backup_${timestamp}"
        log "✅ Presale DB backed up"
    fi
    
    if [ -f "$BLOCKCHAIN_DB" ]; then
        cp "$BLOCKCHAIN_DB" "${BLOCKCHAIN_DB}.backup_${timestamp}"
        log "✅ Blockchain DB backed up"
    fi
}

run_distribution() {
    local mode="$1"  # "dry-run" or "live"
    
    log "=========================================="
    log "🚀 STARTING PRESALE DISTRIBUTION ($mode)"
    log "=========================================="
    
    local args=""
    if [ "$mode" = "dry-run" ]; then
        args="--dry-run"
        log "⚠️  DRY RUN MODE - No actual transactions!"
    else
        log "🔥 LIVE MODE - Real transactions will be sent!"
    fi
    
    # Run distribution
    $PYTHON_BIN "$DISTRIBUTION_SCRIPT" \
        $args \
        --presale-db "$PRESALE_DB" \
        --blockchain-db "$BLOCKCHAIN_DB" \
        2>&1 | tee -a "$LOG_FILE"
    
    local exit_code=$?
    
    if [ $exit_code -eq 0 ]; then
        log "✅ Distribution completed successfully!"
        
        # Check results
        if [ -f "$RESULTS_FILE" ]; then
            log "Results saved to: $RESULTS_FILE"
            
            # Parse results (if jq is available)
            if command -v jq &> /dev/null; then
                local total_orders=$(jq -r '.total_orders // 0' "$RESULTS_FILE")
                local successful=$(jq -r '.successful_distributions // 0' "$RESULTS_FILE")
                local failed=$(jq -r '.failed_distributions // 0' "$RESULTS_FILE")
                local total_tokens=$(jq -r '.total_tokens_distributed // 0' "$RESULTS_FILE")
                
                log "📊 Summary:"
                log "   Total orders: $total_orders"
                log "   Successful: $successful"
                log "   Failed: $failed"
                log "   Total tokens: $total_tokens ZION"
                
                # Send success notification
                send_notification \
                    "✅ ZION Presale Distribution Completed" \
                    "Distribution finished successfully!

Total orders: $total_orders
Successful: $successful
Failed: $failed
Total tokens distributed: $total_tokens ZION

Results: $RESULTS_FILE
Log: $LOG_FILE"
            fi
        fi
        
        return 0
    else
        log "❌ Distribution failed with exit code: $exit_code"
        
        # Send error notification
        send_notification \
            "❌ ZION Presale Distribution FAILED" \
            "Distribution failed with exit code: $exit_code

Please check the log file:
$LOG_FILE"
        
        return 1
    fi
}

# ============================================
# MAIN
# ============================================

main() {
    cd "$PROJECT_ROOT"
    
    log "=========================================="
    log "ZION Presale Distribution Launch"
    log "=========================================="
    log "Project root: $PROJECT_ROOT"
    log "Python: $PYTHON_BIN"
    log "Script: $DISTRIBUTION_SCRIPT"
    log "Log: $LOG_FILE"
    log ""
    
    # Parse arguments
    MODE="dry-run"
    if [ "$1" = "--live" ] || [ "$1" = "-l" ]; then
        MODE="live"
        
        # Double confirm for live mode
        log "⚠️  LIVE MODE REQUESTED!"
        log ""
        log "This will send REAL transactions to the blockchain!"
        log "Press Ctrl+C within 10 seconds to cancel..."
        sleep 10
    fi
    
    # Pre-flight checks
    check_prerequisites
    
    # Backup databases (only in live mode)
    if [ "$MODE" = "live" ]; then
        backup_databases
    fi
    
    # Run distribution
    run_distribution "$MODE"
    
    local exit_code=$?
    
    log "=========================================="
    log "Distribution launch finished"
    log "Exit code: $exit_code"
    log "=========================================="
    
    exit $exit_code
}

# Run main
main "$@"
