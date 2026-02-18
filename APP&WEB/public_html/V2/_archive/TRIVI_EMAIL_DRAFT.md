# Email draft pro Trivi (Jaroslav Ryvola)

---

**Předmět:** Re: Připojení ZION e-shopu na Trivi API - Požadavky pro zahájení integrace

---

Dobrý den,

děkujeme za zaslání úvodních informací k připojení našeho e-shopu na Trivi API.

## Potvrzení zájem o integraci

**Potvrzujeme zájem o aktivaci API** včetně vytvoření testovacího prostředí dle platného ceníku (2.980,- Kč bez DPH).

## Technická připravenost

Naše systémová infrastruktura je **připravena na integraci**:
- ✅ REST API client implementován
- ✅ Automatické odesílání dokladů při vzniku objednávky
- ✅ Error handling a retry logika (max. 3 pokusy s prodlevou)
- ✅ Logování chybových odpovědí
- ✅ Podpora souvislých číselných řad (oddělené pro e-shop a presale)

Splňujeme všechny **požadavky na fakturaci** uvedené v Vašem emailu:
- ✅ Vydané daňové doklady tvoří souvislou číselnou řadu
- ✅ Oddělené číselné řady pro faktury, zálohy a opravné doklady
- ✅ Variabilní symbol odpovídá použitému VS v platebním dokladu (unikátní)
- ✅ Žádné hromadné připisování plateb
- ✅ Každý doklad má vyplněnu adresu včetně pole "country" (země odběratele)
- ✅ Výpočet ceny "shora" (s DPH → bez DPH)
- ✅ Pro DDPZ připravena logika vystavování daňových dokladů k zálohám

## Co od Vás potřebujeme pro zahájení

Pro dokončení integrace prosíme o poskytnutí:

### 1. API Credentials
- **APP ID** (testovací i produkční prostředí)
- **APP SECRET** (testovací i produkční prostředí)

### 2. finAccount kategorie
Seznam povinných účetních kategorií pro:
- Prodej z e-shopu
- Dopravné
- Platební poplatky
- Případné další kategorie dle Vašeho doporučení

### 3. Testovací prostředí
- Přístup k testovací firmě pro ověření správnosti přenosu dat
- Seznam volných "finAccount" pro testování

### 4. API Dokumentace
- Potvrzení API endpointu (předpokládáme: `https://api.trivi.com/v2`)
- Případné upřesnění OAuth2 autentizace, pokud se liší od standardní dokumentace

## Časový harmonogram

Jsme připraveni zahájit **okamžitě po obdržení credentials**:
1. Konfigurace API klíčů (1 den)
2. Testování na testovací firmě (2-3 dny)
3. Ověření správnosti účtování s Vámi (1 den)
4. Odsouhlasení termínu začátku ostrého účtování

## Kontakt pro technické dotazy

V případě potřeby jsme k dispozici pro:
- Konzultaci správnosti nastavení propojení záloh
- Koordinaci testovacího přenosu ostrých dat
- Řešení případných technických problémů během integrace

## Další kroky

Prosíme o:
1. **Zaslání API credentials** (APP ID, APP SECRET) pro testovací prostředí
2. **Seznam finAccount kategorií** pro správné účtování
3. **Termín konzultace** s účetním konzultantem (Jaroslav Ryvola) ohledně způsobu propojení záloh a DDPZ

Těšíme se na spolupráci!

---

S pozdravem,  
**[Vaše jméno]**  
ZION Terra Nova / Omnity.One s.r.o.  
Email: [email]  
Tel: [telefon]

---

## ⚠️ POZNÁMKY (NEODESÍLAT):

**CO ZMÍNIT:**
- ✅ Připravenost na integraci
- ✅ Splnění požadavků (souvislé řady, VS, country field, výpočet shora)
- ✅ Potřeba API keys a finAccount kategorií

**CO NEZMÍNIT:**
- ❌ PHP/Python stack
- ❌ Databázové detaily (SQLite/PostgreSQL)
- ❌ Admin panel specifika
- ❌ Interní endpointy a architektura
- ❌ Wallet systém a ZION tokeny
- ❌ Presale specifika (pokud není nutné)

**TAKTIKA:**
- Jevit se jako standardní e-shop s běžnou integrací
- Zdůraznit compliance s požadavky Trivi
- Minimalizovat technické detaily
- Nechat Trivi pocit, že mají kontrolu nad procesem
