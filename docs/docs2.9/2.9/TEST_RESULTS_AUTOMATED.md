# ✅ ZION Presale - Automatické testy dokončeny

**Datum:** 22. prosince 2025  
**Status:** ✅ Backend připraven, ready pro manuální testy

---

## 📊 Výsledky automatických testů

### ✅ TEST 1: Presale Status
```
✅ Presale is ACTIVE (PRESALE_ENABLED = true)
```

### ✅ TEST 2: Rate Limiting
```
❌ Too many requests from this IP address
✅ Rate limiting funguje správně!
```

### ✅ TEST 3: Wallet Ledger
```json
{
  "count": 52,
  "totalTokens": 165176
}
✅ Ledger API funguje, již existuje 52 testovacích objednávek
```

### ✅ TEST 4: Stripe Configuration
```
✅ Stripe TEST mode (pk_test_...)
✅ Token price: €0.008
```

### ✅ TEST 5: Server-Side Validation
```
✅ Invalid email - rejected (422)
✅ Too few tokens - rejected (422)
✅ Price/tokens mismatch - rejected (422)
✅ Missing fields - rejected (422)
```

---

## 🎯 **Co funguje (Automaticky ověřeno)**

1. ✅ **Presale je aktivní** (PRESALE_ENABLED=true)
2. ✅ **Rate limiting** chrání proti spam (429 po 3-5 requestech)
3. ✅ **Server-side validace** odmítá nevalidní data (422)
4. ✅ **Wallet ledger** trackuje tokeny (165,176 tokens v 52 objednávkách)
5. ✅ **Stripe test mode** aktivní (pk_test_...)
6. ✅ **Config správně nasazen** (€0.008 per token)

---

## 🧪 **Nyní manuální testy (pro tebe)**

### **Krok 1: Otevři presale**
```
URL: https://newearth.cz/V2/presale.html
```

### **Krok 2: Vyber PIZZA Pack**
- Cena: 2,490 Kč
- Tokens: ~12,450 base + 10% bonus
- Klikni "Objednat PIZZA"

### **Krok 3: Vyplň údaje**
```
Email: tvuj.email@example.com
Jméno: Test User (volitelné)
```

### **Krok 4: Stripe Checkout**
**Test karta (VISA):**
```
Card:  4242 4242 4242 4242
Exp:   12/34 (jakékoli budoucí datum)
CVC:   123 (jakékoli 3 číslice)
ZIP:   12345 (jakýkoli ZIP)
```

**Další test karty:**
- **Declined:** `4000 0000 0000 0002`
- **3D Secure:** `4000 0025 0000 3155`
- **Insufficient funds:** `4000 0000 0000 9995`

### **Krok 5: Ověř výsledek**

**A) Browser:**
- [ ] Payment successful message
- [ ] Redirect na success page
- [ ] Žádné console errory

**B) Email:**
- [ ] Confirmation email dorazil (check spam!)
- [ ] Subject: "ZION Presale Order Confirmation"
- [ ] Obsahuje QR kód
- [ ] Obsahuje 12-word mnemonic
- [ ] Obsahuje order summary

**C) SSH na serveru:**
```bash
ssh -p 20002 ssh-685961@dw214.webglobe.com

# Zkontroluj novou objednávku
ls -lt /home/html/newearth.cz/public_html/V2/orders/ | head -5

# Zkontroluj wallet
ls -lt /home/html/newearth.cz/public_html/V2/wallets/ | head -5

# Zkontroluj ledger
cat /home/html/newearth.cz/public_html/V2/wallets/ledger.json | jq '.entries[-1]'

# Zkontroluj logy
tail -20 /home/html/newearth.cz/logs/presale.log
```

**D) Stripe Dashboard:**
```
URL: https://dashboard.stripe.com/test/payments

Zkontroluj:
- [ ] Nový payment je vidět
- [ ] Status: Succeeded
- [ ] Amount: správná částka
- [ ] Customer email: tvůj email
```

---

## 🔍 **Co testovat**

### Priority 1 (Musí fungovat):
- [x] ✅ Presale aktivní (automaticky ověřeno)
- [x] ✅ Rate limiting (automaticky ověřeno)
- [x] ✅ Validace (automaticky ověřeno)
- [ ] 🔄 Stripe checkout flow (manuální)
- [ ] 🔄 Wallet generation (manuální)
- [ ] 🔄 Email delivery (manuální)

### Priority 2 (Mělo by fungovat):
- [ ] 🔄 QR kód v emailu
- [ ] 🔄 Ledger tracking
- [ ] 🔄 Order JSON persistence
- [ ] 🔄 Admin dashboard update

### Priority 3 (Nice to have):
- [ ] Discord webhook notifikace
- [ ] Analytics tracking
- [ ] Mobile responsive checkout

---

## 🚨 **Pokud něco nefunguje**

### Stripe checkout se neotevírá
```bash
# Zkontroluj browser console (F12)
# Hledej JS errory
```

### Email nepřichází
```bash
# SSH na server
php /home/html/newearth.cz/public_html/V2/api/test-mail.php

# Zkontroluj spam folder
# Zkontroluj SMTP logy
```

### Payment failuje
```bash
# Zkontroluj Stripe dashboard logs
# Ověř že používáš test kartu 4242...
# Zkontroluj webhook settings
```

### Wallet negeneruje
```bash
# Zkontroluj server logy
tail -50 /home/html/newearth.cz/logs/error.log

# Zkontroluj PHP error_log
tail -50 /var/log/php-fpm/error.log
```

---

## 📋 **Checklist pro manuální test**

```
Frontend:
☐ Stránka načte bez errorů
☐ Calculator počítá správně
☐ Package buttons fungují
☐ Modal se otevírá

Stripe:
☐ Stripe modal se otevře
☐ Test karta akceptována
☐ Payment successful
☐ Redirect funguje

Backend:
☐ Order JSON vytvořen
☐ Wallet JSON vytvořen
☐ Ledger entry přidán
☐ Mnemonic vygenerován (12 slov)

Email:
☐ Email dorazil
☐ QR kód funguje
☐ Mnemonic je zobrazený
☐ Links fungují

Dashboard:
☐ Stats se aktualizovaly
☐ Nová objednávka vidět
```

---

## 🎉 **Po úspěšném testu**

Pokud všechny manuální testy proběhly OK:

1. **🚀 Presale je LIVE a ready!**
2. **📱 Sdílej link:** https://newearth.cz/V2/presale.html
3. **📊 Sleduj:** https://newearth.cz/V2/dashboard.html
4. **💬 Oznám na Discord/Twitter**
5. **📈 Začni marketing!**

---

## 🔗 **Quick Links**

- **Presale CZ:** https://newearth.cz/V2/presale.html
- **Presale EN:** https://newearth.cz/V2/presale-en.html
- **Dashboard:** https://newearth.cz/V2/dashboard.html
- **Stripe Dashboard:** https://dashboard.stripe.com/test/payments
- **Admin Orders:** https://newearth.cz/V2/admin.html

---

**Automatické testy: ✅ PASS**  
**Manuální testy: 🔄 Nyní na tobě!**

*Go test it! 🚀*
