# 💰 ZION PRESALE MASTER PLAN 2026

**Verze:** 2.0  
**Datum:** 2. ledna 2026  
**Status:** ✅ TestNet LIVE | ⏳ Presale Launch 1.2.2026  
**Entita:** Omnity.One s.r.o. (IČO: 19828748)

---

## 📊 Executive Summary

| Parametr | Hodnota |
|----------|---------|
| **Total Presale Allocation** | 500,000,000 ZION (0.35% z 144B) |
| **Target Raise** | €3-4M |
| **Launch Date** | 1. února 2026 |
| **MainNet Launch** | 31. prosince 2027 |
| **Token Unlock** | 40% at launch + 20%/Q |

### 💵 Cenová Struktura

| Fáze | Cena/ZION | Tokeny za €100 | Alokace | Target |
|------|-----------|----------------|---------|--------|
| **Phase 1** (Únor) | €0.004 | 25,000 ZION | 150M | €600K |
| **Phase 2** (Březen) | €0.008 | 12,500 ZION | 200M | €1.6M |
| **Phase 3** (Duben) | €0.012 | 8,333 ZION | 150M | €1.8M |
| **MainNet** (2027) | €0.015 | 6,667 ZION | — | — |

---

## ✅ AKTUÁLNÍ STAV (2. ledna 2026)

### Dokončeno ✅
- [x] **Presale Backend API** - FastAPI + PHP hybrid
- [x] **Wallet V3 System** - BIP39 mnemonic, Ed25519, Bech32 adresy
- [x] **Stripe Integration** - Test mode funkční
- [x] **Email Notifications** - SMTP + QR kódy
- [x] **Discord Webhooks** - Real-time order notifikace
- [x] **Admin Stats API** - `/api/presale-stats.php`
- [x] **Rate Limiting** - IP + email protection
- [x] **Server-side Validation** - Cena/tokeny/bonus
- [x] **WALLET_LEDGER_API_KEY** - API authentication
- [x] **E2E Tests** - 15 testů passing
- [x] **Mobile QR Scanner** - Email QR → Mobile App import ✅ NEW

### Čeká ⏳
- [ ] **Stripe LIVE Keys** - Deadline: 15.1.2026
- [ ] **Legal Documents** - T&C, Privacy Policy, Token Disclaimer
- [ ] **KYC/AML Provider** - Sumsub nebo Onfido
- [ ] **Marketing Campaign** - Social media, PR

---

## 📅 TIMELINE 2026

```
┌──────────────────────────────────────────────────────────────────────────┐
│                          PRESALE TIMELINE 2026                            │
├──────────┬──────────┬──────────┬──────────┬──────────┬──────────────────┤
│   LED    │   ÚNO    │   BŘE    │   DUB    │   KVĚ    │     PRO 2027     │
│ Příprava │ Phase 1  │ Phase 2  │ Phase 3  │ Uzávěr   │  MainNet Launch  │
│          │ €0.004   │ €0.008   │ €0.012   │          │     €0.015       │
│          │ 150M     │ 200M     │ 150M     │          │   Token Unlock   │
└──────────┴──────────┴──────────┴──────────┴──────────┴──────────────────┘
```

---

## 💎 PRESALE FÁZE

### Phase 1: Early Bird (Únor 2026)
| Parametr | Hodnota |
|----------|---------|
| Cena | €0.004 / ZION |
| Alokace | 150,000,000 ZION |
| Bonus | +10-30% (volume-based) |
| Target | €600,000 |
| Min. nákup | €20 |
| Max. nákup | €10,000 |

**Bonus Tiers:**
- 2,490 Kč+ (€99+): +10% bonus
- 12,490 Kč+ (€499+): +20% bonus
- 24,990 Kč+ (€999+): +30% bonus

### Phase 2: Builder (Březen 2026)
| Parametr | Hodnota |
|----------|---------|
| Cena | €0.008 / ZION |
| Alokace | 200,000,000 ZION |
| Bonus | +5-20% (volume-based) |
| Target | €1,600,000 |
| Min. nákup | €50 |
| Max. nákup | €25,000 |

