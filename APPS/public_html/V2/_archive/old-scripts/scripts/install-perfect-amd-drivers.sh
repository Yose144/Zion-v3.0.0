#!/bin/bash
# 🚀 PERFECT AMD DRIVERS INSTALLER + 100Hz Monitor Support!
# Ultimate AMD GPU setup for mining + gaming + overclocking

echo "🚀 PERFECT AMD DRIVERS + MONITOR OVERCLOCK INSTALLER"
echo "===================================================="
echo "🎯 Target: RX 5700 XT perfection + 100Hz+ monitor!"
echo ""

# 1. Remove old/conflicting drivers
echo "🧹 Cleaning old drivers..."
sudo apt remove --purge -y xserver-xorg-video-ati xserver-xorg-video-radeon 2>/dev/null || true
sudo apt autoremove -y

# 2. Add AMD official repository
echo "📦 Adding AMD official repository..."
wget -qO - https://repo.radeon.com/rocm/rocm.gpg.key | sudo apt-key add -
echo 'deb [arch=amd64] https://repo.radeon.com/amdgpu/latest/ubuntu jammy main' | sudo tee /etc/apt/sources.list.d/amdgpu.list
echo 'deb [arch=amd64] https://repo.radeon.com/rocm/apt/debian jammy main' | sudo tee /etc/apt/sources.list.d/rocm.list

# 3. Update package list
sudo apt update

# 4. Install PERFECT AMD drivers stack
echo "⚡ Installing PERFECT AMD drivers..."
sudo apt install -y \
    amdgpu-dkms \
    amdgpu-pro \
    amdgpu-pro-core \
    libgl1-amdgpu-pro-glx \
    libgles2-amdgpu-pro \
    libegl1-amdgpu-pro \
    libdrm-amdgpu1 \
    xserver-xorg-video-amdgpu \
    vulkan-amdgpu-pro \
    opencl-amdgpu-pro-icd \
    rocm-dev \
    rocm-libs \
    rocm-opencl-dev

# 5. Install mining tools
echo "⛏️ Installing mining essentials..."
sudo apt install -y \
    mesa-opencl-icd \
    clinfo \
    radeontop \
    amdgpu-fan

# 6. Configure AMDGPU module for MAXIMUM performance
echo "🔧 Configuring AMDGPU for MAXIMUM performance..."
sudo tee /etc/modprobe.d/amdgpu-perfect.conf > /dev/null << 'EOF'
# PERFECT AMDGPU Configuration for RX 5700 XT
options amdgpu si_support=1
options amdgpu cik_support=1  
options amdgpu dpm=1
options amdgpu audio=1
options amdgpu bapm=0
options amdgpu runpm=0
options amdgpu deep_color=1
options amdgpu hw_i2c=1
options amdgpu pcie_gen_cap=0x40000
options amdgpu pcie_lane_cap=0x1f0000
options amdgpu cg_mask=0xffffffff
options amdgpu pg_mask=0xffffffff
options amdgpu ppfeaturemask=0xffffffff
EOF

# 7. GRUB configuration for PERFECT AMD + 100Hz support
echo "⚙️ Updating GRUB for PERFECT performance..."
GRUB_LINE="quiet splash amdgpu.si_support=1 amdgpu.cik_support=1 amdgpu.dpm=1 amdgpu.audio=1 amdgpu.ppfeaturemask=0xffffffff video=DP-1:1920x1080@100 drm.edid_firmware=DP-1:edid/1920x1080@100hz.bin"

sudo sed -i "s/GRUB_CMDLINE_LINUX_DEFAULT=\".*\"/GRUB_CMDLINE_LINUX_DEFAULT=\"$GRUB_LINE\"/" /etc/default/grub

# 8. Create custom EDID for 100Hz+ support
echo "📺 Creating 100Hz+ monitor support..."
sudo mkdir -p /lib/firmware/edid

# Create 100Hz EDID binary (1920x1080@100Hz)
sudo tee /lib/firmware/edid/1920x1080@100hz.bin > /dev/null << 'EOF'
# Custom EDID for 100Hz support - will be created by script
EOF

# Generate actual EDID (simplified version)
python3 << 'PYTHON_EOF'
import struct

# Create basic EDID structure for 1920x1080@100Hz
edid_data = bytearray(256)

# EDID header
edid_data[0:8] = [0x00, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0x00]

# Manufacturer ID (Generic)
edid_data[8:10] = [0x22, 0xF0]

# Product code  
edid_data[10:12] = [0x00, 0x00]

# Serial number
edid_data[12:16] = [0x01, 0x01, 0x01, 0x01]

# Week/year of manufacture
edid_data[16:18] = [0x01, 0x20]

# EDID version
edid_data[18:20] = [0x01, 0x04]

# Basic display parameters
edid_data[20] = 0x80  # Digital input
edid_data[21] = 0x50  # Max H image size
edid_data[22] = 0x2D  # Max V image size  
edid_data[23] = 0x78  # Gamma
edid_data[24] = 0x0A  # Features

