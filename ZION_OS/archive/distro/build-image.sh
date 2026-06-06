#!/bin/bash
set -euo pipefail

# ZION OS Image Builder
# Postavi bootovatelny USB flash image pro mining rigy
#
# Pouziti:
#   sudo ./build-image.sh [output.img] [zion-version]
#
# Pozadavky:
#   - debootstrap, parted, mkfs.vfat, mkfs.ext4, mksquashfs, grub-install
#   - dostatek mista v /tmp nebo ./build/

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
OUTPUT="${1:-zion-os-v1.0.0-amd64.img}"
ZION_VERSION="${2:-1.0.0}"
UBUNTU_VERSION="noble"  # 24.04 LTS
BUILD_DIR="${SCRIPT_DIR}/build"
CHROOT="${BUILD_DIR}/chroot"
IMAGE_SIZE_MB="${IMAGE_SIZE_MB:-8192}"  # 8GB default

# Partition sizes (MB)
EFI_SIZE=512
OS_SIZE=4096

echo "=== ZION OS Image Builder ==="
echo "Output: ${OUTPUT}"
echo "Version: ${ZION_VERSION}"
echo "Size: ${IMAGE_SIZE_MB}MB"
echo ""

# --- Cleanup predchoziho buildu ---
if [[ -d "${BUILD_DIR}" ]]; then
    echo "[1/8] Cistim predchozi build..."
    umount -f "${CHROOT}/proc" 2>/dev/null || true
    umount -f "${CHROOT}/sys" 2>/dev/null || true
    umount -f "${CHROOT}/dev/pts" 2>/dev/null || true
    rm -rf "${BUILD_DIR}"
fi
mkdir -p "${BUILD_DIR}"

# --- Vytvoreni raw image ---
echo "[2/8] Vytvarim raw disk image (${IMAGE_SIZE_MB}MB)..."
dd if=/dev/zero of="${BUILD_DIR}/${OUTPUT}" bs=1M count="${IMAGE_SIZE_MB}" status=progress

# --- Partition layout: EFI | OS (squashfs source) | DATA ---
echo "[3/8] Vytvarim partition layout (EFI + OS + DATA)..."
parted -s "${BUILD_DIR}/${OUTPUT}" mklabel gpt
parted -s "${BUILD_DIR}/${OUTPUT}" mkpart primary fat32 1MiB "${EFI_SIZE}MiB"
parted -s "${BUILD_DIR}/${OUTPUT}" mkpart primary ext4 "${EFI_SIZE}MiB" "$((EFI_SIZE + OS_SIZE))MiB"
parted -s "${BUILD_DIR}/${OUTPUT}" mkpart primary ext4 "$((EFI_SIZE + OS_SIZE))MiB" 100%
parted -s "${BUILD_DIR}/${OUTPUT}" set 1 esp on
parted -s "${BUILD_DIR}/${OUTPUT}" set 1 boot on

# --- Loop device setup ---
LOOP_DEV="$(losetup -f --show "${BUILD_DIR}/${OUTPUT}")"
# Force kernel to reread partitions
partprobe "${LOOP_DEV}"
sleep 1
EFI_DEV="${LOOP_DEV}p1"
OS_DEV="${LOOP_DEV}p2"
DATA_DEV="${LOOP_DEV}p3"

# --- Format partitions ---
echo "[4/8] Formatuji partitiony..."
mkfs.vfat -F 32 -n ZION-EFI "${EFI_DEV}"
mkfs.ext4 -L ZION-OS "${OS_DEV}"
mkfs.ext4 -L ZION-DATA "${DATA_DEV}"

# --- Debootstrap Ubuntu minimal ---
echo "[5/8] Debootstrap Ubuntu ${UBUNTU_VERSION}..."
mkdir -p "${CHROOT}"
mount "${OS_DEV}" "${CHROOT}"
debootstrap --variant=minbase --include=linux-generic,grub-pc,systemd,systemd-sysv,udev,sudo,curl,wget,vim-tiny,htop,tmux,net-tools,iproute2,dnsutils,parted,e2fsprogs,docker.io,tailscale "${UBUNTU_VERSION}" "${CHROOT}" http://archive.ubuntu.com/ubuntu/