### Phase 3: Pioneer (Duben 2026)
| Parametr | Hodnota |
|----------|---------|
| Cena | €0.012 / ZION |
| Alokace | 150,000,000 ZION |
| Bonus | +5-10% (volume-based) |
| Target | €1,800,000 |
| Min. nákup | €50 |
| Max. nákup | €50,000 |

---

## 🔐 WALLET SYSTEM V3

### Architektura
```
Customer Purchase → Stripe Payment → Wallet V3 Generator
                                            ↓
                    ┌───────────────────────────────────────┐
                    │        12-word BIP39 Mnemonic         │
                    │     Ed25519 Keypair Generation        │
                    │     Bech32 Address (zion1...)         │
                    │     AES-256-GCM Encrypted Storage     │
                    └───────────────────────────────────────┘
                                            ↓
                    Email Confirmation with Mobile QR Code
                                            ↓
                    Mobile App Scan → Wallet Import → Ready!
```

### QR Code Formats

**1. Mobile-Compatible QR (NEW ✅)**
- Format: `zion://import?mnemonic=word1+word2+...&network=testnet`
- Size: 350x350px, ~15KB PNG
- File: `{wallet_id}_mobile_qr.png`
- Parser: `mobile-app/src/utils/zionUri.js`

**2. Recovery QR (Legacy)**
- Format: JSON s wallet daty
- Size: 200x200px, ~1-3KB PNG
- File: `{wallet_id}_recovery.png`

### Klíčové soubory
| Soubor | Lokace | Popis |
|--------|--------|-------|
| `presale_wallet_v3.py` | `src/core/` | Main wallet engine |
| `wallet_api_v3.py` | `api/` | FastAPI server (port 5556) |
| `wallet-lib-v3.php` | `public_html/V2/api/` | PHP wrapper |
| `mobile_qr_generator.py` | `~/api/` (server) | Mobile QR generator |
| `zionUri.js` | `mobile-app/src/utils/` | URI parser |
| `QRScanner.js` | `mobile-app/src/components/` | Camera scanner |

---

## 🖥️ DESKTOP MINER AGENT - QR WALLET INTEGRATION (PLÁNOVÁNO)

### Nová Feature: QR Wallet Import
**Priorita:** P2 (Q1 2026)  
**Časová náročnost:** ~16 hodin

**Popis:**
Desktop Mining Agent získá schopnost importovat presale wallet přímo skenováním QR kódu z emailu pomocí webkamery.

**Implementace:**
```
┌──────────────────────────────────────────────────────────────┐
│                    ZION Desktop Miner v2.9                   │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│   ┌─────────────────────────────────────────────────────┐   │
│   │  📷 Import Wallet                                    │   │
│   │                                                     │   │
│   │  ┌─────────────────────────────────────────────┐   │   │
│   │  │                                             │   │   │
│   │  │        [Webcam Preview Area]                │   │   │
│   │  │                                             │   │   │
│   │  │   Scan QR code from your presale email     │   │   │
│   │  │                                             │   │   │
│   │  └─────────────────────────────────────────────┘   │   │
│   │                                                     │   │
│   │  [Or Enter Mnemonic Manually]                      │   │
│   │                                                     │   │
│   └─────────────────────────────────────────────────────┘   │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

**Technický stack:**
- **Electron:** `html5-qrcode` nebo `jsQR` pro webcam scanning
- **Node.js:** Parse ZION URI (`zion://import?mnemonic=...`)
- **Secure Storage:** `electron-store` encrypted mnemonic

**Úkoly:**
- [ ] Přidat webcam permission request
- [ ] Implementovat QR scanner component (Electron renderer)
- [ ] Reuse `zionUri.js` parser z mobile-app
- [ ] Secure storage pro mnemonic (AES-256)
- [ ] Auto-detect wallet → start mining flow
- [ ] UI/UX: Drag & drop QR image file jako backup

**Reference:**
- Mobile implementation: `mobile-app/src/components/QRScanner.js`
- URI parser: `mobile-app/src/utils/zionUri.js`
- Desktop miner docs: `docs/2.9/DESKTOP_MINER_AGENT_v2.9.md`

