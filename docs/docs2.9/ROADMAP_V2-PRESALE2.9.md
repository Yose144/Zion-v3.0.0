# ZION V2 Roadmap

Version: 2.9.0  
Date: 3. prosince 2025  
Owner: Core Engineering (Backend + Frontend + DevOps)

---

## 🔭 Overview

Cílem je dovést V2 (Presale + Dashboard) do produkce s bezpečnou infrastrukturou, ověřenými integracemi (Stripe, SMTP, Zásilkovna), automatizovaným deployem a reálnou generací ZION peněženek (secp256k1). Roadmapa rozděluje práci do jasných fází s milníky, vlastníky a termíny.

---

## 🗂️ Phases

### Phase A — Foundation & Docs (Hotovo)
- Milníky:
  - Presale dashboard CZ/EN
  - Stripe TEST klíče (frontend + backend)
  - Webglobe SMTP/IMAP/POP3 konfigurace
  - Zásilkovna API klíče v .env/config
  - SFTP deploy skript s backupem (port 222)
  - Diagnostické nástroje: health.php, stripe-check.php, send-test-email.php
  - Dokumentace: Production Deployment Checklist, Security Hardening Tasks
- Stav: ✅ Completed
- Odkazy:
  - `docs/PRODUCTION_DEPLOYMENT_CHECKLIST.md`
  - `docs/SECURITY_HARDENING_TASKS.md`
  - `scripts/deploy/deploy_v2.sh`

### Phase B — Production Credentials & Deployment (Týden 1)
- Cíle:
  - Získat a nasadit produkční klíče (Stripe LIVE pk/sk, webhook secret)
  - Vyplnit SMTP_PASS (admin@newearth.cz)
  - Vyplnit SFTP_USER/SFTP_PASS a spustit deploy V2
  - Spustit FastAPI backend na serveru (uvicorn/systemd)
- Milníky:
  - V2 nasazeno na `https://newearth.cz/V2/`
  - API health endpoint vrací OK
  - Stripe checkout test purchase úspěšná (test mode)
  - Email test úspěšný
- Vlastníci: DevOps + Backend
- Odhad: 2–4 hodiny
- Závislosti: Webglobe přístupy, Stripe dashboard
- Artefakty:
  - `.env` s produkčními hodnotami
  - systemd service pro FastAPI

### Phase C — Crypto Wallet Upgrade (Týden 1–2)
- Cíle:
  - Nahradit mock adresy v PHP za reálné secp256k1 + Base58Check
  - Integrovat Python generátor (rychlé) nebo PHP `phpseclib` (portabilní)
  - Připravit hybridní wallet pool (škálování)
- Milníky:
  - Option 1: PHP volá Python CLI `generate-wallet` (✅ doporučeno pro start)
  - Option 3: Batch generátor do SQLite poolu + cron refill
  - Validace adres (version byte 0x5A, checksum)
- Vlastníci: Backend (Python + PHP)
- Odhad: 2–3 h (Option 1), 6–8 h (Pool)
- Odkazy: `docs/CRYPTO_WALLET_UPGRADE.md`

### Phase D — Security Hardening (Týden 2)
- Cíle:
  - Admin password change + bcrypt hash v .env
  - CSRF tokeny (formy + PHP verifikace)
  - Security headers (.htaccess / PHP)
  - Error handling (production handler, no leak)
  - Rate limiting, XSS sanitizace, access logging
- Milníky:
  - Week 1: CRITICAL úlohy hotové
  - Week 2: HIGH úlohy (rate limit, XSS, logging)
- Vlastníci: Backend + DevOps
- Odhad: 4–6 h (kritické) + 6 h (high)
- Odkazy: `docs/SECURITY_HARDENING_TASKS.md`

### Phase E — Monitoring & Maintenance (Průběžně)
- Cíle:
  - Denní zálohy DB + encryption key + QR assets
  - Stripe webhook alerty
  - API error rate monitor
  - Týdenní review analytics, disk space
- Milníky:
  - Cron joby nastavené (backup 03:00)
  - Alerting kanály aktivní
- Vlastníci: DevOps
- Odkazy: `docs/PRODUCTION_DEPLOYMENT_CHECKLIST.md`

---

## ✅ Milestones Checklist

- [x] Presale dashboard CZ/EN (V2) 
- [x] Stripe TEST keys (frontend/backend)
- [x] SMTP/IMAP/POP3 (Webglobe) 
- [x] Zásilkovna API klíče v .env
- [x] SFTP deploy skript s backupem
- [x] Health/Stripe/Email test nástroje
- [x] Deployment & Security dokumentace
- [ ] Produkční klíče (Stripe LIVE, SMTP_PASS, SFTP) 
- [ ] Deploy V2 na produkci
- [ ] Wallet upgrade (secp256k1 + Base58Check)
- [ ] Security hardening (CRITICAL + HIGH)
- [ ] Monitoring & zálohy

---

## 🧭 Timeline (suggested)

- Den 1–2: Phase B (prod klíče, deploy, verifikace)
- Den 3: Phase C Option 1 (Python integrace do PHP)
- Den 4–5: Phase D (kritické security úlohy)
- Den 6–7: Phase C Option 3 (wallet pool + cron)
- Týden 2: Phase D (high priority) + Phase E (monitoring)

---

## 👥 Ownership Matrix

- Backend (Python): Wallet generation, FastAPI endpoints, DB init
- Backend (PHP): Presale API bridge, CSRF, sanitizace, rate limiting
- Frontend: Stripe Checkout, V2 UI (CZ/EN), error handling
- DevOps: SFTP deploy, systemd, backups, monitoring, Stripe webhooks

---

## 🔗 Key Files & Paths

- Frontend: `public_html/V2/` (dashboard.html, dashboard-en.html, presale.js)
- PHP API: `api/presale/` (health.php, stripe-check.php, send-test-email.php)
- Python backend: `src/core/presale_*.py`, `api/presale_endpoints.py`
- Deploy: `scripts/deploy/deploy_v2.sh`, `.env.deploy`
- Docs: `docs/PRODUCTION_DEPLOYMENT_CHECKLIST.md`, `docs/SECURITY_HARDENING_TASKS.md`, `docs/CRYPTO_WALLET_UPGRADE.md`

---

## 🧪 Go-Live Gates

- Build: PASS (statické+skripty zkontrolovány)
- Lint/Typecheck: PASS (Python/JS základní kontrola)
- Tests: PASS (Python presale tests 7/7)
- Security: PENDING (CRITICAL tasks)
- Monitoring: PENDING (cron + alerts)

---

## 🚀 Next Actions

1. Získat produkční klíče (Stripe LIVE, webhook, SMTP_PASS, SFTP)  
2. Spustit deploy V2 podle `PRODUCTION_DEPLOYMENT_CHECKLIST.md`  
3. Implementovat Option 1 (Python wallet) + test  
4. Aplikovat CRITICAL security úlohy  
5. Nastavit cron zálohy + webhook alerty

---

## 📬 Contacts

- Webglobe Support: podpora@webglobe.cz, +420 222 745 745  
- Stripe Support: dashboard.stripe.com/support  
- Interní: dev@terranova.one