# --- Chroot konfigurace ---
echo "[6/8] Konfiguruji chroot..."
mount --bind /dev "${CHROOT}/dev"
mount --bind /dev/pts "${CHROOT}/dev/pts"
mount --bind /proc "${CHROOT}/proc"
mount --bind /sys "${CHROOT}/sys"

# Copy build skripty do chroot
cp "${SCRIPT_DIR}/chroot-setup.sh" "${CHROOT}/tmp/"
cp -r "${SCRIPT_DIR}/packages" "${CHROOT}/tmp/"
cp -r "${SCRIPT_DIR}/skel" "${CHROOT}/tmp/"

# Spust chroot setup
chroot "${CHROOT}" /tmp/chroot-setup.sh "${ZION_VERSION}"

# --- Vytvoreni squashfs z OS partition ---
echo "[7/8] Vytvarim squashfs (read-only root)..."
mksquashfs "${CHROOT}" "${BUILD_DIR}/zion-os.squashfs" -comp zstd -Xcompression-level 15

# --- Install bootloader ---
echo "[8/8] Instaluji GRUB bootloader..."
mkdir -p "${BUILD_DIR}/efi"
mount "${EFI_DEV}" "${BUILD_DIR}/efi"

# GRUB config pro overlayfs boot
cat > "${BUILD_DIR}/efi/boot/grub/grub.cfg" << 'GRUBEOF'
set timeout=3
set default=0

menuentry "ZION OS (Live)" {
    linux /boot/vmlinuz-generic root=/dev/disk/by-label/ZION-OS overlayroot=tmpfs quiet
    initrd /boot/initrd.img-generic
}

menuentry "ZION OS (Debug)" {
    linux /boot/vmlinuz-generic root=/dev/disk/by-label/ZION-OS overlayroot=tmpfs debug systemd.log_level=debug
    initrd /boot/initrd.img-generic
}
GRUBEOF

# Install GRUB
grub-install --target=x86_64-efi --efi-directory="${BUILD_DIR}/efi" --bootloader-id=ZION-OS --removable --boot-directory="${BUILD_DIR}/efi/boot"

# Copy kernel + initramfs
cp "${CHROOT}/boot/vmlinuz"* "${BUILD_DIR}/efi/boot/vmlinuz-generic"
cp "${CHROOT}/boot/initrd.img"* "${BUILD_DIR}/efi/boot/initrd.img-generic"

# Copy squashfs na OS partition (bude tam lezet jako soubor, mountuje se initramfs)
cp "${BUILD_DIR}/zion-os.squashfs" "${BUILD_DIR}/efi/boot/zion-os.squashfs"

# --- DATA partition skeleton ---
mkdir -p "${BUILD_DIR}/data"
mount "${DATA_DEV}" "${BUILD_DIR}/data"
mkdir -p "${BUILD_DIR}/data/zion/config"
mkdir -p "${BUILD_DIR}/data/zion/logs"
mkdir -p "${BUILD_DIR}/data/zion/wallet"
mkdir -p "${BUILD_DIR}/data/zion/cache"

# Default autonomous config (rig bootne a ceka na wizard)
cat > "${BUILD_DIR}/data/zion/config/autonomous.json" << 'AUTOEOF'
{
  "mode": "first-boot",
  "auto_start_miner": false,
  "auto_update": "stable",
  "telemetry": {
    "enabled": false
  },
  "wizard": {
    "enabled": true,
    "bind": "0.0.0.0:80"
  }
}
AUTOEOF

# --- Cleanup ---
umount "${BUILD_DIR}/data"
umount "${BUILD_DIR}/efi"
umount "${CHROOT}/sys"
umount "${CHROOT}/proc"
umount "${CHROOT}/dev/pts"
umount "${CHROOT}/dev"
umount "${CHROOT}"
umount "${OS_DEV}" 2>/dev/null || true
losetup -d "${LOOP_DEV}"

# --- Final output ---
mv "${BUILD_DIR}/${OUTPUT}" "${SCRIPT_DIR}/${OUTPUT}"
rm -rf "${BUILD_DIR}"

echo ""
echo "=== ZION OS image hotovo ==="
echo "Soubor: ${OUTPUT}"
echo ""
echo "Flashnuti na USB:"
echo "  sudo dd if=${OUTPUT} of=/dev/sdX bs=4M status=progress oflag=sync"
echo "  # nebo pouzij balenaEtcher / Rufus"
