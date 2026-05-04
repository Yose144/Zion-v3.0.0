#!/bin/bash
# V3 - minimal diagnostic - critical info LAST (tail of console buffer)
# Keep output < 3KB to avoid SMOS truncation

# Find AMD card dynamically
AMD=""
for c in /sys/class/drm/card*/device; do
  v=$(cat $c/vendor 2>/dev/null)
  if [ "$v" = "0x1002" ]; then
    AMD=$(basename $(dirname $c))
    break
  fi
done

echo "=V3= AMD_CARD=$AMD"

# dmesg amdgpu (brief)
echo "=V3= DMESG_AMDGPU:"
dmesg | grep -i amdgpu | tail -10

# OpenCL ICD files (ROOT CAUSE suspect)
echo "=V3= ICD_FILES:"
ls /etc/OpenCL/vendors/ 2>/dev/null
cat /etc/OpenCL/vendors/*.icd 2>/dev/null

# clinfo attempts
echo "=V3= CLINFO_SYS:"
clinfo --list 2>&1 | head -5
echo "=V3= CLINFO_PRO:"
/opt/amdgpu-pro/bin/clinfo 2>&1 | head -5 || /opt/rocm-6.0.3/bin/clinfo 2>&1 | head -5 || echo "none"

# DRI devices
echo "=V3= DRI:"
ls /dev/dri/ 2>/dev/null

# PCIe link (critical)
echo "=V3= PCIE:"
if [ -n "$AMD" ]; then
  DEV="/sys/class/drm/$AMD/device"
  echo "speed=$(cat $DEV/current_link_speed 2>/dev/null)"
  echo "width=$(cat $DEV/current_link_width 2>/dev/null)"
  echo "power=$(cat $DEV/hwmon/hwmon*/power1_average 2>/dev/null)"
  echo "temp=$(cat $DEV/hwmon/hwmon*/temp1_input 2>/dev/null)"
  echo "vbios=$(cat $DEV/vbios_version 2>/dev/null)"
  echo "busy=$(cat $DEV/gpu_busy_percent 2>/dev/null)"
  echo "sclk=$(cat $DEV/pp_dpm_sclk 2>/dev/null | tr '\n' ',')"
  echo "mclk=$(cat $DEV/pp_dpm_mclk 2>/dev/null | tr '\n' ',')"
  echo "driver=$(basename $(readlink $DEV/driver) 2>/dev/null)"
else
  echo "NO_AMD_CARD_FOUND"
  # fallback: list all cards
  for c in /sys/class/drm/card*/device; do
    echo "$(basename $(dirname $c)): vendor=$(cat $c/vendor 2>/dev/null) drv=$(basename $(readlink $c/driver) 2>/dev/null)"
  done
fi

echo "=V3= DONE"
# keep alive so SMOS doesn't reboot
sleep 86400