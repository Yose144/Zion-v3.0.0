# 🛒 ZION eShop - Status Report
**Datum kontroly:** 1. prosince 2025

---

## ✅ Stav systému: PŘIPRAVEN K SPUŠTĚNÍ

Po kontrole všech komponent je systém připraven k produkčnímu nasazení. Níže jsou uvedeny všechny komponenty a jejich stav.

---

## 📁 Struktura souborů

### API Backend (`/V2/api/`)
| Soubor | Stav | Popis |
|--------|------|-------|
| `config.php` | ✅ OK | Konfigurace API klíčů (nutno doplnit produkční klíče) |
| `public-config.php` | ✅ OK | Veřejná konfigurace pro frontend |
| `create-order.php` | ✅ OK | Vytvoření objednávky + email + faktura |
| `admin-orders.php` | ✅ OK | Admin API (list, detail, update-status, stats) |
| `invoice-generator.php` | ✅ OK | Generátor HTML faktur |
| `invoice.php` | ✅ OK | API endpoint pro faktury |
| `stripe-checkout.php` | ✅ OK | Stripe Checkout Session |
| `stripe-webhook.php` | ✅ OK | Stripe webhook handler |
| `wallet-lib.php` | ✅ OK | ZION wallet knihovna |
| `wallet-qr.php` | ✅ OK | QR kód generátor |
| `wallet-ledger.php` | ✅ OK | Token ledger API |

### Frontend (`/V2/`)
| Soubor | Stav | Popis |
|--------|------|-------|
| `shop.html` | ✅ OK | Hlavní stránka obchodu |
| `cart.html` | ✅ OK | Košík + checkout |
| `order-success.html` | ✅ OK | Potvrzení objednávky |
| `terms.html` | ✅ OK | Obchodní podmínky (VOP) |
| `shopping-guide.html` | ✅ OK | Nákupní rád |
| `admin.html` | ✅ OK | Admin dashboard |

### JavaScript (`/V2/`)
| Soubor | Stav | Popis |
|--------|------|-------|
| `products.js` | ✅ OK | Katalog produktů + CATEGORY_NAMES |
| `cart.js` | ✅ OK | Cart funkce (localStorage) |
| `checkout.js` | ✅ OK | Checkout logika, validace, Stripe |
| `shop-ui.js` | ✅ OK | UI interakce shopu |

### Datové složky
| Složka | Stav | Popis |
|--------|------|-------|
| `/V2/orders/` | ✅ Vytvořeno | JSON soubory objednávek |
| `/V2/wallets/` | ✅ Existuje | ZION wallet JSON + QR obrázky |
| `/V2/invoices/` | ✅ Vytvořeno | HTML faktury |

---

## 🔧 Konfigurace - CO DOPLNIT

### 1. Stripe (Platební brána)
Soubor: `api/config.php`
```php
define('STRIPE_SECRET_KEY', 'sk_live_XXXX');        // Produkční secret key
define('STRIPE_PUBLISHABLE_KEY', 'pk_live_XXXX');   // Produkční publishable key
define('STRIPE_WEBHOOK_SECRET', 'whsec_XXXX');      // Webhook secret
// Presale hybrid integrace (volitelné): Python FastAPI webhook URL
// Pokud je nastaveno, stripe-webhook.php bude forwardovat presale eventy
define('PYTHON_PRESALE_WEBHOOK_URL', 'http://127.0.0.1:8000/presale/webhook/stripe');
```

**Stripe Dashboard:**
1. https://dashboard.stripe.com/apikeys
2. Webhooks → Add endpoint: `https://zionterranova.com/V2/api/stripe-webhook.php`
3. Events: `checkout.session.completed`, `payment_intent.succeeded`
4. (Volitelné) Metadata flag pro presale: přidat `presale=true` do Checkout Session metadata, aby se webhook forwardnul do Pythonu.

### 2. Zásilkovna
Soubor: `api/config.php`
```php
define('ZASILKOVNA_API_KEY', 'XXXX');
```

**Zásilkovna:**
1. https://client.packeta.com/
2. Klientská sekce → Nastavení → API heslo

---

## 🏢 Firemní údaje

Všechny právní dokumenty obsahují:
- **Firma:** Omnity.One s.r.o.
- **IČO:** 09120050
- **DIČ:** CZ09120050
- **Sídlo:** Horní Čermná, 56156
- **Banka:** Fio banka, 2901809148/2010
- **IBAN:** CZ63 2010 0000 0029 0180 9148

