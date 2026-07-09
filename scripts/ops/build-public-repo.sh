#!/usr/bin/env bash
# ============================================================
# ZION v3 — Fresh Public Repo Builder
# ============================================================
# Creates a clean public repository from the private monorepo.
# - Clean git history (single initial commit)
# - Only consensus core + L2 contracts + docs
# - WARP excluded (competitive advantage)
# - No secrets, no internal docs, no ops scripts
# - Scrubbed production IPs
#
# Usage:
#   ./build-public-repo.sh /tmp/v3-Mainnet-public
#
# Prerequisites:
#   - Run from the private repo root (2.9.6-main)
#   - git, rsync installed
# ============================================================

set -euo pipefail

SOURCE_DIR="$(cd "$(dirname "$0")/.." && pwd)"
TARGET_DIR="${1:-/tmp/v3-Mainnet-public}"

echo "============================================================"
echo "  ZION v3 — Fresh Public Repo Builder"
echo "============================================================"
echo "  Source: $SOURCE_DIR"
echo "  Target: $TARGET_DIR"
echo "============================================================"

# ── 1. Clean target ──
if [ -d "$TARGET_DIR" ]; then
    echo "[!] Target directory exists: $TARGET_DIR"
    read -p "    Overwrite? (y/N) " -n 1 -r
    echo
    [[ $REPLY =~ ^[Yy]$ ]] || { echo "Aborted."; exit 1; }
    rm -rf "$TARGET_DIR"
fi

mkdir -p "$TARGET_DIR"
cd "$TARGET_DIR"
git init

# ── 2. Copy files (whitelist approach) ──
echo "[*] Copying files..."

# Root files
cp "$SOURCE_DIR/LICENSE" ./
cp "$SOURCE_DIR/PUBLIC_README.md" ./README.md
cp "$SOURCE_DIR/SECURITY.md" ./
cp "$SOURCE_DIR/CONTRIBUTING.md" ./
cp "$SOURCE_DIR/CODE_OF_CONDUCT.md" ./
cp "$SOURCE_DIR/Cargo.toml" ./

# .github (CI/CD)
mkdir -p .github/workflows
cp "$SOURCE_DIR/.github/workflows/security-scan.yml" .github/workflows/

# V3/L1 — Consensus core
mkdir -p V3/L1
rsync -a --exclude="target/" --exclude=".cargo/" \
    "$SOURCE_DIR/V3/L1/core/" V3/L1/core/
rsync -a --exclude="target/" \
    "$SOURCE_DIR/V3/L1/pool/" V3/L1/pool/
rsync -a --exclude="target/" \
    "$SOURCE_DIR/V3/L1/miner/" V3/L1/miner/
rsync -a --exclude="target/" \
    "$SOURCE_DIR/V3/L1/cosmic-harmony/" V3/L1/cosmic-harmony/

# V3/L2 — DeFi + Bridge + DAO + Atomic Swap
mkdir -p V3/L2
rsync -a --exclude="target/" --exclude="node_modules/" \
    "$SOURCE_DIR/V3/L2/contracts/" V3/L2/contracts/
rsync -a --exclude="target/" \
    "$SOURCE_DIR/V3/L2/bridge/" V3/L2/bridge/
rsync -a --exclude="target/" \
    "$SOURCE_DIR/V3/L2/dao/" V3/L2/dao/
rsync -a --exclude="target/" \
    "$SOURCE_DIR/V3/L2/atomic-swap/" V3/L2/atomic-swap/

# V3/L4 — Oasis
if [ -d "$SOURCE_DIR/V3/L4" ]; then
    rsync -a --exclude="target/" \
        "$SOURCE_DIR/V3/L4/" V3/L4/
fi

# V3/L5 — Community
if [ -d "$SOURCE_DIR/V3/L5" ]; then
    rsync -a --exclude="target/" \
        "$SOURCE_DIR/V3/L5/" V3/L5/
fi

# V3/Cargo.toml
cp "$SOURCE_DIR/V3/Cargo.toml" V3/Cargo.toml

# V3/docs — Architecture docs (selective)
mkdir -p V3/docs
for f in MAINNET_CONSTANTS.md CLI_GUIDE.md CLI_REFERENCE.md; do
    [ -f "$SOURCE_DIR/V3/docs/$f" ] && cp "$SOURCE_DIR/V3/docs/$f" V3/docs/
done

# docs/security — Public security disclosures
mkdir -p docs/security
cp "$SOURCE_DIR/docs/security/SECURITY_DISCLOSURE_2026-07.md" docs/security/ 2>/dev/null || true
cp "$SOURCE_DIR/docs/security/vulnerabilities.json" docs/security/ 2>/dev/null || true

