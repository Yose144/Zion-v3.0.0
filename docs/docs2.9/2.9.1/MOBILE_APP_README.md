# 📱 ZION Mobile App v2.9

**React Native aplikace pro Android a iOS - Wallet Manager, Dashboard & Experimentální Mining**

---

## 🌟 Co je ZION Mobile?

ZION Mobile je nativní mobilní aplikace pro ZION TerraNova blockchain, která přináší sílu ZION ekosystému přímo do vaší kapsy. Design je identický s desktop-agent, primárně slouží jako **Wallet Manager** s rozšířenými funkcemi.

### ✨ Hlavní Funkce

#### 🔐 Wallet Manager (Core Funkce)
- ✅ **Generování wallet** - Skutečná BIP39/BIP44 implementace
- ✅ **Import/Export** - Z private key nebo mnemonic phrase (24 slov)
- ✅ **Multi-wallet** - Správa více účtů najednou
- ✅ **Bezpečné uložení** - AES-256 šifrování, biometrická ochrana
- ✅ **QR kódy** - Pro snadné přijímání plateb
- ✅ **Bech32 adresy** - Standardní `zion1...` formát

#### 📊 Dashboard & Monitoring
- 📈 Real-time pool statistiky
- 🎮 Consciousness level tracking (gamification)
- 💰 Balance & rewards zobrazení
- 📡 Network status a block explorer
- 🔔 Push notifikace

#### ⚡ Experimentální Mining
- ⚠️ **S VAROVÁNÍMI** - Jasně zobrazené limity
- 🔥 CPU mining pouze při nabíjení + WiFi
- 🛡️ Safety limits (30 min max, 20% battery min, 42°C max)
- 🛑 Auto-stop při problémech
- 📊 Real-time metrics

---

## 🚀 Quick Start

### Prerequisites
- Node.js 18+
- Yarn nebo npm
- Xcode (pro iOS build)
- Android Studio (pro Android build)

### Instalace

```bash
# Přejít do složky
cd mobile-app/

# Spustit setup script (automaticky nainstaluje vše)
./setup.sh

# Nebo manuálně:
yarn install
cd ios && pod install && cd ..
```

### Spuštění

```bash
# iOS (pouze macOS)
yarn ios

# Android
yarn android

# Web verze (testování v browseru)
npx expo start --web
```

---

## 📁 Struktura

```
mobile-app/
├── App.js                          # Main entry, navigation
├── src/
│   ├── screens/                    # Obrazovky
│   │   ├── WalletScreen.js        # 🔐 Wallet management
│   │   ├── DashboardScreen.js     # 📊 Stats & monitoring
│   │   ├── MiningScreen.js        # ⛏️ Mining control
│   │   └── SettingsScreen.js      # ⚙️ Settings
│   ├── components/common/          # Reusable komponenty
│   │   ├── GlassCard.js           # Design system
│   │   ├── GradientButton.js
│   │   └── ConsciousnessRing.js
│   ├── services/                   # Business logika
│   │   ├── WalletService.js       # ✅ Skutečná kryptografie
│   │   ├── PoolAPI.js             # API calls
│   │   └── MiningService.js       # Mining logic
│   ├── utils/
│   │   └── crypto.js              # 🔐 BIP39/BIP44/ECDSA/Bech32
│   └── constants/
│       ├── config.js               # App konfigurace
│       └── theme.js                # Design system
├── BUILD_INSTRUCTIONS.md           # Detailní build guide
├── FAST_FIX.md                     # Troubleshooting
└── QUICKSTART.md                   # Quick start guide
```

---

## 🔐 Kryptografická Implementace

### Wallet System (`src/utils/crypto.js`)

✅ **Skutečná implementace** (ne placeholder):

- **BIP39 Mnemonic**
  ```javascript
  generateEntropy(256) // 24 slov
  entropyToMnemonic(entropy)
  mnemonicToSeed(mnemonic, passphrase)
  ```

- **BIP32/BIP44 HD Wallet**
  ```javascript
  derivePath(seed, "m/44'/9999'/0'/0/0")
  ```

- **ECDSA Signing**
  ```javascript
  signTransaction(txHash, privateKey)
  verifySignature(txHash, signature, publicKey)
  ```

- **Bech32 Addresses**
  ```javascript
  publicKeyToAddress(publicKey, 'zion1')
  isValidAddress(address)
  ```

- **AES-256 Encryption**
  ```javascript
  encryptPrivateKey(privateKey, password)
  decryptPrivateKey(encrypted, password)
  ```

### Bezpečnost

- Private keys šifrovány AES-256
- Hardware-backed keystore (iOS Keychain, Android Keystore)
- Biometrická autentizace (Face ID / Touch ID / Fingerprint)
- Screen capture disabled při zobrazení seed phrase
- Auto-lock po 5 minutách neaktivity

---

## 🎨 Design System

Identický s desktop-agent:

```javascript
colors = {
  primary: {
    gold: '#f9d976',    // ZION Gold
    cyan: '#32e6ff',    // ZION Cyan
    purple: '#9b5cff',  // ZION Purple
  },
  consciousness: {
    physical: '#3b82f6',   // 1.0x multiplier
    mental: '#8b5cf6',     // 1.1x multiplier
    spiritual: '#ec4899',  // 1.25x multiplier
    cosmic: '#f59e0b',     // 2.0x multiplier
    onTheStar: '#eab308',  // 15.0x multiplier
  }
}
```

