# 🚀 ZION GPU Mining Setup with SRBMiner-Multi

## 📋 **QUICK START GUIDE**

### 1️⃣ **Download SRBMiner-Multi**
```powershell
# Create mining directory
mkdir "C:\ZionMining\SRBMiner-Multi" -Force
cd "C:\ZionMining\SRBMiner-Multi"

# Download latest SRBMiner-Multi
Invoke-WebRequest -Uri "https://github.com/doktor83/SRBMiner-Multi/releases/download/2.9.7/SRBMiner-Multi-2-9-7-win64.zip" -OutFile "SRBMiner-Multi-2-9-7.zip"

# Extract
Expand-Archive -Path "SRBMiner-Multi-2-9-7.zip" -DestinationPath "." -Force
```

### 2️⃣ **GPU Mining Configuration**

#### **RandomX (ZION Primary Algorithm)**
```json
{
  "algorithm": "randomx",
  "pool": "localhost:3333",
  "wallet": "Z321nirFfsdGcAE8Loe1vzcZS9ztUvsTCYsYKYsncA63QqjqQyMnLiedvZSnniUsfE93Zdvu5tpkvC2qNVpDf4ot9q1UJUBMap",
  "password": "gpu-randomx-rig",
  "worker": "gpu-miner-01",
  "gpu_boost": 100,
  "gpu_threads": 16,
  "cpu_threads": 0,
  "log_file": "srbminer-randomx.log",
  "gpu_conf": [
    {
      "id": 0,
      "threads": 16,
      "worksize": 8,
      "intensity": 20
    }
  ]
}
```

#### **KawPow (Alternative Algorithm)**
```json
{
  "algorithm": "kawpow",
  "pool": "localhost:3334",
  "wallet": "Z321nirFfsdGcAE8Loe1vzcZS9ztUvsTCYsYKYsncA63QqjqQyMnLiedvZSnniUsfE93Zdvu5tpkvC2qNVpDf4ot9q1UJUBMap",
  "password": "gpu-kawpow-rig",
  "worker": "gpu-miner-01",
  "gpu_boost": 100,
  "cpu_threads": 0
}
```

### 3️⃣ **Optimized GPU Commands**

#### **NVIDIA GeForce (RTX/GTX Series)**
```bat
@echo off
echo 🚀 ZION GPU Mining - NVIDIA
echo ============================

SRBMiner-MULTI.exe ^
  --algorithm randomx ^
  --pool localhost:3333 ^
  --wallet Z321nirFfsdGcAE8Loe1vzcZS9ztUvsTCYsYKYsncA63QqjqQyMnLiedvZSnniUsfE93Zdvu5tpkvC2qNVpDf4ot9q1UJUBMap ^
  --password gpu-nvidia-rig ^
  --gpu-id 0 ^
  --gpu-threads 16 ^
  --gpu-worksize 8 ^
  --gpu-intensity 20 ^
  --cpu-threads 0 ^
  --disable-cpu ^
  --log-file srbminer-nvidia.log ^
  --api-enable --api-port 21555
```

#### **AMD Radeon (RX Series)**  
```bat
@echo off
echo 🚀 ZION GPU Mining - AMD
echo ========================

SRBMiner-MULTI.exe ^
  --algorithm randomx ^
  --pool localhost:3333 ^
  --wallet Z321nirFfsdGcAE8Loe1vzcZS9ztUvsTCYsYKYsncA63QqjqQyMnLiedvZSnniUsfE93Zdvu5tpkvC2qNVpDf4ot9q1UJUBMap ^
  --password gpu-amd-rig ^
  --gpu-id 0 ^
  --gpu-threads 18 ^
  --gpu-worksize 256 ^
  --gpu-intensity 25 ^
  --cpu-threads 0 ^
  --disable-cpu ^
  --log-file srbminer-amd.log ^
  --api-enable --api-port 21555
```

### 4️⃣ **Multi-Algorithm Auto-Switching**
```bat
@echo off
echo 🎮 ZION Multi-Algorithm GPU Mining
echo ==================================

REM Start with RandomX (primary)
start "ZION-RandomX" SRBMiner-MULTI.exe --algorithm randomx --pool localhost:3333 --wallet Z321nirFfsdGcAE8Loe1vzcZS9ztUvsTCYsYKYsncA63QqjqQyMnLiedvZSnniUsfE93Zdvu5tpkvC2qNVpDf4ot9q1UJUBMap --gpu-id 0 --disable-cpu

REM Wait 30 seconds, then check profitability
timeout /t 30

REM Switch to KawPow if more profitable
REM (This would be automated by profit-switching script)
```

## 🔧 **PERFORMANCE OPTIMIZATION**

### **Hardware-Specific Settings**

#### **RTX 4090 / RTX 4080**
- **Threads**: 20-24
- **Worksize**: 8-16  
- **Intensity**: 25-30
- **Memory**: 16-24GB
- **Expected**: 25-35 kH/s (RandomX)

#### **RTX 3080 / RTX 3070** 
- **Threads**: 16-20
- **Worksize**: 8
- **Intensity**: 20-25
- **Memory**: 8-12GB  
- **Expected**: 15-25 kH/s (RandomX)

#### **RX 6800 XT / RX 6700 XT**
- **Threads**: 18-22
- **Worksize**: 256
- **Intensity**: 25-30
- **Memory**: 8-16GB
- **Expected**: 20-30 kH/s (RandomX)

#### **RX 580 / RX 570**
- **Threads**: 14-16  
- **Worksize**: 256
- **Intensity**: 20
- **Memory**: 4-8GB
- **Expected**: 8-12 kH/s (RandomX)

## 📊 **Monitoring & Statistics**

### **SRBMiner API Endpoints**
```bash
# GPU Stats
curl http://localhost:21555/api/stats

# Current Hashrate  
curl http://localhost:21555/api/hashrate

# GPU Temperature
curl http://localhost:21555/api/temperature
```

### **Web Dashboard**
- **SRBMiner Stats**: http://localhost:21555
- **ZION Pool Stats**: http://localhost:8080/mining/stats
- **XMRig CPU API**: http://localhost:16000

## 🎯 **NEXT STEPS**

1. **Download SRBMiner-Multi** (link above)
2. **Create GPU mining directory** structure
3. **Configure GPU-specific settings** based on your hardware
4. **Start GPU mining** alongside CPU mining
5. **Monitor performance** via web dashboards
6. **Optimize settings** for maximum hashrate

## 💡 **Pro Tips**

- **Kombinujte CPU + GPU**: XMRig (CPU) + SRBMiner (GPU) současně
- **Monitor teploty**: GPU temp should stay under 80°C
- **Power limit**: Set GPU power limit to 85-90% for efficiency  
- **Memory overclock**: +500-1000 MHz na GPU memory for RandomX
- **Core undervolt**: -100 až -200 mV pro nižší spotřebu

---

> **🔥 Ready to start GPU mining? Let's configure your specific GPU model!**