---

## 📧 EMAIL FLOW

### Potvrzovací email obsahuje:
1. **Order Summary** - Token amount, bonus, cena
2. **Wallet Address** - `zion1...` Bech32 adresa
3. **Mobile QR Code** - Scan z mobile app
4. **12-word Mnemonic** - Bezpečně uložit!
5. **Recovery Instructions** - Jak obnovit wallet

### SMTP Konfigurace
- Host: `mail.webglobe.cz`
- Port: 587 (STARTTLS)
- User: `shop@newearth.cz`

---

## 🚀 GO-LIVE CHECKLIST

### T-30 dní (1.1.2026) ✅
- [x] TestNet stable
- [x] Presale API functional
- [x] E2E tests passing
- [x] WALLET_LEDGER_API_KEY set

### T-15 dní (15.1.2026) ⏳
- [ ] Stripe LIVE keys activated
- [ ] Legal docs approved (T&C, Privacy)
- [ ] KYC provider integrated
- [ ] Social media campaign ready

### T-7 dní (25.1.2026) ⏳
- [ ] Full production test
- [ ] Backup system verified
- [ ] Monitoring alerts configured
- [ ] Support team briefed

### T-1 den (31.1.2026) ⏳
- [ ] Final code freeze
- [ ] Announcement drafts ready
- [ ] On-call team confirmed
- [ ] Discord/Telegram mods ready

### Launch Day (1.2.2026) 🚀
- [ ] Enable `PRESALE_ENABLED=true`
- [ ] Post announcements
- [ ] Monitor orders real-time
- [ ] React to issues immediately

---

## 💰 EKONOMIKA

### Revenue Targets
| Scénář | Prodej | Revenue |
|--------|--------|---------|
| Optimistic | 100% | €4,000,000 |
| Realistic | 75% | €3,000,000 |
| Conservative | 50% | €2,000,000 |
| Minimum | 25% | €1,000,000 |

### Use of Proceeds
```
30% - Core Development          €1,200,000
20% - Security & Audits         €800,000
15% - Exchange Listings         €600,000
15% - Marketing & PR            €600,000
10% - Legal & Compliance        €400,000
10% - Operations & Reserve      €400,000
```

### Token Unlock Schedule
| Datum | Procento | Popis |
|-------|----------|-------|
| 31.12.2027 | 40% | MainNet Launch |
| 31.3.2028 | +20% | Q1 2028 |
| 30.6.2028 | +20% | Q2 2028 |
| 30.9.2028 | +20% | Q3 2028 (Final) |

---

## 🔐 BEZPEČNOST

### API Authentication
- **WALLET_LEDGER_API_KEY:** Header `X-API-Key` required
- **Stripe Webhook:** Signature verification
- **Rate Limiting:** 5 requests/hour per IP

### Data Encryption
- **Mnemonic:** AES-256-GCM encrypted at rest
- **Private Keys:** Never transmitted, encrypted in DB
- **QR Codes:** Signed to prevent tampering

### Multi-sig Escrow
- 3-of-5 signatures required pro presale premine
- Signatáři: 3 team members + 2 external custodians

---

## 📊 MONITORING

### Real-time Dashboard
```bash
# Live monitoring
./monitor_presale.sh

# Check stats API
curl https://newearth.cz/V2/api/presale-stats.php | jq .
```

### Discord Notifications
- 🎉 Nová objednávka → #presale-orders
- ❌ Error → #presale-errors

### Metrics to Track
- Orders per day
- Average order value
- Conversion rate (visits → purchases)
- Email delivery rate
- Refund rate

---

## � MAINNET TOKEN DISTRIBUTION SYSTEM

### Přehled
Po spuštění MainNet (31.12.2027) proběhne automatická distribuce všech presale a bonus tokenů na blockchain adresy zákazníků.

