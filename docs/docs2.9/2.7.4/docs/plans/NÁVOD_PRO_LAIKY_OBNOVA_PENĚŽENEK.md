# 🔑 JEDNODUCHY NÁVOD PRO OBNOVU ZION PENĚŽENEK
## Pro úplné začátečníky - krok za krokem

---

## 🆘 NOUZE? RYCHLÁ OBNOVA

**Ztratil jsi přístup k ZION peněženkám? Tento návod ti pomůže!**

### Co potřebuješ:
- ✅ Papírovou zálohu NEBO šifrovaný soubor z plochy
- ✅ Heslo (pokud máš šifrovaný soubor)
- ✅ Počítač s internetem

---

## 📋 KROK 1: Najdi své zálohy

Na **Ploše (Desktop)** hledej tyto soubory:

### A) Papírová záloha (TXT soubor):
```
zion_paper_wallet_CONFIDENTIAL_20251006_234618.txt
```
- **Co je to:** Obsahuje tvoje "seed slova" (12 slov) a adresy
- **Jak otevřít:** Dvojklik → otevře se v poznámkovém bloku

### B) Šifrovaná záloha (ENC soubor):
```
zion_premine_SECURE_BACKUP_20251006_234618.enc
```
- **Co je to:** Šifrovaný balíček se všemi daty
- **Jak otevřít:** Potřebuješ heslo + následuj KROK 3

---

## 📱 KROK 2: Stáhni peněženku (doporučené aplikace)

### Pro mobil (nejjednodušší):
- **iPhone:** Trust Wallet, Coinbase Wallet
- **Android:** Trust Wallet, MetaMask

### Pro počítač:
- **Windows/Mac:** Exodus, Electrum
- **Webová:** MetaMask (rozšíření pro Chrome)

---

## 🔓 KROK 3: Obnov peněženku ze SEED SLOV

### A) Pokud máš PAPÍROVOU zálohu:

1. **Otevři TXT soubor** z plochy
2. **Najdi řádek:** `BIP39 (12 words): slovo1 slovo2 slovo3...`
3. **Zkopíruj 12 slov** (přesně v pořadí!)
4. **V aplikaci peněženky:**
   - Vyber "Import wallet" nebo "Restore from seed"
   - Zadej 12 slov (přesně, bez chyb!)
   - Potvrď

### B) Pokud máš jen ŠIFROVANÝ soubor:

**POZOR: Toto je složitější - potřebuješ technickou pomoc!**

1. Otevři Terminal (Mac) nebo Command Prompt (Windows)
2. Zadej heslo a následuj pokyny v `PREMINE_BACKUP_AND_RECOVERY.md`
3. Získáš JSON soubor s daty
4. Použij seed slova z JSON souboru

---

## 💰 KROK 4: Zkontroluj zůstatky

Po obnově peněženky zkontroluj tyto adresy a zůstatky:

| Peněženka | Očekávaný zůstatek |
|-----------|-------------------|
| 👑 Administrator | 999,000,000 ZION |
| 💻 Development Team | 1,440,000,000 ZION |
| 🌐 SITA Infrastructure | 999,000,000 ZION |
| 👶 Children Fund | 999,000,000 ZION |
| ⭐ Genesis Reward | 333,000,000 ZION |
| ⛏️ Mining Operators | 2,000,000,000 ZION (každý) |

---

## ⚠️ DŮLEŽITÉ BEZPEČNOSTNÍ TIPY

### ✅ CO DĚLAT:
- Zkontroluj adresy před posíláním velkých částek
- Udělej testovací transakci (malá částka)
- Uchovávej seed slova v trezoru/sejfu
- Nikdy nesdílej seed slova s nikým

### ❌ CO NEDĚLAT:
- Nepošli seed slova přes email/WhatsApp
- Nevkládej seed slova do internetu
- Nefoť seed slova telefonem
- Neukládej do cloudu (Google Drive, iCloud)

---

## 🔥 NOUZOVÉ KONTAKTY

**Pokud nevíš jak dál:**

1. **Zkontroluj dokumentaci:** `PREMINE_BACKUP_AND_RECOVERY.md`
2. **Technická podpora:** Kontaktuj ZION tým
3. **Komunitní pomoc:** ZION Discord/Telegram

---

## 📞 ČASTO KLADENÉ OTÁZKY

### Q: Zapomněl jsem heslo k šifrované záloze
**A:** Bez hesla se šifrovaná záloha nedá otevřít. Zkus papírovou zálohu.

### Q: Seed slova nefungují
**A:** Zkontroluj:
- Správné pořadí slov
- Žádné překlepy
- Používáš správnou peněženku (BIP39 compatible)

### Q: Nevidím správný zůstatek
**A:** Možné příčiny:
- Peněženka ještě nesynchronizovala blockchain
- Používáš špatnou síť (zkontroluj nastavení)
- Chyba při obnově (zkus znovu)

### Q: Chci poslat ZION někam jinam
**A:** POZOR! Nejdřív:
1. Udělej testovací transakci (malá částka)
2. Zkontroluj že dorazila
3. Pak teprve pošli větší částku

---

## 📅 INFORMACE O ZÁLOZE

- **Verze:** ZION 2.7.4
- **Datum vytvoření:** 6. října 2025
- **Typ:** BIP39 (12 slov)
- **Celkový premine:** 14,770,000,000 ZION

---

**💡 TIP:** Vytiskni si tento návod a uchovávaj ho s papírovou zálohou!

---

*Tento návod je určen pro nouzové situace. Pro běžné používání doporučujeme hardware peněženky (Ledger, Trezor).*