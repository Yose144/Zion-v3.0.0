# EVIDENCE ZPRACOVÁNÍ OSOBNÍCH ÚDAJŮ (GDPR)
## Záznam dle čl. 30 nařízení (EU) 2016/679 (GDPR)

---

**Správce:** Omnity.One s.r.o., IČO: 09120050  
**Datum vytvoření:** 18. prosince 2025  
**Verze:** 1.0  
**Poslední aktualizace:** 18. prosince 2025

---

## 1. IDENTIFIKACE SPRÁVCE

**Název organizace:** Omnity.One s.r.o.  
**IČO:** 09120050  
**DIČ:** CZ09120050  
**Právní forma:** Společnost s ručením omezeným

**Adresa:**  
Horní Čermná, 561 56  
Česká republika

**Kontaktní údaje:**  
Email: privacy@omnity.one  
Telefon: [DOPLNIT]  
Web: https://zionterranova.com

**Statutární zástupce:**  
Jméno: Yosef Hubálek  
Funkce: Jednatel  
Email: yosef.hubalek@gmail.com

---

## 2. POVĚŘENEC PRO OCHRANU OSOBNÍCH ÚDAJŮ (DPO)

**Povinnost jmenovat DPO:** Dobrovolně (nejsme orgán veřejné moci, není hromadné monitorování)

**Jmenovaný DPO:**  
Jméno: Yosef Hubálek  
Email: dpo@omnity.one  
Telefon: [DOPLNIT]

**Datum jmenování:** 15. prosince 2025

**Působnost:**
- Kontrola dodržování GDPR
- Poradenství zaměstnancům
- Spolupráce s ÚOOÚ
- Kontaktní bod pro subjekty údajů

---

## 3. EVIDENCE ČINNOSTÍ ZPRACOVÁNÍ

### ČINNOST #1: KYC/AML OVĚŘENÍ INVESTORŮ

**Název činnosti:** Identifikace a verifikace investorů (KYC)

**Účel zpracování:**
- Plnění zákonné povinnosti dle zákona č. 253/2008 Sb. (AML)
- Prevence praní špinavých peněz a financování terorismu
- Plnění smlouvy (presale)

**Právní základ:**
- Čl. 6(1)(b) GDPR - Plnění smlouvy (presale purchase agreement)
- Čl. 6(1)(c) GDPR - Právní povinnost (zákon č. 253/2008 Sb.)
- Čl. 6(1)(f) GDPR - Oprávněný zájem (fraud prevention)

**Kategorie subjektů údajů:**
- Potenciální investoři (zájemci o presale)
- Investoři (uzavřená smlouva)
- Politicky exponované osoby (PEP)

**Kategorie osobních údajů:**

**Základní identifikační údaje:**
- Jméno a příjmení
- Datum narození
- Rodné číslo (ČR) / číslo občanského průkazu
- Státní občanství
- Pohlaví

**Kontaktní údaje:**
- Email
- Telefonní číslo
- Adresa trvalého bydliště
- Korespondenční adresa (pokud odlišná)

**Dokladové údaje:**
- Sken občanského průkazu / pasu (obě strany)
- Selfie s dokladem (liveness check)
- Proof of Address (vyúčtování energií, bankovní výpis)
- Číslo dokladu, vydavatel, platnost

**Finanční údaje:**
- Zdroj finančních prostředků (Source of Funds)
- Výše investice (EUR/CZK)
- Číslo bankovního účtu (pokud bankovní převod)
- Crypto adresa (pokud platba crypto)

**Citlivé údaje (zvláštní kategorie):**
- Biometrické údaje (selfie pro facial recognition) - čl. 9 GDPR
- Politický status (PEP screening) - veřejně dostupné informace

**Právní základ zpracování citlivých údajů:**
- Čl. 9(2)(a) GDPR - Výslovný souhlas (pro biometrické údaje)
- Čl. 9(2)(g) GDPR - Důležitý veřejný zájem (AML prevence)

**Příjemci osobních údajů:**

**Interní:**
- KYC Team (analyzátoři)
- AML Officer (compliance)
- Jednatel (schvalování EDD cases)

**Externí (zpracovatelé):**
- **Sumsub** (KYC/AML vendor, Dublin/EU)
  - Facial recognition
  - Document verification
  - Sanction screening
  - PEP screening
- **AWS** (cloud hosting, Frankfurt/EU)
  - Database storage
  - Backup
- **Mailchimp** (email marketing, USA - Standard Contractual Clauses)
  - Investor communications

