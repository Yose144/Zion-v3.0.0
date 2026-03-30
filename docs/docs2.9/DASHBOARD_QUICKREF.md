# Dashboard Replacement - Quick Reference

## ✅ Co bylo uděláno (2. prosince 2025)

### Hlavní změny:
1. ✅ `dashboard.html` - Nahrazen presale verzí (CZ)
2. ✅ `dashboard-en.html` - Vytvořena presale verze (EN)
3. ✅ Všechny zálohy vytvořeny
4. ✅ Navigation linky opraveny

---

## 📁 Souborová struktura

```
public_html/V2/
├── dashboard.html              ← MAIN (Presale CZ) 🔴🟡🟢
├── dashboard-en.html           ← MAIN (Presale EN) 🔴🟡🟢
├── dashboard-presale.js        ← JavaScript (shared)
│
├── dashboard-main-old.html     ← BACKUP (původní CZ - camp/mining)
├── dashboard-en-old.html       ← BACKUP (původní EN - camp/mining)
└── dashboard-presale-old.html  ← BACKUP (první presale verze)
```

---

## 🔗 URL Mapping

| Stará URL | Nová URL | Změna |
|-----------|----------|-------|
| `/V2/dashboard.html` | `/V2/dashboard.html` | **OBSAH ZMĚNĚN** (camp → presale) |
| `/V2/dashboard-en.html` | `/V2/dashboard-en.html` | **OBSAH ZMĚNĚN** (camp → presale) |
| `/V2/dashboard-presale.html` | **NEPŘESMĚROVÁNO** | Soubor přejmenován na dashboard.html |

**⚠️ Poznámka:** URL zůstaly stejné, pouze obsah se změnil z camp/mining dashboardu na presale dashboard.

---

## 🌐 Language Switching

### CZ → EN
```
dashboard.html → dashboard-en.html
```
**Klik:** Lang switch "CZ | **EN**"

### EN → CZ
```
dashboard-en.html → dashboard.html
```
**Klik:** Lang switch "**CZ** | EN"

---

## 🎨 Design Features (oba dashboardy)

### Rasta Theme:
- 🔴 Red: `#e41e2b`
- 🟡 Gold: `#fcd116`
- 🟢 Green: `#078930`

### Sections:
1. **Hero** - Countdown timer + CTA buttons
2. **Progress Bar** - Token sale tracking
3. **Stats Grid** - 5 metrics
4. **Presale Phases** - 3 phase cards
5. **Wallet Lookup** - Search form
6. **Recent Orders** - Live table
7. **Distribution Info** - 3 pillars
8. **Quick Actions** - Cosmic grid
9. **Footer** - Rasta style

---

## 🔧 Rychlé testy

### Test 1: Language detection
```bash
# CZ verze
curl http://localhost/V2/dashboard.html | grep 'lang="cs"'
# Očekáváno: <html lang="cs">

# EN verze
curl http://localhost/V2/dashboard-en.html | grep 'lang="en"'
# Očekáváno: <html lang="en">
```

### Test 2: Countdown units
```bash
# CZ verze
curl http://localhost/V2/dashboard.html | grep -o "DNÍ\|HODIN\|MINUT\|SEKUND"
# Očekáváno: DNÍ HODIN MINUT SEKUND

# EN verze
curl http://localhost/V2/dashboard-en.html | grep -o "DAYS\|HOURS\|MINUTES\|SECONDS"
# Očekáváno: DAYS HOURS MINUTES SECONDS
```

### Test 3: Navigation links
```bash
# CZ verze - žádné -en linky
grep 'href="./presale-en.html"' dashboard.html
# Očekáváno: ŽÁDNÝ VÝSTUP (správně)

# EN verze - má -en linky
grep 'href="./presale-en.html"' dashboard-en.html
# Očekáváno: NALEZEN (správně)
```

---

## 🚨 Troubleshooting

### Problem: Dashboard neukazuje data
**Řešení:**
```bash
# 1. Zkontrolovat API endpoint
curl http://localhost/api/presale/presale-stats.php

# 2. Zkontrolovat JavaScript konzoli (F12)
# Mělo by běžet: updateCountdown(), loadPresaleStats()

# 3. Zkontrolovat, že dashboard-presale.js je načten
curl http://localhost/V2/dashboard.html | grep "dashboard-presale.js"
```

