#!/bin/bash
# Initramfs hook pro ZION OS overlayfs boot
# Instalace: copy do /etc/initramfs-tools/scripts/init-bottom/zion-overlay

set -e

# Tento skript bezi v initramfs behem bootu
# Detekuje boot z USB/flash a nastavi overlayfs

ZION_OS_LABEL="ZION-OS"
ZION_DATA_LABEL="ZION-DATA"

# --- Detekce boot media ---
PREREQ=""
prereqs() {
    echo "$PREREQ"
}

case $1 in
prereqs)
    prereqs
    exit 0
    ;;
esac

. /scripts/functions

# Hlavni logika bezi z init-bottom
# (tento soubor je kopirovan do initramfs)

# /scripts/local-bottom/zion-overlay
# Tento skript je volan initramfs behem mountovani root filesystemu

echo "ZION-OS: overlayfs setup"

# Najdi USB device s ZION-OS squashfs
for dev in /dev/disk/by-label/${ZION_OS_LABEL} /dev/sd*1 /dev/nvme*n1; do
    if [ -b "$dev" ]; then
        echo "  Found device: $dev"
        break
    fi
done

# Pokud jsme bootovali z USB (overlayroot=tmpfs nebo overlayroot=dev)
if [ -n "${overlayroot}" ]; then
    echo "ZION-OS: Setting up overlayfs..."

    # Mount OS partition (obsahuje squashfs)
    mkdir -p /overlay/os
    mount -o ro "$dev" /overlay/os

    # Najdi squashfs
    if [ -f /overlay/os/boot/zion-os.squashfs ]; then
        mkdir -p /overlay/base
        mount -o loop,ro -t squashfs /overlay/os/boot/zion-os.squashfs /overlay/base
        echo "  squashfs mounted"
    else
        # Fallback: OS partition primo je ext4 s OS
        mount --bind /overlay/os /overlay/base
    fi

    # Data partition (persistentni)
    mkdir -p /overlay/data
    for data_dev in /dev/disk/by-label/${ZION_DATA_LABEL} /dev/sd*3 /dev/nvme*n3; do
        if [ -b "$data_dev" ]; then
            mount "$data_dev" /overlay/data 2>/dev/null || true
            break
        fi
    done

    # Pokud neni data partition, vytvor tmpfs
    if ! mountpoint -q /overlay/data; then
        echo "  No data partition found, using tmpfs"
        mount -t tmpfs -o size=512M tmpfs /overlay/data
        mkdir -p /overlay/data/zion/config
        mkdir -p /overlay/data/zion/logs
    fi

    # Overlayfs: base (ro) + upper (data/upper) + work (data/work)
    mkdir -p /overlay/data/upper
    mkdir -p /overlay/data/work

    mount -t overlay overlay -o lowerdir=/overlay/base,upperdir=/overlay/data/upper,workdir=/overlay/data/work /root
    echo "  overlayfs mounted on /root"
else
    echo "ZION-OS: Standard boot (no overlay)"
fi
