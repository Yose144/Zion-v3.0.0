#!/usr/bin/env bash
# ZION Edge — Swap expansion script
# Adds a second swapfile (8 GB) to complement the existing 4 GB swapfile,
# giving 12 GB total swap. This gives the kernel more room to swap cold pages
# on the 7.8 GB RAM server, avoiding OOM during spikes.
#
# Safe: swap is on disk (96 GB free), no RAM cost. The kernel only uses it
# when RAM is full. Creating swap doesn't immediately consume it.
#
# Usage: sudo ./expand-swap.sh [--size 8G] [--dry-run]
set -euo pipefail

SWAP_SIZE="${1:-8G}"
DRY_RUN=0
[[ "${1:-}" == "--dry-run" ]] && DRY_RUN=1
[[ "${2:-}" == "--dry-run" ]] && DRY_RUN=1

SWAPFILE="/swapfile2"

echo "=== ZION Edge Swap Expansion ==="
echo "Target: ${SWAP_SIZE} at ${SWAPFILE}"
echo "Dry run: ${DRY_RUN}"

# Check if already exists
if swapon --show | grep -q "${SWAPFILE}"; then
  echo "✓ ${SWAPFILE} already active — nothing to do"
  swapon --show
  exit 0
fi

if [[ -f "${SWAPFILE}" ]]; then
  echo "⚠ ${SWAPFILE} exists but is not active. Removing and recreating."
  if [[ "$DRY_RUN" == "0" ]]; then
    rm -f "${SWAPFILE}"
  fi
fi

echo "Creating ${SWAPFILE} (${SWAP_SIZE})..."
if [[ "$DRY_RUN" == "1" ]]; then
  echo "  [dry-run] fallocate -l ${SWAP_SIZE} ${SWAPFILE}"
  echo "  [dry-run] chmod 600 ${SWAPFILE}"
  echo "  [dry-run] mkswap ${SWAPFILE}"
  echo "  [dry-run] swapon ${SWAPFILE}"
  echo "  [dry-run] add to /etc/fstab"
else
  fallocate -l "${SWAP_SIZE}" "${SWAPFILE}"
  chmod 600 "${SWAPFILE}"
  mkswap "${SWAPFILE}"
  swapon "${SWAPFILE}"

  # Add to fstab if not already there
  if ! grep -q "${SWAPFILE}" /etc/fstab; then
    echo "${SWAPFILE} none swap sw 0 0" >> /etc/fstab
    echo "✓ Added ${SWAPFILE} to /etc/fstab (persists across reboots)"
  fi
fi

echo ""
echo "=== Swap after expansion ==="
swapon --show
free -h
echo ""
echo "✓ Done. Total swap: $(swapon --show | tail -n +2 | awk '{s+=$3} END {print s/1024 " GB"}')"
