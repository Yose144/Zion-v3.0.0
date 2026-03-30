# 🚀 ZION Presale - Doporučené další kroky
**Status:** ✅ Presale živý na newearth.cz (CZ + EN)  
**Datum:** 22. prosince 2025

---

## ✅ **Co je hotové**

### Deployment
- ✅ **CZ verze** (presale.html) - DEBUG MODE odstraněn, produkční messaging
- ✅ **EN verze** (presale-en.html) - DEBUG MODE odstraněn, produkční messaging  
- ✅ **Backend API** - PRESALE_ENABLED=true, WALLET_LEDGER_API_KEY nastaven
- ✅ **Backupy** - Všechny soubory zálohovány před změnami

### Live URLs
- 🇨🇿 https://newearth.cz/V2/presale.html
- 🇬🇧 https://newearth.cz/V2/presale-en.html

---

## 🎯 **Priority 1 - Okamžitě** (dnes/zítra)

### 1. **Test plného presale flow**
```bash
# Kroky:
1. Otevři https://newearth.cz/V2/presale.html
2. Vyber balíček (např. PIZZA Pack - 2,490 Kč)
3. Vyplň email
4. Klikni "Checkout with Stripe"
5. Použij Stripe test kartu: 4242 4242 4242 4242
6. Zkontroluj:
   ✓ Email confirmation přišel
   ✓ QR kód v emailu funguje
   ✓ Wallet JSON vytvořen v /V2/wallets/
   ✓ Order JSON vytvořen v /V2/orders/
   ✓ Ledger entry v /V2/wallets/ledger.json
```

**Stripe test karty:**
- Úspěšná: `4242 4242 4242 4242`
- Declined: `4000 0000 0000 0002`
- Vyžaduje auth: `4000 0025 0000 3155`

### 2. **Monitoring nastavení**
```bash
# SSH monitoring na serveru
ssh -p 20002 ssh-685961@dw214.webglobe.com

# Sleduj logy
tail -f /home/html/newearth.cz/logs/presale.log
tail -f /home/html/newearth.cz/logs/error.log

# Kontroluj presale data
ls -lh /home/html/newearth.cz/public_html/V2/orders/
ls -lh /home/html/newearth.cz/public_html/V2/wallets/
cat /home/html/newearth.cz/public_html/V2/wallets/ledger.json | jq .
```

### 3. **Email delivery test**
```bash
# Test SMTP na serveru
php /home/html/newearth.cz/public_html/V2/api/test-mail.php

# Zkontroluj spam folder pokud email nedorazil
# Ověř DKIM/SPF nastavení domény
```

---

## 🎯 **Priority 2 - Tento týden**

### 4. **Admin Dashboard setup**
- Otevři: https://newearth.cz/V2/admin.html
- Implementuj:
  - ✓ Real-time presale stats
  - ✓ Order management (approve/reject)
  - ✓ Wallet export (pro budoucí payout)
  - ✓ Revenue tracking

### 5. **Analytics integrace**
```javascript
// Google Analytics už je (G-NHF25ZZ97S)
// Přidej Facebook Pixel (volitelné)
// Přidej Discord webhook notifikace pro nové objednávky
```

**Discord webhook setup:**
```php
// V api/presale-order.php přidej po úspěšné objednávce:
$webhook = "https://discord.com/api/webhooks/YOUR_WEBHOOK_ID";
$data = [
    'content' => "🎉 **Nová presale objednávka!**\n" .
                 "Email: {$email}\n" .
                 "Tokens: {$tokens}\n" .
                 "Cena: €{$priceEur}\n" .
                 "Balíček: {$packageName}"
];
```

### 6. **Rate limiting ajustace**
```php
// V api/rate-limiter.php zkontroluj limity:
define('RATE_LIMIT_PER_IP_HOUR', 5);     // Max 5 pokusů/hodinu z jedné IP
define('RATE_LIMIT_PER_EMAIL_DAY', 3);   // Max 3 objednávky/den z jednoho emailu
```

---

## 🎯 **Priority 3 - Tento měsíc**

### 7. **Security audit**
- [ ] Zkontroluj SQL injection body (zatím nejsou DB queries, jen JSON)
- [ ] Rate limiting test (zkus zaslat >5 requestů rychle po sobě)
- [ ] XSS test (zkus speciální znaky v inputech)
- [ ] CSRF token implementace (už je v `csrf-token.php`)
- [ ] Stripe webhook signature verification

### 8. **Performance optimalizace**
```bash
# Zapni OPcache na serveru (PHP akcelerace)
# Zkomprimuj CSS/JS (minify)
# Nastavení CDN pro statické assets (cloudflare?)
# Redis cache pro stats polling
```