### Problem: Lang switch nefunguje
**Řešení:**
```bash
# CZ verze - kontrola EN linku
grep 'dashboard-en.html' dashboard.html

# EN verze - kontrola CZ linku
grep 'href="./dashboard.html"' dashboard-en.html
```

### Problem: Countdown neukazuje čas
**Řešení:**
```javascript
// DevTools Console (F12)
console.log(MAINNET_LAUNCH_DATE); // Should be: 2026-12-31T00:00:00

// Check if updateCountdown() runs
setInterval(() => console.log('Countdown:', document.getElementById('days').textContent), 5000);
```

---

## 📊 Srovnání verzí

| Feature | dashboard.html (CZ) | dashboard-en.html (EN) |
|---------|---------------------|------------------------|
| **Language** | `lang="cs"` | `lang="en"` |
| **Title** | ZION Presale Dashboard | ZION Presale Dashboard |
| **Countdown** | DNÍ, HODIN, MINUT, SEKUND | DAYS, HOURS, MINUTES, SECONDS |
| **CTA** | Koupit ZION Tokeny | Buy ZION Tokens |
| **Stats** | Celkem objednávek, Zaplaceno... | Total Orders, Paid Orders... |
| **Phase Status** | Aktivní, Čeká | Active, Pending |
| **Lookup** | Vyhledávání Wallets | Wallet Lookup |
| **Loading** | Načítám objednávky... | Loading orders... |
| **Links** | presale.html, whitepaper.html | presale-en.html, whitepaper-en.html |
| **Lang Switch** | CZ \| EN → dashboard-en.html | CZ (→ dashboard.html) \| EN |

---

## 🔄 Rollback (v případě problémů)

### Krok 1: Záloha nových souborů
```bash
cd /Users/yeshuae/Desktop/ZION/Zion-2.9-main/public_html/V2
mv dashboard.html dashboard-presale-new.html
mv dashboard-en.html dashboard-presale-en-new.html
```

### Krok 2: Obnovení originálu
```bash
mv dashboard-main-old.html dashboard.html
mv dashboard-en-old.html dashboard-en.html
```

### Krok 3: Test
```bash
open http://localhost/V2/dashboard.html
# Měl by ukázat původní camp/mining dashboard
```

### Krok 4: Zpět na presale (pokud potřeba)
```bash
mv dashboard.html dashboard-main-old.html
mv dashboard-en.html dashboard-en-old.html
mv dashboard-presale-new.html dashboard.html
mv dashboard-presale-en-new.html dashboard-en.html
```

---

## ✅ Production Checklist

Před nasazením na terranova.one:

- [ ] Test localhost CZ verze
- [ ] Test localhost EN verze
- [ ] Lang switch CZ → EN funguje
- [ ] Lang switch EN → CZ funguje
- [ ] Countdown běží (394 dní)
- [ ] Progress bar animuje
- [ ] Stats načítají z API
- [ ] Wallet lookup funguje
- [ ] Recent orders zobrazují data
- [ ] Mobile responsive (test na telefonu)
- [ ] Všechny linky funkční
- [ ] Žádné console errors (F12)
- [ ] Zálohy vytvořeny
- [ ] CSS načítá (rasta.css + style.css)
- [ ] JavaScript načítá (dashboard-presale.js)

---

## 📝 Update log

| Datum | Změna | Soubory |
|-------|-------|---------|
| 2.12.2025 | Vytvoření presale dashboardu (Rasta design) | dashboard-presale.html |
| 2.12.2025 | Nahrazení hlavního dashboardu | dashboard.html |
| 2.12.2025 | Vytvoření EN verze presale | dashboard-en.html |
| 2.12.2025 | Oprava navigation linků | dashboard.html, dashboard-en.html |

---

## 🎯 Next Steps

1. ✅ **Test na localhost** - CZ i EN verze
2. ⏸️ **API connection test** - presale-stats.php
3. ⏸️ **Database setup** - pokud ještě neexistuje
4. ⏸️ **Deploy na terranova.one**
5. ⏸️ **Update external links** - pokud existují
6. ⏸️ **SEO update** - meta tags, sitemap

---

**Status: READY FOR TESTING ✅**  
**MainNet Launch: 394 dní (31. 12. 2026) 🦁**
