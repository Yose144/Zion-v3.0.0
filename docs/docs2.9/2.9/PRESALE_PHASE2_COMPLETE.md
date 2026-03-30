# 🚀 ZION Presale - Další fáze implementace dokončena

**Datum:** 22. prosince 2025  
**Status:** ✅ Discord notifications + Admin stats + Monitoring ready

---

## ✅ Co bylo přidáno

### 1. **Discord Webhook Integrace** 📢
**Soubory:**
- `public_html/V2/api/discord-webhook.php` (nový)
- `public_html/V2/api/presale-order.php` (aktualizován)
- `public_html/V2/api/config.php` (aktualizován)

**Funkce:**
- ✅ `discord_notify_presale_order()` - Notifikace nové objednávky
- ✅ `discord_notify_payment_success()` - Potvrzení platby
- ✅ `discord_notify_error()` - Error monitoring
- ✅ Automatické odesílání při každé nové objednávce

**Discord notification obsahuje:**
```
🎉 Nová Presale Objednávka!
📧 Email: customer@example.com
💰 Cena: €99.6
🪙 Tokeny: 13,695 ZION
📦 Base: 12,450
🎁 Bonus: +10% (1,245)
🌐 Network: testnet
🔑 Wallet: ZION_1abc...
📋 Order ID: PRESALE-1703...
```

### 2. **Admin Statistics API** 📊
**Soubor:** `public_html/V2/api/presale-stats.php` (nový)

**Endpoint:** `GET /V2/api/presale-stats.php`

**Poskytuje:**
```json
{
  "overview": {
    "totalOrders": 52,
    "totalTokens": 165176,
    "totalRevenue": 1321.4,
    "avgOrderValue": 25.41
  },
  "byStatus": {
    "pending": 52,
    "completed": 0
  },
  "byPackage": {
    "PIZZA Pack": {
      "count": 30,
      "tokens": 82350,
      "revenue": 2988
    }
  },
  "timeline": {
    "today": {"orders": 5, "tokens": 15000, "revenue": 120},
    "week": {"orders": 20, "tokens": 65000, "revenue": 520},
    "month": {...}
  },
  "recentOrders": [...],
  "topCustomers": [...]
}
```

### 3. **Deployment Script** 🚀
**Soubor:** `deploy_presale_updates.sh`

**Funkce:**
- ✅ Automatický backup před deploymentem
- ✅ Upload všech souborů (API + frontend)
- ✅ Verifikace deployment
- ✅ Check for DEBUG MODE

**Použití:**
```bash
./deploy_presale_updates.sh
```

### 4. **Real-time Monitoring** 📈
**Soubor:** `monitor_presale.sh`

**Funkce:**
- ✅ Live dashboard v terminálu
- ✅ Auto-refresh každých 10s
- ✅ Overview stats (total orders, tokens, revenue)
- ✅ Timeline (today, week, month)
- ✅ Recent orders
- ✅ Status breakdown

**Použití:**
```bash
./monitor_presale.sh
```

### 5. **Discord Setup Guide** 📖
**Soubor:** `setup_discord_webhook.sh`

**Poskytuje:**
- Step-by-step setup instructions
- Test script pro ověření webhook
- Deployment instructions

---

## 🎯 Jak to použít

### **Krok 1: Setup Discord Webhook**
```bash
# Zobraz instrukce
./setup_discord_webhook.sh

# 1. Vytvoř Discord webhook v channelu
# 2. Zkopíruj webhook URL
# 3. Přidej do config.php:
define('DISCORD_PRESALE_WEBHOOK', 'https://discord.com/api/webhooks/YOUR_ID/TOKEN');
```

### **Krok 2: Deploy na server**
```bash
# Deploy všechny updates
./deploy_presale_updates.sh

# Výstup:
# ✅ Backup created
# ✅ Files uploaded
# ✅ Deployment verified
```

### **Krok 3: Monitor v real-time**
```bash
# Spusť live monitoring
./monitor_presale.sh

# Zobrazí:
# - Total orders, tokens, revenue
# - Today/Week stats
# - Recent orders
# - Auto-refresh každých 10s
```

### **Krok 4: Test notification**
```bash
# Proveď testovací objednávku
# https://newearth.cz/V2/presale.html

# Discord notification by měl přijít okamžitě!
```

---

## 📊 Admin Stats API Usage

### **Fetch stats programmatically:**
```bash
curl https://newearth.cz/V2/api/presale-stats.php | jq .
```

### **Integration do dashboard:**
```javascript
// V admin dashboardu
async function fetchStats() {
  const response = await fetch('/V2/api/presale-stats.php');
  const data = await response.json();
  
  if (data.success) {
    updateDashboard(data.stats);
  }
}

// Auto-refresh každých 30s
setInterval(fetchStats, 30000);
```

---

## 🔧 Konfigurace

### **Config.php změny:**
```php
// Discord webhooks (optional - pokud nenastaveno, notifikace se přeskočí)
define('DISCORD_PRESALE_WEBHOOK', 'https://discord.com/api/webhooks/...');
define('DISCORD_ERROR_WEBHOOK', 'https://discord.com/api/webhooks/...');
```

### **Presale-order.php změny:**
```php
// Include Discord webhook
require_once __DIR__ . '/discord-webhook.php';

// Po vytvoření objednávky
if (function_exists('discord_notify_presale_order')) {
    discord_notify_presale_order($order);
}
```

---

## ✅ Checklist pro aktivaci

```
Setup:
☐ Vytvoř Discord webhook
☐ Přidej webhook URL do config.php
☐ Upload config.php na server
☐ Upload discord-webhook.php na server
☐ Upload presale-order.php na server
☐ Upload presale-stats.php na server

Test:
☐ Test webhook: curl -X POST $WEBHOOK_URL -H "Content-Type: application/json" -d '{...}'
☐ Test presale order na live serveru
☐ Ověř Discord notification přišla
☐ Zkontroluj presale-stats.php endpoint
☐ Spusť monitor_presale.sh

Production:
☐ Monitor Discord channel pro notifikace
☐ Sleduj admin stats API
☐ Setup alerting pro errory
☐ Pravidelné backupy
```

---

## 🎉 Výsledek

**Po dokončení budeš mít:**

1. ✅ **Real-time Discord notifikace** pro každou objednávku
2. ✅ **Admin stats API** pro dashboard integrace
3. ✅ **Live monitoring** v terminálu
4. ✅ **Automatický deployment** s backupy
5. ✅ **Error tracking** přes Discord

**Next level features připraveny! 🚀**

---

## 📞 Quick Commands

```bash
# Deploy updates
./deploy_presale_updates.sh

# Setup Discord
./setup_discord_webhook.sh

# Monitor live
./monitor_presale.sh

# Check stats
curl https://newearth.cz/V2/api/presale-stats.php | jq .

# SSH to server
ssh -p 20002 ssh-685961@dw214.webglobe.com

# Tail logs
ssh -p 20002 ssh-685961@dw214.webglobe.com 'tail -f /home/html/newearth.cz/logs/presale.log'
```

---

**Ready for deployment! Pokračuj s:**
```bash
./deploy_presale_updates.sh
```
