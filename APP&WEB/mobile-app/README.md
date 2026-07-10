# 📱 ZION TerraNova Mobile App v3.0.5 "All Green"

**Where Technology Meets Spirit - Now in Your Pocket** 🌟

## 🎯 Overview

ZION Mobile je React Native / Expo aplikace pro Android a iOS, která přináší sílu ZION blockchainu do mobilního prostředí. Primárně slouží jako **Wallet Manager** s rozšířenými funkcemi pro monitoring, experimentální mining a **In-App Purchases** (Pro upgrade, Miner Boost, donations).

## ✨ Hlavní Funkce

### 🔐 Wallet Manager (Core)
- ✅ **Generování wallet** - Vytvoření nové ZION adresy s private/public key
- ✅ **Import/Export** - BIP39 mnemonic, private key, JSON keystore
- ✅ **QR kódy** - Skenování a generování pro snadné platby
- ✅ **Multi-wallet** - Správa více účtů najednou (Pro: unlimited, Free: 1)
- ✅ **Biometrická ochrana** - Face ID / Fingerprint unlock
- ✅ **Backup** - Šifrovaný cloud backup (iCloud/Google Drive)

### 💎 In-App Purchases (NEW v3.0.5)
- ✅ **ZION Pro** - Lifetime ($29.99) / Yearly ($9.99) / Monthly ($1.99)
  - Unlimited wallets, TX history export, advanced stats, no ads, priority support
- ✅ **Miner Boost** ($4.99 one-time)
  - GPU mining unlock, advanced auto-tuner, push notifications
- ✅ **Donations** ($4.99 / $24.99)
  - Support development, cosmetic badge
- ✅ **StoreKit 2** (iOS) + **Google Play Billing** (Android) via `react-native-iap`
- ✅ **Receipt validation** with update server (`updates.zionterranova.com/api/iap`)
- ✅ **Restore purchases** across devices
- ✅ **Offline entitlement caching** (AsyncStorage)

### 📊 Dashboard & Monitoring
- 📈 **Pool Stats** - Real-time statistiky z mining poolu
- 🎮 **Consciousness Level** - Sledování gamification progress
- 💰 **Balance & Rewards** - Aktuální zůstatek a odměny
- 📡 **Network Status** - Blockchain info, block height, hashrate
- 🔔 **Push Notifikace** - Nové bloky, payouty, achievements

### ⚡ Experimentální Mining
- ⚠️ **Varování** - Jasně zobrazené omezení (baterie, výkon)
- 🔥 **CPU Mining** - Pouze při nabíjení + WiFi
- 📊 **Real-time Metrics** - Hashrate, shares, temperature
- 🛑 **Auto-stop** - Ochrana při přehřátí nebo nízké baterii
- ⏱️ **Time Limits** - Maximální doba běhu (např. 30 min)

### 🌐 Další Funkce
- 🖥️ **Remote Miner Control** - Správa desktop minerů
- 💱 **Transaction History** - Historie transakcí a rewards
- 🌉 **wZION Bridge** - L1↔Base L2 bridging
- 🏛️ **DAO Voting** - Governance participation
- 🧠 **Hiran AI** - AI insights
- 🌍 **Multi-language** - CZ, EN, další jazyky
- 🌙 **Dark/Light Mode** - Přizpůsobení vzhledu

## 🎨 Design System

### Barvy (identické s desktop-agent)
```javascript
const colors = {
  primary: {
    gold: '#f9d976',      // ZION Gold
    cyan: '#32e6ff',      // ZION Cyan
    purple: '#9b5cff',    // ZION Purple
  },
  background: {
    dark: '#0a0c1c',      // Main dark
    card: '#1a1d35',      // Card background
    elevated: '#252844',  // Elevated surfaces
  },
  text: {
    primary: 'rgba(255,255,255,0.92)',
    secondary: 'rgba(255,255,255,0.68)',
    muted: 'rgba(255,255,255,0.45)',
  },
  consciousness: {
    physical: '#3b82f6',    // Blue
    mental: '#8b5cf6',      // Purple
    spiritual: '#ec4899',   // Pink
    cosmic: '#f59e0b',      // Orange
    onTheStar: '#eab308',   // Gold
  },
  status: {
    success: '#10b981',
    warning: '#f59e0b',
    error: '#ef4444',
    info: '#3b82f6',
  }
}
```

### Komponenty
- `GlassCard` - Průhledné panely s blur efektem
- `GradientButton` - Tlačítka s gradientem
- `ConsciousnessRing` - Kruhový progress indicator
- `StatCard` - Karty pro statistiky
- `MiningWarningModal` - Varování před mining

## 📁 Struktura Projektu

