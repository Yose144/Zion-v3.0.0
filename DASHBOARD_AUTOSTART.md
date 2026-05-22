# ZION Dashboard Auto-Start

## 🚀 Co se stane po PC resetu?

**Problém:** Dashboard běží jako Python skript, takže po restartu PC se vypne.

**Řešení:** Vytvořil jsem automatický start, který dashboard spustí po každém restartu PC.

## 📁 Soubory

### 1. `start-dashboard.bat`
- Spustí dashboard server
- Nachází se v root adresáři
- Můžeš ho spustit manuálně kdykoliv

### 2. `install-dashboard-autostart.bat`
- Instaluje dashboard do Windows Startup
- Vytvoří zástupce ve složce Startup
- **Spusť jako Administrátor!**

## 🔧 Jak to nastavit

### Možnost 1: Manuální start (bez instalace)
1. Po restartu PC otevři `start-dashboard.bat`
2. Dashboard se spustí na `http://127.0.0.1:8765`

### Možnost 2: Automatický start (doporučeno)
1. Klikni pravým tlačítkem na `install-dashboard-autostart.bat`
2. Vyber "Run as Administrator"
3. Potvrď UAC dialog
4. ✅ Dashboard se nyní automaticky spustí po každém restartu PC

## 🎯 Jak to funguje

1. **Instalace:** Skript vytvoří zástupce ve složce `Startup` ve Windows
2. **Restart PC:** Windows automaticky spustí všechny programy ve složce Startup
3. **Auto-Start:** Dashboard se spustí na pozadí
4. **Přístup:** Otevři `http://127.0.0.1:8765` v prohlížeči

## 🛠️ Odinstalace

Pokud chceš odinstalovat automatický start:

1. Jdi do složky: `%APPDATA%\Microsoft\Windows\Start Menu\Programs\Startup`
2. Smaž soubor: `ZION-Dashboard.lnk`
3. Nebo použij tento příkaz:
   ```cmd
   del "%APPDATA%\Microsoft\Windows\Start Menu\Programs\Startup\ZION-Dashboard.lnk"
   ```

## 📊 Dashboard Po Restartu

Po restartu PC:

1. **Dashboard automaticky startuje** (pokud je nainstalován autostart)
2. **Běží na pozadí** - nevidíš ho, ale běží
3. **Přístup:** Otevři `http://127.0.0.1:8765`
4. **Všechny funkce:** Launch Day automatizace, monitoring, atd.

## ⚠️ Důležité

- **Python musí být nainstalovaný** a v PATH
- **Adresář projektu se nesmí přesunout** - autostart používá absolutní cesty
- **Firewall:** Pokud máš firewall, můžeš muset povolit Python pro port 8765
- **Port 8765:** Musí být volný - pokud je zabraný, dashboard se nespustí

## 🚨 Co když dashboard neběží?

Po restartu zkontroluj:

1. **Je Python nainstalovaný?** Spusť `python --version` v CMD
2. **Je port volný?** Spusť `netstat -ano | findstr :8765`
3. **Běží proces?** Spusť `tasklist | findstr python`
4. **Zkus manuální start:** Dvakrát klikni na `start-dashboard.bat`

## 🎉 Hotovo

Po instalaci autostartu se dashboard automaticky spustí po každém restartu PC a bude připraven pro Launch Day automatizaci!