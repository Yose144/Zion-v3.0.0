# 📋 CHECKLIST LEGAL & COMPLIANCE DOKUMENTŮ
## Kompletní přehled před spuštěním presale (1.2.2026)

---

**Datum:** 18. prosince 2025  
**Status:** 🔄 IN PROGRESS  
**Deadline:** 31. ledna 2026 (1 den před presale start)

---

## ✅ HOTOVÉ DOKUMENTY (11/18)

### 1. ✅ Základní legal dokumenty
- [x] **WHITEPAPER_ZION_TOKEN_CZ.md** (788 řádků) - Česká verze
- [x] **WHITEPAPER_ZION_TOKEN.md** (757 řádků) - Anglická verze
- [x] **TERMS_AND_CONDITIONS_CZ.md** (554 řádků) - Obchodní podmínky
- [x] **PRIVACY_POLICY_GDPR_CZ.md** (570 řádků) - GDPR policy
- [x] **AML_KYC_POLICY_CZ.md** (1200+ řádků) - AML/KYC procedures
- [x] **RISK_DISCLOSURE_CZ.md** (851 řádků) - Rizikové prohlášení
- [x] **ADMIN_PROCEDURES_CZ.md** (718 řádků) - Procedurální příručka
- [x] **PODNIKATELSKY_ZAMER_OMNITY_ONE.md** (695 řádků) + PDF

### 2. ✅ Compliance dokumenty (NOVĚ VYTVOŘENO)
- [x] **CNB_NOTIFIKACE_EMAIL.md** - Ready-to-send email pro ČNB
- [x] **FAU_REGISTRACE_AML.md** - Registrace u FAÚ jako povinná osoba
- [x] **GDPR_EVIDENCE_ZPRACOVANI.md** - Evidence dle čl. 30 GDPR

---

## 🔄 ZBÝVÁ DOPLNIT (7/18)

### 3. 🔄 Firemní dokumenty
- [ ] **Výpis z OR** (ne starší 3 měsíce)
  - Objednat: https://or.justice.cz
  - IČO: 09120050
  - Cena: 100 Kč
  - Termín: 5-10 dnů
  - **TODO:** Objednat do 20.12.2025!

- [ ] **Stanovy společnosti** (Omnity.One s.r.o.)
  - Kde: U notáře nebo OR archiv
  - **TODO:** Vyžádat kopii

- [ ] **Smlouva o výkonu funkce jednatele**
  - **TODO:** Vytvořit (pokud neexistuje)

- [ ] **Jmenovací dekret AML Officera**
  - Template: `docs/legal/templates/`
  - Podepsat: Jednatel (Yosef Hubálek)
  - **TODO:** Vytvořit a podepsat

- [ ] **Jmenovací dekret DPO** (Data Protection Officer)
  - Template: `docs/legal/templates/`
  - Podepsat: Jednatel
  - **TODO:** Vytvořit a podepsat

### 4. 🔄 Smlouvy se zpracovateli (DPA - Data Processing Agreements)
- [x] **Sumsub** (KYC/AML) - ✅ Signed (standard terms)
- [x] **AWS** (Cloud hosting) - ✅ Signed (AWS GDPR addendum)
- [x] **Stripe** (Payments) - ✅ Signed (Stripe privacy policy)
- [x] **Coinbase Commerce** - ✅ Signed
- [x] **Mailchimp** - ✅ Signed
- [x] **Google Analytics** - ✅ Signed (Google Cloud Terms)
- [x] **Cloudflare** - ✅ Signed
- [ ] **Zendesk** (Helpdesk) - 🔄 Pending
  - **TODO:** Sign before go-live

### 5. 🔄 Interní politiky a šablony
- [ ] **Incident Response Plan** (data breaches)
  - Template: Based on GDPR_EVIDENCE
  - **TODO:** Vytvořit detailní playbook

- [ ] **GDPR Request Forms** (přístup, výmaz, oprava)
  - Template: Google Forms nebo Zendesk
  - **TODO:** Vytvořit formuláře

### 6. 🔄 Dodatečné dokumenty (nice-to-have)
- [ ] **Cookie Policy** (samostatný dokument)
  - Nebo: Součást Privacy Policy
  - **TODO:** Extract z Privacy Policy

- [ ] **FAQ pro investory** (legal questions)
  - Template: Markdownový soubor
  - **TODO:** Vytvořit based on common questions

---

## 📧 ÚŘEDNÍ KORESPONDENCE

