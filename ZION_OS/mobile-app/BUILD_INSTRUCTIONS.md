# ZION Mobile - Build & Deploy Instructions

## 🚨 Oprava build problémů

### iOS Build Failed?

Pokud `yarn ios` selhal, zkontrolujte:

1. **Xcode nainstalován?**
   ```bash
   xcode-select --print-path
   # Mělo by vrátit: /Applications/Xcode.app/Contents/Developer
   ```

2. **CocoaPods nainstalován?**
   ```bash
   pod --version
   # Pokud ne:
   sudo gem install cocoapods
   ```

3. **Instalace pods:**
   ```bash
   cd ios/
   pod install
   cd ..
   ```

4. **Čistý build:**
   ```bash
   # Smazat node_modules a reinstalovat
   rm -rf node_modules
   yarn install
   
   # Čistý iOS build
   cd ios
   rm -rf Pods Podfile.lock build
   pod install
   cd ..
   
   # Restart Metro bundler
   yarn start --reset-cache
   ```

5. **Spustit znovu:**
   ```bash
   yarn ios
   ```

### Android Build (jednodušší)

```bash
# Android Studio musí být nainstalované
# Android SDK musí být nastavené

# Spustit
yarn android
```

---

## 🔧 Alternativní metoda: Expo (doporučeno pro rychlý start)

Pokud chcete nejrychlejší cestu bez iOS/Android native setupu:

```bash
# 1. Instalace Expo CLI
npm install -g expo-cli

# 2. Konverze na Expo projekt
npx expo prebuild

# 3. Spuštění
npx expo start

# 4. Skenujte QR kód v Expo Go app (iOS/Android)
```

---

## 📱 Testování bez buildu

### 1. Web verze (nejrychlejší)
```bash
# Spustit jako web app
yarn web
# nebo
npx expo start --web
```

### 2. Simulator bez buildu
```bash
# iOS Simulator (macOS)
yarn ios

# Android Emulator
yarn android
```

---

## 🎯 Production Build

### Android APK
```bash
cd android
./gradlew assembleRelease

# Output: android/app/build/outputs/apk/release/app-release.apk
```

### Android AAB (Google Play)
```bash
cd android
./gradlew bundleRelease

# Output: android/app/build/outputs/bundle/release/app-release.aab
```

### iOS (macOS only)
```bash
# 1. Open in Xcode
open ios/ZIONMobile.xcworkspace

# 2. Select target device
# 3. Product → Archive
# 4. Distribute → App Store Connect
```

---

## 🐛 Časté problémy a řešení

### Problem: "Command not found: react-native"
```bash
npm install -g react-native-cli
```

### Problem: "Unable to resolve module"
```bash
yarn start --reset-cache
```

### Problem: "Xcode build failed"
```bash
cd ios
rm -rf build
xcodebuild -workspace ZIONMobile.xcworkspace -scheme ZIONMobile clean
cd ..
yarn ios
```

### Problem: "Gradle build failed"
```bash
cd android
./gradlew clean
cd ..
yarn android
```

### Problem: "Metro bundler crashed"
```bash
# Kill all Node processes
killall node

# Restart
yarn start --reset-cache
```

---

## ✅ Checklist před spuštěním

- [ ] Node.js 18+ nainstalován
- [ ] Yarn nainstalován (`npm install -g yarn`)
- [ ] Xcode nainstalován (pro iOS)
- [ ] Android Studio nainstalován (pro Android)
- [ ] CocoaPods nainstalován (`sudo gem install cocoapods`)
- [ ] `yarn install` proběhlo úspěšně
- [ ] `cd ios && pod install` proběhlo úspěšně (iOS)

---

## 🚀 Rychlý Start (Web verze)

Nejjednodušší způsob, jak vyzkoušet aplikaci:

```bash
# 1. Instalace
yarn install

# 2. Spuštění jako web app
yarn web

# 3. Otevřít: http://localhost:19006
```

Toto běží v browseru bez potřeby Xcode nebo Android Studio!

---

## 📞 Podpora

Pokud stále nejde build:
1. Zkontrolujte [React Native troubleshooting](https://reactnative.dev/docs/troubleshooting)
2. Zkuste Expo verzi (jednodušší)
3. Nebo použijte web verzi pro vývoj

---

**Made with ❤️ for the Conscious Community**
