#!/bin/bash
echo "🎮 AMD GPU STATUS - RX 5700 XT"
echo "=============================="

# Driver info
echo "📋 Driver: $(glxinfo | grep "OpenGL renderer" 2>/dev/null || echo 'Driver loading...')"

# GPU clocks and power
if [ -f /sys/class/drm/card0/device/pp_dpm_sclk ]; then
    echo "⚡ GPU Clocks:"
    cat /sys/class/drm/card0/device/pp_dpm_sclk 2>/dev/null | head -10
else
    echo "⚠️ GPU clocks not available (driver loading)"
fi

# Temperature
sensors 2>/dev/null | grep -A5 "amdgpu" || echo "🌡️ Temperature sensors loading..."

# Current display mode
xrandr 2>/dev/null | grep "connected" | head -3

echo ""
echo "🚀 For 100Hz: xrandr --output DP-1 --mode 1920x1080@100"
echo "⛏️ Mining ready: clinfo | grep 'Device Name'"
