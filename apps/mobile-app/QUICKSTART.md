# 🚀 ZION Mobile - Quick Start Guide

## 📱 Co jsme vytvořili

**ZION Mobile** je React Native aplikace pro Android a iOS s identickým designem jako desktop-agent. Hlavní funkce:

### ✅ Hotové funkce:
- 🔐 **Wallet Manager** - Vytváření, import, export, multi-wallet
- 📊 **Dashboard** - Pool stats, miner stats, consciousness level
- ⚡ **Experimentální Mining** - S varováními a bezpečnostními limity
- ⚙️ **Settings** - Biometrie, notifikace, network config
- 🎨 **Design System** - Identický s desktop-agent (barvy, komponenty)

## 🛠️ Instalace & Setup

### 1. Install Dependencies
```bash
cd mobile-app/
yarn install

# iOS (pouze macOS)
cd ios && pod install && cd ..
```

### 2. Start Development
```bash
# Terminal 1 - Metro bundler
yarn start

# Terminal 2 - Run on device/emulator
yarn android  # Android
yarn ios      # iOS (pouze macOS)
```

## 📁 Struktura

```
mobile-app/
├── App.js                    # Main app entry, navigation
├── package.json             # Dependencies
├── README.md                # Dokumentace
├── QUICKSTART.md            # Tento soubor
│
├── src/
│   ├── screens/             # Hlavní obrazovky
│   │   ├── WalletScreen.js      # Wallet management
│   │   ├── DashboardScreen.js   # Stats & monitoring
│   │   ├── MiningScreen.js      # Mining control
│   │   └── SettingsScreen.js    # App settings
│   │
│   ├── components/common/   # Reusable komponenty
│   │   ├── GlassCard.js         # Průhledné karty
│   │   ├── GradientButton.js    # Gradient tlačítka
│   │   └── ConsciousnessRing.js # Progress ring
│   │
│   ├── services/            # Business logika
│   │   ├── WalletService.js     # Wallet operace
│   │   ├── PoolAPI.js           # API komunikace
│   │   └── MiningService.js     # Mining logika
│   │
│   ├── context/             # State management
│   │   ├── WalletContext.js
│   │   └── MiningContext.js
│   │
│   └── constants/           # Config & theme
│       ├── config.js            # App konfigurace
│       └── theme.js             # Design system
```

## 🎯 Klíčové komponenty

### WalletScreen
- Generování nových wallets
- Import z private key / mnemonic
- Export s varováním
- Multi-wallet management
- QR kódy pro receive

### DashboardScreen
- Real-time pool stats
- Miner hashrate, shares
- Consciousness level progress
- Network info
- Recent blocks

### MiningScreen
- **DŮLEŽITÉ VAROVÁNÍ před startem**
- Device status monitoring
- Safety limits enforcement
- Auto-stop při:
  - Nízká baterie (< 20%)
  - Vysoká teplota (> 42°C)
  - Ztráta WiFi
  - Max 30 minut běhu

### SettingsScreen
- Biometric lock
- Push notifications
- Network endpoints
- About & legal

## 🎨 Design Systém

Identický s desktop-agent:

```javascript
colors = {
  primary: {
    gold: '#f9d976',
    cyan: '#32e6ff',
    purple: '#9b5cff',
  },
  background: {
    dark: '#0a0c1c',
    card: '#1a1d35',
  },
  consciousness: {
    physical: '#3b82f6',
    mental: '#8b5cf6',
    spiritual: '#ec4899',
    cosmic: '#f59e0b',
    onTheStar: '#eab308',
  },
}
```

## 🔧 Další kroky (TODO)

### Priorita 1 - Funkční
- [ ] **Skutečná kryptografie** - Nahradit placeholder v WalletService
  - Použít `react-native-bip39` pro mnemonic
  - Použít `@ethersproject/wallet` pro key derivation
  - Hardware-backed keystore
