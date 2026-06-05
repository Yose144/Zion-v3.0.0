#!/bin/bash
# Tento skript bezi uvnitr chroot behem buildu ZION OS
set -euo pipefail

ZION_VERSION="${1:-1.0.0}"

echo "=== ZION OS Chroot Setup (v${ZION_VERSION}) ==="

# --- Zakladni konfigurace ---
echo "[chroot] Zakladni system config..."
ln -sf /usr/share/zoneinfo/UTC /etc/localtime
echo "ZION-OS" > /etc/hostname
cat > /etc/hosts << 'EOF'
127.0.0.1 localhost
127.0.1.1 ZION-OS
EOF

# --- APT sources & update ---
cat > /etc/apt/sources.list << 'EOF'
deb http://archive.ubuntu.com/ubuntu noble main restricted universe multiverse
deb http://archive.ubuntu.com/ubuntu noble-updates main restricted universe multiverse
deb http://archive.ubuntu.com/ubuntu noble-security main restricted universe multiverse
EOF
apt-get update

# --- Kernel & boot ---
echo "[chroot] Kernel & initramfs..."
apt-get install -y --no-install-recommends linux-generic
update-initramfs -u -k all

# --- GPU Drivers ---
echo "[chroot] GPU drivers (AMD, NVIDIA, Intel)..."
# AMD ROCm + OpenCL
apt-get install -y --no-install-recommends amdgpu-pro rocm-opencl rocm-smi
# NVIDIA (headless)
apt-get install -y --no-install-recommends nvidia-driver-550-server nvidia-utils-550
# CUDA toolkit (bez GUI)
apt-get install -y --no-install-recommends cuda-toolkit-12-4 || true
# Intel
apt-get install -y --no-install-recommends intel-gpu-tools || true

# --- Runtime ---
echo "[chroot] Docker & Tailscale..."
apt-get install -y --no-install-recommends docker.io docker-compose-plugin
systemctl enable docker || true

# Tailscale (repo + install)
curl -fsSL https://pkgs.tailscale.com/stable/ubuntu/noble.noarmor.gpg | tee /usr/share/keyrings/tailscale-archive-keyring.gpg >/dev/null
curl -fsSL https://pkgs.tailscale.com/stable/ubuntu/noble.tailscale-keyring.list | tee /etc/apt/sources.list.d/tailscale.list >/dev/null
apt-get update
apt-get install -y tailscale
systemctl enable tailscaled || true

# --- ZION Binaries ---
echo "[chroot] Instalace ZION balicku..."
# Nase custom .deb balicky (predpokladame, ze jsou zkompilovane)
for pkg in /tmp/packages/*/; do
    if compgen -G "${pkg}*.deb" > /dev/null; then
        dpkg -i "${pkg}"*.deb || apt-get install -f -y
    fi
done

# --- Systemd services ---
echo "[chroot] Systemd services..."
cp /tmp/skel/etc/systemd/system/*.service /etc/systemd/system/ 2>/dev/null || true
systemctl daemon-reload
systemctl enable zion-agent.service || true
systemctl enable zion-watchdog.service || true
systemctl enable zion-ota.service || true
systemctl enable zion-telemetry.service || true
systemctl enable tailscale.service || true

# --- Skeleton config ---
echo "[chroot] Konfiguracni skeleton..."
mkdir -p /etc/zion
mkdir -p /data/zion/config
mkdir -p /data/zion/logs
mkdir -p /data/zion/wallet
mkdir -p /data/zion/cache
cp -r /tmp/skel/etc/zion/* /etc/zion/ 2>/dev/null || true

# --- Uzivatel & SSH ---
echo "[chroot] Uzivatel & SSH hardening..."
useradd -m -s /bin/bash -G sudo,docker zion || true
echo "zion:zion" | chpasswd  # Zmenit pri prvnim bootu

# SSH: pouze key-auth, zakaz root login
sed -i 's/#PermitRootLogin prohibit-password/PermitRootLogin no/' /etc/ssh/sshd_config
sed -i 's/#PasswordAuthentication yes/PasswordAuthentication no/' /etc/ssh/sshd_config
systemctl enable ssh || true

# --- Performance tuning ---
echo "[chroot] Performance tuning..."
cat >> /etc/sysctl.conf << 'EOF'
# ZION OS tuning
vm.swappiness=10
vm.vfs_cache_pressure=50
vm.dirty_ratio=10
vm.dirty_background_ratio=5
net.core.rmem_max=134217728
net.core.wmem_max=134217728
EOF

# zram for low-memory rigs
cat > /etc/systemd/system/zram.service << 'EOF'
[Unit]
Description=zram swap
After=local-fs.target

[Service]
Type=oneshot
ExecStart=/bin/bash -c 'modprobe zram && echo zstd > /sys/block/zram0/comp_algorithm && echo 2G > /sys/block/zram0/disksize && mkswap /dev/zram0 && swapon /dev/zram0 -p 10'
ExecStop=/bin/bash -c 'swapoff /dev/zram0 && rmmod zram'
RemainAfterExit=yes

[Install]
WantedBy=multi-user.target
EOF
systemctl enable zram.service || true

# --- Cleanup ---
echo "[chroot] Cleanup..."
apt-get clean
rm -rf /var/lib/apt/lists/*
rm -rf /tmp/*

echo "[chroot] Hotovo!"