**Mezinárodní přenosy:**
- USA (Mailchimp) - Standard Contractual Clauses (SCCs) dle čl. 46 GDPR
- Non-EU: ŽÁDNÉ (kromě USA s ochranou)

**Doba uložení:**
- **10 let** od ukončení obchodního vztahu (AML zákonná povinnost)
- Po uplynutí: Anonymizace nebo výmaz

**Automatizované rozhodování:**
- Částečně ANO - automatický KYC scoring (low/medium/high risk)
- Finální rozhodnutí: Lidský reviewer (AML Officer)

**Technická a organizační opatření:**
- **Šifrování:** AES-256-GCM (at rest), TLS 1.3 (in transit)
- **Přístupová práva:** Role-based access control (RBAC)
- **2FA:** Povinné pro všechny adminy
- **Audit log:** Všechny přístupy logované
- **Backup:** Denní automatický backup, šifrovaný offsite
- **Penetrační testy:** Ročně (externí vendor)

---

### ČINNOST #2: PRESALE TRANSAKCE

**Název činnosti:** Zpracování plateb a distribuce tokenů

**Účel zpracování:**
- Plnění smlouvy (presale purchase)
- Vedení účetnictví
- Compliance reporting (ČNB, FAÚ)

**Právní základ:**
- Čl. 6(1)(b) GDPR - Plnění smlouvy
- Čl. 6(1)(c) GDPR - Právní povinnost (účetní, daňová)

**Kategorie subjektů údajů:**
- Investoři (koupili tokeny)

**Kategorie osobních údajů:**
- Jméno a příjmení
- Email
- Částka investice (EUR/CZK)
- Datum transakce
- Platební metoda (bank transfer / card / crypto)
- Číslo faktury
- ZION wallet adresa (blockchain)
- Počet zakoupených tokenů

**Příjemci:**
- **Stripe** (payment processor, USA/EU - SCCs)
- **Coinbase Commerce** (crypto payments, USA - SCCs)
- **Fio banka** (bankovní převody, ČR)
- **Účetní** (Trivi.cz, ČR)
- **ČNB** (reporting presale)
- **FAÚ** (AML reporting)
- **Finanční úřad** (daňové přiznání)

**Doba uložení:**
- **10 let** od transakce (účetní zákon č. 563/1991 Sb.)

**Technická opatření:**
- **Payment tokenization** (Stripe - nevidíme čísla karet)
- **Blockchain privacy** (stealth addresses)
- **Šifrování:** AES-256-GCM

---

### ČINNOST #3: MARKETING & KOMUNIKACE

**Název činnosti:** Email marketing a investor relations

**Účel zpracování:**
- Informování o projektu
- Presale updates
- Post-TGE komunikace (MainNet launch, token distribution)

**Právní základ:**
- Čl. 6(1)(a) GDPR - Souhlas (pro marketing)
- Čl. 6(1)(b) GDPR - Plnění smlouvy (transaktní emaily)

**Kategorie subjektů údajů:**
- Newsletter subscribers
- Investoři

**Kategorie osobních údajů:**
- Email
- Jméno (pokud poskytnuto)
- IP adresa (při registraci)
- User-agent (prohlížeč)
- Newsletter open rates (tracking)

**Příjemci:**
- **Mailchimp** (USA - SCCs)
- **Google Analytics** (USA - anonymizované IP)

**Doba uložení:**
- Do odvolání souhlasu
- Max. 3 roky od poslední aktivity (neaktivní subscribers)

**Právo na odvolání:**
- Unsubscribe link v každém emailu
- Request na privacy@omnity.one

**Technická opatření:**
- Double opt-in (potvrzení souhlasu)
- Easy unsubscribe
- Anonymizované IP tracking

---

### ČINNOST #4: WEBOVÁ ANALYTIKA

**Název činnosti:** Sledování návštěvnosti webu

**Účel zpracování:**
- Zlepšení uživatelské zkušenosti
- Marketingová analýza
- Bezpečnostní monitoring (DDoS detection)

**Právní základ:**
- Čl. 6(1)(f) GDPR - Oprávněný zájem (web optimization)
- Souhlas (cookie consent pro non-essential cookies)

