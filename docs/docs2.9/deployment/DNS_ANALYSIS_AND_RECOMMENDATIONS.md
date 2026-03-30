# 🌐 DNS Analýza a doporučení - zionterranova.com

**Datum:** 29. října 2025  
**Doména:** zionterranova.com  
**DNS Provider:** Webglobe  
**ZION Server:** 91.98.122.165

---

## ✅ **SOUČASNÁ KONFIGURACE (Co máš teď)**

```dns
$TTL 3600
$ORIGIN zionterranova.com.

@                   3600    IN A        91.98.122.165
www                 3600    IN A        91.98.122.165
*                   3600    IN A        62.109.151.80

; Email (Webglobe hosting)
@                   3600    IN MX       10 email.webglobe.cz.
@                   3600    IN MX       10 email2.webglobe.cz.
@                   3600    IN MX       10 email3.webglobe.cz.
@                   3600    IN MX       10 email4.webglobe.cz.

; Name servers
@                   3600    IN NS       ns1.webglobe.cz.
@                   3600    IN NS       ns2.webglobe.cz.
@                   3600    IN NS       ns3.webglobe.com.

; Email config
@                   3600    IN TXT      "v=spf1 a mx include:_spf.webglobe.cz -all"
_dmarc              3600    IN TXT      "v=DMARC1; p=none;"
```

---

## 🎯 **ANALÝZA**

### ✅ **Co je SPRÁVNĚ:**

1. **A record pro apex domain** (`@`) → 91.98.122.165 ✅
2. **A record pro www** → 91.98.122.165 ✅
3. **MX records** pro email ✅
4. **SPF record** nakonfigurován ✅
5. **DMARC record** přítomen ✅

### ⚠️ **Co je POTŘEBA UPRAVIT:**

#### 1. **Wildcard record (`*`)** - PROBLÉM!

```dns
*                   3600    IN A        62.109.151.80
```

**Problém:**
- Wildcard směřuje na Webglobe server (62.109.151.80)
- To znamená, že `anything.zionterranova.com` jde na Webglobe
- Mělo by směřovat na tvůj ZION server (91.98.122.165)

**Řešení:**
```dns
*                   3600    IN A        91.98.122.165
```

#### 2. **DMARC politika** - PŘÍLIŠ VOLNÁ!

```dns
_dmarc              3600    IN TXT      "v=DMARC1; p=none;"
```

**Problém:**
- `p=none` = žádná ochrana proti email spoofing
- Útočníci můžou posílat emaily z tvé domény

**Řešení:**
```dns
_dmarc              3600    IN TXT      "v=DMARC1; p=quarantine; rua=mailto:security@zionterranova.com; ruf=mailto:security@zionterranova.com; pct=100"
```

#### 3. **CHYBÍ DKIM record** - BEZPEČNOSTNÍ RIZIKO!

**Co to je:**
- DKIM = DomainKeys Identified Mail
- Digitální podpis pro emaily
- Chrání před spoofing útoky

**Co přidat:**
```dns
default._domainkey  3600    IN TXT      "v=DKIM1; k=rsa; p=MIGfMA0GCS..."
```
*(Získáš od Webglobe nebo vygeneruješ vlastní)*

#### 4. **CHYBÍ CAA record** - SSL BEZPEČNOST!

**Co to je:**
- CAA = Certification Authority Authorization
- Definuje, kdo může vydat SSL certifikát pro tvou doménu
- Chrání před neoprávněnými SSL certifikáty

**Co přidat:**
```dns
@                   3600    IN CAA      0 issue "letsencrypt.org"
@                   3600    IN CAA      0 issuewild "letsencrypt.org"
@                   3600    IN CAA      0 iodef "mailto:security@zionterranova.com"
```

---

## 🔧 **DOPORUČENÁ KONFIGURACE (Optimalizovaná)**

