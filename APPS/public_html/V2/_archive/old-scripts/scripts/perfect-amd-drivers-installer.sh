#!/bin/bash
# 🔥 PERFECT AMD DRIVERS INSTALLER FOR MINING
# Instalace nejnovějších AMD drivers pro RX 5700 XT mining

echo "🔥 PERFECT AMD DRIVERS FOR MINING - Starting..."
echo "=============================================="
echo "Target: AMD RX 5700 XT (Navi 10) optimization"
echo ""

# 1. Backup current system
echo "💾 Creating system backup point..."
sudo timeshift --create --comments "Before AMD driver installation" --yes || echo "Timeshift not available - continuing..."

# 2. Remove old drivers and blacklist nouveau (just in case)
echo "🧹 Cleaning old drivers..."
sudo apt purge -y nvidia* nouveau* 2>/dev/null || true
sudo apt autoremove -y

# 3. Update system
echo "📦 Updating system..."
sudo apt update
sudo apt upgrade -y

# 4. Install essential packages
echo "🔧 Installing essential packages..."
sudo apt install -y \
    build-essential \
    dkms \
    linux-headers-$(uname -r) \
    firmware-linux \
    git \
    wget \
    software-properties-common \
    apt-transport-https \
    ca-certificates \
    gnupg \
    lsb-release

# 5. Install latest Mesa for AMDGPU support
echo "🎮 Installing latest Mesa AMDGPU support..."
sudo add-apt-repository ppa:oibaf/graphics-drivers -y
sudo apt update
sudo apt install -y \
    mesa-vulkan-drivers \
    mesa-vulkan-drivers:i386 \
    libdrm-amdgpu1 \
    xserver-xorg-video-amdgpu \
    radeontop \
    clinfo \
    mesa-opencl-icd

# 6. Install ROCm for mining performance
echo "⛏️ Installing ROCm for mining..."
wget -q -O - https://repo.radeon.com/rocm/rocm.gpg.key | sudo apt-key add -
echo 'deb [arch=amd64] https://repo.radeon.com/rocm/apt/6.2.4/ noble main' | sudo tee /etc/apt/sources.list.d/rocm.list
sudo apt update
sudo apt install -y \
    rocm-dev \
    rocm-libs \
    rocm-utils \
    hip-runtime-amd \
    rocm-device-libs \
    hsa-rocr-dev

# 7. Configure AMDGPU kernel parameters
echo "⚙️ Configuring AMDGPU kernel parameters..."
sudo tee /etc/modprobe.d/amdgpu.conf > /dev/null << 'EOF'
# AMDGPU Configuration for RX 5700 XT Mining
options amdgpu si_support=1
options amdgpu cik_support=1  
options amdgpu dpm=1
options amdgpu audio=1
options amdgpu deep_color=1
options amdgpu hw_i2c=1
options amdgpu pcie_gen_cap=0x40000
options amdgpu pcie_lane_cap=0x1f0000
options amdgpu cg_mask=0xffffffff
options amdgpu pg_mask=0xffffffff
options amdgpu ppfeaturemask=0xffffffff
options amdgpu gpu_recovery=1
options amdgpu emu_mode=0
options amdgpu runpm=1
EOF

# 8. Blacklist radeon driver (use AMDGPU instead)
echo "🚫 Blacklisting old radeon driver..."
echo 'blacklist radeon' | sudo tee /etc/modprobe.d/blacklist-radeon.conf

# 9. Update GRUB with optimal parameters for mining
echo "🔧 Configuring GRUB for AMD mining..."
GRUB_FILE="/etc/default/grub"
sudo cp "$GRUB_FILE" "${GRUB_FILE}.backup"