### Systém distribuce

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                      MAINNET TOKEN DISTRIBUTION FLOW                        │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│   ┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐      │
│   │  PRESALE ESCROW │     │  DAO TREASURY   │     │   BLOCKCHAIN    │      │
│   │   500M ZION     │     │   100M ZION     │     │     MAINNET     │      │
│   └────────┬────────┘     └────────┬────────┘     └────────▲────────┘      │
│            │                       │                       │               │
│            ▼                       ▼                       │               │
│   ┌─────────────────┐     ┌─────────────────┐             │               │
│   │ Presale Payout  │     │  Bonus Payout   │             │               │
│   │   Automation    │     │   Automation    │─────────────┘               │
│   └────────┬────────┘     └─────────────────┘                             │
│            │                                                               │
│            ▼                                                               │
│   ┌─────────────────────────────────────────────────────────────────────┐ │
│   │                     ADMIN DASHBOARD                                  │ │
│   │  ┌─────────────────┐          ┌─────────────────┐                   │ │
│   │  │ 🚀 DISTRIBUTE   │          │ 🎁 DISTRIBUTE   │                   │ │
│   │  │ PRESALE TOKENS  │          │  BONUS TOKENS   │                   │ │
│   │  │   500M ZION     │          │   100M ZION     │                   │ │
│   │  └─────────────────┘          └─────────────────┘                   │ │
│   └─────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Komponenty systému

| Komponenta | Soubor | Popis |
|------------|--------|-------|
| **Orchestrator** | `src/wallet/mainnet_launch_orchestrator.py` | Master koordinátor distribuce |
| **Presale Payout** | `src/wallet/presale_payout_automation.py` | 500M ZION z escrow |
| **Bonus Payout** | `src/wallet/eshop_bonus_automation.py` | eShop bonusy z DAO treasury |
| **PHP API** | `public_html/V2/api/token-distribution.php` | Admin dashboard API |
| **Admin UI** | `public_html/V2/admin.html` | Tlačítka pro distribuci |

### Admin Dashboard - Token Distribution

