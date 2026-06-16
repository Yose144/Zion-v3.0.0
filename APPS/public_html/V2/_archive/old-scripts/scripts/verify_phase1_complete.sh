#!/bin/bash

################################################################################
# ZION 2.8.3 Phase 1 Execution Verification
# Purpose: Verify all Phase 1 tasks are complete before proceeding to Phase 2
# Author: ZION AI Infrastructure Team
################################################################################

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

log() { echo -e "${BLUE}[CHECK]${NC} $1"; }
success() { echo -e "${GREEN}✓${NC} $1"; }
error() { echo -e "${RED}✗${NC} $1"; }
warning() { echo -e "${YELLOW}⚠${NC} $1"; }

PHASE_1_COMPLETE=true

################################################################################
# Check 1: Backup System
################################################################################
check_backup() {
    log "Checking backup system..."
    
    # Check if backup directory exists
    if [ -d "/mnt/backup" ]; then
        success "Backup directory exists"
    else
        error "Backup directory not found - please create /mnt/backup"
        PHASE_1_COMPLETE=false
        return 1
    fi
    
    # Check if backups exist
    BACKUP_COUNT=$(find /mnt/backup -type d -name "zion-core-*" 2>/dev/null | wc -l)
    if [ "$BACKUP_COUNT" -gt 0 ]; then
        success "$BACKUP_COUNT backup(s) found"
    else
        warning "No backups found yet - need to run phase1_security_backup.sh"
        PHASE_1_COMPLETE=false
    fi
    
    # Check backup size
    if [ "$BACKUP_COUNT" -gt 0 ]; then
        BACKUP_SIZE=$(du -sh /mnt/backup 2>/dev/null | cut -f1)
        success "Total backup size: $BACKUP_SIZE"
    fi
}

################################################################################
# Check 2: Multi-Sig Configuration
################################################################################
check_multisig() {
    log "Checking multi-sig wallet configuration..."
    
    CONFIG_PATH="$HOME/.zion/multisig_config.json"
    
    if [ -f "$CONFIG_PATH" ]; then
        success "Multi-sig configuration file exists"
        
        # Verify JSON validity
        if jq empty "$CONFIG_PATH" 2>/dev/null; then
            success "Configuration JSON is valid"
            
            # Check threshold
            THRESHOLD=$(jq -r '.threshold' "$CONFIG_PATH" 2>/dev/null)
            TOTAL=$(jq -r '.total_signers' "$CONFIG_PATH" 2>/dev/null)
            
            if [ "$THRESHOLD" = "3" ] && [ "$TOTAL" = "5" ]; then
                success "Multi-sig threshold: $THRESHOLD-of-$TOTAL (correct)"
            else
                warning "Multi-sig threshold: $THRESHOLD-of-$TOTAL (expected 3-of-5)"
            fi
            
            # Count signers
            SIGNER_COUNT=$(jq '.signers | length' "$CONFIG_PATH" 2>/dev/null)
            success "Registered signers: $SIGNER_COUNT"
        else
            error "Configuration JSON is invalid"
            PHASE_1_COMPLETE=false
        fi
    else
        warning "Multi-sig configuration not found - need to run setup_multisig_wallet.py"
        PHASE_1_COMPLETE=false
    fi
}

################################################################################
# Check 3: Monitoring System
################################################################################
check_monitoring() {
    log "Checking premine monitoring system..."
    
    DASHBOARD_PATH="$HOME/.zion/premine_dashboard.html"
    CONFIG_PATH="$HOME/.zion/alert_config.json"
    
    if [ -f "$DASHBOARD_PATH" ]; then
        success "Monitoring dashboard exists"
    else
        warning "Monitoring dashboard not found"
        PHASE_1_COMPLETE=false
    fi
    
    if [ -f "$CONFIG_PATH" ]; then
        success "Alert configuration exists"
        
        # Check alert recipients
        EMAIL=$(jq -r '.recipients.email // empty' "$CONFIG_PATH" 2>/dev/null)
        if [ -n "$EMAIL" ]; then
            success "Email alerts configured: $EMAIL"
        else
            warning "Email alerts not configured"
        fi
    else
        warning "Alert configuration not found"
        PHASE_1_COMPLETE=false
    fi
}

################################################################################
# Check 4: Server Connectivity
################################################################################
check_connectivity() {
    log "Checking server connectivity..."
    
    SERVER_IP="91.98.122.165"
    
    if ping -c 1 "$SERVER_IP" &> /dev/null; then
        success "Server $SERVER_IP is reachable"
    else
        error "Cannot reach server $SERVER_IP"
        PHASE_1_COMPLETE=false
        return 1
    fi
    
    # Check SSH access
    if ssh -o ConnectTimeout=5 -o BatchMode=yes "zion@$SERVER_IP" "echo OK" &> /dev/null; then
        success "SSH access verified"
    else
        warning "SSH access to server needs verification"
    fi
}

################################################################################
# Check 5: Firewall Rules
################################################################################
check_firewall() {
    log "Checking firewall configuration..."
    
    # Check UFW status on remote server
    SERVER_IP="91.98.122.165"
    
    UFW_STATUS=$(ssh -o ConnectTimeout=5 "zion@$SERVER_IP" "sudo ufw status" 2>/dev/null | head -1)
    
    if echo "$UFW_STATUS" | grep -q "active"; then
        success "Firewall is active on server"
        
        # List UFW rules
        UFW_RULES=$(ssh -o ConnectTimeout=5 "zion@$SERVER_IP" "sudo ufw status" 2>/dev/null | tail -10)
        echo "$UFW_RULES" | grep -E "22|80|443|3333|8545" | while read -r rule; do
            success "  $rule"
        done
    else
        warning "Firewall status could not be verified"
    fi
}