```dns
$TTL 3600
$ORIGIN zionterranova.com.

; ============================================
; HLAVNÍ A RECORDS (ZION Server)
; ============================================
@                   3600    IN A        91.98.122.165
www                 3600    IN A        91.98.122.165
*                   3600    IN A        91.98.122.165    ; ← ZMĚNA!

; ============================================
; SUBDOMENY (Explicitní pro důležité služby)
; ============================================
api                 3600    IN A        91.98.122.165
mining              3600    IN A        91.98.122.165
explorer            3600    IN A        91.98.122.165
testnet             3600    IN A        91.98.122.165

; ============================================
; EMAIL (Webglobe hosting)
; ============================================
@                   3600    IN MX       10 email.webglobe.cz.
@                   3600    IN MX       10 email2.webglobe.cz.
@                   3600    IN MX       10 email3.webglobe.cz.
@                   3600    IN MX       10 email4.webglobe.cz.

; Email CNAME aliasy
imap                3600    IN A        62.109.151.33
mail                3600    IN A        62.109.151.33
pop3                3600    IN A        62.109.151.33
smtp                3600    IN A        62.109.151.33
webmail             3600    IN CNAME    roundcube.webglobe.cz.

; Email autodiscover
autoconfig          3600    IN CNAME    autodiscover.webglobe.cz.
autodiscover        3600    IN CNAME    autodiscover.webglobe.cz.
_autodiscover._tcp  3600    IN SRV      0 0 443 autodiscover.webglobe.cz.

; ============================================
; SECURITY RECORDS
; ============================================

; SPF (Sender Policy Framework)
@                   3600    IN TXT      "v=spf1 a mx ip4:91.98.122.165 include:_spf.webglobe.cz -all"

; DMARC (Enhanced)
_dmarc              3600    IN TXT      "v=DMARC1; p=quarantine; rua=mailto:security@zionterranova.com; ruf=mailto:security@zionterranova.com; pct=100; adkim=s; aspf=s"

; DKIM (Požádej Webglobe o public key)
default._domainkey  3600    IN TXT      "v=DKIM1; k=rsa; p=YOUR_DKIM_PUBLIC_KEY_HERE"

; CAA (SSL Certificate Authority Authorization)
@                   3600    IN CAA      0 issue "letsencrypt.org"
@                   3600    IN CAA      0 issuewild "letsencrypt.org"
@                   3600    IN CAA      0 iodef "mailto:security@zionterranova.com"

; ============================================
; NAME SERVERS
; ============================================
@                   3600    IN NS       ns1.webglobe.cz.
@                   3600    IN NS       ns2.webglobe.cz.
@                   3600    IN NS       ns3.webglobe.com.

; ============================================
; UTILITY RECORDS
; ============================================

; Database admin (Webglobe)
dbadmin             3600    IN CNAME    dbadmin.webglobe.cz.

; Verification records (pro Google, Facebook, atd.)
; Přidej podle potřeby:
; @                 3600    IN TXT      "google-site-verification=XXX"
; @                 3600    IN TXT      "facebook-domain-verification=XXX"
```

---

## 📝 **ZMĚNY, KTERÉ MUSÍŠ UDĚLAT**

### **Krok 1: Přihlášení do Webglobe DNS managementu**

1. Jdi na: https://admin.webglobe.cz
2. Přihlas se
3. Najdi: **DNS Správa** → **zionterranova.com**

### **Krok 2: Upravit existující záznamy**

#### A) Změň wildcard record:
```
Starý:  *     3600  IN A    62.109.151.80
Nový:   *     3600  IN A    91.98.122.165
```

#### B) Updatuj DMARC:
```
Starý:  _dmarc  3600  IN TXT  "v=DMARC1; p=none;"
Nový:   _dmarc  3600  IN TXT  "v=DMARC1; p=quarantine; rua=mailto:security@zionterranova.com; ruf=mailto:security@zionterranova.com; pct=100"
```

