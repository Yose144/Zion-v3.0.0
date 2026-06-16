#!/bin/bash
# Auto-generated optimal refresh rate script
echo "🚀 Setting optimal 80Hz mode..."

# Generate and apply optimal mode
modeline=$(cvt 1920 1080 80 | grep Modeline | sed 's/Modeline //')
mode_name=$(echo $modeline | cut -d' ' -f1 | tr -d '"')
mode_params=$(echo $modeline | cut -d' ' -f2-)

xrandr --newmode "$mode_name" $mode_params 2>/dev/null
xrandr --addmode DP-3 "$mode_name" 2>/dev/null  
xrandr --output DP-3 --mode "$mode_name"

echo "✅ 80Hz activated!"
xrandr | grep "*"
