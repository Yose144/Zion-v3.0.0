#!/bin/bash
# 🚀 ZION Performance Restore Script - Obnovení výkonu
# Datum: 1. října 2025

echo "🚀 ZION Performance Restore - Starting..."
echo "========================================="

# 1. CPU Performance Mode
echo "⚡ Restoring CPU performance..."
echo 'performance' | sudo tee /sys/devices/system/cpu/cpu*/cpufreq/scaling_governor > /dev/null
echo "   ✅ CPU governor set to performance"

# 2. GPU Full Power (NVIDIA)
if command -v nvidia-smi &> /dev/null; then
    sudo nvidia-smi -pl 300 2>/dev/null && echo "   ✅ NVIDIA power limit restored to 300W" || true
fi

# 3. USB Full Power
for device in /sys/bus/usb/devices/*/power/control; do
    [ -f "$device" ] && echo 'on' | sudo tee "$device" > /dev/null
done
echo "   ✅ USB power management disabled"

# 4. Network Full Performance
for interface in /sys/class/net/*/device/power/control; do
    [ -f "$interface" ] && echo 'on' | sudo tee "$interface" > /dev/null 2>&1
done
echo "   ✅ Network power saving disabled"

# 5. GNOME Performance Mode
if [ "$XDG_CURRENT_DESKTOP" = "GNOME" ]; then
    gsettings set org.gnome.desktop.interface enable-animations true
    echo "   ✅ GNOME animations restored"
fi

# 6. Disable audio power saving
echo 0 | sudo tee /sys/module/snd_hda_intel/parameters/power_save > /dev/null 2>&1
echo "   ✅ Audio power saving disabled"

# 7. PCIe devices full power
for device in /sys/bus/pci/devices/*/power/control; do
    [ -f "$device" ] && echo 'on' | sudo tee "$device" > /dev/null 2>&1
done
echo "   ✅ PCIe devices full power"

# 8. I/O Performance
for disk in /sys/block/sd*/queue/scheduler; do
    [ -f "$disk" ] && echo 'mq-deadline' | sudo tee "$disk" > /dev/null 2>&1
done
echo "   ✅ I/O scheduler restored to performance"

echo "========================================="
echo "🏆 ZION Performance Restored!"
echo ""
echo "🎯 System ready for:"
echo "   • Gaming"
echo "   • Mining (6K+ H/s)"
echo "   • Heavy workloads"
echo ""
echo "🔋 To optimize for power saving:"
echo "   ./power-optimize.sh"