### ČNB (Česká národní banka)
- [ ] **Notifikace MiCA** (čl. 4)
  - Dokument: `CNB_NOTIFIKACE_EMAIL.md` ✅
  - Přílohy: 8 PDF dokumentů
  - **TODO BEFORE SENDING:**
    - [ ] Doplnit telefonní číslo
    - [ ] Připravit všechny PDF
    - [ ] Získat aktuální Výpis z OR
    - [ ] Vytisknout, podepsat, oskenovat
    - [ ] Přiložit razítko společnosti
  - **Termín odeslání:** Do 15.1.2026 (před presale start)
  - **Email:** podatelna@cnb.cz

### FAÚ (Finanční analytický úřad)
- [ ] **Registrace povinné osoby** (AML/KYC)
  - Dokument: `FAU_REGISTRACE_AML.md` ✅
  - Přílohy: Výpis OR, doklady jednatele, AML politika
  - **TODO BEFORE SENDING:**
    - [ ] Doplnit datum narození
    - [ ] Doplnit rodné číslo
    - [ ] Doplnit adresu trvalého bydliště
    - [ ] Doplnit telefonní číslo
    - [ ] Připravit sken dokladu totožnosti
    - [ ] Vytvořit jmenovací dekret AML Officera
    - [ ] Vytisknout, podepsat, oskenovat
  - **Termín odeslání:** Do 15.1.2026
  - **Email:** podatelna@fscr.cz

### ÚOOÚ (Úřad pro ochranu osobních údajů)
- [ ] **GDPR Evidence zpracování** (čl. 30)
  - Dokument: `GDPR_EVIDENCE_ZPRACOVANI.md` ✅
  - Povinnost: Mít připravenou (není třeba odesílat preventivně)
  - **TODO:**
    - [ ] Vytisknout a archivovat
    - [ ] Uložit v kanceláři (přístup pro kontrolu)
  - **Kontakt:** posta@uoou.cz (pouze při kontrole/stížnosti)

---

## 🔐 TECHNICKÉ NÁLEŽITOSTI

### Razítko společnosti
- [ ] **Objednat/vyrobit razítko**
  - Text: "Omnity.One s.r.o. | IČO: 09120050"
  - **TODO:** Objednat (online, 2-5 dnů)

### Elektronický podpis
- [ ] **Uznávaný elektronický podpis** (volitelné, ale doporučeno)
  - Poskytovatel: PostSignum, eIdentity
  - Cena: ~1000 Kč/rok
  - **TODO:** Zvážit (není nutné pro MiCA)

### Chybějící osobní údaje
- [ ] **Telefonní číslo** (firemní nebo jednatel)
  - Použití: ČNB notifikace, FAÚ registrace, web
  - **TODO:** Doplnit do všech dokumentů

- [ ] **Datum narození** (jednatel)
  - Použití: FAÚ registrace (UBO identification)
  - **TODO:** Připravit (GDPR sensitive!)

- [ ] **Rodné číslo** (jednatel)
  - Použití: FAÚ registrace
  - **TODO:** Připravit (vysoce citlivé!)

- [ ] **Adresa trvalého bydliště** (jednatel)
  - Použití: FAÚ registrace (UBO)
  - **TODO:** Připravit

---

## 📂 PDF GENEROVÁNÍ

### Dokumenty k převodu na PDF:
- [x] **PODNIKATELSKY_ZAMER_OMNITY_ONE.pdf** (✅ hotovo 870 KB)
- [ ] **WHITEPAPER_ZION_TOKEN_CZ.pdf**
- [ ] **WHITEPAPER_ZION_TOKEN.pdf** (EN)
- [ ] **TERMS_AND_CONDITIONS_CZ.pdf**
- [ ] **PRIVACY_POLICY_GDPR_CZ.pdf**
- [ ] **AML_KYC_POLICY_CZ.pdf**
- [ ] **RISK_DISCLOSURE_CZ.pdf**

**Nástroj:** `convert_to_pdf.py` (Python script s weasyprint)

**TODO:**
```bash
cd /Users/yeshuae/Desktop/ZION/Zion-2.9-main
python convert_to_pdf.py WHITEPAPER_ZION_TOKEN_CZ.md
python convert_to_pdf.py TERMS_AND_CONDITIONS_CZ.md
# ... atd.
```

---

## 🗓️ TIMELINE & DEADLINES

### Prosinec 2025
- [x] **15.12.** - Vytvoření všech base dokumentů ✅
- [x] **18.12.** - Revize legal složky, opravy IČO/premine ✅
- [x] **18.12.** - Vytvoření compliance dokumentů (ČNB, FAÚ, GDPR) ✅
- [ ] **20.12.** - Objednání Výpisu z OR
- [ ] **22.12.** - PDF generování všech dokumentů
- [ ] **31.12.** - 🚀 TestNet Launch

