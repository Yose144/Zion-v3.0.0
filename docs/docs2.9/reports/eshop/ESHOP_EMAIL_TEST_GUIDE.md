# 🧪 ZION eShop Email Test - Quick Guide

## Co potřebujete:

1. **SMTP údaje** (máte od Webglobe):
   - Server: `mail.webglobe.cz`
   - Port: `587` (TLS) nebo `465` (SSL)
   - User: `shop@newearth.cz` nebo `presale@zion.omnity.one`
   - Password: Vaše SMTP heslo

2. **Testovací email** - kam chcete dostat test email

---

## 🚀 Způsob 1: Přes environment variable (doporučeno)

```bash
# 1. Nastavte SMTP password
export ZION_SMTP_PASSWORD="vaše_smtp_heslo"

# 2. Dry-run test (bez odeslání)
python3 scripts/test_eshop_email.py --email admin@newearth.cz

# 3. Skutečné odeslání
python3 scripts/test_eshop_email.py --email admin@newearth.cz --live
```

---

## 🚀 Způsob 2: Přes command line parametry

```bash
# S mail.webglobe.cz (port 587)
python3 scripts/test_eshop_email.py \
    --email admin@newearth.cz \
    --smtp-host mail.webglobe.cz \
    --smtp-port 587 \
    --smtp-user shop@newearth.cz \
    --smtp-password "vaše_heslo" \
    --live

# S mail.webglobe.cz (port 465 - SSL)
python3 scripts/test_eshop_email.py \
    --email admin@newearth.cz \
    --smtp-host mail.webglobe.cz \
    --smtp-port 465 \
    --smtp-user shop@newearth.cz \
    --smtp-password "vaše_heslo" \
    --live
```

---

## 🚀 Způsob 3: S presale@zion.omnity.one

```bash
python3 scripts/test_eshop_email.py \
    --email admin@newearth.cz \
    --smtp-host mail.webglobe.cz \
    --smtp-port 587 \
    --smtp-user presale@zion.omnity.one \
    --smtp-password "vaše_heslo" \
    --live
```

---

## ✅ Co se stane:

1. **Dry-run (bez --live):**
   - Načte email template
   - Vygeneruje HTML
   - Zkontroluje vše
   - **NEODEŠLE email**

2. **Live (s --live):**
   - Vše jako dry-run +
   - **Skutečně odešle email přes SMTP**
   - Dostanete konfirmaci v konzoli

---

## 📧 Jak bude vypadat email:

```
Subject: ✅ ZION eShop - Potvrzení objednávky #TEST_20251209_XXXXXX
From: ZION eShop <shop@newearth.cz>
To: admin@newearth.cz

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🟢 GREEN → 🟡 GOLD → 🔴 RED
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

⚡ ESHOP OBJEDNÁVKA ⚡

ZION TERRA NOVA

🌿 One Love • One Chain • One Future 🌿

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

✓ Jah Bless! 🙏 Objednávka přijata

Díky za důvěru! 💚 Vaše objednávka 
byla úspěšně zpracována.

📋 DETAILY OBJEDNÁVKY
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🔖 Číslo: TEST_20251209_XXXXXX
👤 Jméno: Test Zákazník
💰 Celkem: 1,599.00 Kč

🛒 POLOŽKY
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
ZION T-Shirt Rasta    2×    998 Kč
ZION Cap              1×    299 Kč
ZION Sticker Pack     1×     99 Kč

(+ Shipping, Payment info, atd.)
```

---

## ❌ Pokud nefunguje:

### 1. Zkontrolujte SMTP údaje:
```bash
# Test SMTP připojení
telnet mail.webglobe.cz 587
# Mělo by odpovědět: 220 mail.webglobe.cz ESMTP
```

### 2. Zkuste jiný port:
- Port **587** s TLS (doporučeno)
- Port **465** s SSL (fallback)

### 3. Zkontrolujte heslo:
- Použijte správné heslo pro mailbox
- Možná potřebujete "app password" místo běžného hesla

### 4. Zkuste s presale@zion.omnity.one:
```bash
python3 scripts/test_eshop_email.py \
    --email test@gmail.com \
    --smtp-user presale@zion.omnity.one \
    --smtp-password "heslo_od_presale" \
    --live
```

### 5. Logování:
- Sledujte chybové hlášky v konzoli
- Common errors:
  - `Authentication failed` → špatné heslo
  - `Connection refused` → špatný port/host
  - `SSL error` → zkuste jiný port

---

## 🎯 Doporučený test flow:

```bash
# Krok 1: Dry-run (bez odeslání)
python3 scripts/test_eshop_email.py --email admin@newearth.cz

# Pokud Krok 1 prošel ✅:
# Krok 2: Skutečné odeslání
export ZION_SMTP_PASSWORD="vaše_smtp_heslo"
python3 scripts/test_eshop_email.py --email admin@newearth.cz --live

# Zkontrolujte inbox!
```

---

## 📝 Po úspěšném testu:

1. ✅ Zkontrolujte email dorazil
2. ✅ Zkontrolujte zobrazení (desktop + mobile)
3. ✅ Zkontrolujte spam folder
4. ✅ Klikněte na odkazy (shop URL, unsubscribe)
5. ✅ Integrujte do PHP eshopu

---

**Připraveno k testování!** 🚀

Spusťte: `python3 scripts/test_eshop_email.py --email vas@email.cz --live`