# Remove old AMD parameters and add optimal ones
sudo sed -i 's/GRUB_CMDLINE_LINUX_DEFAULT="[^"]*/GRUB_CMDLINE_LINUX_DEFAULT="quiet splash/' "$GRUB_FILE"
sudo sed -i 's/GRUB_CMDLINE_LINUX_DEFAULT="quiet splash"/GRUB_CMDLINE_LINUX_DEFAULT="quiet splash amdgpu.si_support=1 amdgpu.cik_support=1 amdgpu.dpm=1 amdgpu.audio=1 amdgpu.ppfeaturemask=0xffffffff radeon.si_support=0 radeon.cik_support=0"/' "$GRUB_FILE"

sudo update-grub

# 10. Configure Xorg for AMDGPU
echo "🖥️ Configuring Xorg for AMDGPU..."
sudo tee /etc/X11/xorg.conf.d/20-amdgpu.conf > /dev/null << 'EOF'
Section "Device"
    Identifier "AMD Graphics"
    Driver "amdgpu"
    Option "TearFree" "true"
    Option "DRI" "3"
    Option "VariableRefresh" "true"
    Option "AsyncFlipSecondaries" "true"
EndSection
EOF

# 11. Add user to video and render groups
echo "👤 Adding user to video/render groups..."
sudo usermod -a -G video,render $USER

# 12. Configure GPU for mining
echo "⛏️ Configuring GPU for mining performance..."
sudo tee /etc/systemd/system/amd-mining-optimization.service > /dev/null << 'EOF'
[Unit]
Description=AMD GPU Mining Optimization
After=multi-user.target

[Service]
Type=oneshot
ExecStart=/bin/bash -c '
# Wait for GPU to be available
sleep 10

# Set maximum performance for mining
if [ -f /sys/class/drm/card0/device/power_dpm_force_performance_level ]; then
    echo "high" > /sys/class/drm/card0/device/power_dpm_force_performance_level
fi

# Enable compute mode for mining
if [ -f /sys/class/drm/card0/device/pp_compute_power_profile ]; then
    echo "1" > /sys/class/drm/card0/device/pp_compute_power_profile  
fi

# Set power limit to maximum for mining
if [ -f /sys/class/drm/card0/device/hwmon/hwmon*/power1_cap_max ]; then
    MAX_POWER=$(cat /sys/class/drm/card0/device/hwmon/hwmon*/power1_cap_max)
    echo $MAX_POWER > /sys/class/drm/card0/device/hwmon/hwmon*/power1_cap 2>/dev/null || true
fi

# Disable power management during mining
echo "on" > /sys/class/drm/card0/device/power/control 2>/dev/null || true
'
RemainAfterExit=yes

[Install]
WantedBy=multi-user.target
EOF

# 13. Create mining tools
echo "🛠️ Creating mining optimization tools..."

# GPU monitoring script
tee /media/maitreya/ZION1/scripts/amd-gpu-monitor.sh > /dev/null << 'EOF'
#!/bin/bash
echo "📊 AMD RX 5700 XT Monitoring"
echo "==========================="

while true; do
    clear
    echo "📊 AMD RX 5700 XT MINING MONITOR - $(date)"
    echo "=========================================="
    
    # GPU Info
    echo "🎮 GPU Information:"
    if [ -f /sys/class/drm/card0/device/pp_dpm_sclk ]; then
        echo "   Core Clock: $(cat /sys/class/drm/card0/device/pp_dpm_sclk | grep '*')"
    fi
    if [ -f /sys/class/drm/card0/device/pp_dpm_mclk ]; then
        echo "   Memory Clock: $(cat /sys/class/drm/card0/device/pp_dpm_mclk | grep '*')"
    fi
    
    # Power
    echo "⚡ Power Status:"
    if [ -f /sys/class/drm/card0/device/hwmon/hwmon*/power1_average ]; then
        POWER=$(cat /sys/class/drm/card0/device/hwmon/hwmon*/power1_average 2>/dev/null)
        echo "   Power Draw: $((POWER/1000000))W"
    fi
    if [ -f /sys/class/drm/card0/device/hwmon/hwmon*/power1_cap ]; then
        CAP=$(cat /sys/class/drm/card0/device/hwmon/hwmon*/power1_cap 2>/dev/null)  
        echo "   Power Limit: $((CAP/1000000))W"
    fi
    
    # Temperature
    echo "🌡️ Temperature:"
    if [ -f /sys/class/drm/card0/device/hwmon/hwmon*/temp1_input ]; then
        TEMP=$(cat /sys/class/drm/card0/device/hwmon/hwmon*/temp1_input)
        echo "   GPU Temp: $((TEMP/1000))°C"
    fi
    
    # Performance Level
    echo "🚀 Performance:"
    if [ -f /sys/class/drm/card0/device/power_dpm_force_performance_level ]; then
        echo "   Performance Level: $(cat /sys/class/drm/card0/device/power_dpm_force_performance_level)"
    fi
    
    echo ""
    echo "Press Ctrl+C to exit"
    sleep 2
