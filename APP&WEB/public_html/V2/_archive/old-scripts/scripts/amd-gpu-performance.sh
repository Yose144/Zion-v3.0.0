#!/bin/bash
echo "🚀 AMD GPU Performance Mode - For Gaming/Mining"

# Set high performance
if [ -f /sys/class/drm/card0/device/power_dpm_force_performance_level ]; then
    echo 'high' | sudo tee /sys/class/drm/card0/device/power_dpm_force_performance_level > /dev/null
    echo "   ✅ GPU performance set to HIGH"
fi

# Disable runtime PM during gaming
if [ -f /sys/class/drm/card0/device/power/control ]; then
    echo 'on' | sudo tee /sys/class/drm/card0/device/power/control > /dev/null
    echo "   ✅ GPU runtime PM disabled for performance"
fi

echo "🎯 AMD GPU ready for gaming/mining!"
