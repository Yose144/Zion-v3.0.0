#!/usr/bin/env bash
set -euo pipefail

# Resize sdb pro ZION VM + Blockchain data
# sdb2 (NTFS) zmenšíme o ~300 GB, sdb3 smažeme, vytvoříme novou ext4 partition
#
# PŘEDPOKLADY:
#   - sdb2 obsahuje NTFS data/zálohy
#   - sdb3 je 55.9 GB FAT32 (recovery/boot — nepotřebné)
#   - Potřebujeme ~300 GB ext4 pro VM image + ZION blockchain
#
# POŘADÍ:
#   1. Záloha důležitých dat z sdb2 (RUČNĚ!)
#   2. Zmenšit sdb2 NTFS o 300 GB
#   3. Smazat sdb3
#   4. Vytvořit novou sdb3 = 300 GB ext4
#
# TENTO SKRYPT VYŽADUJE sudo A INTERAKTIVNÍ POTVRZENÍ!

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

log_info()  { echo -e "${BLUE}[INFO]${NC} $1"; }
log_ok()    { echo -e "${GREEN}[OK]${NC} $1"; }
log_warn()  { echo -e "${YELLOW}[WARN]${NC} $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; }

# ── Kontrola root ──────────────────────────────────────────────────────
if [[ $EUID -ne 0 ]]; then
   log_error "Tento skript MUSÍ běžet jako root (sudo)."
   log_error "Spusť: sudo $0"
   exit 1
fi

echo ""
log_warn "═══════════════════════════════════════════════════════════════════"
log_warn "  POZOR: MANIPULACE S DISKEM — RIZIKO ZTRÁTY DAT"
log_warn "═══════════════════════════════════════════════════════════════════"
echo ""
log_warn "Tento skript provede:"
log_warn "  1. ZMENŠENÍ sdb2 (NTFS, 1.8 TB) o ~300 GB"
log_warn "  2. SMAZÁNÍ sdb3 (FAT32, 55.9 GB)"
log_warn "  3. VYTVOŘENÍ nové sdb3 ext4 = 300 GB"
echo ""
log_warn "Ujisti se, že:"
log_warn "  - Máš ZÁLOHU důležitých dat z /dev/sdb2"
log_warn "  - sdb3 NEOBSAHUJE důležitá data (recovery/boot)"
log_warn "  - Chápeš, že při chybě můžeš přijít o data na sdb2!"
echo ""
read -rp "Rozumíš rizikům a chceš pokračovat? Napiš 'ANO' (velkými písmeny): " confirm
if [[ "$confirm" != "ANO" ]]; then
    log_info "Zrušeno uživatelem."
    exit 0
fi

# ── Instalace nástrojů ─────────────────────────────────────────────────
log_info "Instaluji potřebné nástroje..."
apt-get update -qq
apt-get install -y -qq \
    gdisk \
    ntfs-3g \
    parted \
    e2fsprogs \
    qemu-utils \
    2>/dev/null || apt-get install -y gdisk ntfs-3g parted e2fsprogs qemu-utils

# ── Zobrazení aktuálního stavu ─────────────────────────────────────────
echo ""
log_info "Aktuální stav /dev/sdb:"
lsblk -o NAME,SIZE,TYPE,FSTYPE,FSAVAIL,MOUNTPOINT /dev/sdb

echo ""
log_info "Detail partition /dev/sdb:"
parted /dev/sdb print || true

echo ""
log_info "Zjistím volné místo na /dev/sdb2 (NTFS)..."

# Mount sdb2 temporarily
mkdir -p /tmp/sdb2-check
if mount -t ntfs-3g /dev/sdb2 /tmp/sdb2-check 2>/dev/null; then
    df -h /tmp/sdb2-check
    used_pct=$(df /tmp/sdb2-check | tail -1 | awk '{print $5}' | tr -d '%')
    avail_gb=$(df -BG /tmp/sdb2-check | tail -1 | awk '{print $4}' | tr -d 'G')
    umount /tmp/sdb2-check 2>/dev/null || true
    
    log_info "sdb2: použito ${used_pct}%, volných ${avail_gb} GB"
    
    if (( avail_gb < 350 )); then
        log_error "Na sdb2 není dostatek volného místa!"
        log_error "Dostupné: ${avail_gb} GB, potřebné: ~350 GB (300 GB + rezerva)"
        log_error "Musíš uvolnit místo na sdb2 nebo přesunout data."
        exit 1
    else
        log_ok "Dostatek volného místa: ${avail_gb} GB > 350 GB potřeba."
    fi
else
    log_warn "Nelze dočasně mountovat sdb2 pro kontrolu volného místa."
    log_warn "Pokračuji s resize na vlastní riziko — ujisti se ručně!"
    read -rp "Chceš pokračovat i tak? [y/N]: " force
    [[ "$force" == "y" || "$force" == "Y" ]] || exit 0
fi

# ── Krok 1: Zmenšit sdb2 NTFS o 300 GB ─────────────────────────────────
echo ""
log_info "Krok 1: Zmenšuji /dev/sdb2 (NTFS) o ~300 GB..."
log_warn "  Toto může trvat 10–30 minut podle zaplnění disku."
log_warn "  NEPOVÍNEJ PC a nechej proces dokončit!"

# Force check and resize NTFS
ntfsfix -b -d /dev/sdb2 2>/dev/null || true
ntfsresize --info /dev/sdb2

echo ""
read -rp "NTFS resize — pokračovat? [y/N]: " ntfs_go
[[ "$ntfs_go" == "y" || "$ntfs_go" == "Y" ]] || exit 0

# Calculate new size: current - 300 GB (in MB, rounded)
current_mb=$(parted -s /dev/sdb2 unit MB print 2>/dev/null | grep "^Disk /dev/sdb2" | awk '{print $3}' | tr -d 'MB' || echo "0")
if [[ "$current_mb" == "0" ]]; then
    # Fallback: use block count
    current_mb=$(($(cat /sys/class/block/sdb2/size) * 512 / 1024 / 1024))
fi
new_mb=$((current_mb - 307200))  # 300 GB in MB

log_info "Aktuální sdb2: ${current_mb} MB"
log_info "Nová velikost sdb2: ${new_mb} MB (uvolníme 300 GB)"

# Resize NTFS
ntfsresize --size "${new_mb}M" /dev/sdb2 || {
    log_error "NTFS resize selhal! sdb2 je možná poškozený."
    log_error "Spusť ručně: sudo ntfsresize --check /dev/sdb2"
    exit 1
}

log_ok "NTFS filesystem zmenšen na ${new_mb} MB."

# ── Krok 2: Upravit partition table (zmenšit sdb2 partition) ────────
echo ""
log_info "Krok 2: Upravuji partition table..."

# Backup GPT
sgdisk --backup=/tmp/sdb-gpt-backup.gpt /dev/sdb || true

# Delete sdb3, resize sdb2, create new sdb3
# Using sgdisk for precise sector manipulation
start_sector=$(sgdisk -i 2 /dev/sdb | grep "First sector" | awk '{print $3}' | tr -d ' ')
end_sector=$((start_sector + (new_mb * 1024 * 1024 / 512) - 1))

log_info "sdb2: First sector = $start_sector, Nový Last sector = $end_sector"

# Delete partition 3 first
sgdisk -d 3 /dev/sdb || true

# Delete and recreate partition 2 with new size
sgdisk -d 2 /dev/sdb
sgdisk -n 2:${start_sector}:${end_sector} -t 2:0700 /dev/sdb  # 0700 = Microsoft basic data (NTFS)

log_ok "Partition table aktualizován."

# ── Krok 3: Vytvořit novou sdb3 = 300 GB ext4 ──────────────────────────
echo ""
log_info "Krok 3: Vytvářím novou /dev/sdb3 (300 GB ext4)..."

# Find remaining space
last_sector=$(sgdisk -i 2 /dev/sdb | grep "Last sector" | awk '{print $3}' | tr -d ' ')
total_sectors=$(sgdisk -p /dev/sdb | grep "Disk size" | awk '{print $3}' | tr -d ' ')
# Alternative:
total_sectors=$(cat /sys/class/block/sdb/size)

# Create partition 3 from end of 2 to end of disk
sgdisk -n 3:$((last_sector + 1)):$((total_sectors - 1)) -t 3:8300 /dev/sdb  # 8300 = Linux filesystem

# Format as ext4
mkfs.ext4 -L "zion-vm-data" /dev/sdb3

log_ok "Nová partition vytvořena a naformátována."

# ── Krok 4: Verifikace a mount ────────────────────────────────────────
echo ""
log_info "Krok 4: Verifikace..."
parted /dev/sdb print
lsblk -o NAME,SIZE,TYPE,FSTYPE,LABEL /dev/sdb

# Create mount point
mkdir -p /mnt/zion-vm-data

# Add to fstab if not present
if ! grep -q "zion-vm-data" /etc/fstab; then
    uuid=$(blkid -s UUID -o value /dev/sdb3)
    echo "UUID=${uuid} /mnt/zion-vm-data ext4 defaults,noatime 0 2" >> /etc/fstab
    log_info "Přidáno do /etc/fstab: UUID=${uuid} -> /mnt/zion-vm-data"
fi

mount /dev/sdb3 /mnt/zion-vm-data
chown -R "${SUDO_USER:-$USER}:${SUDO_USER:-$USER}" /mnt/zion-vm-data

df -h /mnt/zion-vm-data

# ── Krok 5: Vytvořit VM disk pro Windows 11 ───────────────────────────
echo ""
log_info "Krok 5: Vytvářím VM disk pro Windows 11..."

vm_dir="/mnt/zion-vm-data/win11-vm"
mkdir -p "$vm_dir"

if [[ ! -f "$vm_dir/win11-disk.qcow2" ]]; then
    qemu-img create -f qcow2 "$vm_dir/win11-disk.qcow2" 250G
    log_ok "VM disk vytvořen: $vm_dir/win11-disk.qcow2 (250 GB thin)"
else
    log_ok "VM disk už existuje: $vm_dir/win11-disk.qcow2"
fi

# TPM directory
mkdir -p "$vm_dir/tpm"

# Blockchain data directory
mkdir -p /mnt/zion-vm-data/zion-blockchain

# ── Shrnutí ───────────────────────────────────────────────────────────
echo ""
log_ok "═══════════════════════════════════════════════════════════════════"
log_ok "  HOTOVÉ! Nový disk layout /dev/sdb:"
log_ok "═══════════════════════════════════════════════════════════════════"
echo ""
lsblk -o NAME,SIZE,TYPE,FSTYPE,LABEL,MOUNTPOINT /dev/sdb
echo ""
log_ok "Vytvořeno:"
log_ok "  /mnt/zion-vm-data/win11-vm/win11-disk.qcow2  = 250 GB VM disk"
log_ok "  /mnt/zion-vm-data/win11-vm/tpm/              = TPM emulátor"
log_ok "  /mnt/zion-vm-data/zion-blockchain/            = pro ZION node data"
echo ""
log_info "Další kroky:"
log_info "  1. Stáhni Windows 11 ISO:"
log_info "     wget -O /mnt/zion-vm-data/win11-vm/Win11.iso 'https://...'"
log_info ""
log_info "  2. Spusť VM instalaci:"
log_info "     sudo virt-install \\"
log_info "       --name win11-workstation \\"
log_info "       --memory 12288 --vcpus 6 \\"
log_info "       --disk path=/mnt/zion-vm-data/win11-vm/win11-disk.qcow2,bus=virtio \\"
log_info "       --cdrom /mnt/zion-vm-data/win11-vm/Win11.iso \\"
log_info "       --os-variant win11 --boot uefi \\"
log_info "       --network default --graphics spice \\"
log_info "       --video qxl --features kvm_hidden=on \\"
log_info "       --tpm emulator,version=2.0 \\"
log_info "       --noautoconsole"
log_info ""
log_info "  3. Připoj se: sudo virt-viewer --connect qemu:///system win11-workstation"
echo ""
log_ok "sda (1TB SSD s Windows 11) zůstal NEDOTČENÝ — záchranný fyzický boot."