# ── 3. EXPLICITLY EXCLUDED (do NOT copy) ──
echo "[*] Excluded (by design):"
echo "    - V3/L3/warp/ (competitive advantage)"
echo "    - V3/L3/ai-native/ (internal AI)"
echo "    - V3/L3/ncl/ (internal)"
echo "    - scripts/_rig_*.py, scripts/tmp_smos_*.py (SimpleMining)"
echo "    - archive/ (legacy code)"
echo "    - PoC-lab/ (research prototype)"
echo "    - HiranV2.*/ (AI training)"
echo "    - APP&WEB/ (separate repos)"
echo "    - ZionStart/ (ops scripts with production IPs)"
echo "    - HARDRESETOFFICIAL.md, StatusV3.md, AGENTS.md (internal)"
echo "    - SECURITY_PATCH_3.0.4_PLAN.md, SECURITY_TODO_*.md (internal)"
echo "    - dns.md (DNS zone file)"
echo "    - *.env (environment files)"

# ── 4. Scrub production IPs ──
echo "[*] Scrubbing production IPs..."
find . -type f \( -name "*.rs" -o -name "*.toml" -o -name "*.sh" -o -name "*.md" -o -name "*.yml" -o -name "*.yaml" -o -name "*.json" -o -name "*.py" -o -name "*.ini" \) -exec \
    sed -i 's/62\.171\.141\.136/<ZION_SEED_PEER>/g; s/77\.42\.71\.94/<LEGACY_EDGE>/g; s/100\.76\.16\.108/<LEGACY_TAILSCALE>/g; s/SecurityToken=990467394D5317678DAC1F873E4C63A2/SecurityToken=<REDACTED>/g' {} +

# ── 5. Create .gitignore ──
cat > .gitignore << 'GITIGNORE'
# Build artifacts
target/
node_modules/
dist/
cache/

# IDE
.idea/
.vscode/
*.swp
*.swo

# Environment files (NEVER commit secrets)
.env
.env.local
.env.production
.env.mainnet
*.pem
*.key

# OS
.DS_Store
Thumbs.db

# Cargo
**/*.rs.bk

# Foundry
foundry.lock
broadcast/

# Temporary
*.log
*.tmp
GITIGNORE

# ── 6. Verify no secrets ──
echo "[*] Verifying no secrets leaked..."
SECRET_HITS=0

# Check for SimpleMining token
if grep -r "api-7a77595" . 2>/dev/null; then
    echo "[!] SimpleMining API token found!"
    SECRET_HITS=$((SECRET_HITS + 1))
fi

# Check for PostgreSQL password
if grep -r "zion_db_2675" . 2>/dev/null; then
    echo "[!] PostgreSQL password found!"
    SECRET_HITS=$((SECRET_HITS + 1))
fi

# Check for private key patterns
if grep -r "BEGIN.*PRIVATE KEY" . 2>/dev/null | grep -v ".gitignore"; then
    echo "[!] Private key material found!"
    SECRET_HITS=$((SECRET_HITS + 1))
fi

# Check for production IP
if grep -r "62.171.141.136" . 2>/dev/null; then
    echo "[!] Production IP found!"
    SECRET_HITS=$((SECRET_HITS + 1))
fi

# Check for UE5 security token
if grep -r "990467394D5317678DAC1F873E4C63A2" . 2>/dev/null; then
    echo "[!] UE5 security token found!"
    SECRET_HITS=$((SECRET_HITS + 1))
fi

if [ $SECRET_HITS -gt 0 ]; then
    echo "[!] SECRET SCAN FAILED — $SECRET_HITS issues found"
    exit 1
fi
echo "[+] Secret scan passed — no secrets found"

# ── 7. Initial commit ──
echo "[*] Creating initial commit..."
git add -A
git commit -m "$(cat <<'COMMIT_EOF'
Initial public release — ZION v3.0.4 mainnet

L1 consensus core (Rust):
- Dual-algo PoW (Ekam Deeksha)
- Ed25519 signatures, BLAKE3 hashing
- UTXO + account transaction models with memo support
- LWMA difficulty adjustment
- P2P networking (QUIC/Quinn)
- LMDB persistent storage
- JSON-RPC 2.0 (17+ methods)
- Prometheus metrics

L2 DeFi (Base Mainnet):
- wZION ERC-20 token
- ZIONBridge (5/5 validator threshold, 6 EVM chains)
- ZIONGovernance (token-weighted voting)
- ZIONTreasury (3-of-3 multisig)
- ZIONStaking (12% APR)
- ZIONFarm (yield farming)
- ZIONAtomicSwap (HTLC)
- All 7 contracts verified on Basescan

Security:
- F1 (forged P2P signatures) — fixed
- F5 (unlimited inflation) — fixed
- C1-C8 (server exposure) — fixed
- Public vulnerability disclosures (ZION-2026-001..005)

License: MIT
COMMIT_EOF
)"

echo ""
echo "============================================================"
echo "  ✅ Fresh public repo created at: $TARGET_DIR"
echo "============================================================"
echo ""
echo "Next steps:"
echo "  1. Review the repo: cd $TARGET_DIR && ls -la"
echo "  2. Run gitleaks:    gitleaks detect --source $TARGET_DIR"
echo "  3. Build test:      cd $TARGET_DIR && cargo build --release"
echo "  4. Push to GitHub:"
echo "     git remote add origin https://github.com/Zion-TerraNova/v3-Mainnet.git"
echo "     git branch -M main"
echo "     git push -u origin main --force"
echo "============================================================"
