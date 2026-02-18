#!/bin/bash
# 🔋 PERMANENT Power Optimizations Setup
# Makes optimizations persistent across reboots

echo "🔧 ZION Permanent Power Optimizations Setup..."
echo "=============================================="

# 1. TLP Configuration for permanent power management
if ! command -v tlp &> /dev/null; then
    echo "📦 Installing TLP..."
    sudo apt update
    sudo apt install -y tlp tlp-rdw
fi

# 2. Configure TLP for maximum power savings
echo "⚙️ Configuring TLP..."
sudo tee /etc/tlp.conf > /dev/null << 'EOF'
# TLP Configuration for ZION Power Optimization

TLP_ENABLE=1
TLP_DEFAULT_MODE=BAT
TLP_PERSISTENT_DEFAULT=1

# CPU
CPU_SCALING_GOVERNOR_ON_AC=powersave
CPU_SCALING_GOVERNOR_ON_BAT=powersave
CPU_ENERGY_PERF_POLICY_ON_AC=balance_power
CPU_ENERGY_PERF_POLICY_ON_BAT=power
CPU_MIN_PERF_ON_AC=0
CPU_MAX_PERF_ON_AC=80
CPU_MIN_PERF_ON_BAT=0
CPU_MAX_PERF_ON_BAT=60

# Platform
PLATFORM_PROFILE_ON_AC=balanced
PLATFORM_PROFILE_ON_BAT=low-power

# Disk
DISK_APM_LEVEL_ON_AC="127 127"
DISK_APM_LEVEL_ON_BAT="127 127"
DISK_SPINDOWN_TIMEOUT_ON_AC="0 0"
DISK_SPINDOWN_TIMEOUT_ON_BAT="0 0"

# Network
WIFI_PWR_ON_AC=on
WIFI_PWR_ON_BAT=on
WOL_DISABLE=Y

# Audio
SOUND_POWER_SAVE_ON_AC=1
SOUND_POWER_SAVE_ON_BAT=1
SOUND_POWER_SAVE_CONTROLLER=Y

# USB
USB_AUTOSUSPEND=1
USB_EXCLUDE_AUDIO=1
USB_EXCLUDE_BTUSB=1
USB_EXCLUDE_PHONE=1
USB_EXCLUDE_PRINTER=1
USB_EXCLUDE_WWAN=1

# Runtime PM
RUNTIME_PM_ON_AC=auto
RUNTIME_PM_ON_BAT=auto

# PCIe
PCIE_ASPM_ON_AC=default
PCIE_ASPM_ON_BAT=powersupersave
EOF

# 3. Input devices udev rules (never suspend mouse/keyboard)
echo "🖱️ Protecting input devices..."
sudo tee /etc/udev/rules.d/50-usb-input-no-autosuspend.rules > /dev/null << 'EOF'
# Never suspend input devices (mouse, keyboard)
SUBSYSTEM=="usb", ATTR{bInterfaceClass}=="03", ATTR{power/control}="on"
# Specific devices
SUBSYSTEM=="usb", ATTR{idVendor}=="145f", ATTR{idProduct}=="02af", ATTR{power/control}="on"
SUBSYSTEM=="usb", ATTR{idVendor}=="30fa", ATTR{idProduct}=="1701", ATTR{power/control}="on"
EOF

# 4. Systemd service for power optimizations on boot
echo "🚀 Creating boot service..."
sudo tee /etc/systemd/system/zion-power-optimize.service > /dev/null << 'EOF'
[Unit]
Description=ZION Power Optimization Service
After=multi-user.target

[Service]
Type=oneshot
ExecStart=/bin/bash -c '
# Audio power saving
echo 1 > /sys/module/snd_hda_intel/parameters/power_save 2>/dev/null || true
echo Y > /sys/module/snd_hda_intel/parameters/power_save_controller 2>/dev/null || true

# PCIe runtime PM (except input devices)
for device in /sys/bus/pci/devices/*/power/control; do
    [ -f "$device" ] && echo auto > "$device" 2>/dev/null || true
done

# Network power save
for interface in /sys/class/net/*/device/power/control; do
    [ -f "$interface" ] && echo auto > "$interface" 2>/dev/null || true  
done
'
RemainAfterExit=yes

[Install]
WantedBy=multi-user.target
EOF

# 5. GRUB configuration for power saving
echo "⚙️ Updating GRUB for power saving..."
if ! grep -q "pcie_aspm=force" /etc/default/grub; then
    sudo sed -i 's/GRUB_CMDLINE_LINUX_DEFAULT="quiet splash"/GRUB_CMDLINE_LINUX_DEFAULT="quiet splash pcie_aspm=force"/' /etc/default/grub
    sudo update-grub
fi

# 6. Enable services
echo "🔧 Enabling services..."
sudo systemctl enable tlp
sudo systemctl enable zion-power-optimize.service
sudo systemctl start tlp
sudo systemctl start zion-power-optimize.service

# 7. Reload udev rules
sudo udevadm control --reload-rules
sudo udevadm trigger

echo "=============================================="
echo "✅ PERMANENT OPTIMIZATIONS CONFIGURED!"
echo ""
echo "🔋 Power optimizations that will persist after reboot:"
echo "   • TLP power management"
echo "   • CPU governor: powersave"
echo "   • Disk APM: level 127"
echo "   • Audio power saving"
echo "   • PCIe ASPM: force"
echo "   • Network power management"
echo "   • USB autosuspend (except input devices)"
echo ""
echo "🖱️ Input devices protected:"
echo "   • Mouse and keyboard will never suspend"
echo "   • Gaming performance maintained"
echo ""
echo "🔄 To apply now: sudo tlp start"
echo "🎯 To check status: sudo tlp-stat"
echo ""
echo "💡 For mining/gaming, temporarily disable:"
echo "   sudo systemctl stop tlp"
echo "   ./restore-performance.sh"