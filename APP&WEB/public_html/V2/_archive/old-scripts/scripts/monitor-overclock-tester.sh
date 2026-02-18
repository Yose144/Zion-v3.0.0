#!/bin/bash
# 🚀 MONITOR OVERCLOCK TESTER - Progressive refresh rate testing
# Tests multiple refresh rates to find monitor's maximum capability

echo "🚀 MONITOR OVERCLOCK TESTER"
echo "=========================="
echo "🎯 Testing progressive refresh rates on DP-3"
echo ""

# Current display info
echo "📺 Current display:"
xrandr | grep -E "DP-3.*connected"
echo ""

# Test refresh rates from safe to aggressive
RATES=(60 65 70 75 80 85 90 95 100 110 120 144)

for rate in "${RATES[@]}"; do
    echo "🔄 Testing ${rate}Hz..."
    
    # Generate modeline
    modeline=$(cvt 1920 1080 $rate | grep Modeline | sed 's/Modeline //')
    mode_name=$(echo $modeline | cut -d' ' -f1 | tr -d '"')
    mode_params=$(echo $modeline | cut -d' ' -f2-)
    
    # Try to add and set the mode
    xrandr --newmode "$mode_name" $mode_params 2>/dev/null
    xrandr --addmode DP-3 "$mode_name" 2>/dev/null
    
    if xrandr --output DP-3 --mode "$mode_name" 2>/dev/null; then
        sleep 2
        current_mode=$(xrandr | grep "*" | head -1)
        
        if echo "$current_mode" | grep -q "$rate"; then
            echo "   ✅ ${rate}Hz WORKS! ✅"
            echo "   Mode: $current_mode"
            
            # Ask user if it looks stable
            echo ""
            echo "🤔 Does ${rate}Hz look stable? No flickering? (y/n/s=skip to next)"
            echo "   Press 's' to skip, 'n' to stop here, 'y' to continue testing higher rates"
            
            # Auto-timeout after 10 seconds
            if read -t 10 -n 1 response; then
                echo ""
                case $response in
                    y|Y) 
                        echo "   👍 Continuing to test higher rates..."
                        LAST_WORKING=$rate
                        ;;
                    s|S)
                        echo "   ⏭️  Skipping to next rate..."
                        ;;
                    *)
                        echo "   🛑 Stopping at ${rate}Hz - this seems to be the limit"
                        FINAL_RATE=$rate
                        break
                        ;;
                esac
            else
                echo ""
                echo "   ⏱️  No response - continuing (assuming it works)"
                LAST_WORKING=$rate
            fi
        else
            echo "   ❌ ${rate}Hz failed - reverted to 60Hz"
            if [ ! -z "$LAST_WORKING" ]; then
                echo "   📋 Last working rate was: ${LAST_WORKING}Hz"
            fi
        fi
    else
        echo "   ❌ ${rate}Hz rejected by driver/monitor"
        if [ ! -z "$LAST_WORKING" ]; then
            echo "   📋 Last working rate was: ${LAST_WORKING}Hz"
            break
        fi
    fi
    
    echo ""
done

# Set final optimal rate
if [ ! -z "$FINAL_RATE" ]; then
    OPTIMAL_RATE=$FINAL_RATE
elif [ ! -z "$LAST_WORKING" ]; then
    OPTIMAL_RATE=$LAST_WORKING
else
    OPTIMAL_RATE=60
fi

echo "=========================="
echo "🏆 MONITOR OVERCLOCK RESULTS:"
echo "=========================="
echo "📊 Optimal refresh rate: ${OPTIMAL_RATE}Hz"
echo ""

if [ "$OPTIMAL_RATE" -gt 60 ]; then
    echo "🎉 SUCCESS! Your monitor supports overclocking!"
    echo "📈 Improvement: +$((OPTIMAL_RATE - 60))Hz over standard 60Hz"
    echo ""
    
    # Create permanent script for this rate
    cat > /media/maitreya/ZION1/scripts/set-optimal-refresh.sh << EOF
#!/bin/bash
# Auto-generated optimal refresh rate script
echo "🚀 Setting optimal ${OPTIMAL_RATE}Hz mode..."

# Generate and apply optimal mode
modeline=\$(cvt 1920 1080 $OPTIMAL_RATE | grep Modeline | sed 's/Modeline //')
mode_name=\$(echo \$modeline | cut -d' ' -f1 | tr -d '"')
mode_params=\$(echo \$modeline | cut -d' ' -f2-)

xrandr --newmode "\$mode_name" \$mode_params 2>/dev/null
xrandr --addmode DP-3 "\$mode_name" 2>/dev/null  
xrandr --output DP-3 --mode "\$mode_name"

echo "✅ ${OPTIMAL_RATE}Hz activated!"
xrandr | grep "*"
EOF

    chmod +x /media/maitreya/ZION1/scripts/set-optimal-refresh.sh
    
    echo "💾 Created permanent script: ./scripts/set-optimal-refresh.sh"
    echo ""
    echo "🔄 Apply optimal rate now? (y/n)"
    read -t 5 -n 1 apply_now
    if [[ $apply_now =~ [yY] ]]; then
        bash /media/maitreya/ZION1/scripts/set-optimal-refresh.sh
    fi
    
else
    echo "😔 No overclocking possible - monitor limited to 60Hz"
    echo "💡 This is normal for many monitors"
fi

echo ""
echo "🎯 For gaming/mining performance:"
echo "   • Use optimal refresh rate: ${OPTIMAL_RATE}Hz"  
echo "   • Enable FreeSync/G-Sync if available"
echo "   • Consider upgrading to 144Hz gaming monitor"