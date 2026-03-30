# ZION AMD GPU Mining Setup Log - 25. září 2025

## 🎯 Cíl
Rozchodit GPU mining na Ubuntu s AMD Radeon RX 5600 XT pro ZION TestNet.

## ✅ Co se podařilo

### 1. Hardware detekce
- **GPU**: AMD Radeon RX 5600 XT (Navi 10) detekována
- **CPU**: AMD Ryzen 5 3600 (6C/12T) - mining běží ✅
- **Systém**: Ubuntu 25.04 (Plucky)

### 2. Minery připraveny
- **XMRig v6.24.0**: ✅ Stažen, nakonfigurován, běží na CPU
- **SRBMiner-MULTI v2.9.7**: ✅ Stažen, detekuje algoritmy
- **Konfigurace**: Peněženky a pooly nakonfigurovány

### 3. XMRig CPU mining aktivní
```
✅ XMRig běží na AMD Ryzen 5 3600
✅ Pool: 91.98.122.165:3333 (RandomX)
✅ Wallet: Z3BDEEC2A0AE0F5D81B034308F99ECD8990D9B8B01BD9C7E7429392CA31861C6220DA3B30D74E809FA0A1FE069F1
✅ Status: Mining aktivní
```

### 4. AMD GPU ovladače - částečně
- **AMDGPU kernel modul**: ✅ Načten (lsmod | grep amdgpu)
- **ROCm OpenCL**: ✅ Nainstalován
- **Mesa OpenCL**: ✅ Nainstalován
- **OpenCL detekce**: ✅ AMD RX 5600 XT detekována přes clinfo

## ❌ Problém: SRBMiner GPU mining

### Chyba
```bash
./SRBMiner-MULTI --algorithm kawpow --pool 91.98.122.165:3334 --wallet ... --disable-cpu
Detecting GPU devices...
GPU mining disabled, OpenCL not installed ?
No devices available to mine with
```

### OpenCL status
```bash
clinfo
Number of platforms: 3
  1. Clover (Mesa) - AMD Radeon RX 5600 XT ✅ DETEKOVÁNO
  2. AMD Accelerated Parallel Processing - 0 devices
  3. rusticl - 0 devices
```

### Možné příčiny
1. **DKMS build failed**: AMD GPU DKMS modul se nepostavil správně
2. **OpenCL runtime issue**: SRBMiner nevidí Mesa OpenCL
3. **Permissions**: GPU přístupová práva
4. **Kernel compatibility**: Ubuntu 25.04 vs AMD drivers

## 🔧 Instalované komponenty

### AMD Software
```bash
- amdgpu-install_6.2.60204-1
- rocm-opencl-runtime
- mesa-opencl-icd
- libdrm-amdgpu-amdgpu1
- amdgpu kernel modul (načten)
```

### Mining Software
```bash
- XMRig 6.24.0 (CPU) ✅
- SRBMiner-MULTI 2.9.7 (GPU) ❌
```

## 📋 Další kroky po restartu

1. **Restart systému** - načtení všech kernel modulů
2. **Ověřit AMDGPU** - `lsmod | grep amdgpu`
3. **Test OpenCL** - `clinfo`
4. **Test SRBMiner** - `./SRBMiner-MULTI --list-devices`
5. **GPU permissions** - `ls -la /dev/dri/`

## 💾 Backup
- Všechny mining konfigurace: ✅ Připraveny
- Wallet backupy: ✅ V `/home/maitreya/backup-wallets/` (mimo git)
- Mining skripty: ✅ V `scripts/`

## 🚀 Mining Status
- **CPU Mining**: ✅ AKTIVNÍ (XMRig na Ryzen 5 3600)
- **GPU Mining**: ❌ Čeká na restart/driver fix
- **Pool**: ✅ 91.98.122.165:3333 (CPU), 3334 (GPU)
- **Cíl**: 60 bloků pro TestNet startup

---
**Poznámka**: CPU mining běží a těží. Po restartu by mělo GPU mining také fungovat.

## 🔄 25. září 2025 – Čistá reinstallace AMD OpenCL a příprava na restart

Po diskusi jsme zvolili cestu čistého prostředí s originálním AMD OpenCL a bez překryvů Mesa/rusticl. Provedené kroky:

### 1) Zastavení minerů a audit stavu
- Zastaveny běžící procesy `SRBMiner-MULTI` a `xmrig`.
- Ověřeny skupiny uživatele: přidán do `video, render` (aplikuje se po relogu/restartu).
- Zkontrolovány ICD soubory v `/etc/OpenCL/vendors`.

### 2) Odstranění konfliktů (Mesa/ROCm/DKMS)
- Odinstalovány balíky: `amdgpu-dkms*`, `mesa-opencl-icd`, `rocm-opencl*`, `rocm-core`, `hsa-rocr`, `comgr`, `ocl-icd-opencl-dev`, `opencl-headers*` atd.
- `autoremove` odstranil nadbytečné závislosti.

### 3) Instalace AMD OpenCL userland (bez DKMS)
- Pokus o `--opencl=pal` bez DKMS nebyl podporován na této kombinaci; nainstalován ROCm OpenCL userland z AMD repozitáře:
  - `amdgpu-core`, `rocm-core`, `rocm-opencl`, `rocm-opencl-runtime`, `rocm-opencl-icd-loader`, `hsa-rocr`, `comgr` atd.
- Deaktivovány ne-AMD ICD: `mesa.icd`, `rusticl.icd` byly odstraněny/zakázány.
- Aktuální stav vendors: pouze `amdocl64_60204_139.icd` s obsahem `libamdocl64.so`.

### 4) clinfo před restartem (očekávané)
```
Platformy: 1 (AMD Accelerated Parallel Processing)
Zařízení: 0 (očekávané před restartem)
ICD loader: Khronos 3.0.6
```

### 5) Další plán
- Restart systému, poté:
  1. `clinfo` – očekáváme GPU pod AMD APP
  2. `./SRBMiner-MULTI --list-devices` – detekce RX 5600 XT
  3. Spuštění KawPow: `--algorithm kawpow --pool 91.98.122.165:3334 --wallet <addr> --disable-cpu`

Pozn.: Mesa/rusticl ICD jsme záměrně deaktivovali, aby SRBMiner používal AMD ICD.

---
## 🟦 25. září 2025 – Test na Windows 11 a další kroky

- Proveden test CPU mineru (XMRig) na Ubuntu: miner se spustí, ale neudrží spojení s pool serverem (91.98.122.165:3333), přestože port je otevřený a pool odpovídá na Stratum JSON-RPC login.
- Ověřeno, že problém není v síti ani v poolu (ruční login funguje, port otevřený).
- Pravděpodobná příčina: problém v build/kompatibilitě XMRig na Ubuntu 25.04 nebo v interakci s knihovnami (libuv, OpenSSL, hwloc).
- Další krok: Otestovat mining na Windows 11 (W11) – pokud tam XMRig funguje, problém je čistě linuxový/kompatibilitní.
- Po testu na W11 logovat výsledek a pushnout tento log na git.

### TODO po W11 testu:
- [ ] Pokud mining na W11 funguje, otevřít issue pro Ubuntu build/debug.
- [ ] Pokud nefunguje ani na W11, zkontrolovat pool server a jeho logy.

---
_Log aktualizován: 25. září 2025_