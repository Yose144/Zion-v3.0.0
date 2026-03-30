# 🚨 NÁVOD PRO ROOT: Oprava P0 Credentials (Google Cloud)

**Priorita:** P0 (Kritická) - Blokuje spuštění Presale  
**Cíl:** Vygenerovat a nahrát soubor `presale-credentials.json`, aby fungovaly emaily a QR kódy.

---

## 📋 Co je potřeba udělat (Rychlý přehled)

Náš systém potřebuje "klíč" k Google Cloudu, aby mohl odesílat emaily a ukládat soubory. Tento klíč musíte vygenerovat v Google konzoli a nahrát na server.

---

## 🛠️ Postup k vygenerování klíče

### 1. Přihlášení do Google Cloud
1. Jděte na [console.cloud.google.com](https://console.cloud.google.com/).
2. Přihlaste se administrátorským účtem projektu ZION.
3. V horní liště vyberte správný projekt (např. `zion-presale` nebo `zion-production`).

### 2. Vytvoření Service Accountu (pokud neexistuje)
*Pokud už máte účet (např. `presale-bot@...`), přeskočte na bod 3.*

1. V menu (vlevo) jděte na **IAM & Admin** > **Service Accounts**.
2. Klikněte na **+ CREATE SERVICE ACCOUNT**.
3. **Name:** Např. `presale-bot`.
4. **Access:** Dejte mu tyto role:
   - `Storage Admin` (pro ukládání QR kódů)
   - `Pub/Sub Editor` (pokud používáte pro events)
   - *Případně další role, pokud používáte Gmail API pro SendGrid relay.*
5. Klikněte **Done**.

### 3. Vygenerování JSON klíče
1. V seznamu Service Accounts najděte ten účet (např. `presale-bot@...`).
2. Klikněte na tři tečky vpravo (Actions) -> **Manage keys**.
3. Klikněte na **ADD KEY** > **Create new key**.
4. Vyberte typ **JSON**.
5. Klikněte **CREATE**.
6. **Soubor se vám automaticky stáhne do počítače.** (Uložte si ho bezpečně!)

---

## 📤 Postup nahrání na server

### 1. Přejmenování
Přejmenujte stažený soubor (např. `zion-project-12345-abcdef.json`) na přesný název:
**`presale-credentials.json`**

### 2. Upload (Dvě možnosti)

#### Možnost A: Přes terminál (SCP/SFTP)
Pokud máte přístup přes terminál, spusťte tento příkaz ze svého počítače (nahraďte `user@ip` vašimi údaji):

```bash
# Nahrajte soubor do složky config v rootu projektu
scp /cesta/k/presale-credentials.json root@91.98.122.165:/root/zion-v2.9/config/
```

#### Možnost B: Ruční vytvoření (Nano/Vim)
1. Otevřete stažený JSON soubor v textovém editoru (Notepad, TextEdit).
2. Zkopírujte celý obsah (včetně závorek `{}`).
3. Připojte se na server přes SSH.
4. Jděte do složky projektu a vytvořte soubor:
   ```bash
   cd /root/zion-v2.9/config/  # Nebo /Users/yeshuae/Desktop/ZION/Zion-2.9-main/config/ pro local
   nano presale-credentials.json
   ```
5. Vložte obsah (CMD+V nebo click pravým > Paste).
6. Uložte (Ctrl+O, Enter) a ukončete (Ctrl+X).

---

## ✅ Ověření funkčnosti

Jakmile je soubor na místě, restartujte službu API (pokud běží v Dockeru):

```bash
docker-compose restart api
```

Nebo pokud testujete lokálně:

1. Spusťte testovací skript (pokud existuje) nebo zkuste generovat peněženku přes API.
2. Sledujte logy - chyba `Credentials missing` by měla zmizet.
