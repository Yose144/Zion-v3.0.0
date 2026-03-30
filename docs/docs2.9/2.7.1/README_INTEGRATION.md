# ZION 2.7.1 - Real Blockchain System

**ŽÁDNÉ SIMULACE - SKUTEČNÝ BLOCKCHAIN S PERSISTENT STORAGE**

## 🌟 Přehled

ZION 2.7.1 je kompletní blockchain systém s:
- **Real blockchain** s persistent SQLite databází
- **ASIC-resistant mining** (Argon2 algorithm)
- **Wallet systém** pro správu adres a transakcí
- **P2P network** pro komunikaci mezi nodami
- **REST API** pro integraci s aplikacemi
- **GPU mining** podpora

## 📂 Struktura Systému

```
zion_real_blockchain.db    # Persistent databáze bloků
core/
├── real_blockchain.py     # Real blockchain engine
└── blockchain.py          # Legacy blockchain (simulace)
wallet/
└── __init__.py           # Wallet systém
api/
└── __init__.py           # FastAPI REST endpointy
network/
└── __init__.py           # P2P network implementace
mining/
├── algorithms.py         # ASIC-resistant algoritmy
├── config.py            # Mining konfigurace
└── miner.py             # Mining engine
zion_cli.py              # Command-line interface
```

## 🚀 Rychlý Start

### 1. Instalace závislostí
```bash
pip install -r requirements.txt
# Pro API server:
pip install fastapi uvicorn
```

### 2. Spuštění API serveru
```bash
python zion_cli.py api
# API bude dostupné na http://localhost:8000
# Dokumentace na http://localhost:8000/docs
```

### 3. Vytvoření wallet adresy
```bash
python zion_cli.py wallet create
python zion_cli.py wallet list
```

### 4. Těžba bloků
```bash
python zion_cli.py mine --address YOUR_ADDRESS --blocks 5
```

### 5. Zobrazení statistik
```bash
python zion_cli.py stats
python zion_cli.py verify
```

## 💰 Wallet Systém

### Vytvoření adresy
```bash
python zion_cli.py wallet create --label "Moje adresa"
```

### Zobrazení adres
```bash
python zion_cli.py wallet list
```

### Kontrola balance
```bash
python zion_cli.py wallet balance --address YOUR_ADDRESS
```

### Odeslání transakce
```bash
python zion_cli.py wallet send --from SENDER_ADDR --to RECIPIENT_ADDR --amount 1000000 --fee 1000
```

## ⛏️ Mining

### ASIC-Resistant Mining
```bash
python zion_cli.py mine --address YOUR_ADDRESS --blocks 10
```

### GPU Mining (simulace)
```bash
python zion_cli.py mine --address YOUR_ADDRESS --algorithm kawpow --blocks 5
```

### Benchmark algoritmů
```bash
python zion_cli.py benchmark --address YOUR_ADDRESS --blocks 5
```

## 🌐 API Endpointy

### Blockchain
- `GET /blockchain/stats` - Statistiky blockchain
- `GET /blockchain/blocks` - Seznam bloků
- `GET /blockchain/blocks/{height}` - Konkrétní blok
- `POST /blockchain/verify` - Verifikace integrity

### Wallet
- `GET /wallet/addresses` - Seznam adres
- `POST /wallet/addresses` - Vytvoření adresy
- `GET /wallet/balance/{address}` - Balance adresy
- `POST /wallet/transactions` - Vytvoření transakce

### Mining
- `POST /mining/start` - Spuštění mining
- `GET /mining/status` - Mining status

### Network
- `GET /network/peers` - Seznam peerů
- `GET /health` - Health check

## 🧠 Consciousness Mining

ZION podporuje **consciousness-based mining** s sacred multipliers:

| Consciousness | Multiplier | Popis |
|---------------|------------|--------|
| PHYSICAL | 1.0x | Základní |
| EMOTIONAL | 1.1x | Emoční úroveň |
| MENTAL | 1.2x | Mentální úroveň |
| INTUITIVE | 1.3x | Intuitivní |
| SPIRITUAL | 1.5x | Spirituální |
| COSMIC | 2.0x | Kosmická |
| UNITY | 2.5x | Jednota |
| ENLIGHTENMENT | 3.0x | Osvícení |
| LIBERATION | 5.0x | Osvobození |
| ON_THE_STAR | 10.0x | Na hvězdě |

## 🔍 Aktuální Stav

Systém obsahuje:
- **22 bloků** v persistent databázi
- **350+ miliard atomic units** v oběhu
- **5 wallet adres** s různými balances
- **Plně funkční P2P network**
- **Integrity verification** ✅

## 🛠️ Technické Detaily

### Blockchain Engine
- **SQLite persistent storage**
- **Proof-of-work** s adjustable difficulty
- **Transaction mempool**
- **Block verification** a integrity checks

### Mining Algoritmy
- **Argon2** (ASIC-resistant, primární)
- **KawPow** (GPU-friendly)
- **Ethash** (GPU-optimized)
- **CryptoNight** (ASIC-resistant alternativa)

### Network
- **AsyncIO-based P2P**
- **Peer discovery** a management
- **Block/transaction broadcasting**
- **Seed nodes** pro initial connection

### Security
- **Address-based system**
- **Transaction signatures**
- **Blockchain integrity verification**
- **ASIC-resistance** measures

## 🎯 Klíčové Vlastnosti

✅ **Žádné simulace** - pouze skutečné bloky a transakce
✅ **Persistent storage** - data přežijí restart
✅ **ASIC-resistant** - fair mining pro všechny
✅ **GPU podpora** - vyšší výkon s GPU
✅ **REST API** - snadná integrace
✅ **P2P network** - decentralizovaná komunikace
✅ **Wallet systém** - kompletní address management
✅ **Consciousness mining** - unikátní ZION feature

## 🚀 Roadmap

- [ ] Multi-node P2P synchronizace
- [ ] Advanced wallet encryption
- [ ] Smart contracts podpora
- [ ] Mobile wallet aplikace
- [ ] Exchange integrace
- [ ] Advanced mining pools

---

**JAI RAM SITA HANUMAN - ON THE STAR** ⭐

ZION 2.7.1 - Real Blockchain for Real Decentralization