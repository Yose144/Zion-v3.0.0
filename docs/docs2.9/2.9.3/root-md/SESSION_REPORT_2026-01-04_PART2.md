# 📝 Session Report: 4. ledna 2026 (Part 2)

**Status:** ✅ Úspěšně dokončeno
**Fáze:** Production Deployment (Security & Config)

## 🎯 Dosažené cíle

### 1. Production Deployment (newearth.cz)
- **Server:** `dw214.webglobe.com` (Production E-shop/Presale)
- **Akce:** Nasazení zabezpečeného API (včetně `auth.php`, Bcrypt hashů a CSRF ochrany).
- **Konfigurace:** Aktualizován `.env` soubor s produkčními klíči:
    - **Stripe:** Live keys (`pk_live_...`, `sk_live_...`)
    - **SMTP:** `mail.webglobe.cz` (user: `admin.newearth.cz`)
    - **Zásilkovna:** API klíče
    - **Security:** Admin password hash (`$2b$12$...`)
- **Metoda:** Automatizovaný `rsync` přes `sshpass` (WSL).

### 2. Security Hardening (Production)
- Všechny citlivé skripty na produkci jsou nyní chráněny přihlášením.
- Testovací skripty jsou přesunuty do `_tests/` a znepřístupněny.

## 🔜 Další kroky

1.  **Ověření funkčnosti:**
    - Přihlásit se do admin dashboardu na `https://newearth.cz/V2/api/admin-dashboard.php`.
    - Otestovat vytvoření objednávky (Stripe platba).
    - Otestovat odeslání emailu (SMTP).

2.  **TestNet Server (91.98.122.165):**
    - Stále čeká na konfiguraci Nginx pro PHP-FPM, pokud chceme testovat API i tam. Ale pro produkci je nyní klíčový `newearth.cz`.

## 🔑 Credentials (Production)
- **Admin Login:** `https://newearth.cz/V2/api/admin-login.php`
- **Heslo:** `x3nityOne144`