**Aktualizováno v:**
- ✅ `terms.html` - Obchodní podmínky
- ✅ `shopping-guide.html` - Nákupní rád
- ✅ `order-success.html` - Platební údaje
- ✅ `create-order.php` - Email s platebními údaji
- ✅ `invoice-generator.php` - Faktury
- ✅ `shop.html` - Footer
- ✅ `cart.html` - Footer

---

## 💳 Platební metody

| Metoda | Stav | Implementace |
|--------|------|--------------|
| Kartou (Stripe) | ✅ Připraveno | `stripe-checkout.php` |
| Bankovní převod | ✅ Připraveno | Údaje v emailu + success page |
| Dobírka | ✅ Připraveno | `create-order.php` |

---

## 🚚 Doprava

| Dopravce | Cena | Implementace |
|----------|------|--------------|
| Zásilkovna - výdejní místo | 79 Kč | Widget v6 |
| Zásilkovna - na adresu | 119 Kč | Widget v6 |
| Virtuální nákup | Zdarma | Digitální fulfillment |

---

## 🎁 ZION Token systém

| Komponenta | Stav |
|------------|------|
| Výpočet tokenů | ✅ OK |
| Generování wallet | ✅ OK |
| QR kód (QuickChart) | ✅ OK |
| Ledger evidence | ✅ OK |
| Email s QR | ✅ OK |

---

## 📧 Email notifikace

| Typ | Příjemce | Obsah |
|-----|----------|-------|
| Potvrzení objednávky | Zákazník | Položky, platební údaje, ZION QR, odkaz na fakturu |
| Notifikace | Admin | Kompletní detaily objednávky |

---

## 🧾 Fakturační systém

| Funkce | Stav |
|--------|------|
| Auto-generování při objednávce | ✅ OK |
| HTML faktura s DPH 21% | ✅ OK |
| Odkaz v emailu | ✅ OK |
| Zobrazení v admin dashboardu | ✅ OK |
| Regenerace faktury | ✅ OK |

---

## 🔐 Bezpečnost

| Položka | Stav |
|---------|------|
| GDPR checkbox při checkout | ✅ Implementováno |
| Admin auth (Basic Auth) | ✅ admin:zion2025 |
| Stripe webhook signature | ✅ Připraveno |
| Presale Python webhook URL | ✅ Volitelné, nastavte `PYTHON_PRESALE_WEBHOOK_URL` |
| .htaccess ochrana invoices JSON | ✅ OK |
| Config v .gitignore | ✅ OK |

---

## 📊 Admin Dashboard

**URL:** `/V2/admin.html`
**Login:** admin / zion2025

| Funkce | Stav |
|--------|------|
| Statistiky (objednávky, tržby, tokeny) | ✅ OK |
| Seznam objednávek | ✅ OK |
| Detail objednávky | ✅ OK |
| Změna stavu | ✅ OK |
| Filtrování | ✅ OK |
| Zobrazení faktury | ✅ OK |
| Export CSV/JSON | ✅ OK |

---

## 🚀 Checklist před spuštěním

### Server
- [ ] PHP 8.0+ nainstalováno
- [ ] SSL certifikát (HTTPS)
- [ ] Oprávnění pro zápis do `/orders`, `/wallets`, `/invoices`
- [ ] PHP mail() funkční (nebo SMTP)

### Konfigurace
- [ ] Stripe produkční klíče v `config.php`
- [ ] Zásilkovna API klíč v `config.php`
- [ ] Webhook endpoint nastaven ve Stripe Dashboard
- [ ] (Volitelné) Nastaveno `PYTHON_PRESALE_WEBHOOK_URL` pro hybridní presale sync
- [ ] `DEBUG_MODE` na `false`

### Testování
- [ ] Test objednávky kartou (Stripe test mode)
- [ ] Test objednávky převodem
- [ ] Test objednávky dobírkou
- [ ] Ověření emailů (admin + zákazník)
- [ ] Ověření generování faktur
- [ ] Test admin dashboardu

---

## 📞 Podpora

- **Email:** hello@zionterranova.com
- **GDPR:** gdpr@zionterranova.com
- **Discord:** https://discord.gg/eatGYDbd

---

*Generováno automaticky při kontrole systému*