#### C) Updatuj SPF (přidej tvůj server):
```
Starý:  @  3600  IN TXT  "v=spf1 a mx include:_spf.webglobe.cz -all"
Nový:   @  3600  IN TXT  "v=spf1 a mx ip4:91.98.122.165 include:_spf.webglobe.cz -all"
```

### **Krok 3: Přidat nové záznamy**

#### A) CAA records (pro SSL bezpečnost):
```
Typ: CAA
Hostname: @
Flags: 0
Tag: issue
Value: letsencrypt.org

Typ: CAA
Hostname: @
Flags: 0
Tag: issuewild
Value: letsencrypt.org

Typ: CAA
Hostname: @
Flags: 0
Tag: iodef
Value: mailto:security@zionterranova.com
```

#### B) DKIM record (požádej Webglobe support):
```
Napiš Webglobe supportu:
"Prosím o DKIM public key pro doménu zionterranova.com"

Pak přidáš:
Typ: TXT
Hostname: default._domainkey
Value: "v=DKIM1; k=rsa; p=MIGfMA0GCS..." (dostaneš od Webglobe)
```

#### C) Explicitní subdomény (optional, ale doporučeno):
```
Typ: A
Hostname: api
Value: 91.98.122.165

Typ: A
Hostname: mining
Value: 91.98.122.165

Typ: A
Hostname: explorer
Value: 91.98.122.165

Typ: A
Hostname: testnet
Value: 91.98.122.165
```

---

## ⏱️ **TTL (Time To Live) Doporučení**

### **Během změn:**
```
TTL: 300 (5 minut)
```
- Umožní rychlé testování a opravy

### **Po úspěšném nasazení:**
```
TTL: 3600 (1 hodina)
```
- Tvoje současné nastavení je OK

### **Pro produkci (long-term):**
```
TTL: 86400 (24 hodin)
```
- Lepší performance, menší DNS traffic

---

## 🔍 **TESTOVÁNÍ PO ZMĚNÁCH**

### **1. Zkontroluj DNS propagaci**

```bash
# Test A record
dig zionterranova.com +short
# Očekáváno: 91.98.122.165

dig www.zionterranova.com +short
# Očekáváno: 91.98.122.165

# Test wildcard
dig anything.zionterranova.com +short
# Očekáváno: 91.98.122.165 (NE 62.109.151.80!)

# Test MX records
dig zionterranova.com MX +short

# Test TXT records
dig zionterranova.com TXT +short

# Test CAA records
dig zionterranova.com CAA +short
```

### **2. Online DNS test nástroje**

- **DNSChecker:** https://dnschecker.org/
  - Zadej: `zionterranova.com`
  - Check propagaci po celém světě

- **MXToolbox:** https://mxtoolbox.com/
  - **DNS Lookup:** Kontrola všech records
  - **SPF Check:** Validace SPF
  - **DMARC Check:** Validace DMARC

- **DKIM Validator:** https://dkimvalidator.com/
  - Test DKIM signature

### **3. Email Security Score**

- **Mail-Tester:** https://www.mail-tester.com/
  - Pošli testovací email
  - Získáš score /10 (cíl: 10/10)

### **4. SSL/CAA Check**

- **SSL Labs:** https://www.ssllabs.com/ssltest/
  - Test SSL konfigurace
  - Mělo by být: A+ rating

- **CAA Lookup:** https://caatest.co.uk/
  - Zadej: `zionterranova.com`
  - Ověř CAA records

---

## 📧 **EMAIL KONFIGURACE**

### **Co máš (Webglobe hosting):**

✅ MX records správně nastaveny  
✅ SPF record funkční  
⚠️ DMARC slabý (p=none)  
❌ DKIM chybí  

### **Emailové účty (vytvoř v Webglobe):**

```
info@zionterranova.com           - Obecná komunikace
support@zionterranova.com        - Technická podpora
security@zionterranova.com       - Bezpečnostní reporty
dev@zionterranova.com            - Vývojová komunikace
press@zionterranova.com          - Media kontakt
partnerships@zionterranova.com   - Partnerství
noreply@zionterranova.com        - Automatické emaily
```

