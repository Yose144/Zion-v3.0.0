# 💰 ZION Presale Launch Coordination

**Datum dokumentu**: 2. ledna 2026  
**Navrhované spuštění**: 1. února 2026  
**Platforma**: newearth.cz  
**Cíl**: €1.7M (3 fáze)

---

## 📅 Launch Timeline

```
┌─────────────────────────────────────────────────────────────────┐
│                    PRESALE TIMELINE 2026                        │
├─────────────┬───────────────┬───────────────┬───────────────────┤
│   LEDEN     │    ÚNOR       │   BŘEZEN      │  DUBEN - ČERVEN   │
│  Příprava   │   Phase 1     │   Phase 2     │    Phase 3        │
│             │   €0.008      │   €0.010      │    €0.012         │
│  ✅ Done    │   150M ZION   │   200M ZION   │    150M ZION      │
│             │   Target €1.2M│   Target €2.0M│    Target €1.8M   │
└─────────────┴───────────────┴───────────────┴───────────────────┘
```

---

## ✅ Pre-Launch Checklist

### 1. Technical Infrastructure

| Komponenta | Status | Owner | Deadline |
|------------|--------|-------|----------|
| Stripe LIVE keys | ⏳ Pending | @admin | 15.01.2026 |
| SMTP credentials | ⏳ Pending | @admin | 15.01.2026 |
| WALLET_LEDGER_API_KEY | ✅ Done | @dev | 02.01.2026 |
| Python FastAPI Backend | ✅ Done | @backend | Done |
| PHP Hybrid Integration | ✅ Done | @backend | Done |
| SSL certificate | ✅ Done | @devops | Done |
| Presale E2E tests | ✅ Done | @qa | 01.01.2026 |

### 2. Payment Processing

| Test Scénář | Status | Poznámka |
|-------------|--------|----------|
| Stripe test payment | ✅ Pass | Test mode OK |
| Stripe LIVE payment | ⏳ Pending | Needs LIVE keys |
| Webhook handling | ✅ Pass | 15 tests |
| Refund flow | ⏳ Pending | Test po LIVE aktivaci |
| Order confirmation email | ✅ Pass | SMTP ready |
| Wallet assignment | ✅ Pass | Auto-generated |

### 3. Legal & Compliance

| Dokument | Status | Deadline |
|----------|--------|----------|
| Terms & Conditions | ⏳ Draft | 20.01.2026 |
| Privacy Policy | ⏳ Draft | 20.01.2026 |
| Cookie Policy | ⏳ Draft | 20.01.2026 |
| GDPR compliance | ⏳ Review | 25.01.2026 |
| Token disclaimer | ⏳ Draft | 20.01.2026 |

### 4. Marketing & Communication

| Aktivita | Status | Deadline |
|----------|--------|----------|
| Presale landing page | ✅ Done | Done |
| Email templates | ✅ Done | Done |
| Social media graphics | ⏳ Pending | 25.01.2026 |
| Press release | ⏳ Draft | 28.01.2026 |
| Discord announcement | ⏳ Ready | Launch day |
| Telegram announcement | ⏳ Ready | Launch day |

---

## 🔧 Technical Setup Commands

### Stripe LIVE Activation
```bash
# 1. SSH na production server
ssh -p 20002 ssh-685961@dw214.webglobe.com

# 2. Aktualizuj config.php
nano /home/html/newearth.cz/public_html/V2/api/config.php

# 3. Změň Stripe keys:
# define('STRIPE_PUBLIC_KEY', 'pk_live_...');
# define('STRIPE_SECRET_KEY', 'sk_live_...');
# define('STRIPE_WEBHOOK_SECRET', 'whsec_...');

# 4. Ověř endpoint
curl -s https://newearth.cz/V2/api/presale-order.php | jq .
```

### Enable Presale
```bash
# V config.php změň:
define('PRESALE_ENABLED', true);  # false → true
define('PRESALE_PHASE', 1);       # Aktuální fáze
define('PRESALE_TOKEN_PRICE', 0.008);  # EUR za token
```

### Verify All Systems
```bash
# Test presale API
curl -s https://newearth.cz/V2/api/presale-order.php

# Test wallet ledger
curl -s -X POST https://newearth.cz/V2/api/wallet-ledger.php \
  -H "Content-Type: application/json" \
  -H "X-API-Key: YOUR_KEY" \
  -d '{"action": "test"}'

# Check Stripe webhook
# → Dashboard: https://dashboard.stripe.com/webhooks
```

---

## 📊 Presale Phases

### Phase 1: Early Birds (Únor 2026)
| Parametr | Hodnota |
|----------|---------|
| Cena | €0.008 / ZION |
| Alokace | 150,000,000 ZION |
| Bonus | +20% |
| Min. nákup | €50 |
| Max. nákup | €10,000 |
| Target | €1,200,000 |

### Phase 2: Community (Březen 2026)
| Parametr | Hodnota |
|----------|---------|
| Cena | €0.010 / ZION |
| Alokace | 200,000,000 ZION |
| Bonus | +15% |
| Min. nákup | €50 |
| Max. nákup | €25,000 |
| Target | €2,000,000 |