**Kategorie subjektů údajů:**
- Návštěvníci webu (https://zionterranova.com, https://newearth.cz)

**Kategorie osobních údajů:**
- IP adresa (anonymizovaná)
- User-agent (prohlížeč, OS)
- Referrer URL (odkud přišel)
- Page views, čas na stránce
- Geo-lokace (země, město)

**Příjemci:**
- **Google Analytics** (USA - SCCs, anonymized IP)
- **Cloudflare** (USA/EU - SCCs, DDoS protection)

**Doba uložení:**
- 14 měsíců (Google Analytics default)
- Cookies: max. 13 měsíců (ePrivacy Directive)

**Cookies:**
- **Nezbytné:** Session cookies (authentication)
- **Analytické:** Google Analytics (`_ga`, `_gid`)
- **Marketingové:** Tracking pixels (Facebook, Twitter) - POUZE se souhlasem

**Cookie consent:** Cookie banner s granulárním souhlasem (accept all / customize)

---

### ČINNOST #5: PODPORA & HELPDESK

**Název činnosti:** Zákaznická podpora (investor support)

**Účel zpracování:**
- Odpovědi na dotazy
- Řešení problémů (KYC issues, payment issues)
- Bug reports

**Právní základ:**
- Čl. 6(1)(b) GDPR - Plnění smlouvy
- Čl. 6(1)(f) GDPR - Oprávněný zájem (customer satisfaction)

**Kategorie subjektů údajů:**
- Investoři
- Potenciální investoři
- Uživatelé (po MainNet launch)

**Kategorie osobních údajů:**
- Email
- Jméno
- Obsah dotazu (může obsahovat osobní údaje)
- IP adresa (anti-spam)
- User-agent

**Příjemci:**
- Support team (interní)
- **Zendesk** (USA - SCCs) - helpdesk software

**Doba uložení:**
- 3 roky od poslední komunikace
- Nebo do vyřešení issue (pokud kratší)

---

## 4. PRÁVA SUBJEKTŮ ÚDAJŮ

### 4.1 Právo na přístup (čl. 15 GDPR)

**Požadavek:** Subjekt chce vědět, jaké údaje zpracováváme

**Postup:**
1. Ověření totožnosti (email verification + security questions)
2. Vygenerování GDPR exportu (PDF/CSV)
3. Zaslání do 1 měsíce (max. 3 měsíce pokud komplexní)

**Obsah:**
- Účely zpracování
- Kategorie údajů
- Příjemci
- Doba uložení
- Práva (oprava, výmaz, omezení)
- Právo podat stížnost ÚOOÚ

### 4.2 Právo na opravu (čl. 16 GDPR)

**Požadavek:** Subjekt chce opravit nesprávné údaje

**Postup:**
1. Ověření totožnosti
2. Verifikace změny (pokud KYC data, re-screening)
3. Aktualizace v databázi
4. Potvrzení emailem

**Lhůta:** Bez zbytečného odkladu (obvykle do 7 dnů)

### 4.3 Právo na výmaz (čl. 17 GDPR) - "Právo být zapomenut"

**Požadavek:** Subjekt chce smazat své údaje

**POZOR:** Výmaz **NENÍ MOŽNÝ** během 10leté AML retention období!

**Postup:**
1. Kontrola, zda jsou splněny podmínky výmazu
2. Pokud ANO: Výmaz z databáze + backup
3. Pokud NE: Odůvodnění odmítnutí (AML povinnost)

**Důvody odmítnutí výmazu:**
- Právní povinnost (AML retention 10 let)
- Účetní retention (10 let)
- Právní nárok (sporná transakce)

**Možná alternativa:** Anonymizace (pokud splňuje zákon)

### 4.4 Právo na omezení zpracování (čl. 18 GDPR)

**Požadavek:** Subjekt chce pozastavit zpracování

**Postup:**
1. Označení záznamu jako "restricted"
2. Pouze ukládání, žádné další zpracování
3. Notifikace příjemcům (Sumsub, AWS)

**Lhůta:** Okamžitě (do 24h)

### 4.5 Právo na přenositelnost (čl. 20 GDPR)

**Požadavek:** Subjekt chce údaje v strojově čitelném formátu

**Postup:**
1. Export dat (JSON/CSV)
2. Zaslání emailem nebo download link

**Formát:** JSON, CSV, XML (machine-readable)

**Lhůta:** 1 měsíc

### 4.6 Právo vznést námitku (čl. 21 GDPR)

**Požadavek:** Subjekt nesouhlasí se zpracováním (zejména marketing)

**Postup:**
1. Okamžité zastavení sporného zpracování (např. unsubscribe)
2. Posouzení, zda můžeme pokračovat (vyvážené zájmy)

**Marketing:** VŽDY vyhovět (unsubscribe)  
**AML/KYC:** Nelze vyhovět (právní povinnost)

---

## 5. INCIDENTY NARUŠENÍ ZABEZPEČENÍ (DATA BREACHES)

### 5.1 Co je incident?

- Neoprávněný přístup k databázi
- Ztráta/krádež zařízení s osobními údaji
- Ransomware útok
- Lidská chyba (email na wrong recipient)
- Hacking

### 5.2 Postup při incidentu

**Fáze 1: IDENTIFIKACE (0-1 hodina)**
1. Detekce incidentu (monitoring, report)
2. Eskalace na DPO a jednatele
3. Aktivace incident response teamu

**Fáze 2: CONTAINMENT (1-4 hodiny)**
1. Izolace postiženého systému
2. Zmrazení přístupu (revoke credentials)
3. Zabránění dalšího úniku

**Fáze 3: VYŠETŘOVÁNÍ (4-24 hodin)**
1. Zjištění rozsahu (kolik osob, jaké údaje)
2. Identifikace útočníka (pokud možné)
3. Root cause analysis

**Fáze 4: REPORTING (24-72 hodin)**

**ÚOOÚ notifikace (čl. 33 GDPR):**
- **Lhůta:** Do **72 hodin** od zjištění incidentu
- **Email:** posta@uoou.cz
- **Telefon:** +420 234 665 111

**Obsah hlášení:**
- Popis incidentu
- Kategorie a počet dotčených osob
- Pravděpodobné následky
- Opatření k nápravě
- Kontakt na DPO

**Notifikace subjektů údajů (čl. 34 GDPR):**
- **Kdy:** Pokud je vysoké riziko pro práva subjektů (např. riziko identity theft)
- **Forma:** Email (individuální) nebo veřejné oznámení (pokud nepřiměřené náklady)

**Fáze 5: NÁPRAVA (1-4 týdny)**
1. Oprava zranitelnosti
2. Změna hesel/klíčů
3. Penetrační test
4. Update politik
5. Školení zaměstnanců

**Fáze 6: DOKUMENTACE**
- Záznam incidentu do registru
- Lessons learned
- Update incident response planu

### 5.3 Registr incidentů

**Povinnost:** Vést evidenci všech incidentů (i těch bez reportu ÚOOÚ)

**Obsah:**
- Datum a čas
- Popis incidentu
- Rozsah dopadu
- Opatření
- Hlášeno ÚOOÚ? (ANO/NE)
- Hlášeno subjektům? (ANO/NE)

---

## 6. ZPRACOVATELÉ (PROCESSORS)

### 6.1 Seznam zpracovatelů

| Zpracovatel | Služba | Země | Ochrana |
|-------------|--------|------|---------|
| Sumsub | KYC/AML | EU (Dublin) | GDPR |
| AWS | Cloud hosting | EU (Frankfurt) | GDPR |
| Stripe | Payments | USA/EU | SCCs |
| Coinbase Commerce | Crypto payments | USA | SCCs |
| Mailchimp | Email marketing | USA | SCCs |
| Google Analytics | Web analytics | USA | SCCs, anonymized IP |
| Zendesk | Helpdesk | USA | SCCs |
| Cloudflare | CDN, DDoS protection | USA/EU | SCCs |

### 6.2 Smlouvy o zpracování (DPA - Data Processing Agreements)

**Povinnost:** Písemná smlouva s každým zpracovatelem (čl. 28 GDPR)

**Obsah:**
- Předmět a doba zpracování
- Povaha a účel zpracování
- Typ osobních údajů
- Kategorie subjektů údajů
- Povinnosti a práva správce
- Bezpečnostní opatření zpracovatele
- Subdodavatelé (povolit pouze se souhlasem)
- Asistence při výkonu práv subjektů
- Notifikace incidentů (do 24-48h)
- Výmaz/vrácení údajů po skončení

**Status:**
- ✅ Sumsub: DPA signed (standard terms)
- ✅ AWS: DPA signed (AWS GDPR addendum)
- ✅ Stripe: DPA signed (Stripe privacy policy)
- ✅ Coinbase: DPA signed
- ✅ Mailchimp: DPA signed
- ✅ Google: DPA signed (Google Cloud Terms)
- 🔄 Zendesk: Pending (before go-live)
- ✅ Cloudflare: DPA signed

---

## 7. POSOUZENÍ VLIVU NA OCHRANU OSOBNÍCH ÚDAJŮ (DPIA)

**Kdy povinné (čl. 35 GDPR):**
- Systematické a rozsáhlé hodnocení (profiling)
- Rozsáhlé zpracování citlivých údajů
- Systematické monitorování veřejně přístupných prostor (CCTV)

**Náš případ:**
- ❌ Neděláme rozsáhlé profilování (pouze KYC risk scoring)
- ✅ Zpracováváme biometrické údaje (selfie) → **DPIA DOPORUČENO**

### 7.1 DPIA pro KYC/Biometriku

**Popis zpracování:**
- Facial recognition (Sumsub)
- Liveness detection
- Document verification

**Rizika:**
- Falešná negativa (odmítnutí legitimního klienta)
- Falešná pozitiva (schválení fraudera)
- Biometric template leak (identity theft)

**Opatření:**
- Lidský reviewer (finální rozhodnutí)
- Šifrování biometric templates
- Vendor certifikace (Sumsub je GDPR compliant)

**Závěr:** Riziko je **přijatelné** s implementovanými opatřeními.

**Datum:** 15. prosince 2025  
**Autor:** Yosef Hubálek, DPO

---

## 8. MEZINÁRODNÍ PŘENOSY

**Kam přenášíme:**
- USA (Stripe, Coinbase, Mailchimp, Google)

**Právní základ:**
- **Standard Contractual Clauses (SCCs)** dle čl. 46 GDPR
- Approved by European Commission

**Dodatečná opatření (Schrems II):**
- Šifrování in transit (TLS)
- Šifrování at rest (AES-256)
- Anonymizace (Google Analytics)
- Právní review US surveillance laws

**Dokumentace:**
- ✅ SCCs signed s všemi US processors
- ✅ Transfer Impact Assessment (TIA) provedeno

---

## 9. ŠKOLENÍ ZAMĚSTNANCŮ

**Povinnost:** Řádné zaškolení o GDPR

**Témata:**
- Základy GDPR (čl. 5, čl. 6)
- Práva subjektů údajů (čl. 15-22)
- Data breaches (čl. 33-34)
- Tipping-off zákaz (nesmí upozornit subjekt)
- Praktické postupy (jak zpracovávat GDPR requests)

**Četnost:** Roční školení + onboarding pro nové zaměstnance

**Evidence:**
- Prezenční listiny
- Test (80%+ pass rate)
- Certifikát

---

## 10. AUDITOVÁNÍ

**Interní audit:** Čtvrtletně (během presale), poté ročně

**Kontrolované oblasti:**
- Evidence zpracování (aktuální?)
- DPA smlouvy (signed?)
- Práva subjektů (reaction time OK?)
- Incidenty (správně hlášeno?)
- Školení (všichni absolvovali?)

**Externí audit:** Dobrovolně, ročně (doporučeno)

---

## 11. KONTAKT NA ÚOOÚ

**Úřad pro ochranu osobních údajů**

**Adresa:**  
Pplk. Sochora 27  
170 00 Praha 7  
Česká republika

**Email:** posta@uoou.cz  
**Telefon:** +420 234 665 111  
**Web:** https://www.uoou.cz

**Podání stížnosti:**
- Online formulář: https://www.uoou.cz/podnet
- Email: posta@uoou.cz
- Poštou (doporučeně)

**Lhůta:** ÚOOÚ má 60 dnů na vyřízení (+ 30 dnů prodloužení pokud komplexní)

---

## 12. REVIZE A AKTUALIZACE

**Četnost:** Minimálně ročně nebo při změnách

**Trigger events:**
- Nová činnost zpracování
- Změna zpracovatele
- Změna legislativy
- Data breach
- Stížnost subjektu

**Schválení aktualizace:**
- DPO + jednatel

---

## 13. PŘÍLOHY

1. ✅ Jmenovací dekret DPO
2. ✅ DPA smlouvy (Sumsub, AWS, Stripe, atd.)
3. ✅ Privacy Policy (veřejná)
4. ✅ Cookie Policy
5. ✅ DPIA (biometrické zpracování)
6. ✅ Registr incidentů (prázdný template)
7. ✅ GDPR request formuláře (přístup, výmaz, oprava)

---

## 14. PROHLÁŠENÍ

Prohlašuji, že tato evidence zpracování osobních údajů je úplná a odpovídá skutečnosti ke dni 18. prosince 2025.

**Datum:** 18. prosince 2025

**Podpis DPO:**

\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_  
Yosef Hubálek  
Pověřenec pro ochranu osobních údajů  
Email: dpo@omnity.one

**Podpis jednatele:**

\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_  
Yosef Hubálek  
Jednatel, Omnity.One s.r.o.  
IČO: 09120050

---

**Status:** ✅ AKTUÁLNÍ  
**Další revize:** 18. prosince 2026  
**Uloženo:** `docs/legal/GDPR_EVIDENCE_ZPRACOVANI.md`

**JAI RAM! 🕉️**
