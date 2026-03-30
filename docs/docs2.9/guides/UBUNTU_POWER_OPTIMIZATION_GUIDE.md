# 🔋 UBUNTU POWER OPTIMIZATION GUIDE
## Snížení spotřeby PC pod Ubuntu - Kompletní optimalizace

### ⚡ 1. CPU POWER MANAGEMENT

#### A) CPU Governor - změna na úsporný režim:
```bash
# Zobrazit aktuální governor
cat /sys/devices/system/cpu/cpu*/cpufreq/scaling_governor

# Nastavit úsporný režim (místo performance)
sudo cpupower frequency-set -g powersave

# Nebo conservativní (balance mezi výkonem a spotřebou)
sudo cpupower frequency-set -g conservative

# Pro trvalé nastavení přidat do /etc/default/cpufrequtils:
echo 'GOVERNOR="powersave"' | sudo tee /etc/default/cpufrequtils
```

#### B) CPU Frequency scaling:
```bash
# Nastavit maximální frekvenci na 75% (například)
sudo cpupower frequency-set -u 2.5GHz

# Automatické snížení frekvence při nečinnosti
echo 'ondemand' | sudo tee /sys/devices/system/cpu/cpu*/cpufreq/scaling_governor
```

### 🖥️ 2. GPU OPTIMALIZACE

#### A) NVIDIA GPU power management:
```bash
# Nastavit GPU do persistentního úsporného režimu
sudo nvidia-smi -pm 1
sudo nvidia-smi -pl 150  # Omezit power limit na 150W (adjust podle GPU)

# Auto suspend pro NVIDIA
echo 'options nvidia NVreg_DynamicPowerManagement=0x02' | sudo tee /etc/modprobe.d/nvidia-power.conf
```

#### B) AMD GPU optimalizace:
```bash
# Povolit power management pro AMD
echo 'auto' | sudo tee /sys/class/drm/card0/device/power_dpm_force_performance_level

# Snížit GPU voltage (opatrně!)
echo 'low' | sudo tee /sys/class/drm/card0/device/power_dpm_state
```

### 💾 3. STORAGE OPTIMALIZACE

#### A) SSD power management:
```bash
# Povolit SATA link power management
echo 'med_power_with_dipm' | sudo tee /sys/class/scsi_host/host*/link_power_management_policy

# Nastavit aggressive disk power management
sudo hdparm -B 127 /dev/sda  # Hodnoty 1-127 (127 = nejvíce aggressive)
sudo hdparm -S 240 /dev/sda  # Standby po 20 minutách
```

#### B) Filesystem optimalizace:
```bash
# Mount options pro ext4 (přidat do /etc/fstab)
# noatime,commit=60,barrier=0

# Příklad fstab line:
/dev/sda1 / ext4 defaults,noatime,commit=60 0 1
```

### 🔌 4. USB & PERIPHERAL MANAGEMENT

```bash
# Automatické suspendování USB zařízení
echo 'auto' | sudo tee /sys/bus/usb/devices/*/power/control

# Vypnout Bluetooth když se nepoužívá
sudo systemctl disable bluetooth
sudo systemctl stop bluetooth

# Vypnout WiFi když použijete ethernet
sudo nmcli radio wifi off
```

### 🖱️ 5. DESKTOP ENVIRONMENT OPTIMALIZACE

#### A) GNOME optimalizace:
```bash
# Snížit animace
gsettings set org.gnome.desktop.interface enable-animations false

# Vypnout location services
gsettings set org.gnome.system.location enabled false

# Snížit Tracker indexování
systemctl --user mask tracker-extract-3.service
systemctl --user mask tracker-miner-fs-3.service
```

#### B) Background services:
```bash
# Zobrazit služby spotřebovávající nejvíce energie
systemctl --type=service --state=running

# Vypnout nepotřebné služby:
sudo systemctl disable cups-browsed    # Printer discovery
sudo systemctl disable avahi-daemon   # Network discovery
sudo systemctl disable ModemManager   # Modem management (pokud nemáte)
```

### 🌡️ 6. THERMAL MANAGEMENT

#### A) Nastavit agresivnější thermal throttling:
```bash
# Nainstalovat thermald
sudo apt install thermald

# Konfigurace v /etc/thermald/thermal-conf.xml
sudo systemctl enable thermald
sudo systemctl start thermald
```