### 9. **Legal & Compliance**
- [ ] Terms & Conditions aktualizovat (už existuje: terms.html)
- [ ] Privacy Policy ověřit GDPR compliance
- [ ] Cookies consent banner (pokud potřeba)
- [ ] Token sale disclaimer (securities vs utility)

---

## 🎯 **Priority 4 - Pre-MainNet**

### 10. **MainNet příprava**
```php
// Když TestNet běží stabilně, změň v wallet-lib-v3.php:
define('ZION_DEFAULT_NETWORK', 'mainnet'); // místo 'testnet'

// A v config.php:
define('STRIPE_SECRET_KEY', 'sk_live_XXX'); // Live Stripe keys
define('STRIPE_PUBLISHABLE_KEY', 'pk_live_XXX');
```

### 11. **Payout systém**
```bash
# Native wallet bude číst ledger.json a posílat tokeny:
python wallet_payout_processor.py \
  --ledger /path/to/ledger.json \
  --network mainnet \
  --dry-run  # Test nejprve
```

### 12. **Marketing launch**
- [ ] Social media kampáň (Discord, Twitter, Telegram)
- [ ] Influencer outreach (crypto YouTubers)
- [ ] Press release (CoinTelegraph, etc.)
- [ ] Community AMA (Discord/Reddit)

---

## 📊 **Metriky k sledování**

### Daily monitoring
```
- Počet nových objednávek
- Celkový objem (EUR)
- Celkové tokeny prodané
- Conversion rate (návštěvy → objednávky)
- Průměrná hodnota objednávky
- Email delivery rate
```

### Weekly review
```
- Top balíčky (PIZZA vs LAMBO vs MANSION)
- Geographic distribution (pokud máš analytics)
- Refund rate (mělo být 0%)
- Support tickets (pokud přijdou)
```

---

## 🚨 **Emergency kontakty**

### Technické problémy
```bash
# SSH produkční server
ssh -p 20002 ssh-685961@dw214.webglobe.com

# FTP přístup
ftp.newearth.cz
user: admin.newearth.cz

# Restart PHP (pokud potřeba)
sudo systemctl restart php-fpm
```

### Stripe support
- Dashboard: https://dashboard.stripe.com
- Support: support@stripe.com
- Docs: https://stripe.com/docs

### Hosting support (Webglobe)
- Web: https://www.webglobe.cz
- Telefon: +420 246 035 835
- Email: podpora@webglobe.cz

---

## ✅ **Checklist před potvrzením že vše funguje**

```
Frontend:
☐ presale.html loading bez errorů
☐ presale-en.html loading bez errorů
☐ Calculator počítá bonusy správně
☐ Package buttons fungují
☐ Stripe modal se otevírá

Backend:
☐ presale-order.php zpracovává objednávky
☐ wallet-lib-v3.php generuje V3 wallets
☐ Email confirmation odesílán
☐ QR kódy se generují
☐ Ledger tracking funguje

Payments:
☐ Stripe test mode funguje
☐ Webhook přijímá events
☐ Order status se aktualizuje

Security:
☐ Rate limiting aktivní
☐ API key auth funguje
☐ Server-side validace aktivní
☐ HTTPS certifikát platný
```

---

## 📞 **Když něco nefunguje**

### Debug kroky:
1. **Zkontroluj browser console** (F12) pro JS errory
2. **Zkontroluj network tab** pro failed API calls
3. **Zkontroluj PHP error log** na serveru
4. **Zkontroluj Stripe dashboard** pro payment events
5. **Zkontroluj email delivery** (spam folder?)

### Rychlé fixe:
```bash
# Rollback na backup (pokud potřeba)
ssh -p 20002 ssh-685961@dw214.webglobe.com
cp /home/html/newearth.cz/public_html/V2/presale.html.backup.20251222 \
   /home/html/newearth.cz/public_html/V2/presale.html

# Clear cache
php -r "opcache_reset();"

# Restart services
sudo systemctl restart nginx php-fpm
```

---

## 🎉 **Success metrics (1. měsíc)**

**Cíle:**
- 📧 **50+ objednávek** (realistický cíl pro soft launch)
- 💰 **€5,000+ revenue** (cca 100 EUR průměr)
- ⭐ **0 security incidentů**
- 📈 **90%+ email delivery rate**
- 🚀 **<2s page load time**

**Long-term (6 měsíců):**
- 500M tokenů prodaných (Phase 1 cíl)
- €4M+ total revenue
- 10,000+ holders
- TestNet → MainNet migrace úspěšná

---

**Další update:** Po prvním testovacím nákupu 🎯

*Report připraven: 22. prosince 2025*