```
mobile-app/
├── src/
│   ├── screens/           # Obrazovky aplikace
│   │   ├── WalletScreen.js
│   │   ├── DashboardScreen.js
│   │   ├── MiningScreen.js
│   │   └── SettingsScreen.js
│   ├── components/        # Reusable komponenty
│   │   ├── wallet/
│   │   ├── dashboard/
│   │   ├── mining/
│   │   └── common/
│   ├── services/          # API a business logika
│   │   ├── WalletService.js
│   │   ├── PoolAPI.js
│   │   ├── MiningService.js
│   │   └── NotificationService.js
│   ├── utils/            # Utility funkce
│   │   ├── crypto.js     # Kryptografie
│   │   ├── validation.js
│   │   └── formatting.js
│   ├── navigation/       # React Navigation setup
│   ├── hooks/            # Custom React hooks
│   ├── context/          # React Context (state management)
│   └── constants/        # Konstanty, barvy, konfigurace
├── android/              # Android native code
├── ios/                  # iOS native code
└── assets/              # Obrázky, fonty, ikony
```

## 🚀 Quick Start

### Prerequisites
```bash
# Node.js 18+
node --version

# Yarn (doporučeno) nebo npm
npm install -g yarn

# React Native CLI
npm install -g react-native-cli

# Android Studio (pro Android build)
# Xcode (pro iOS build - pouze macOS)
```

### Instalace

```bash
# Přejít do složky
cd mobile-app/

# Instalace dependencies
yarn install

# iOS - instalace pods
cd ios && pod install && cd ..
```

### Vývoj

```bash
# Spustit Metro bundler
yarn start

# Android (v jiném terminálu)
yarn android

# iOS (pouze macOS)
yarn ios
```

### Build pro Production

```bash
# Android APK/AAB
yarn build:android
# Output: android/app/build/outputs/apk/release/

# iOS (macOS)
yarn build:ios
# Pak Xcode → Archive → Distribute
```

## 🔐 Bezpečnost

### Wallet Storage
- ✅ Private keys uloženy v **Keychain** (iOS) / **Keystore** (Android)
- ✅ Šifrování AES-256
- ✅ Biometrická autentizace
- ✅ Screen capture disabled při zobrazení seed phrase

### Mining Safety
- ⚠️ Automatické vypnutí při:
  - Baterie < 20%
  - Teplota > 42°C
  - Ztráta WiFi (pokud vyžadováno)
  - Screen off > 5 minut

### API Security
- 🔒 HTTPS only
- 🔑 API klíče uloženy bezpečně
- 🚫 Žádné private keys v síťových voláních

## 📱 Minimální Požadavky

### Android
- Android 8.0 (API 26) a vyšší
- 2 GB RAM
- 100 MB volného místa
- OpenGL ES 3.0 (pro grafiku)

### iOS
- iOS 13.0 a vyšší
- iPhone 6s a novější
- 100 MB volného místa

## 🎯 Roadmap

### v2.9.0 (Initial Release)
- [x] Wallet generator a management
- [x] Pool stats dashboard
- [x] Basic mining s varováním
- [x] Push notifikace
- [x] Multi-wallet support

### v2.9.1 (Plánováno)
- [ ] Transaction signing
- [ ] On-chain balance check
- [ ] Enhanced consciousness gamification
- [ ] Peer-to-peer wallet transfers
- [ ] Advanced mining controls

### v3.0.0 (Budoucnost)
- [ ] DEX integration
- [ ] NFT gallery
- [ ] Social features (consciousness community)
- [ ] Hardware wallet support
- [ ] Lightning Network integration

## 🛠️ Technologie

- **React Native 0.73** - Framework
- **TypeScript** - Type safety
- **React Navigation** - Navigace
- **Axios** - HTTP klient
- **AsyncStorage** - Lokální databáze
- **Crypto-JS** - Kryptografie
- **react-native-qrcode** - QR kódy
- **Push Notifications** - Notifikace

## 📄 Licence

MIT License - see LICENSE file

## 🌟 Filozofie

*"Carry consciousness in your pocket. Mine with awareness. Evolve with purpose."*

ZION Mobile není jen wallet app - je to **průvodce duchovním vývojem** v digitálním věku. Každá funkce je navržena s ohledem na:
- 💜 **Soucit** - Chráníme tvé zařízení
- 🌍 **Zodpovědnost** - Mining jen když to dává smysl
- ✨ **Růst** - Gamification podporuje evoluci
- 🔒 **Bezpečnost** - Tvé klíče, tvá kontrola

---

**Made with ❤️ for the Conscious Community**  
**ZION TerraNova - Where Technology Meets Spirit** 🌟