# Color characteristics (simplified)
edid_data[25:35] = [0x0D, 0xC9, 0xA0, 0x57, 0x47, 0x98, 0x27, 0x12, 0x48, 0x4C]

# Established timings
edid_data[35:38] = [0x21, 0x08, 0x00]

# Standard timings (8 entries)
for i in range(8):
    edid_data[38 + i*2:40 + i*2] = [0x01, 0x01]  # Unused

# Detailed timing descriptor 1: 1920x1080@100Hz
# Pixel clock = 235.50 MHz
pixel_clock = int(235.50 * 100)  # in 10kHz units
edid_data[54:56] = struct.pack('<H', pixel_clock)

# Horizontal active/blanking
edid_data[56] = 0x80  # H active low 8 bits (1920 & 0xFF)
edid_data[57] = 0x38  # H blanking low 8 bits (280 & 0xFF) 
edid_data[58] = 0x70  # H active/blanking high 4 bits

# Vertical active/blanking  
edid_data[59] = 0x38  # V active low 8 bits (1080 & 0xFF)
edid_data[60] = 0x28  # V blanking low 8 bits (40 & 0xFF)
edid_data[61] = 0x40  # V active/blanking high 4 bits

# Sync timing
edid_data[62:66] = [0x68, 0xB0, 0x36, 0x00]

# Image size
edid_data[66:68] = [0x50, 0x2D]

# Border/flags
edid_data[68:71] = [0x00, 0x00, 0x1E]

# Remaining descriptors (monitor name, etc.)
edid_data[71:89] = [0x00] * 18  # Descriptor 2
edid_data[89:107] = [0x00] * 18  # Descriptor 3  
edid_data[107:125] = [0x00] * 18  # Descriptor 4

# Extension flag
edid_data[126] = 0x00

# Checksum
checksum = (256 - sum(edid_data[:127])) % 256
edid_data[127] = checksum

# Write binary EDID
with open('/tmp/1920x1080@100hz.bin', 'wb') as f:
    f.write(edid_data)

print("✅ 100Hz EDID created")
PYTHON_EOF

sudo mv /tmp/1920x1080@100hz.bin /lib/firmware/edid/

# 9. Create Xorg configuration for 100Hz+
echo "🖥️ Creating Xorg config for 100Hz+ support..."
sudo tee /etc/X11/xorg.conf.d/20-amdgpu-100hz.conf > /dev/null << 'EOF'
Section "Device"
    Identifier "AMD GPU"
    Driver "amdgpu" 
    Option "TearFree" "true"
    Option "DRI" "3"
    Option "VariableRefresh" "true"
    Option "AsyncFlipSecondaries" "true"
EndSection

Section "Monitor"
    Identifier "DP-1"
    Option "PreferredMode" "1920x1080"
    Modeline "1920x1080@100" 235.50 1920 1968 2000 2080 1080 1083 1088 1120 +hsync +vsync
EndSection

Section "Screen"
    Identifier "Screen0"
    Device "AMD GPU" 
    Monitor "DP-1"
    DefaultDepth 24
    SubSection "Display"
        Depth 24
        Modes "1920x1080@100" "1920x1080"
    EndSubSection
EndSection
EOF

# 10. Update GRUB and initramfs
sudo update-grub
sudo update-initramfs -u

# 11. Create monitoring and overclock tools
echo "🔧 Creating GPU monitoring tools..."

# GPU status script
tee /media/maitreya/ZION1/scripts/gpu-status.sh > /dev/null << 'EOF'
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
EOF

chmod +x /media/maitreya/ZION1/scripts/gpu-status.sh

# 12. Create 100Hz activation script
tee /media/maitreya/ZION1/scripts/enable-100hz.sh > /dev/null << 'EOF'
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
EOF

chmod +x /media/maitreya/ZION1/scripts/enable-100hz.sh

echo "===================================================="
echo "✅ PERFECT AMD DRIVERS + 100Hz INSTALLATION COMPLETE!"
echo ""
echo "🚀 What was installed:"
echo "   • AMD Official Pro Drivers (latest)"
echo "   • AMDGPU kernel module (optimized)"  
echo "   • Vulkan + OpenCL support"
echo "   • ROCm for mining"
echo "   • 100Hz monitor support"
echo "   • Custom EDID for high refresh rates"
echo ""
echo "⚠️ REBOOT REQUIRED for drivers to load!"
echo ""
echo "🎯 After reboot:"
echo "   • Check: ./scripts/gpu-status.sh"
echo "   • Enable 100Hz: ./scripts/enable-100hz.sh"  
echo "   • Test mining: clinfo"
echo "   • Monitor: radeontop"
echo ""
echo "💫 Your RX 5700 XT will be PERFECT for mining + 100Hz gaming!"
echo ""
echo "🔄 REBOOT NOW? (y/n)"