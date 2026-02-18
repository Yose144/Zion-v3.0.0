# 🌳 Tree of Life Server - ZION v2.9.5 Native Stack

> **Vytvořeno:** 28. ledna 2026  
> **Status:** 🆕 Čistá instalace - připraveno pro deployment

---

## 📋 Server Info

| Vlastnost | Hodnota |
|-----------|---------|
| **Hostname** | `TreeOfLife-Zion` |
| **IP Adresa** | `77.42.31.72` |
| **Provider** | Hetzner (Helsinki, Finland) |
| **OS** | Ubuntu 24.04 (aarch64/ARM64) |
| **Kernel** | 6.8.0-90-generic |
| **CPU** | 4 cores (ARM64) |
| **RAM** | 8 GB |
| **Disk** | 75 GB SSD (71 GB volných) |
| **Architektura** | ARM64 (aarch64) |

---

## 🔐 SSH Přístup

```bash
# Připojení k serveru
ssh -i ~/.ssh/zion_hetzner_key root@77.42.31.72
```

| Parametr | Hodnota |
|----------|---------|
| **User** | `root` |
| **Port** | `22` (default) |
| **SSH Key** | `~/.ssh/zion_hetzner_key` |
| **Auth** | Key-based (password disabled) |

---

## 📦 Nainstalovaný Software

| Software | Status | Verze |
|----------|--------|-------|
| Git | ✅ Nainstalován | 2.43.0 |
| Docker | ✅ Nainstalován | 28.2.2 |
| Docker Compose | ✅ Nainstalován | 2.37.1 |
| Rust | ✅ Nainstalován | 1.93.0 |
| Cargo | ✅ Nainstalován | 1.93.0 |
| Build Tools | ✅ Nainstalován | gcc 13.3.0 |

---

## 🚀 Deployment Checklist

### Fáze 1: Příprava prostředí
- [ ] Nainstalovat Docker + Docker Compose
- [ ] Nainstalovat Rust toolchain
- [ ] Naklonovat ZION repository
- [ ] Nakonfigurovat firewall (ufw)

### Fáze 2: Build Native Stack
- [ ] Build `zion-native/core` (blockchain)
- [ ] Build `zion-native/pool` (mining pool)
- [ ] Build `zion-universal-miner` (miner)

### Fáze 3: Spuštění služeb
- [ ] Spustit blockchain node (seed)
- [ ] Spustit mining pool
- [ ] Otestovat E2E mining

### Fáze 4: Monitoring
- [ ] Nastavit Prometheus metrics
- [ ] Nakonfigurovat logy
- [ ] Healthcheck endpoints

---

## 🌐 Plánované Porty

| Port | Služba | Popis |
|------|--------|-------|
| 22 | SSH | Vzdálený přístup |
| 80 | HTTP | Web (nginx) |
| 443 | HTTPS | Web SSL |
| 3333 | Stratum | Mining pool protokol |
| 8080 | Pool API | HTTP stats API |
| 8334 | P2P | Blockchain P2P (seed) |
| 8444 | RPC | Blockchain JSON-RPC |
| 18082 | Monero RPC | Kompatibilita |
| 9090 | Prometheus | Metrics |

---

## 🔧 Rychlé příkazy

```bash
# SSH připojení
ssh -i ~/.ssh/zion_hetzner_key root@77.42.31.72

# Kontrola zdrojů
ssh -i ~/.ssh/zion_hetzner_key root@77.42.31.72 "free -h && df -h /"

# Docker logy (po instalaci)
ssh -i ~/.ssh/zion_hetzner_key root@77.42.31.72 "docker logs -f zion-core"

# Restart služeb (po instalaci)
ssh -i ~/.ssh/zion_hetzner_key root@77.42.31.72 "docker-compose restart"
```

---

## ⚠️ Poznámky

1. **ARM64 Architektura** - Server běží na ARM procesoru, buildy musí být kompilované pro `aarch64`
2. **Čistá instalace** - Žádné předchozí ZION komponenty
3. **Hetzner Helsinki** - Nízká latence do EU, dobrá konektivita

---

## 📝 Historie změn

| Datum | Akce |
|-------|------|
| 28.01.2026 | Server vytvořen, dokumentace založena |

