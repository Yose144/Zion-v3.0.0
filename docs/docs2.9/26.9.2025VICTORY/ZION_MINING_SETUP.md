# ZION GPU Mining s peněženkami - Kompletní Setup

## 🎯 Architektura ZION Mining Ecosystem

```
ZION Blockchain Node (port 8080)
         ↕
ZION Mining Pool (multi-algo ports 3333-3338)  
         ↕
SRBMiner-Multi GPU + XMRig CPU
         ↕
ZION Wallet: Z321vzLnnRu15AF82Kwx5DVZAX8rf1jZdDThTFZERRwKV23r...
```

## 🚀 Spuštění celého systému

### 1. Spustit ZION Blockchain + Pool
```bat
start-zion-pool.bat
```
**Co se stane:**
- Spustí ZION Core v2.5.0 node
- Aktivuje multi-algorithm mining pool
- Otevře Stratum servery na portech 3333-3338
- Validuje ZION adresy (87 znaků, prefix 'Z')

### 2. Spustit GPU Mining
```bat
start-multi-algo-mining.bat
```
**Co se stane:**
- Python bridge analyzuje profitabilitu algoritmů
- SRBMiner-Multi se napojí na nejziskovější algoritmus
- GPU automaticky přepíná mezi algoritmy každých 5 min
- CPU mining jako backup (6 threads Ryzen 5 3600)

## 💰 Mining Wallet Configuration

**Hlavní ZION Wallet:**
```
Z321vzLnnRu15AF82Kwx5DVZAX8rf1jZdDThTFZERRwKV23rXUqcV5u5mvT45ZDpW71kG3zEGuM5F2n3uytvAx5G9jFSY5HcFU
```

**Pool Settings:**
- Pool Fee: 2.5%
- Minimum Payout: 0.1 ZION
- Network: zion-mainnet-v2
- Address Validation: Aktivní

## 🎮 Multi-Algorithm Ports & Rewards

| Algoritmus | Port | Hardware | Expected Rate | Block Reward |
|-----------|------|----------|---------------|--------------|
| RandomX   | 3333 | GPU/CPU  | 1200 H/s     | 2.5 ZION     |
| KawPow    | 3334 | GPU      | 8.5 MH/s     | 2.5 ZION     |
| Octopus   | 3337 | GPU      | 45 MH/s      | 2.5 ZION     |
| Ergo      | 3338 | GPU      | 85 MH/s      | 2.5 ZION     |
| Ethash    | 3335 | GPU      | 22 MH/s      | 2.5 ZION     |
| CryptoNight| 3336 | GPU/CPU  | 950 H/s      | 2.5 ZION     |

## ⚙️ Konfigurační soubory

**Hlavní konfigurace:**
- `config/zion-mining-pool.json` - Pool settings & ZION wallet
- `mining/multi-algo-pools.json` - Algoritmy s ZION adresou
- `mining/srb-*-config.json` - SRBMiner konfigurace pro jednotlivé algo

**Klíčové změny:**
- Všechny minery používají stejnou ZION wallet adresu
- Pool validuje adresy před autorizací
- Automatické přepínání na základě ziskovosti
- Native ZION blockchain integration

## 🔍 Monitoring & Statistiky

**Pool API endpoints:**
```
http://localhost:8080/mining/stats    - Pool statistiky
http://localhost:8080/mining/miners   - Aktivní miners
http://localhost:8080/mining/shares   - Share historie
```

**SRBMiner API:**
```
http://localhost:21555   - KawPow stats
http://localhost:21556   - Octopus stats  
http://localhost:21557   - Ergo stats
```

## 🛡️ Security & Validation

**Address Validation:**
- Kontrola ZION address formátu (87 znaků, prefix 'Z')
- Base58 encoding validation
- Automatic rejection neplatných adres

**Pool Security:**
- 2.5% pool fee pro provoz
- Minimum payout 0.1 ZION
- Share validation per algorithm
- Worker authentication

## 📊 Expected Profitability

**AMD RX 5600 XT Performance:**
```
KawPow:  8.5 MH/s  → ~$2.30/day
Octopus: 45 MH/s   → ~$4.20/day  
Ergo:    85 MH/s   → ~$3.80/day
```

**Automatic Switching:**
Python bridge každých 5 minut:
1. Stáhne network stats pro všechny algoritmy
2. Vypočítá ziskovost na základě difficulty
3. Přepne na nejziskovější algoritmus
4. Loguje všechny změny

## 🚀 Rychlé spuštění

```bat
# 1. Spustit ZION blockchain + pool
start-zion-pool.bat

# 2. Počkat 10 sekund na inicializaci

# 3. Spustit GPU mining  
start-multi-algo-mining.bat

# 4. Monitoring v browseru
http://localhost:8080/mining/stats
```

Systém je nyní nakonfigurován pro produkční ZION mining s automatickým přepínáním algoritmů a skutečnými ZION peněženkami! 🎯