V admin dashboardu (https://newearth.cz/V2/admin.html) je nový panel **"MainNet Token Distribution"** obsahující:

1. **Statistiky pending distribucí:**
   - Počet presale objednávek k distribuci
   - Celkem ZION tokenů k odeslání
   - Počet eShop bonusů k distribuci
   - Celkem bonus tokenů

2. **Tlačítka distribuce:**
   - 🚀 **Distribuovat Presale Tokeny** - Odešle všechny presale ZION
   - 🎁 **Distribuovat eShop Bonusy** - Odešle všechny bonus tokeny

3. **Bezpečnostní opatření:**
   - Dvojité potvrzení před distribucí
   - Textové potvrzení ("DISTRIBUTE PRESALE" / "DISTRIBUTE BONUS")
   - Logging všech operací
   - Rollback capability

### API Endpoints

```
GET  /api/token-distribution.php?action=stats
     → Vrátí statistiky pending distribucí

POST /api/token-distribution.php?action=distribute-presale
     Body: {"confirm": true}
     → Spustí presale token distribution

POST /api/token-distribution.php?action=distribute-bonus  
     Body: {"confirm": true}
     → Spustí eShop bonus distribution

GET  /api/token-distribution.php?action=status
     → Vrátí stav probíhající distribuce
```

### Proces distribuce

1. **Pre-checks:**
   - Ověření MainNet connectivity
   - Kontrola escrow balance
   - Validace všech wallet adres

2. **Batch processing:**
   - Max 100 transakcí na blok
   - Rate limiting: 50 tx / batch, 2s delay
   - Retry logic pro failed transactions

3. **Konfirmace:**
   - 6 confirmations pro presale (velké částky)
   - 3 confirmations pro bonusy (menší částky)

4. **Notifikace:**
   - Email zákazníkům po úspěšné distribuci
   - Discord webhook pro monitoring

### Alokace tokenů

| Typ | Alokace | Zdroj | Kategorie |
|-----|---------|-------|-----------|
| **Presale** | 500M ZION | Escrow Contract | 3 fáze (150M + 200M + 150M) |
| **eShop Bonus** | 100M ZION reserve | DAO Treasury | 1 - 1,000,000 ZION |

### Klíčová data

| Typ | Escrow Adresa |
|-----|---------------|
| Presale | `ZION_PRESALE_ESCROW_GENESIS_2025` |
| DAO Treasury | `ZION_DAO_TREASURY_GENESIS_2025` |

### Logging

```bash
# Check distribution logs
tail -f /home/html/newearth.cz/public_html/V2/logs/token-distribution.log

# Check status
cat /home/html/newearth.cz/public_html/V2/logs/distribution-status.json
```

---

## �📁 DOKUMENTY (Reference)

### Presale Docs
| Dokument | Popis |
|----------|-------|
| [PRESALE_ROADMAP_v1.0.md](../PRESALE_2025/PRESALE_ROADMAP_v1.0.md) | Původní roadmapa |
| [PRESALE_API.md](../PRESALE_API.md) | FastAPI dokumentace |
| [PRESALE_WALLET_V3_README.md](../PRESALE_WALLET_V3_README.md) | Wallet system V3 |
| [PRESALE_DEPLOYMENT_REPORT_22_12_2025.md](./PRESALE_DEPLOYMENT_REPORT_22_12_2025.md) | Deployment report |
| [PRESALE_LAUNCH_COORDINATION.md](./PRESALE_LAUNCH_COORDINATION.md) | Launch plan |
| [PRESALE_NEXT_STEPS.md](./PRESALE_NEXT_STEPS.md) | Next steps |

### Technical Docs
| Dokument | Popis |
|----------|-------|
| [DESKTOP_MINER_AGENT_v2.9.md](./DESKTOP_MINER_AGENT_v2.9.md) | Desktop miner spec |
| [DEVELOPMENT_PLAN_2026.md](./DEVELOPMENT_PLAN_2026.md) | Dev roadmapa |
| [TODO.md](./TODO.md) | Aktuální TODO |

---

## 🆘 EMERGENCY PROCEDURES

### Disable Presale
```bash
ssh -p 20002 ssh-685961@dw214.webglobe.com \
  "sed -i \"s/PRESALE_ENABLED', true/PRESALE_ENABLED', false/\" \
  /home/html/newearth.cz/public_html/V2/api/config.php"
```

### Check Logs
```bash
ssh -p 20002 ssh-685961@dw214.webglobe.com \
  'tail -100 /home/html/newearth.cz/logs/presale.log'
```

### Rollback
```bash
ssh -p 20002 ssh-685961@dw214.webglobe.com \
  'cp /home/html/newearth.cz/public_html/V2/api/config.php.backup.YYYYMMDD \
      /home/html/newearth.cz/public_html/V2/api/config.php'
```

---

## 📞 KONTAKTY

| Role | Kontakt |
|------|---------|
| SSH Production | `ssh -p 20002 ssh-685961@dw214.webglobe.com` |
| SSH TestNet | `ssh -i ~/.ssh/zion_server_key root@91.98.122.165` |
| Presale URL | https://newearth.cz/V2/presale.html |
| Presale EN | https://newearth.cz/V2/presale-en.html |
| Admin Dashboard | https://newearth.cz/V2/admin.html |
| Stripe Dashboard | https://dashboard.stripe.com |
| Hosting Support | podpora@webglobe.cz |

---

## ✅ ZMĚNY OD PŮVODNÍHO PLÁNU

### Aktualizace Timeline
| Původní | Aktuální | Důvod |
|---------|----------|-------|
| TestNet Q4 2025 | 31.12.2025 ✅ | Hotovo |
| Presale Q1 2026 | 1.2.2026 | Čeká Stripe LIVE |
| MainNet Q2 2026 | 31.12.2027 | Realistický posun |

### Přidané Features
- ✅ Mobile QR Scanner (app + desktop planned)
- ✅ Discord webhooks
- ✅ Admin stats API
- ✅ Multi-language (CZ + EN)
- ⏳ Desktop Miner QR Import (P2)

### Odstraněno/Odloženo
- KYC/AML → Odloženo do Phase 2 (nad €15,000)
- Hardware wallet → Q2 2026
- Referral program → Po spuštění

---

*Document owner: @zion-team*  
*Last updated: 2. ledna 2026*  
*Next review: 15. ledna 2026*

---

🌟 **"Where technology meets spirit"** 🌟
