#!/bin/bash

# ZION Security Scanner
# Version: 2.8.9
# Runs comprehensive security checks on the codebase

set -e

echo "================================================================================"
echo "ZION v2.8.9 Security Scanner"
echo "================================================================================"
echo ""

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Create security reports directory
REPORTS_DIR="security-reports"
mkdir -p "$REPORTS_DIR"

echo "📂 Reports will be saved to: $REPORTS_DIR/"
echo ""

# Counter for issues
TOTAL_ISSUES=0
CRITICAL_ISSUES=0
HIGH_ISSUES=0

# ============================================================================
# 1. Python Dependency Security
# ============================================================================

echo "1️⃣  Checking Python Dependencies..."
echo "-----------------------------------"

if command -v pip-audit &> /dev/null; then
    echo "  Running pip-audit..."
    pip-audit --format json > "$REPORTS_DIR/pip-audit.json" 2>&1 || true
    pip-audit --format markdown > "$REPORTS_DIR/pip-audit.md" 2>&1 || true
    
    VULNS=$(jq '.vulnerabilities | length' "$REPORTS_DIR/pip-audit.json" 2>/dev/null || echo "0")
    if [ "$VULNS" -gt 0 ]; then
        echo -e "  ${RED}✗ Found $VULNS vulnerabilities${NC}"
        TOTAL_ISSUES=$((TOTAL_ISSUES + VULNS))
    else
        echo -e "  ${GREEN}✓ No vulnerabilities found${NC}"
    fi
else
    echo -e "  ${YELLOW}⚠ pip-audit not installed. Installing...${NC}"
    pip install pip-audit
fi

if command -v safety &> /dev/null; then
    echo "  Running safety check..."
    safety check --json > "$REPORTS_DIR/safety.json" 2>&1 || true
    safety check > "$REPORTS_DIR/safety.txt" 2>&1 || true
    echo -e "  ${GREEN}✓ Safety check completed${NC}"
else
    echo -e "  ${YELLOW}⚠ safety not installed. Installing...${NC}"
    pip install safety
fi

echo ""

# ============================================================================
# 2. Code Security Scanning
# ============================================================================

echo "2️⃣  Scanning Code for Security Issues..."
echo "--------------------------------------"

if command -v bandit &> /dev/null; then
    echo "  Running bandit..."
    bandit -r src/ -f json -o "$REPORTS_DIR/bandit.json" 2>&1 || true
    bandit -r src/ -f txt -o "$REPORTS_DIR/bandit.txt" 2>&1 || true
    
    HIGH_SEVERITY=$(jq '[.results[] | select(.issue_severity == "HIGH" or .issue_severity == "CRITICAL")] | length' "$REPORTS_DIR/bandit.json" 2>/dev/null || echo "0")
    if [ "$HIGH_SEVERITY" -gt 0 ]; then
        echo -e "  ${RED}✗ Found $HIGH_SEVERITY high/critical severity issues${NC}"
        HIGH_ISSUES=$((HIGH_ISSUES + HIGH_SEVERITY))
        TOTAL_ISSUES=$((TOTAL_ISSUES + HIGH_SEVERITY))
    else
        echo -e "  ${GREEN}✓ No high/critical severity issues${NC}"
    fi
else
    echo -e "  ${YELLOW}⚠ bandit not installed. Installing...${NC}"
    pip install bandit
fi

echo ""

# ============================================================================
# 3. Secret Scanning
# ============================================================================

echo "3️⃣  Scanning for Hardcoded Secrets..."
echo "-----------------------------------"

if command -v gitleaks &> /dev/null; then
    echo "  Running gitleaks..."
    gitleaks detect --source . --report-path "$REPORTS_DIR/gitleaks.json" --exit-code 0 || true
    
    if [ -f "$REPORTS_DIR/gitleaks.json" ]; then
        SECRETS=$(jq 'length' "$REPORTS_DIR/gitleaks.json" 2>/dev/null || echo "0")
        if [ "$SECRETS" -gt 0 ]; then
            echo -e "  ${RED}✗ Found $SECRETS potential secrets${NC}"
            CRITICAL_ISSUES=$((CRITICAL_ISSUES + SECRETS))
            TOTAL_ISSUES=$((TOTAL_ISSUES + SECRETS))
        else
            echo -e "  ${GREEN}✓ No secrets found${NC}"
        fi
    fi
else
    echo -e "  ${YELLOW}⚠ gitleaks not installed${NC}"
    echo "  Install with: brew install gitleaks (macOS) or see https://github.com/gitleaks/gitleaks"
fi

echo ""

# ============================================================================
# 4. Docker Security Scanning
# ============================================================================

echo "4️⃣  Scanning Docker Images..."
echo "---------------------------"

