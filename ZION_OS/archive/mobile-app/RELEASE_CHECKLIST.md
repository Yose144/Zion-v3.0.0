# ZION Mobile v3.0.0 — Release Checklist

## Pre-build

- [ ] `package.json` version = `3.0.0`
- [ ] `app.json` version = `3.0.0`, buildNumber / versionCode = `7`
- [ ] `android/app/build.gradle` versionName = `3.0.0`, versionCode = `7`
- [ ] `ios/ZIONMobile/Info.plist` CFBundleShortVersionString = `3.0.0`
- [ ] All `AGENTS.md` mainnet constants verified (genesis hash, ports, addresses)
- [ ] `CONFIG.NETWORK_MODE` defaults to `mainnet`
- [ ] Tests pass: `npm test` (or `jest --run`)

## Assets

- [ ] `./assets/icon.png` — 1024×1024 PNG (iOS App Store)
- [ ] `./assets/splash.png` — 1242×2438 PNG (iPhone X+ splash)
- [ ] `./assets/adaptive-icon.png` — 1024×1024 PNG (Android adaptive icon foreground)
- [ ] Verify `app.json` references correct asset paths

## Android Build

```bash
cd android
./gradlew assembleRelease
```

- [ ] APK / AAB generated at `android/app/build/outputs/`
- [ ] Sign with release keystore
- [ ] Upload to Google Play Console (Internal Testing → Production)

## iOS Build

```bash
cd ios
pod install
xcodebuild -workspace ZIONMobile.xcworkspace -scheme ZIONMobile -configuration Release archive
```

- [ ] Archive in Xcode → Distribute App → App Store Connect
- [ ] Upload via Transporter or Xcode Organizer
- [ ] Submit for review in App Store Connect

## Post-release

- [ ] Tag release: `git tag -a v3.0.0-mobile -m "ZION Mobile v3.0.0"`
- [ ] Push tag: `git push origin v3.0.0-mobile`
- [ ] Update website download links
- [ ] Announce on Discord / Twitter

## Notes

- Bundle ID: `com.zionterranova.mobile`
- Min SDK: Android API 24+ / iOS 14+
- Expo EAS optional: `eas build --platform all`
