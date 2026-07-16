#!/bin/bash
# MSR mod for AMD Ryzen 5 3600 (Zen 2) — RandomX optimization
# Based on XMRig's MSR mod for Ryzen (15% RandomX hashrate gain)
#
# Registers modified:
#   0xc0011020: clear bits [28:25] (disable loop accelerator / L1 prefetch)
#   0xc0011021: clear bit [54] (disable speculative memory access)
#   0xc0011022: set bit [2] (enable FP pipelining)
#
# Usage: sudo ./scripts/msr-mod-ryzen.sh [apply|restore]
#
# Requires: msr-tools (wrmsr/rdmsr), root access
# Install: sudo apt install msr-tools

set -e

ACTION="${1:-apply}"

if [ "$(id -u)" -ne 0 ]; then
    echo "ERROR: Must run as root (sudo)"
    exit 1
fi

# Load msr module if not loaded
modprobe msr 2>/dev/null || true

# Check msr-tools
if ! command -v wrmsr &>/dev/null || ! command -v rdmsr &>/dev/null; then
    echo "ERROR: msr-tools not installed. Run: sudo apt install msr-tools"
    exit 1
fi

# Backup file
BACKUP="/tmp/msr-backup-ryzen.txt"

backup_msrs() {
    echo "Backing up MSR values to $BACKUP..."
    > "$BACKUP"
    for cpu in /dev/cpu/*/msr; do
        local core=$(echo "$cpu" | grep -oP '\d+')
        local val1020=$(rdmsr -p "$core" 0xc0011020 2>/dev/null || echo "0x0")
        local val1021=$(rdmsr -p "$core" 0xc0011021 2>/dev/null || echo "0x0")
        local val1022=$(rdmsr -p "$core" 0xc0011022 2>/dev/null || echo "0x0")
        echo "core=$core 0xc0011020=$val1020 0xc0011021=$val1021 0xc0011022=$val1022" >> "$BACKUP"
    done
    cat "$BACKUP"
}

apply_msrs() {
    backup_msrs
    echo ""
    echo "Applying Ryzen MSR mod for RandomX optimization..."
    for cpu in /dev/cpu/*/msr; do
        local core=$(echo "$cpu" | grep -oP '\d+')

        # Read current values
        local val1020=$(rdmsr -p "$core" 0xc0011020)
        local val1021=$(rdmsr -p "$core" 0xc0011021)
        local val1022=$(rdmsr -p "$core" 0xc0011022)

        # Convert to decimal for bitwise ops
        local dec1020=$((val1020))
        local dec1021=$((val1021))
        local dec1022=$((val1022))

        # 0xc0011020: clear bits [28:25] (L1 prefetch disable for RandomX)
        # Mask: ~0x1E000000
        local new1020=$((dec1020 & ~0x1E000000))

        # 0xc0011021: clear bit [54] (disable speculative memory access)
        # Mask: ~0x400000000000000
        local new1021=$((dec1021 & ~0x400000000000000))

        # 0xc0011022: set bit [2] (enable FP pipelining)
        # Mask: |0x4
        local new1022=$((dec1022 | 0x4))

        # Write new values
        wrmsr -p "$core" 0xc0011020 $(printf "0x%x" $new1020)
        wrmsr -p "$core" 0xc0011021 $(printf "0x%x" $new1021)
        wrmsr -p "$core" 0xc0011022 $(printf "0x%x" $new1022)

        echo "  core=$core: 0xc0011020 $(printf "0x%x" $dec1020)→$(printf "0x%x" $new1020)  0xc0011021 $(printf "0x%x" $dec1021)→$(printf "0x%x" $new1021)  0xc0011022 $(printf "0x%x" $dec1022)→$(printf "0x%x" $new1022)"
    done
    echo ""
    echo "MSR mod applied! Expected RandomX hashrate gain: ~15%"
    echo "Backup saved to $BACKUP (restore with: sudo $0 restore)"
}

restore_msrs() {
    if [ ! -f "$BACKUP" ]; then
        echo "ERROR: No backup found at $BACKUP"
        exit 1
    fi
    echo "Restoring MSR values from $BACKUP..."
    while IFS= read -r line; do
        local core=$(echo "$line" | grep -oP 'core=\K\d+')
        local val1020=$(echo "$line" | grep -oP '0xc0011020=\K\S+')
        local val1021=$(echo "$line" | grep -oP '0xc0011021=\K\S+')
        local val1022=$(echo "$line" | grep -oP '0xc0011022=\K\S+')
        wrmsr -p "$core" 0xc0011020 "$val1020"
        wrmsr -p "$core" 0xc0011021 "$val1021"
        wrmsr -p "$core" 0xc0011022 "$val1022"
        echo "  core=$core restored"
    done < "$BACKUP"
    echo "MSR values restored!"
}

case "$ACTION" in
    apply)
        apply_msrs
        ;;
    restore)
        restore_msrs
        ;;
    *)
        echo "Usage: sudo $0 [apply|restore]"
        exit 1
        ;;
esac