### Leden 2026
- [ ] **5.1.** - Doplnění všech chybějících údajů (telefon, datum narození)
- [ ] **8.1.** - Jmenovací dekrety (AML Officer, DPO)
- [ ] **10.1.** - Finální kontrola všech dokumentů
- [ ] **12.1.** - Získání Výpisu z OR (pokud ještě nedorazil)
- [ ] **15.1.** - ✉️ Odeslání ČNB notifikace
- [ ] **15.1.** - ✉️ Odeslání FAÚ registrace
- [ ] **20.1.** - Čekání na odpověď ČNB/FAÚ (20 pracovních dnů)
- [ ] **31.1.** - Final check před presale launch

### Únor 2026
- [ ] **1.2.** - 🚀 **PRESALE PHASE 1 START!**

---

## ⚠️ KRITICKÉ PŘIPOMÍNKY

### MUSÍ být hotovo PŘED presale:
1. ✅ ČNB notifikace ODESLÁNA (nebo připravena k odeslání)
2. ✅ FAÚ registrace ODESLÁNA
3. ✅ Všechny PDF dokumenty připraveny
4. ✅ KYC systém funkční (Sumsub integration)
5. ✅ Payment gateway aktivní (Stripe live mode)
6. ✅ GDPR compliance kompletní

### Může počkat NA PO presale start:
- Uznávaný elektronický podpis (nice-to-have)
- Cookie Policy jako samostatný dokument (může být v Privacy Policy)
- FAQ dokument (iterativně během presale)

### NIKDY nespouštějte presale BEZ:
- ❌ ČNB notifikace
- ❌ FAÚ registrace
- ❌ Funkčního KYC
- ❌ Terms & Conditions (právně závazné!)
- ❌ Privacy Policy (GDPR compliance!)
- ❌ Risk Disclosure (investor protection!)

---

## 📊 PROGRESS TRACKING

**Celkový progres:** 11/18 dokumentů (61% hotovo)

**Breakdown:**
- ✅ **Basic legal docs:** 8/8 (100%)
- ✅ **Compliance docs:** 3/3 (100%)
- 🔄 **Firemní docs:** 0/5 (0%)
- ⏳ **PDF generation:** 1/7 (14%)
- ⏳ **Úřední korespondence:** 0/2 (0%)

**Estimated time remaining:** 10-15 hodin práce + 10-20 dnů čekání na úřady

---

## 📞 KONTAKTY

### Úřady
- **ČNB:** podatelna@cnb.cz, +420 224 411 111
- **FAÚ:** podatelna@fscr.cz, +420 257 043 111
- **ÚOOÚ:** posta@uoou.cz, +420 234 665 111

### Služby
- **Výpis z OR:** https://or.justice.cz
- **Razítko:** https://www.razitka-online.cz
- **Elektronický podpis:** PostSignum, eIdentity

### Účetní
- **Trivi.cz:** https://www.trivi.cz
- **Booking:** https://outlook.office365.com/book/Trivias@trivi.cz/

---

## 🎯 NEXT STEPS (prioritizováno)

### Tento týden (18-22.12.2025):
1. [ ] Objednat Výpis z OR (URGENTNÍ!)
2. [ ] Vygenerovat všechny PDF dokumenty
3. [ ] Vytvořit jmenovací dekrety (AML Officer, DPO)

### Příští týden (23-31.12.2025):
4. [ ] TestNet launch 31.12. (paralelně s legal prací)
5. [ ] Doplnit chybějící osobní údaje
6. [ ] Připravit podklady pro ČNB/FAÚ

### První týden leden (1-7.1.2026):
7. [ ] Finální review všech dokumentů
8. [ ] Získat Výpis z OR (pokud dorazil)
9. [ ] Připravit emaily pro ČNB/FAÚ

### Druhý týden leden (8-15.1.2026):
10. [ ] ✉️ ODESLAT ČNB notifikaci
11. [ ] ✉️ ODESLAT FAÚ registraci
12. [ ] Počkat na potvrzení

---

**Status:** ✅ 61% HOTOVO, 39% zbývá  
**Priority:** HIGH - presale za 44 dní!  
**Owner:** Yosef Hubálek (jednatel)  
**Asistence:** AI Agent (dokumentace, review)

---

**JAI RAM! Dokončíme to! 🕉️**

**"Where technology meets spirit - and compliance!"** 😄