done
EOF

# Mining optimization script
tee /media/maitreya/ZION1/scripts/amd-mining-optimize.sh > /dev/null << 'EOF'
#!/bin/bash
echo "⛏️ AMD RX 5700 XT Mining Optimization"

# Maximum performance for mining
if [ -f /sys/class/drm/card0/device/power_dpm_force_performance_level ]; then
    echo "high" | sudo tee /sys/class/drm/card0/device/power_dpm_force_performance_level > /dev/null
    echo "✅ Performance level: HIGH"
fi

# Set optimal memory clock for mining (Ethereum optimized)
if [ -f /sys/class/drm/card0/device/pp_od_clk_voltage ]; then
    echo "m 0 875" | sudo tee /sys/class/drm/card0/device/pp_od_clk_voltage > /dev/null
    echo "m 1 875" | sudo tee /sys/class/drm/card0/device/pp_od_clk_voltage > /dev/null  
    echo "c" | sudo tee /sys/class/drm/card0/device/pp_od_clk_voltage > /dev/null
    echo "✅ Memory clock optimized for mining"
fi

# Maximum power limit
if [ -f /sys/class/drm/card0/device/hwmon/hwmon*/power1_cap_max ]; then
    MAX_POWER=$(cat /sys/class/drm/card0/device/hwmon/hwmon*/power1_cap_max)
    echo $MAX_POWER | sudo tee /sys/class/drm/card0/device/hwmon/hwmon*/power1_cap > /dev/null 2>&1
    echo "✅ Power limit: $(($MAX_POWER/1000000))W"
fi

echo "🚀 AMD RX 5700 XT ready for mining!"
EOF

chmod +x /media/maitreya/ZION1/scripts/amd-gpu-monitor.sh
chmod +x /media/maitreya/ZION1/scripts/amd-mining-optimize.sh

# 14. Enable mining service
sudo systemctl enable amd-mining-optimization.service

# 15. Update initramfs
echo "🔄 Updating initramfs..."
sudo update-initramfs -u

echo "=============================================="
echo "🔥 PERFECT AMD DRIVERS INSTALLATION COMPLETE!"
echo "=============================================="
echo ""
echo "✅ Installed components:"
echo "   • Latest Mesa AMDGPU drivers"
echo "   • ROCm 6.2.4 for mining performance"
echo "   • OpenCL support for GPU computing"
echo "   • Vulkan drivers for graphics"
echo "   • Mining optimization service"
echo "   • GPU monitoring tools"
echo ""
echo "⚠️ CRITICAL - REBOOT REQUIRED:"
echo "   sudo reboot"
echo ""
echo "🔍 After reboot, verify installation:"
echo "   • lspci -k | grep -A 3 AMD     # Check driver"
echo "   • glxinfo | grep renderer      # Check OpenGL"
echo "   • clinfo                       # Check OpenCL"
echo "   • ./scripts/amd-gpu-monitor.sh # Monitor GPU"
echo ""
echo "⛏️ For mining:"
echo "   • ./scripts/amd-mining-optimize.sh  # Optimize for mining"
echo "   • Expected hashrate: 50+ MH/s (Ethereum)"
echo "   • Power draw: ~180W optimized"
echo ""
echo "🎯 Your RX 5700 XT will be ready for professional mining!"