- [ ] **Stratum mining** - Připojit k pool.zionterranova.com:8444
  - Port mining logiky z desktop-agent
  - WebSocket nebo native TCP connection
- [ ] **Transaction signing** - Podepisování transakcí
- [ ] **Balance checking** - Skutečný on-chain balance

### Priorita 2 - UX
- [ ] **Biometric auth** - React Native Biometrics
- [ ] **QR Scanner** - Camera permission + scanner
- [ ] **Push notifications** - FCM setup
- [ ] **Deep linking** - zion:// URL scheme
- [ ] **Clipboard** - Copy address/keys
- [ ] **Share** - Export wallet via share sheet

### Priorita 3 - Polish
- [ ] **Loading states** - Skeleton screens
- [ ] **Error handling** - Better error messages
- [ ] **Animations** - Smooth transitions
- [ ] **Haptics** - Vibration feedback
- [ ] **Sound effects** - Mining sounds
- [ ] **Localization** - i18n (CZ, EN)

### Priorita 4 - Native
- [ ] **Android build** - APK/AAB generation
- [ ] **iOS build** - IPA + TestFlight
- [ ] **App icons** - All sizes
- [ ] **Splash screen** - Launch screen
- [ ] **Google Play** - Store listing
- [ ] **App Store** - Store listing

## 🔐 Bezpečnost (Kritické)

Současný WalletService používá **PLACEHOLDER kryptografii**. Před production:

1. **Mnemonic**: Použít BIP39 knihovnu
   ```bash
   yarn add react-native-bip39 crypto-js
   ```

2. **Key Derivation**: Správná HD wallet implementace
   ```bash
   yarn add @ethersproject/wallet @ethersproject/hdnode
   ```

3. **Secure Storage**: Hardware-backed
   ```bash
   yarn add react-native-keychain
   ```

4. **Address Generation**: Bech32 encoding
   ```bash
   yarn add bech32
   ```

## 📱 Build Commands

### Android
```bash
# Debug APK
yarn android

# Release APK
cd android
./gradlew assembleRelease
# Output: android/app/build/outputs/apk/release/app-release.apk

# Release AAB (Google Play)
./gradlew bundleRelease
# Output: android/app/build/outputs/bundle/release/app-release.aab
```

### iOS (macOS only)
```bash
# Debug
yarn ios

# Release
# 1. Open Xcode
# 2. Product → Archive
# 3. Distribute → App Store Connect
```

## 🐛 Debugging

```bash
# React Native debugger
npx react-native log-android
npx react-native log-ios

# Errors
npx react-devtools

# Performance
yarn android --variant=release
yarn ios --configuration Release
```

## 🌐 API Endpoints (Config)

Změnit v `src/constants/config.js`:

```javascript
POOL_URL: 'https://pool.zionterranova.com',
API_URL: 'https://api.zionterranova.com',
POOL_HOST: 'pool.zionterranova.com',
POOL_PORT: 8444,
```

## 💡 Tips

1. **Hot Reload**: Shake device → Enable Fast Refresh
2. **DevMenu**: 
   - Android: Shake nebo `adb shell input keyevent 82`
   - iOS: Cmd+D
3. **Clean Build**:
   ```bash
   yarn android --reset-cache
   cd android && ./gradlew clean && cd ..
   ```

## 📚 Dokumentace

- [React Native Docs](https://reactnative.dev/)
- [React Navigation](https://reactnavigation.org/)
- [Desktop Agent Code](../desktop-agent/)

## 🌟 Filozofie

Stejně jako desktop-agent:
- 💜 **Soucit** - Chráníme zařízení uživatele
- 🌍 **Zodpovědnost** - Mining jen když to dává smysl
- ✨ **Růst** - Gamification podporuje evoluci
- 🔒 **Bezpečnost** - Tvé klíče, tvá kontrola

---

**Made with ❤️ for the Conscious Community**  
**ZION TerraNova - Where Technology Meets Spirit** 🌟