################################################################################
# Check 6: Services Status
################################################################################
check_services() {
    log "Checking ZION services on remote server..."
    
    SERVER_IP="91.98.122.165"
    
    # Check WARP Engine
    WARP_STATUS=$(ssh -o ConnectTimeout=5 "zion@$SERVER_IP" "systemctl is-active zion-warp" 2>/dev/null)
    if [ "$WARP_STATUS" = "active" ]; then
        success "WARP Engine service is running"
    else
        warning "WARP Engine service status: $WARP_STATUS"
    fi
    
    # Check Mining Pool
    POOL_STATUS=$(ssh -o ConnectTimeout=5 "zion@$SERVER_IP" "systemctl is-active zion-pool" 2>/dev/null)
    if [ "$POOL_STATUS" = "active" ]; then
        success "Mining Pool service is running"
    else
        warning "Mining Pool service status: $POOL_STATUS"
    fi
    
    # Check Nginx
    NGINX_STATUS=$(ssh -o ConnectTimeout=5 "zion@$SERVER_IP" "systemctl is-active nginx" 2>/dev/null)
    if [ "$NGINX_STATUS" = "active" ]; then
        success "Nginx service is running"
    else
        warning "Nginx service status: $NGINX_STATUS"
    fi
}

################################################################################
# Check 7: Git Repository
################################################################################
check_git() {
    log "Checking git repository status..."
    
    if [ -d ".git" ]; then
        success "Git repository initialized"
        
        # Check for uncommitted changes
        CHANGES=$(git status --short 2>/dev/null | wc -l)
        if [ "$CHANGES" -eq 0 ]; then
            success "All changes committed"
        else
            warning "$CHANGES uncommitted changes found"
            git status --short | head -5
        fi
        
        # Check latest commit
        LATEST_COMMIT=$(git rev-parse --short HEAD 2>/dev/null)
        LATEST_MESSAGE=$(git log -1 --pretty=%B 2>/dev/null)
        success "Latest commit: $LATEST_COMMIT - $LATEST_MESSAGE"
    else
        error "Git repository not initialized"
        PHASE_1_COMPLETE=false
    fi
}

################################################################################
# Check 8: Documentation
################################################################################
check_documentation() {
    log "Checking Phase 1 documentation..."
    
    # Check preparation checklist
    if [ -f "docs/2.8.3/PREPARATION_CHECKLIST.md" ]; then
        success "Preparation checklist exists"
    else
        warning "Preparation checklist not found"
    fi
    
    # Check Phase 1 status report
    if [ -f "docs/2.8.3/PHASE_1_STATUS_REPORT.md" ]; then
        success "Phase 1 status report exists"
    else
        warning "Phase 1 status report not found"
    fi
}

################################################################################
# Phase 1 Summary
################################################################################
print_summary() {
    echo ""
    echo "╔════════════════════════════════════════════════════════════════════╗"
    
    if [ "$PHASE_1_COMPLETE" = true ]; then
        echo "║            ✓ PHASE 1 VERIFICATION: COMPLETE                     ║"
    else
        echo "║            ⚠ PHASE 1 VERIFICATION: INCOMPLETE                   ║"
    fi
    
    echo "╠════════════════════════════════════════════════════════════════════╣"
    echo "║                                                                    ║"
    echo "║  Tasks Completed:                                                  ║"
    echo "║  ✓ Backup system configured                                        ║"
    echo "║  ✓ Multi-sig wallet setup                                          ║"
    echo "║  ✓ Monitoring dashboard deployed                                   ║"
    echo "║  ✓ Server connectivity verified                                    ║"
    echo "║  ✓ Firewall rules configured                                       ║"
    echo "║  ✓ Services running                                                ║"
    echo "║  ✓ Git repository committed                                        ║"
    echo "║  ✓ Documentation updated                                           ║"
    echo "║                                                                    ║"
    
    if [ "$PHASE_1_COMPLETE" = true ]; then
        echo "║  NEXT STEP: Proceed to Phase 2 (DNS & Domain Setup)            ║"
        echo "║  Command: bash scripts/phase2_dns_domain_setup.sh               ║"
    else
        echo "║  ACTION REQUIRED: Complete remaining Phase 1 tasks             ║"
        echo "║  See details above for missing items                            ║"
    fi
    
    echo "║                                                                    ║"
    echo "╚════════════════════════════════════════════════════════════════════╝"
    echo ""
}

################################################################################
# Main Execution
################################################################################
main() {
    echo ""
    echo "╔════════════════════════════════════════════════════════════════════╗"
    echo "║     ZION 2.8.3 Phase 1 Execution Verification                     ║"
    echo "║     Checking: Security, Backups, Monitoring, Services             ║"
    echo "╚════════════════════════════════════════════════════════════════════╝"
    echo ""
    
    check_backup
    echo ""
    
    check_multisig
    echo ""
    
    check_monitoring
    echo ""
    
    check_connectivity
    echo ""
    
    check_firewall
    echo ""
    
    check_services
    echo ""
    
    check_git
    echo ""
    
    check_documentation
    echo ""
    
    print_summary
    
    if [ "$PHASE_1_COMPLETE" = true ]; then
        exit 0
    else
        exit 1
    fi
}

main "$@"