if command -v trivy &> /dev/null; then
    DOCKER_IMAGES=(
        "deployment/Dockerfile.node.optimized"
        "deployment/Dockerfile.pool.optimized"
        "deployment/Dockerfile.api.optimized"
    )
    
    for dockerfile in "${DOCKER_IMAGES[@]}"; do
        if [ -f "$dockerfile" ]; then
            IMAGE_NAME=$(basename "$dockerfile" | sed 's/Dockerfile\.\(.*\)\.optimized/zion-\1/')
            echo "  Scanning $IMAGE_NAME..."
            
            # Build image for scanning
            docker build -f "$dockerfile" -t "$IMAGE_NAME:scan" . > /dev/null 2>&1 || true
            
            # Scan with trivy
            trivy image --format json --output "$REPORTS_DIR/trivy-$IMAGE_NAME.json" "$IMAGE_NAME:scan" 2>&1 || true
            trivy image --severity HIGH,CRITICAL "$IMAGE_NAME:scan" > "$REPORTS_DIR/trivy-$IMAGE_NAME.txt" 2>&1 || true
            
            if [ -f "$REPORTS_DIR/trivy-$IMAGE_NAME.json" ]; then
                DOCKER_VULNS=$(jq '[.Results[]?.Vulnerabilities[]? | select(.Severity == "HIGH" or .Severity == "CRITICAL")] | length' "$REPORTS_DIR/trivy-$IMAGE_NAME.json" 2>/dev/null || echo "0")
                if [ "$DOCKER_VULNS" -gt 0 ]; then
                    echo -e "    ${RED}✗ Found $DOCKER_VULNS high/critical vulnerabilities${NC}"
                    TOTAL_ISSUES=$((TOTAL_ISSUES + DOCKER_VULNS))
                else
                    echo -e "    ${GREEN}✓ No high/critical vulnerabilities${NC}"
                fi
            fi
            
            # Cleanup
            docker rmi "$IMAGE_NAME:scan" > /dev/null 2>&1 || true
        fi
    done
else
    echo -e "  ${YELLOW}⚠ trivy not installed${NC}"
    echo "  Install with: brew install aquasecurity/trivy/trivy (macOS)"
fi

echo ""

# ============================================================================
# 5. Outdated Dependencies Check
# ============================================================================

echo "5️⃣  Checking for Outdated Dependencies..."
echo "---------------------------------------"

pip list --outdated > "$REPORTS_DIR/outdated-packages.txt" 2>&1 || true
OUTDATED=$(wc -l < "$REPORTS_DIR/outdated-packages.txt" | tr -d ' ')

if [ "$OUTDATED" -gt 2 ]; then  # Subtract header lines
    echo -e "  ${YELLOW}⚠ Found $((OUTDATED - 2)) outdated packages${NC}"
else
    echo -e "  ${GREEN}✓ All packages up to date${NC}"
fi

echo ""

# ============================================================================
# 6. Generate Summary Report
# ============================================================================

echo "================================================================================"
echo "📊 Security Scan Summary"
echo "================================================================================"
echo ""

SUMMARY_FILE="$REPORTS_DIR/SUMMARY.md"

cat > "$SUMMARY_FILE" << EOF
# ZION v2.8.9 Security Scan Summary

**Date:** $(date)  
**Scan Duration:** Automated security scanning  

---

## 📊 Results Overview

| Category | Issues Found | Severity |
|----------|--------------|----------|
| Critical | $CRITICAL_ISSUES | 🔴 |
| High | $HIGH_ISSUES | 🟠 |
| **Total** | **$TOTAL_ISSUES** | - |

---

## 🔍 Detailed Findings

### 1. Python Dependencies
- **Tool:** pip-audit, safety
- **Report:** See \`pip-audit.json\`, \`safety.json\`

### 2. Code Security
- **Tool:** bandit
- **Report:** See \`bandit.json\`

### 3. Secret Scanning
- **Tool:** gitleaks
- **Report:** See \`gitleaks.json\`

### 4. Docker Images
- **Tool:** trivy
- **Report:** See \`trivy-*.json\`

### 5. Outdated Packages
- **Report:** See \`outdated-packages.txt\`

---

## 🎯 Next Steps

EOF

if [ "$CRITICAL_ISSUES" -gt 0 ]; then
    echo "❌ CRITICAL: $CRITICAL_ISSUES critical issues found!" >> "$SUMMARY_FILE"
    echo "   These must be resolved before deployment." >> "$SUMMARY_FILE"
    echo ""  >> "$SUMMARY_FILE"
fi

if [ "$HIGH_ISSUES" -gt 0 ]; then
    echo "⚠️  WARNING: $HIGH_ISSUES high severity issues found." >> "$SUMMARY_FILE"
    echo "   Review and remediate as soon as possible." >> "$SUMMARY_FILE"
    echo ""  >> "$SUMMARY_FILE"
fi

if [ "$TOTAL_ISSUES" -eq 0 ]; then
    echo "✅ No security issues found!" >> "$SUMMARY_FILE"
    echo "   Code passes all security checks." >> "$SUMMARY_FILE"
    echo ""  >> "$SUMMARY_FILE"
fi

cat >> "$SUMMARY_FILE" << EOF

---

## 📝 Recommendations

1. Review all findings in detail
2. Prioritize critical and high severity issues
3. Update outdated dependencies
4. Implement remediation plan
5. Re-run scan after fixes

---

**Generated by ZION Security Scanner v2.8.9**
EOF

# Display summary
cat "$SUMMARY_FILE"

echo ""
echo "================================================================================"

if [ "$CRITICAL_ISSUES" -gt 0 ]; then
    echo -e "${RED}❌ Security scan FAILED: $CRITICAL_ISSUES critical issues found${NC}"
    exit 1
elif [ "$HIGH_ISSUES" -gt 0 ]; then
    echo -e "${YELLOW}⚠️  Security scan completed with warnings: $HIGH_ISSUES high severity issues${NC}"
    exit 0
else
    echo -e "${GREEN}✅ Security scan PASSED: No critical or high severity issues found${NC}"
    exit 0
fi
