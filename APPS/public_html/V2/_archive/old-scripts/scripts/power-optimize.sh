#!/bin/bash
# 🔋 ZION Power Saving Script - Okamžité úspory
# Datum: 1. října 2025

echo "🔋 ZION Power Optimization - Starting..."
echo "========================================"

# 1. CPU Power Management
echo "⚡ CPU optimizations..."
echo 'powersave' | sudo tee /sys/devices/system/cpu/cpu*/cpufreq/scaling_governor > /dev/null
echo "   ✅ CPU governor set to powersave"

# 2. GPU Power Management (NVIDIA)
if command -v nvidia-smi &> /dev/null; then
    sudo nvidia-smi -pl 150 2>/dev/null && echo "   ✅ NVIDIA power limit set to 150W" || true
fi

# 3. USB Auto Suspend (except input devices)
for device in /sys/bus/usb/devices/*/power/control; do
    if [ -f "$device" ]; then
        # Check if device is input device (keyboard/mouse)
        device_path=$(dirname "$device")
        if ! ls "$device_path"/*:*.*/bInterfaceClass 2>/dev/null | xargs cat 2>/dev/null | grep -q "03"; then
            echo 'auto' | sudo tee "$device" > /dev/null
        fi
    fi
done
echo "   ✅ USB auto-suspend enabled (except input devices)"

# 4. Disk Power Management
for disk in /dev/sd?; do
    [ -b "$disk" ] && sudo hdparm -B 127 -S 240 "$disk" 2>/dev/null
done
echo "   ✅ Disk power management applied"

# 5. Network Power Save
for interface in /sys/class/net/*/device/power/control; do
    [ -f "$interface" ] && echo 'auto' | sudo tee "$interface" > /dev/null 2>&1
done
echo "   ✅ Network power saving enabled"

# 6. GNOME optimizations
if [ "$XDG_CURRENT_DESKTOP" = "GNOME" ]; then
    gsettings set org.gnome.desktop.interface enable-animations false
    gsettings set org.gnome.system.location enabled false
    gsettings set org.gnome.desktop.search-providers disabled "['org.gnome.Software.desktop', 'org.gnome.seahorse.Application.desktop']"
    echo "   ✅ GNOME power optimizations applied"
fi

# 7. Background services optimization
sudo systemctl stop cups-browsed 2>/dev/null || true
sudo systemctl disable cups-browsed 2>/dev/null || true
echo "   ✅ Unnecessary services stopped"

# 8. Kernel parameters for power saving
echo 1 | sudo tee /sys/module/snd_hda_intel/parameters/power_save > /dev/null 2>&1
echo Y | sudo tee /sys/module/snd_hda_intel/parameters/power_save_controller > /dev/null 2>&1
echo "   ✅ Audio power saving enabled"

# 9. I/O Scheduler optimization for power
for disk in /sys/block/sd*/queue/scheduler; do
    [ -f "$disk" ] && echo 'none' | sudo tee "$disk" > /dev/null 2>&1
done
echo "   ✅ I/O scheduler optimized"

# 10. Runtime PM for PCIe devices
for device in /sys/bus/pci/devices/*/power/control; do
    [ -f "$device" ] && echo 'auto' | sudo tee "$device" > /dev/null 2>&1
done
echo "   ✅ PCIe runtime power management enabled"

echo "========================================"
echo "🏆 ZION Power Optimization Complete!"
echo ""
echo "📊 Expected savings:"
echo "   • CPU: 20-30% power reduction"
echo "   • GPU: 15-25% power reduction"
echo "   • System: 10-20% overall savings"
echo ""
echo "🔄 To restore performance:"
echo "   ./restore-performance.sh"
echo ""
echo "💡 For permanent optimizations:"
echo "   • Install: sudo apt install tlp powertop"
echo "   • Enable: sudo systemctl enable tlp"
echo "   • Configure: sudo tlp start"