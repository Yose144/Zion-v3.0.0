#!/usr/bin/env bash
set -euo pipefail

# ZION V3 — Dual-Boot / VM Strategie pro Windows 11 + Continuous ZION Stack
#
# Hardware detekováno:
#   nvme0n1 (477 GB) = Ubuntu (LVM encrypted) — aktuální OS
#   sda     (954 GB) = Verbatim SSD — Windows 11 (EFI + C: + Recovery)
#   sdb     (1.8 TB) = Seagate HDD — volný / data disk
#
# Cíl: Windows 11 pro práci + ZION stack 24/7 současně
#
# Scénáře:
#   A) Windows 11 VM s RAW disk passthrough (/dev/sda) — ZION běží na hostu
#   B) Druhý disk (sdb) = storage pro VM image — sda zůstává pro záchranný boot
#   C) Čistý dual-boot GRUB + dedikovaný ZION node (RPi/SFF/cloud)
#   D) Ubuntu host = ZION node 24/7, Windows 11 = VM na sdb, sda = backup boot

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

log_info()  { echo -e "${BLUE}[INFO]${NC} $1"; }
log_ok()    { echo -e "${GREEN}[OK]${NC} $1"; }
log_warn()  { echo -e "${YELLOW}[WARN]${NC} $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; }
log_cyan()  { echo -e "${CYAN}$1${NC}"; }

show_header() {
    clear 2>/dev/null || true
    log_cyan "╔══════════════════════════════════════════════════════════════════╗"
    log_cyan "║  ZION V3 — Windows 11 + Continuous ZION Stack Strategie        ║"
    log_cyan "╠══════════════════════════════════════════════════════════════════╣"
    log_cyan "║                                                                  ║"
    log_cyan "║  Detekované disky:                                               ║"
    log_cyan "║    nvme0n1 (477 GB) = Ubuntu  ← TY V TOMHLE TERMINÁLU           ║"
    log_cyan "║    sda     (954 GB) = Windows 11 SSD                             ║"
    log_cyan "║    sdb     (1.8 TB) = Seagate HDD                                ║"
    log_cyan "║    GPU     = AMD RX 5700 XT (OpenCL OK)                          ║"
    log_cyan "║                                                                  ║"
    log_cyan "╚══════════════════════════════════════════════════════════════════╝"
    echo ""
}

# ── Scénář A: RAW disk passthrough ────────────────────────────────────────
scenario_a_raw_disk() {
    log_info "Scénář A: Windows 11 VM s RAW disk passthrough (/dev/sda)"
    echo ""
    log_warn "VAROVÁNÍ: VM bude mít PŘÍMÝ přístup k /dev/sda!"
    log_warn "  - Při běhu VM NEBOOTUJ z /dev/sda fyzicky (conflict)"
    log_warn "  - Windows 11 může detekovat změnu HW a chtít reaktivaci"
    log_warn "  - Doporučuji zálohovat důležitá data na sda předem"
    echo ""
    read -rp "Chceš pokračovat? [y/N]: " confirm
    [[ "$confirm" == "y" || "$confirm" == "Y" ]] || return

    install_kvm

    log_info "Vytvářím Windows 11 VM s RAW disk passthrough..."

    # Create VM XML
    local vm_name="win11-raw"
    local vm_dir="$HOME/vm-win11-raw"
    mkdir -p "$vm_dir"

    # TPM
    mkdir -p "$vm_dir/tpm"
    if ! pgrep -f "swtpm.*$vm_dir" > /dev/null; then
        swtpm socket --tpm2 --tpmstate dir="$vm_dir/tpm" \
            --ctrl type=unixio,path="$vm_dir/tpm/swtpm-sock" --daemon 2>/dev/null || true
    fi

    # Create XML
    cat > "$vm_dir/win11.xml" << EOF
<domain type='kvm'>
  <name>${vm_name}</name>
  <memory unit='GiB'>12</memory>
  <currentMemory unit='GiB'>12</currentMemory>
  <vcpu placement='static'>6</vcpu>
  <os>
    <type arch='x86_64' machine='pc-q35-7.2'>hvm</type>
    <loader readonly='yes' type='pflash'>/usr/share/OVMF/OVMF_CODE_4M.fd</loader>
    <nvram template='/usr/share/OVMF/OVMF_VARS_4M.fd'>${vm_dir}/OVMF_VARS.fd</nvram>
    <boot dev='hd'/>
  </os>
  <features>
    <acpi/>
    <apic/>
    <hyperv mode='custom'>
      <relaxed state='on'/>
      <vapic state='on'/>
      <spinlocks state='on' retries='8191'/>
    </hyperv>
    <kvm>
      <hidden state='on'/>
    </kvm>
  </features>
  <cpu mode='host-passthrough' check='none' migratable='off'>
    <topology sockets='1' dies='1' cores='6' threads='1'/>
  </cpu>
  <clock offset='localtime'>
    <timer name='rtc' tickpolicy='catchup'/>
    <timer name='pit' tickpolicy='delay'/>
    <timer name='hpet' present='yes'/>
    <timer name='hypervclock' present='yes'/>
  </clock>
  <on_poweroff>destroy</on_poweroff>
  <on_reboot>restart</on_reboot>
  <on_crash>destroy</on_crash>
  <devices>
    <emulator>/usr/bin/qemu-system-x86_64</emulator>
    <disk type='block' device='disk'>
      <driver name='qemu' type='raw' cache='none' io='native'/>
      <source dev='/dev/sda'/>
      <target dev='sda' bus='sata'/>
      <address type='drive' controller='0' bus='0' target='0' unit='0'/>
    </disk>
    <controller type='sata' index='0'>
      <address type='pci' domain='0x0000' bus='0x00' slot='0x1f' function='0x2'/>
    </controller>
    <interface type='network'>
      <mac address='52:54:00:12:34:56'/>
      <source network='default'/>
      <model type='virtio'/>
      <address type='pci' domain='0x0000' bus='0x01' slot='0x00' function='0x0'/>
    </interface>
    <serial type='pty'>
      <target type='isa-serial' port='0'>
        <model name='isa-serial'/>
      </target>
    </serial>
    <console type='pty'>
      <target type='serial' port='0'/>
    </console>
    <input type='tablet' bus='usb'>
      <address type='usb' bus='0' port='1'/>
    </input>
    <input type='mouse' bus='ps2'/>
    <input type='keyboard' bus='ps2'/>
    <graphics type='spice' port='-1' autoport='yes'>
      <listen type='address'/>
      <image compression='off'/>
    </graphics>
    <sound model='ich9'>
      <address type='pci' domain='0x0000' bus='0x00' slot='0x1b' function='0x0'/>
    </sound>
    <video>
      <model type='qxl' ram='65536' vram='65536' vgamem='16384' heads='1' primary='yes'/>
      <address type='pci' domain='0x0000' bus='0x00' slot='0x01' function='0x0'/>
    </video>
    <tpm model='tpm-tis'>
      <backend type='emulator' version='2.0' path='${vm_dir}/tpm/swtpm-sock'/>
    </tpm>
    <redirdev bus='usb' type='spicevmc'>
      <address type='usb' bus='0' port='2'/>
    </redirdev>
    <redirdev bus='usb' type='spicevmc'>
      <address type='usb' bus='0' port='3'/>
    </redirdev>
    <memballoon model='virtio'>
      <address type='pci' domain='0x0000' bus='0x05' slot='0x00' function='0x0'/>
    </memballoon>
    <rng model='virtio'>
      <backend model='random'>/dev/urandom</backend>
      <address type='pci' domain='0x0000' bus='0x06' slot='0x00' function='0x0'/>
    </rng>
  </devices>
</domain>
EOF

    log_info "Definuji VM v libvirt..."
    sudo virsh define "$vm_dir/win11.xml" 2>/dev/null || \
        { log_error "Nemohu definovat VM. Zkus ručně přes virt-manager."; return 1; }

    log_ok "VM '$vm_name' definována."
    log_info "Start VM:    sudo virsh start $vm_name"
    log_info "SPICE připojení: sudo virt-viewer --connect qemu:///system $vm_name"
    log_info "RDP z Ubuntu: remmina rdp://192.168.122.x (IP se zobrazí po startu)"
    log_info "Vypni VM:    sudo virsh shutdown $vm_name"
    log_info "Zobraz IP:   sudo virsh domifaddr $vm_name"
    echo ""
    log_warn "DŮLEŽITÉ: Po spuštění VM NErestartuj PC z /dev/sda fyzicky."
    log_warn "Vždy bootuj Ubuntu na nvme0n1. Windows 11 běží POUZE ve VM."
}

# ── Scénář B: Windows 11 VM na sdb, sda = záložní boot ────────────────────
scenario_b_vm_on_sdb() {
    log_info "Scénář B: Windows 11 VM na sdb (2TB HDD), sda = fyzický záchranný boot"
    echo ""
    log_info "Tento scénář:"
    log_info "  1. Vytvoří Windows 11 VM image na sdb (200-300 GB)"
    log_info "  2. Ponechá sda nedotčený — můžeš z něj fyzicky bootovat kdykoli"
    log_info "  3. ZION stack běží na host Ubuntu 24/7"
    echo ""
    read -rp "Chceš pokračovat? [y/N]: " confirm
    [[ "$confirm" == "y" || "$confirm" == "Y" ]] || return

    install_kvm

    # Mount sdb or use it directly
    local sdb_mount="/mnt/sdb-vm"
    local vm_dir="$sdb_mount/win11-vm"
    local vm_name="win11-sdb"

    log_info "Připravuji sdb..."
    if ! mountpoint -q "$sdb_mount" 2>/dev/null; then
        sudo mkdir -p "$sdb_mount"
        # Check if sdb2 is mountable
        if sudo blkid /dev/sdb2 | grep -q "TYPE="; then
            log_info "sdb2 má existující filesystem — připojuji..."
            sudo mount /dev/sdb2 "$sdb_mount" 2>/dev/null || \
                { log_warn "Nelze připojit sdb2. Možná je to Windows disk."; \
                  log_info "Pokračuji s vytvořením image v domovském adresáři..."; \
                  vm_dir="$HOME/vm-win11-sdb"; }
        else
            log_warn "sdb2 nemá rozpoznatelný filesystem."
            log_info "Pokračuji s vytvořením image v domovském adresáři..."
            vm_dir="$HOME/vm-win11-sdb"
        fi
    fi

    mkdir -p "$vm_dir"

    log_info "Vytvářím 250 GB disk image pro VM..."
    if [[ ! -f "$vm_dir/win11-disk.qcow2" ]]; then
        qemu-img create -f qcow2 "$vm_dir/win11-disk.qcow2" 250G
        log_ok "Disk image vytvořen: $vm_dir/win11-disk.qcow2 (250 GB, thin)"
    else
        log_ok "Disk image už existuje: $vm_dir/win11-disk.qcow2"
    fi

    # TPM
    mkdir -p "$vm_dir/tpm"
    if ! pgrep -f "swtpm.*$vm_dir" > /dev/null; then
        swtpm socket --tpm2 --tpmstate dir="$vm_dir/tpm" \
            --ctrl type=unixio,path="$vm_dir/tpm/swtpm-sock" --daemon 2>/dev/null || true
    fi

    log_info "Stáhni Windows 11 ISO ručně:"
    log_info "  wget -P $vm_dir https://... (odkaz zakaždý mění, stáhni z microsoft.com)"
    echo ""
    log_info "Pak spusť instalaci přes:"
    log_info "  sudo virt-install \\"
    log_info "    --name $vm_name \\"
    log_info "    --memory 12288 --vcpus 6 \\"
    log_info "    --disk path=$vm_dir/win11-disk.qcow2,format=qcow2,bus=virtio,cache=writethrough \\"
    log_info "    --disk path=$vm_dir/Win11.iso,device=cdrom,bus=sata \\"
    log_info "    --os-variant win11 \\"
    log_info "    --boot uefi \\"
    log_info "    --network network=default,model=virtio \\"
    log_info "    --graphics spice,listen=0.0.0.0 \\"
    log_info "    --video qxl \\"
    log_info "    --features hyperv_relaxed=on,hyperv_vapic=on,hyperv_spinlocks=on,vmport=off,kvm_hidden=on \\"
    log_info "    --cpu host-passthrough,kvm=off \\"
    log_info "    --tpm model=tpm-tis,version=2.0,backend.type=emulator,backend.path=$vm_dir/tpm/swtpm-sock \\"
    log_info "    --noautoconsole"
    echo ""
    log_ok "Připraveno! sda (1TB SSD) zůstal nedotčený — můžeš z něj bootovat fyzicky."
    log_info "Když VM běží, připoj se přes: virt-viewer --connect qemu:///system $vm_name"
}

# ── Scénář C: Čistý dual-boot + dedikovaný ZION node (RPi/cloud) ────────
scenario_c_dualboot_external() {
    log_info "Scénář C: Čistý dual-boot GRUB + externí ZION node"
    echo ""
    log_info "Tento scénář:"
    log_info "  1. Nakonfiguruje GRUB pro dual-boot Ubuntu ↔ Windows 11 (sda)"
    log_info "  2. Když jsi ve Windows 11, ZION běží na EXTERNÍM zařízení:"
    log_info "     a) Raspberry Pi 4/5 (~$75) — tiše běží v rohu"
    log_info "     b) Levný SFF PC (~$100-150) — used Dell/Lenovo"
    log_info "     c) Cloud VPS (~$5-15/měsíc) — Hetzner/Contabo"
    echo ""
    log_info "Tento script nakonfiguruje GRUB. Externí zařízení musíš zajistit sám."
    read -rp "Chceš pokračovat s GRUB konfigurací? [y/N]: " confirm
    [[ "$confirm" == "y" || "$confirm" == "Y" ]] || return

    log_info "Instaluji os-prober pro GRUB Windows detekci..."
    sudo apt-get install -y os-prober

    log_info "Povoluji os-prober v GRUB..."
    if ! grep -q "^GRUB_DISABLE_OS_PROBER=false" /etc/default/grub; then
        sudo sed -i 's/^GRUB_DISABLE_OS_PROBER=.*/GRUB_DISABLE_OS_PROBER=false/' /etc/default/grub || \
            echo 'GRUB_DISABLE_OS_PROBER=false' | sudo tee -a /etc/default/grub
    fi

    log_info "Nastavuji GRUB timeout na 15 vteřin..."
    sudo sed -i 's/GRUB_TIMEOUT=.*/GRUB_TIMEOUT=15/' /etc/default/grub
    sudo sed -i 's/GRUB_TIMEOUT_STYLE=.*/GRUB_TIMEOUT_STYLE=menu/' /etc/default/grub

    log_info "Aktualizuji GRUB..."
    sudo update-grub

    log_ok "GRUB nakonfigurován."
    log_info "Při příštím restartu uvidíš:"
    log_info "  Ubuntu"
    log_info "  Windows 11 (na /dev/sda)"
    echo ""
    log_warn "DŮLEŽITÉ: Když vybereš Windows 11, ZION stack se VYPNE."
    log_warn "Pro 24/7 ZION potřebuješ externí node:"
    log_warn "  - Raspberry Pi 5 ($75) + SSD: pasivní, tichý, spotřeba 5W"
    log_warn "  - Used Dell OptiPlex SFF ($100): 4-core, 8GB RAM, pod stolem"
    log_warn "  - Hetzner VPS ($5/měsíc): nejsnazší, nezávislé na tvé síti"
    echo ""
    log_info "Následující restart nabootuje GRUB menu:"
    read -rp "Restartovat teď? [y/N]: " reboot_now
    [[ "$reboot_now" == "y" || "$reboot_now" == "Y" ]] && sudo reboot
}

# ── Scénář D: Doporučený — Ubuntu host 24/7, Windows 11 = VM, sda = passthrough ─
scenario_d_recommended() {
    log_info "Scénář D (DOPORUČENÝ): Ubuntu 24/7 ZION node + Windows 11 VM na sdb"
    echo ""
    log_ok "Výhody:"
    log_ok "  - ZION stack (node + pool + miner) běží 24/7 na Ubuntu s plnou GPU"
    log_ok "  - Windows 11 ve VM pro práci — přístup přes RDP/SPICE kdykoli"
    log_ok "  - sda (1TB SSD s Windows) zůstává jako ZÁCHRANNÁ možnost fyzického bootu"
    log_ok "  - sdb (2TB HDD) hostí VM image + ZION data"
    echo ""
    log_info "Kroky:"
    log_info "  1. sdb1 = ZION blockchain data (/data/zion-vm)"
    log_info "  2. sdb2 = Windows 11 VM image (300 GB)"
    log_info "  3. sdb3 = volný prostor pro VM storage / zálohy"
    echo ""
    read -rp "Chceš pokračovat? [y/N]: " confirm
    [[ "$confirm" == "y" || "$confirm" == "Y" ]] || return

    install_kvm

    # Prepare sdb
    local vm_base="/mnt/sdb-vm"
    sudo mkdir -p "$vm_base"

    # Try to mount sdb2 or create new partition layout
    if sudo blkid /dev/sdb2 | grep -q -E "ntfs|ext4|xfs"; then
        log_info "sdb2 má existující filesystem. Připojuji jako VM storage..."
        sudo mount /dev/sdb2 "$vm_base" 2>/dev/null || {
            log_warn "Nelze připojit sdb2. Formátuji jako ext4 pro VM storage..."
            read -rp "FORMÁTOVAT sdb2? VŠECHNA DATA BUDOU ZTRACENA! [y/N]: " fmt
            if [[ "$fmt" == "y" || "$fmt" == "Y" ]]; then
                sudo umount /dev/sdb2 2>/dev/null || true
                sudo mkfs.ext4 -L zion-vm /dev/sdb2
                sudo mount /dev/sdb2 "$vm_base"
            else
                log_info "Používám domovský adresář pro VM..."
                vm_base="$HOME/vm-storage"
                mkdir -p "$vm_base"
            fi
        }
    else
        log_warn "sdb2 nemá rozpoznatelný filesystem."
        read -rp "Vytvořit nový ext4 filesystem na sdb2? [y/N]: " fmt
        if [[ "$fmt" == "y" || "$fmt" == "Y" ]]; then
            sudo mkfs.ext4 -L zion-vm /dev/sdb2
            sudo mount /dev/sdb2 "$vm_base"
        else
            vm_base="$HOME/vm-storage"
            mkdir -p "$vm_base"
        fi
    fi

    # Create directories
    sudo mkdir -p "$vm_base/win11-vm" "$vm_base/zion-data"
    sudo chown -R "$USER:$USER" "$vm_base"

    # Create VM disk
    local vm_dir="$vm_base/win11-vm"
    if [[ ! -f "$vm_dir/win11-disk.qcow2" ]]; then
        log_info "Vytvářím 300 GB thin disk pro Windows 11 VM..."
        qemu-img create -f qcow2 "$vm_dir/win11-disk.qcow2" 300G
        log_ok "VM disk vytvořen. Skutečná spotřeba: ~5 GB (prázdný)"
    fi

    # TPM
    mkdir -p "$vm_dir/tpm"
    swtpm socket --tpm2 --tpmstate dir="$vm_dir/tpm" \
        --ctrl type=unixio,path="$vm_dir/tpm/swtpm-sock" --daemon 2>/dev/null || true

    log_ok "Připraveno!"
    echo ""
    log_info "Další kroky:"
    log_info "  1. Stáhni Windows 11 ISO do: $vm_dir/"
    log_info "     wget -O $vm_dir/Win11.iso 'https://...'"
    log_info ""
    log_info "  2. Spusť instalaci přes virt-manager nebo příkaz:"
    log_info "     sudo virt-install \\"
    log_info "       --name win11-workstation \\"
    log_info "       --memory 12288 --vcpus 6 \\"
    log_info "       --disk path=$vm_dir/win11-disk.qcow2,bus=virtio \\"
    log_info "       --cdrom $vm_dir/Win11.iso \\"
    log_info "       --os-variant win11 --boot uefi \\"
    log_info "       --network default --graphics spice \\"
    log_info "       --video qxl --features kvm_hidden=on \\"
    log_info "       --tpm emulator,version=2.0,path=$vm_dir/tpm/swtpm-sock"
    log_info ""
    log_info "  3. Připoj se přes: virt-viewer --connect qemu:///system win11-workstation"
    log_info ""
    log_info "  4. ZION data půjdou na: $vm_base/zion-data/ (připoj do docker-compose.yml)"
    echo ""
    log_ok "sda (1TB s W11) zůstává nedotčený — záchranný fyzický boot kdykoli."
    log_ok "sdb (2TB) = VM storage + ZION data."
    log_ok "nvme0n1 (477 GB) = Ubuntu host + ZION stack 24/7 + GPU mining."
}

# ── Install KVM helper ────────────────────────────────────────────────────
install_kvm() {
    log_info "Kontroluji KVM..."
    if ! command -v virsh &>/dev/null; then
        log_info "Instaluji KVM + libvirt + virt-manager..."
        sudo apt-get update
        sudo apt-get install -y \
            qemu-kvm qemu-utils qemu-system-x86 \
            libvirt-daemon-system libvirt-clients \
            virt-manager virt-viewer \
            bridge-utils ovmf swtpm swtpm-tools
        sudo usermod -aG libvirt,kvm "$USER"
        sudo systemctl enable --now libvirtd
        log_ok "KVM nainstalováno. Odhlásíš se a znovu přihlásíš pro skupiny libvirt,kvm."
        newgrp libvirt 2>/dev/null || true
        newgrp kvm 2>/dev/null || true
    else
        log_ok "KVM už je nainstalován."
    fi
}

# ── ZION stack quick-start on host ──────────────────────────────────────
start_zion_host() {
    log_info "Spouštím ZION stack na host Ubuntu (24/7)..."
    cd "$REPO_ROOT"

    source .env.zion-native 2>/dev/null || {
        log_warn ".env.zion-native nenalezeno, používám výchozí hodnoty."
    }

    export ZION_NODE_STATE_PATH="${ZION_NODE_STATE_PATH:-/tmp/zion-node-state}"
    mkdir -p "$ZION_NODE_STATE_PATH"

    # Check if already running
    if pgrep -f "target/release/node" > /dev/null; then
        log_warn "ZION node už běží!"
    else
        log_info "Spouštím node..."
        nohup "$REPO_ROOT/V3/target/release/node" > /tmp/zion-node.log 2>&1 &
        echo $! > /tmp/zion-node.pid
        sleep 3
    fi

    if pgrep -f "target/release/server" > /dev/null; then
        log_warn "ZION pool už běží!"
    else
        log_info "Spouštím pool..."
        nohup "$REPO_ROOT/V3/target/release/server" > /tmp/zion-pool.log 2>&1 &
        echo $! > /tmp/zion-pool.pid
        sleep 2
    fi

    if pgrep -f "target/release/zion-miner" > /dev/null; then
        log_warn "ZION miner už běží!"
    else
        log_info "Spouštím miner s OpenCL..."
        export ZION_GPU_BACKEND=opencl
        export ZION_GPU_WORK_SIZE=4096
        nohup "$REPO_ROOT/V3/target/release/zion-miner" > /tmp/zion-miner.log 2>&1 &
        echo $! > /tmp/zion-miner.pid
    fi

    log_ok "ZION stack spuštěn na pozadí!"
    log_info "Logy: tail -f /tmp/zion-{node,pool,miner}.log"
    log_info "Stop:  kill \$(cat /tmp/zion-{node,pool,miner}.pid)"
}

# ── Main menu ───────────────────────────────────────────────────────────
show_menu() {
    echo ""
    log_cyan "══════════════════════════════════════════════════════════════════"
    log_cyan "  VYBER SCÉNÁŘ: Windows 11 + Continuous ZION Stack"
    log_cyan "══════════════════════════════════════════════════════════════════"
    echo ""
    log_cyan "  [A] Windows 11 VM s RAW disk passthrough (/dev/sda)"
    echo "      ├─ ZION běží na Ubuntu host 24/7 s GPU"
    echo "      ├─ Windows 11 bootuje přímo z fyzického sda disku ve VM"
    echo "      ├─ Rychlost: NATIVE (sata passthrough)"
    echo "      └─ ⚠️ Risk: sda nesmíš bootovat fyzicky když VM běží"
    echo ""
    log_cyan "  [B] Windows 11 VM na sdb (2TB HDD), sda = záložní boot"
    echo "      ├─ ZION běží na Ubuntu host 24/7 s GPU"
    echo "      ├─ Windows 11 čistá instalace do VM image na sdb"
    echo "      ├─ sda zůstává nedotčený — můžeš z něj bootovat fyzicky"
    echo "      └─ Bezpečnější než A, ale pomalejší (HDD pro VM)"
    echo ""
    log_cyan "  [C] Čistý dual-boot GRUB + externí ZION node"
    echo "      ├─ GRUB menu: Ubuntu / Windows 11 na sda"
    echo "      ├─ Když Ubuntu → ZION běží lokálně na RX 5700 XT"
    echo "      ├─ Když Windows 11 → ZION běží na EXTERNÍM zařízení"
    echo "      ├─ Externí node: RPi 5 / SFF PC / Cloud VPS"
    echo "      └─ Nejflexibilnější, ale vyžaduje 2. stroj"
    echo ""
    log_cyan "  [D] DOPORUČENÝ: Ubuntu 24/7 + W11 VM na sdb + sda = záchrana"
    echo "      ├─ ZION node 24/7 na nvme0n1 (Ubuntu) s GPU mining"
    echo "      ├─ Windows 11 VM na sdb (2TB HDD) — 300 GB image"
    echo "      ├─ ZION blockchain data také na sdb"
    echo "      ├─ sda (1TB SSD s W11) = nedotčený, záchranný fyzický boot"
    echo "      └─ 🏆 Nejlepší kompromis: performance + bezpečnost + flexibilita"
    echo ""
    log_cyan "  [Z] Spustit ZION stack na hostu teď (bez VM)"
    echo ""
    log_cyan "  [Q] Konec"
    echo ""
}

main() {
    show_header

    while true; do
        show_menu
        read -rp "Vyber scénář [A/B/C/D/Z/Q]: " choice
        case "${choice^^}" in
            A) scenario_a_raw_disk; break ;;
            B) scenario_b_vm_on_sdb; break ;;
            C) scenario_c_dualboot_external; break ;;
            D) scenario_d_recommended; break ;;
            Z) start_zion_host; break ;;
            Q) log_info "Konec."; exit 0 ;;
            *) log_error "Neplatná volba."; sleep 1 ;;
        esac
    done
}

main "$@"