### Phase 3: Public (Duben - Červen 2026)
| Parametr | Hodnota |
|----------|---------|
| Cena | €0.012 / ZION |
| Alokace | 150,000,000 ZION |
| Bonus | +10% |
| Min. nákup | €50 |
| Max. nákup | €50,000 |
| Target | €1,800,000 |

---

## 🎯 Go/No-Go Criteria

### Must Have (Blockers)
- [ ] ✅ TestNet stable 7+ dní bez critical bugs
- [ ] ⏳ Stripe LIVE keys aktivní
- [ ] ⏳ Legal dokumenty schváleny
- [ ] ⏳ Backup systém otestován
- [ ] ⏳ Monitoring alerts nastaveny

### Should Have (Important)
- [ ] ✅ E2E testy projdou (15/15)
- [ ] ⏳ Social media kampań připravena
- [ ] ⏳ Support team briefed
- [ ] ⏳ FAQ dokumentace hotová

### Nice to Have
- [ ] Referral program ready
- [ ] Multi-language support
- [ ] Mobile-optimized checkout

---

## 📞 Team Responsibilities

| Role | Osoba | Odpovědnost |
|------|-------|-------------|
| **Launch Lead** | TBD | Overall coordination |
| **Backend** | @dev | API stability, fixes |
| **DevOps** | @devops | Server monitoring |
| **Legal** | @legal | T&C, compliance |
| **Marketing** | @marketing | Announcements |
| **Support** | @support | Customer queries |

---

## 📋 Launch Day Procedure (D-Day)

### T-48 hodin
- [ ] Final code freeze
- [ ] Full system backup
- [ ] Team sync meeting
- [ ] Verify all credentials

### T-24 hodin
- [ ] Enable PRESALE_ENABLED=true
- [ ] Test purchase flow (admin test)
- [ ] Verify email delivery
- [ ] Prepare announcement drafts

### T-4 hodin
- [ ] Final monitoring check
- [ ] On-call team confirmed
- [ ] Discord/Telegram admins ready
- [ ] Support email monitored

### T-0 (Launch!)
```bash
# 1. Verify presale active
curl -s https://newearth.cz/V2/api/presale-order.php | jq '.presale_enabled'

# 2. Post announcements
# - Discord #announcements
# - Telegram main channel
# - Twitter/X
# - Email to waitlist

# 3. Monitor real-time
# - Stripe dashboard
# - Server logs
# - Error tracking
```

### T+1 hodina
- [ ] Review first orders
- [ ] Check payment success rate
- [ ] Monitor server load
- [ ] Respond to early feedback

### T+24 hodin
- [ ] Daily report
- [ ] Fix any issues
- [ ] Team retrospective
- [ ] Plan week 1 activities

---

## 🆘 Emergency Procedures

### Payment Issues
```bash
# Check Stripe webhook logs
ssh -p 20002 ssh-685961@dw214.webglobe.com
tail -f /home/html/newearth.cz/logs/stripe-webhook.log

# Manual order verification
curl -s "https://newearth.cz/V2/api/admin-orders.php?order_id=XXX" \
  -H "X-Admin-Key: YOUR_ADMIN_KEY"
```

### Server Down
```bash
# Check TestNet server
ssh -i ~/.ssh/zion_server_key root@91.98.122.165 'docker ps'

# Restart services
ssh -i ~/.ssh/zion_server_key root@91.98.122.165 \
  'cd /root/zion-v2.9 && docker-compose restart'
```

### Disable Presale (Emergency)
```bash
# Immediately disable
ssh -p 20002 ssh-685961@dw214.webglobe.com \
  "sed -i \"s/PRESALE_ENABLED', true/PRESALE_ENABLED', false/\" /home/html/newearth.cz/public_html/V2/api/config.php"

# Verify disabled
curl -s https://newearth.cz/V2/api/presale-order.php | jq '.presale_enabled'
```

---

## 📈 Success Metrics

### Week 1 Targets
| Metrika | Cíl | Tracking |
|---------|-----|----------|
| Total orders | > 50 | Stripe dashboard |
| Revenue | > €10,000 | Stripe dashboard |
| Conversion rate | > 5% | Analytics |
| Email open rate | > 40% | SMTP logs |
| Support tickets | < 20 | Support inbox |

### Month 1 Targets
| Metrika | Cíl |
|---------|-----|
| Phase 1 completion | > 50% |
| Unique buyers | > 200 |
| Average order | > €200 |
| Referral signups | > 50 |

---

## 📝 Post-Launch Actions

### Day 1-7
- Daily standup (15 min)
- Bug triage
- Customer support
- Social media engagement

### Week 2-4
- Performance optimization
- Marketing campaign iteration
- Community building
- Prepare Phase 2

---

**Document Owner**: @launch-team  
**Last Updated**: 2. ledna 2026  
**Next Review**: 15. ledna 2026

---

*"Where technology meets spirit"* 🌟
