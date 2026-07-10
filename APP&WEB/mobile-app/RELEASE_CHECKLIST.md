# ZION Mobile v3.0.5 "All Green" — Release Checklist

## Pre-build

- [x] `package.json` version = `3.0.5`
- [x] `app.json` version = `3.0.5`, buildNumber = `8`, versionCode = `8`
- [x] `config.js` VERSION = `3.0.5`, BUILD_NUMBER = `8`, CODENAME = `All Green`
- [ ] `android/app/build.gradle` versionName = `3.0.5`, versionCode = `8`
- [ ] `ios/ZIONMobile/Info.plist` CFBundleShortVersionString = `3.0.5`
- [ ] All `AGENTS.md` mainnet constants verified (genesis hash, ports, addresses)
- [x] `CONFIG.NETWORK_MODE` defaults to `mainnet`
- [x] RPC nodes point to `62.171.141.136:8443`
- [x] Pool points to `62.171.141.136:8444`
- [ ] Tests pass: `npm test` (or `jest --run`)

## IAP (In-App Purchases) — NEW in 3.0.5

- [x] `react-native-iap` added to `package.json`
- [x] `IAPService.js` — StoreKit 2 + Google Play Billing wrapper
- [x] `LicenseService.js` — receipt validation with update server
- [x] `IAPContext.js` — React context for purchase state
- [x] `useSubscription.js` — convenience hook
- [x] `PaywallScreen.js` — full paywall UI (Pro, Miner Boost, Donations)
- [x] `SettingsScreen.js` — Premium section with upgrade/restore
- [x] `App.js` — IAPProvider wired, PaywallScreen in RootStack
- [x] `config.js` — IAP product IDs + entitlements configured
- [ ] `npm install` run successfully (react-native-iap native module)
- [ ] IAP products configured in App Store Connect (6 products)
- [ ] IAP products configured in Google Play Console (6 products)
- [ ] `APPLE_SHARED_SECRET` set on update server
- [ ] `GOOGLE_SERVICE_ACCOUNT_KEY_PATH` set on update server
- [ ] IAP sandbox test (iOS) — purchase + restore verified
- [ ] IAP test purchase (Android) — purchase + restore verified

### IAP Product IDs

| Product ID | Type | Price | Entitlement |
|------------|------|-------|-------------|
| `zion.pro.lifetime` | One-time | $29.99 | pro |
| `zion.pro.yearly` | Subscription | $9.99/yr | pro |
| `zion.pro.monthly` | Subscription | $1.99/mo | pro |
| `zion.miner.boost` | One-time | $4.99 | miner_boost |
| `zion.donate.5` | One-time | $4.99 | donate |
| `zion.donate.25` | One-time | $24.99 | donate |

## Assets

- [ ] `./assets/icon.png` — 1024×1024 PNG (iOS App Store)
- [ ] `./assets/splash.png` — 1242×2438 PNG (iPhone X+ splash)
- [ ] `./assets/adaptive-icon.png` — 1024×1024 PNG (Android adaptive icon foreground)
- [ ] Verify `app.json` references correct asset paths

## Android Build

```bash
# Using EAS (recommended)
eas build --platform android --profile production

# Or manual
cd android
./gradlew assembleRelease
```

- [ ] APK / AAB generated
- [ ] Sign with release keystore (or Play App Signing)
- [ ] Upload to Google Play Console (Internal Testing → Production)
- [ ] IAP products live in Play Console

## iOS Build

```bash
# Using EAS (recommended)
eas build --platform ios --profile production
eas submit --platform ios --profile production

# Or manual
cd ios
pod install
xcodebuild -workspace ZIONMobile.xcworkspace -scheme ZIONMobile -configuration Release archive
```

- [ ] Archive in Xcode → Distribute App → App Store Connect
- [ ] Upload via Transporter or Xcode Organizer
- [ ] IAP products configured in App Store Connect
- [ ] Submit for review in App Store Connect

## Post-release

- [ ] Tag release: `git tag -a v3.0.5-mobile -m "ZION Mobile v3.0.5 All Green"`
- [ ] Push tag: `git push origin v3.0.5-mobile`
- [ ] Update website download links (App Store + Play Store URLs)
- [ ] Announce on Discord / Twitter
- [ ] EAS OTA update: `eas update --branch production --message "v3.0.5 All Green"`

## Notes

- Bundle ID: `com.zionterranova.mobile`
- Min SDK: Android API 24+ / iOS 14+
- Expo EAS: `eas build --platform all --profile production`
- Update server: `https://updates.zionterranova.com/api/iap`
- See `AppPay.md` (repo root) for full monetization plan