#### B) Fan control:
```bash
# Nainstalovat fancontrol
sudo apt install lm-sensors fancontrol

# Detekce sensorů
sudo sensors-detect

# Konfigurace ventilátorů
sudo pwmconfig
sudo systemctl enable fancontrol
```

### 🔋 7. KERNEL PARAMETRY PRO ÚSPORY

#### Přidat do GRUB (/etc/default/grub):
```bash
GRUB_CMDLINE_LINUX_DEFAULT="quiet splash intel_pstate=disable pcie_aspm=force"

# Po úpravě:
sudo update-grub
```

### ⚙️ 8. ADVANCED POWER TOOLS

#### A) PowerTOP - automatická optimalizace:
```bash
sudo apt install powertop

# Kalibrace (jednou)
sudo powertop --calibrate

# Automatické aplikování všech úspor
sudo powertop --auto-tune

# Pro trvalé použití přidat do cron:
echo '@reboot root /usr/sbin/powertop --auto-tune' | sudo tee -a /etc/crontab
```

#### B) TLP - pokročilý power management:
```bash
sudo apt install tlp tlp-rdw

# Základní konfigurace v /etc/tlp.conf:
sudo nano /etc/tlp.conf

# Klíčové nastavení:
TLP_DEFAULT_MODE=BAT          # Battery mode i na AC
CPU_SCALING_GOVERNOR_ON_AC=powersave
CPU_SCALING_GOVERNOR_ON_BAT=powersave
ENERGY_PERF_POLICY_ON_AC=balance_power
RUNTIME_PM_ON_AC=auto
USB_AUTOSUSPEND=1

# Start TLP
sudo systemctl enable tlp
sudo tlp start
```

### 📊 9. MONITORING SPOTŘEBY

#### A) Monitoring tools:
```bash
# PowerTOP pro real-time monitoring
sudo powertop

# Monitoring per-process
sudo iotop
sudo htop

# Battery info
upower -i /org/freedesktop/UPower/devices/battery_BAT0
```

#### B) Benchmark spotřeby:
```bash
# Test bez optimalizací
sudo powertop --time=60 > power-before.txt

# Test s optimalizacemi  
sudo powertop --time=60 > power-after.txt
```

### 🎯 10. QUICK POWER SAVING SCRIPT

```bash
#!/bin/bash
# quick-power-save.sh

echo "🔋 Aplikování rychlých úspor energie..."

# CPU na powersave
echo 'powersave' | sudo tee /sys/devices/system/cpu/cpu*/cpufreq/scaling_governor

# GPU do úsporného režimu (NVIDIA)
sudo nvidia-smi -pl 100 2>/dev/null || true

# USB auto suspend
echo 'auto' | sudo tee /sys/bus/usb/devices/*/power/control

# Disk power management
sudo hdparm -B 127 /dev/sd* 2>/dev/null

# Network power save
sudo iw dev wlan0 set power_save on 2>/dev/null || true

# PowerTOP auto-tune
sudo powertop --auto-tune

echo "✅ Power saving applied!"
```

### 🚀 11. GAMING/PERFORMANCE RESTORE SCRIPT

```bash
#!/bin/bash  
# restore-performance.sh

echo "⚡ Obnovování výkonu pro gaming/mining..."

# CPU na performance
echo 'performance' | sudo tee /sys/devices/system/cpu/cpu*/cpufreq/scaling_governor

# GPU full power
sudo nvidia-smi -pl 300 2>/dev/null || true

# Disable USB suspend
echo 'on' | sudo tee /sys/bus/usb/devices/*/power/control

echo "🚀 Performance restored!"
```

### 💡 DOPORUČENÉ KOMBINÁCIE:

#### Denní práce (office):
- Governor: `powersave` nebo `conservative`  
- GPU: snížený power limit
- TLP active
- USB autosuspend on

#### Gaming/Mining:
- Governor: `performance`
- GPU: full power limit  
- TLP off nebo performance mode
- USB autosuspend off

#### Noční/idle:
- Vše na minimum
- Suspend after 15 min
- Aggressive disk spindown

### 📈 OČEKÁVANÉ ÚSPORY:

- **CPU optimalizace:** 20-30% snížení spotřeby
- **GPU power limit:** 15-25% úspora  
- **TLP + PowerTOP:** 10-20% další úspora
- **Celkové úspory:** 30-50% při office práci

---
**Tip:** Začni s TLP + PowerTOP pro nejlepší poměr effort/výsledek! 🎯