### **SMTP nastavení (pro ZION aplikace):**

```ini
SMTP_HOST=smtp.webglobe.cz
SMTP_PORT=587
SMTP_USER=noreply@zionterranova.com
SMTP_PASS=your_password_here
SMTP_FROM=noreply@zionterranova.com
SMTP_TLS=true
```

---

## 🔒 **BEZPEČNOSTNÍ DOPORUČENÍ**

### **1. Email Security Headers**

Když posíláš emaily z ZION aplikace, přidej tyto headers:

```python
headers = {
    'From': 'ZION Network <noreply@zionterranova.com>',
    'Reply-To': 'support@zionterranova.com',
    'Return-Path': 'noreply@zionterranova.com',
    'X-Mailer': 'ZION Blockchain v2.8.3',
    'X-Priority': '3',
}
```

### **2. DNSSEC (Optional - pokročilá ochrana)**

Zapni DNSSEC v Webglobe admin panelu:
- Chrání před DNS spoofing útoky
- Validace integrity DNS záznamů
- Vyžaduje podporu u registrátora

### **3. Monitoring**

Setup monitoring pro:
```bash
# DNS uptime
uptime.robot.com → Monitor DNS

# Email deliverability
postmarkapp.com → Email monitoring

# SSL expiration
ssllabs.com → SSL monitoring
```

---

## ⚡ **QUICK REFERENCE - Co změnit TEĎ**

### **Priorita 1 (KRITICKÉ):**
```
✅ Změň wildcard (*) z 62.109.151.80 → 91.98.122.165
✅ Přidej CAA records pro Let's Encrypt
```

### **Priorita 2 (DŮLEŽITÉ):**
```
✅ Updatuj DMARC na p=quarantine
✅ Updatuj SPF (přidej ip4:91.98.122.165)
✅ Získej DKIM key od Webglobe
```

### **Priorita 3 (DOPORUČENO):**
```
✅ Přidej explicitní A records (api, mining, explorer)
✅ Vytvoř emailové účty
✅ Nastav email forwarding
```

---

## 📞 **PODPORA**

### **Webglobe Support:**
- **Web:** https://www.webglobe.cz/podpora
- **Email:** podpora@webglobe.cz
- **Telefon:** +420 542 427 777

### **Co říct supportu:**

```
Předmět: DKIM konfigurace pro zionterranova.com

Dobrý den,

Potřebuji nastavit DKIM pro doménu zionterranova.com.
Mohl byste mi prosím poskytnout:
1. DKIM public key pro DNS TXT record
2. Instrukce pro konfiguraci DKIM signature

Děkuji,
Yeshuae Amon Ra
```

---

## ✅ **CHECKLIST**

Po aplikování změn:

- [ ] Wildcard (*) směřuje na 91.98.122.165
- [ ] DMARC nastaven na p=quarantine
- [ ] SPF obsahuje ip4:91.98.122.165
- [ ] CAA records přidány
- [ ] DKIM key získán a nakonfigurován
- [ ] Emailové účty vytvořeny
- [ ] DNS propagace ověřena (dig)
- [ ] Email security tested (mail-tester.com)
- [ ] SSL test passed (ssllabs.com)
- [ ] Website funguje na www.zionterranova.com

---

## 🎉 **ZÁVĚR**

Tvoje DNS je **80% správně** nakonfigurována! 

**Co musíš změnit:**
1. Wildcard record (5 minut)
2. DMARC politika (2 minuty)
3. SPF update (2 minuty)
4. CAA records (5 minut)
5. DKIM setup (vyžaduje Webglobe support)

**Celková doba:** ~30 minut práce + čekání na DKIM od supportu

Po těchto změnách budeš mít **production-ready** DNS konfiguraci s maximální bezpečností! 🚀

---

**Poslední aktualizace:** 29. října 2025  
**ZION DNS Configuration Guide**