Komponenty:
- `GlassCard` - Průhledné panely s blur efektem
- `GradientButton` - Gradient CTA buttony
- `ConsciousnessRing` - Kruhový progress indicator
- `StatCard` - Karty pro statistiky

---

## 🛠️ Build & Deploy

### Development
```bash
# Metro bundler
yarn start

# iOS simulator
yarn ios

# Android emulator
yarn android
```

### Production

#### Android APK
```bash
cd android
./gradlew assembleRelease
# Output: android/app/build/outputs/apk/release/app-release.apk
```

#### Android AAB (Google Play)
```bash
cd android
./gradlew bundleRelease
# Output: android/app/build/outputs/bundle/release/app-release.aab
```

#### iOS (macOS only)
```bash
# 1. Open Xcode
open ios/ZIONMobile.xcworkspace

# 2. Product → Archive
# 3. Distribute → App Store Connect
```

---

## ⚠️ Mining Warning System

Mobilní mining je **EXPERIMENTÁLNÍ** a má významné limity:

### Automatické Safety Limits
- ⏱️ Max 30 minut běhu
- 🔋 Min 20% baterie
- 🌡️ Max 42°C teplota
- 📶 Vyžaduje WiFi
- ⚡ Vyžaduje nabíjení

### Auto-Stop když:
- Baterie klesne pod 20%
- Teplota přesáhne 42°C
- Ztráta WiFi připojení
- Screen vypnutý > 5 minut
- Dosažen časový limit

### Varování před startem:
```javascript
⚠️ Important Warning

Mobile mining is EXPERIMENTAL and comes with significant risks:
• Rapid battery drain
• Device overheating
• Reduced performance
• Shortened battery lifespan
• Very low hashrate (~10-50 H/s)
• Minimal ZION earnings

Desktop mining is MUCH more efficient!
```

---

## 📊 API Endpoints

Konfigurovatelné v `src/constants/config.js`:

```javascript
POOL_URL: 'https://pool.zionterranova.com',
API_URL: 'https://api.zionterranova.com',
POOL_HOST: 'pool.zionterranova.com',
POOL_PORT: 3333,
```

---

## 🐛 Troubleshooting

### iOS Build Failed?
```bash
# Čistý restart
rm -rf node_modules ios/Pods ios/Podfile.lock
yarn install
cd ios && pod install && cd ..
yarn ios
```

### Android Build Failed?
```bash
cd android
./gradlew clean
cd ..
yarn android
```

### Metro Bundler Issues?
```bash
yarn start --reset-cache
```

Detailní troubleshooting: [BUILD_INSTRUCTIONS.md](mobile-app/BUILD_INSTRUCTIONS.md)

---

## 🔮 Roadmap

### v2.9.0 (Current)
- [x] Wallet generator & management
- [x] Pool stats dashboard
- [x] Experimental mining
- [x] Push notifications
- [x] Multi-wallet support

### v2.9.1 (Planned)
- [ ] Transaction signing & broadcasting
- [ ] On-chain balance checking
- [ ] Enhanced consciousness gamification
- [ ] Peer-to-peer transfers
- [ ] Hardware wallet support

### v3.0.0 (Future)
- [ ] DEX integration
- [ ] NFT gallery
- [ ] Social features (consciousness community)
- [ ] Lightning Network support
- [ ] DAO governance voting

---

## 🔗 Links

- **Website**: https://zionterranova.com
- **Pool**: pool.zionterranova.com:3333
- **Explorer**: https://explorer.zionterranova.com
- **Documentation**: [Projekt docs](docs/)
- **Desktop Agent**: [desktop-agent/](desktop-agent/)

---

## 📞 Support & Community

- **GitHub Issues**: Pro bug reports a feature requests
- **Discord**: [Join our community](#)
- **Twitter**: [@ZIONTerraNova](#)

---

## 🌟 Filozofie

ZION Mobile není jen crypto wallet - je to **průvodce vědomého vývoje** v digitálním věku.

Každá funkce je navržena s ohledem na:
- 💜 **Soucit** - Chráníme tvé zařízení (safety limits)
- 🌍 **Zodpovědnost** - Mining jen když to dává smysl
- ✨ **Růst** - Gamification podporuje evoluci
- 🔒 **Bezpečnost** - Tvé klíče, tvá kontrola

> *"Carry consciousness in your pocket. Mine with awareness. Evolve with purpose."*

---

## 📄 Licence

MIT License - see [LICENSE](LICENSE)

---

## 🙏 Credits

**Made with ❤️ for the Conscious Community**

ZION TerraNova v2.9 - Where Technology Meets Spirit 🌟

---

## 🚀 Getting Started

```bash
# Clone repo (pokud ještě nemáte)
git clone https://github.com/your-org/Zion-2.9-main.git
cd Zion-2.9-main/mobile-app

# Setup
./setup.sh

# Run
yarn ios    # or yarn android
```

**Nebo pro rychlé testování bez native buildu:**
```bash
npx expo start --web
```

---

**Last Updated**: December 29, 2025  
**Version**: 2.9.0  
**Status**: ✅ Ready for TestNet
