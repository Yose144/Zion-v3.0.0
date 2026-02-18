#!/bin/bash
echo "📺 ENABLING 100Hz MODE!"
echo "======================"

# Add custom 100Hz mode
xrandr --newmode "1920x1080@100" 235.50 1920 1968 2000 2080 1080 1083 1088 1120 +hsync +vsync 2>/dev/null || true

# Add mode to output
xrandr --addmode DP-1 "1920x1080@100" 2>/dev/null || true
xrandr --addmode HDMI-A-1 "1920x1080@100" 2>/dev/null || true

# Try to set 100Hz on primary display
if xrandr | grep -q "DP-1 connected"; then
    xrandr --output DP-1 --mode "1920x1080@100" 2>/dev/null && echo "✅ 100Hz enabled on DP-1!" || echo "⚠️ 100Hz failed on DP-1"
elif xrandr | grep -q "HDMI-A-1 connected"; then
    xrandr --output HDMI-A-1 --mode "1920x1080@100" 2>/dev/null && echo "✅ 100Hz enabled on HDMI!" || echo "⚠️ 100Hz failed on HDMI"
else
    echo "📺 Manual setup: xrandr --output YOUR_OUTPUT --mode 1920x1080@100"
fi

# Show current refresh rate
echo ""
echo "📊 Current display:"
xrandr | grep -E "connected|1920x1080"
