# ZION AppPay — Cross-Platform App Monetization & Publishing Plan

> **Datum:** 2026-07-10
> **Status:** Implementation complete — Desktop auto-update + Mobile IAP built, tested, ready for deployment
> **Scope:** Desktop Agent (Electron), Mobile App (React Native / Expo), all platforms

---

## TL;DR

| Platform | Distribution | Monetization | Auto-Update | Code Signing | Status |
|----------|-------------|--------------|-------------|--------------|--------|
| **macOS** (Desktop) | DMG + own update server | License key (own server) | electron-updater → `updates.zionterranova.com` | Apple Developer ID ($99/yr) — needed | **BUILT** — auto-update + license system complete, certs pending |
| **Windows** (Desktop) | NSIS installer + own update server | License key (own server) | electron-updater → `updates.zionterranova.com` | OV/EV Code Signing ($60–400/yr) — needed | **BUILT** — auto-update + license system complete, certs pending |
| **Linux** (Desktop) | AppImage + .deb + own update server | License key (own server) | electron-updater → `updates.zionterranova.com` | Not required (optional) | **BUILT** — auto-update + license system complete |
| **iOS** (Mobile) | App Store | In-App Purchase (StoreKit 2) | App Store + EAS Updates (OTA) | Apple Developer ($99/yr) — needed | **BUILT** — IAP service + paywall UI + server validation, store config pending |
| **Android** (Mobile) | Google Play + APK sideload | In-App Purchase (Google Play Billing) | Google Play + EAS Updates (OTA) | Google Play signing — needed | **BUILT** — IAP service + paywall UI + server validation, store config pending |

**Key decision:** Desktop = license key via own server (no store middleman, 100% revenue). Mobile = In-App Purchases via Apple/Google (stores take 15–30% cut, but required for App Store distribution).

---

## 1. Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│                     ZION AppPay Ecosystem                           │
├──────────────────┬──────────────────┬───────────────────────────────┤
│  Desktop Agent    │  Mobile App      │  Update / License Server      │
│  (Electron)       │  (React Native)  │  (Node.js + SQLite)           │
│                   │                  │                               │
│  macOS: DMG       │  iOS: App Store  │  updates.zionterranova.com    │
│  Windows: NSIS    │  Android: Play   │                               │
│  Linux: AppImage  │                  │  Desktop: License key gate    │
│                   │                  │  Mobile: IAP receipt validation│
│  License: own     │  License: IAP    │                               │
│  server (100%)    │  (70–85% net)    │  License DB (SQLite)          │
│                   │                  │  Release artifacts storage    │
│  Update: electron │  Update: EAS OTA │  IAP receipt verification     │
│  -updater generic │  + store updates │  (Apple/Google)               │
│  provider         │                  │                               │
└──────────────────┴──────────────────┴───────────────────────────────┘
```

---

## 2. Desktop Agent — License Key System (BUILT)

### What exists

- **Update server:** `update-server/` — Fastify + SQLite, license-gated
- **Desktop agent:** `electron-updater` generic provider → `updates.zionterranova.com`
- **License UI:** Settings → Updates → License key input + Activate button
- **Admin CLI:** generate-license, list-licenses, revoke-license, upload-release

### How it works

```
User buys license → you run generate-license.js → send key to user
→ user enters key in Desktop Agent → app validates with server
→ electron-updater fetches latest.yml with X-License-Key header
→ download + install update
```

### Revenue flow

```
Customer pays (Stripe/crypto/manual) → you generate license key → 100% revenue
No store fees. No middleman. You control distribution entirely.
```

### What's needed to go live

| # | Task | Cost | Priority |
|---|------|------|----------|
| 1 | Deploy update server on `62.171.141.136` | $0 (existing server) | High |
| 2 | DNS: `updates.zionterranova.com` → server IP | $0 (Webglobe DNS) | High |
| 3 | nginx reverse proxy + Let's Encrypt SSL | $0 | High |
| 4 | Generate admin token + JWT secret | $0 | High |
| 5 | First build: `npm run build:mac` → upload | $0 | High |
| 6 | Generate first license key for testing | $0 | High |
| 7 | Apple Developer ID cert (macOS signing) | $99/yr | Medium |
| 8 | Windows OV Code Signing cert | $60–200/yr | Medium |
| 9 | Payment integration (Stripe checkout on website) | Stripe fees (2.9%+$0.30) | Medium |

---

## 3. Mobile App — In-App Purchase System (PLANNED)

### Platform constraints

| Platform | Store | Fee | Required for distribution? | Alt distribution |
|----------|-------|-----|---------------------------|------------------|
| **iOS** | App Store | 30% (< $1M/yr), 15% (Small Business Program) | **Yes** — Apple walled garden | Enterprise cert (internal only), TestFlight (beta) |
| **Android** | Google Play | 30% (< $1M/yr), 15% (Small Business Program) | No — APK sideload possible | Direct APK download, F-Droid, alternative stores |

### IAP Product tiers

| Product ID | Tier | Price | Features | Revenue (after 15% fee) |
|------------|------|-------|----------|------------------------|
| `zion.pro.lifetime` | Pro Lifetime | $29.99 | Unlimited wallets, advanced TX history, priority support, no ads | $25.49 |
| `zion.pro.yearly` | Pro Yearly | $9.99/yr | Same as lifetime, annual | $8.49/yr |
| `zion.pro.monthly` | Pro Monthly | $1.99/mo | Same as lifetime, monthly | $1.69/mo |
| `zion.miner.boost` | Miner Boost | $4.99 | GPU mining unlock, advanced stats, auto-tuner | $4.24 |
| `zion.donate.5` | Donation | $4.99 | Support development, cosmetic badge | $4.24 |
| `zion.donate.25` | Donation | $24.99 | Support development, cosmetic badge | $21.24 |

> **Note:** Mining itself is free (PoW — anyone can mine). IAP unlocks **premium features** in the wallet/mining manager app, not mining rights.

### iOS — StoreKit 2 Integration

#### Prerequisites

| # | Requirement | Cost | Where |
|---|-------------|------|-------|
| 1 | Apple Developer Program | $99/yr | https://developer.apple.com/programs/ |
| 2 | App Store Connect account | included | https://appstoreconnect.apple.com |
| 3 | App record + bundle ID `com.zionterranova.mobile` | $0 | App Store Connect |
| 4 | IAP products configured in App Store Connect | $0 | App Store Connect → In-App Purchases |
| 5 | Paid Applications Agreement | $0 (bank info needed) | App Store Connect → Agreements |
| 6 | StoreKit testing in Xcode | $0 | Xcode → StoreKit Configuration File |

#### Implementation plan

```
mobile-app/
├── src/
│   ├── services/
│   │   ├── IAPService.js          # NEW — StoreKit 2 / Google Play Billing wrapper
│   │   └── LicenseService.js      # NEW — receipt validation + feature gating
│   ├── context/
│   │   └── IAPContext.js          # NEW — React context for purchase state
│   ├── screens/
│   │   ├── SettingsScreen.js      # MODIFY — add "Upgrade to Pro" section
│   │   └── PaywallScreen.js       # NEW — IAP purchase UI
│   └── hooks/
│       └── useIAP.js              # NEW — hook for purchase/restore/validate
```

**IAPService.js** — unified API for both platforms:

```javascript
// Unified interface (works on both iOS and Android)
import { Platform } from 'react-native';

// iOS: react-native-iap (StoreKit 2)
// Android: react-native-iap (Google Play Billing v5)

const PRODUCT_IDS = {
  proLifetime: 'zion.pro.lifetime',
  proYearly: 'zion.pro.yearly',
  proMonthly: 'zion.pro.monthly',
  minerBoost: 'zion.miner.boost',
  donate5: 'zion.donate.5',
  donate25: 'zion.donate.25',
};

class IAPService {
  async init() { /* connect to store */ }
  async fetchProducts() { /* get product details */ }
  async purchase(productId) { /* initiate purchase flow */ }
  async restorePurchases() { /* restore across devices */ }
  async validateReceipt(receipt) { /* verify with server */ }
  async getActiveEntitlements() { /* check what user owns */ }
}
```

**Receipt validation flow:**

```
1. User taps "Buy Pro" → StoreKit/Play Billing shows native purchase dialog
2. Purchase succeeds → app gets receipt (iOS) or purchase token (Android)
3. App sends receipt to update server: POST /api/iap/validate
4. Server verifies receipt:
   - iOS: Apple App Store Server API (verifyReceipt or App Store Server API v2)
   - Android: Google Play Developer API (purchases.subscriptions.verify)
5. Server creates/updates license in DB, returns entitlements
6. App unlocks features
```

#### Server-side: IAP receipt validation (add to update-server)

New endpoints needed in `update-server/server.js`:

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/api/iap/validate` | Validate Apple/Google receipt, create license |
| `GET` | `/api/iap/entitlements` | Get user's active entitlements |
| `POST` | `/api/iap/restore` | Restore purchases across devices |

New DB tables:

```sql
CREATE TABLE iap_receipts (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  platform        TEXT NOT NULL,        -- 'ios' | 'android'
  product_id      TEXT NOT NULL,
  receipt_data    TEXT,                  -- iOS receipt (base64)
  purchase_token  TEXT,                  -- Android purchase token
  transaction_id  TEXT UNIQUE,           -- Apple transaction ID / Google order ID
  entitlement     TEXT NOT NULL,         -- 'pro' | 'miner_boost' | 'donate'
  status          TEXT DEFAULT 'active', -- active | expired | refunded
  purchased_at    TEXT,
  expires_at      TEXT,                  -- for subscriptions
  device_id       TEXT,
  created_at      TEXT DEFAULT (datetime('now'))
);

CREATE TABLE iap_entitlements (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  device_id       TEXT NOT NULL,
  entitlement     TEXT NOT NULL,
  source          TEXT NOT NULL,         -- 'iap_ios' | 'iap_android' | 'license_key'
  expires_at      TEXT,                  -- NULL = lifetime
  created_at      TEXT DEFAULT (datetime('now')),
  UNIQUE(device_id, entitlement)
);
```

**Apple receipt verification** (server-side):

```javascript
// Verify iOS receipt with Apple
async function verifyAppleReceipt(receiptData) {
  // Production: https://buy.itunes.apple.com/verifyReceipt
  // Sandbox:    https://sandbox.itunes.apple.com/verifyReceipt
  const response = await fetch('https://buy.itunes.apple.com/verifyReceipt', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      'receipt-data': receiptData,
      password: process.env.APPLE_SHARED_SECRET, // from App Store Connect
    }),
  });
  const result = await response.json();
  // status 0 = valid, 21007 = sandbox receipt → retry with sandbox URL
  return result;
}
```

**Google Play verification** (server-side):

```javascript
// Verify Android purchase with Google Play Developer API
const { google } = require('googleapis');

async function verifyGooglePurchase(productId, purchaseToken) {
  const auth = new google.auth.GoogleAuth({
    keyFile: process.env.GOOGLE_SERVICE_ACCOUNT_KEY_PATH,
    scopes: ['https://www.googleapis.com/auth/androidpublisher'],
  });
  const androidpublisher = google.androidpublisher({ version: 'v3', auth });
  const result = await androidpublisher.purchases.products.get({
    packageName: 'com.zionterranova.mobile',
    productId,
    token: purchaseToken,
  });
  return result.data;
}
```

### Android — Google Play Billing

#### Prerequisites

| # | Requirement | Cost | Where |
|---|-------------|------|-------|
| 1 | Google Play Console | $25 one-time | https://play.google.com/console |
| 2 | Google service account JSON key | $0 | Google Cloud Console |
| 3 | App record + package `com.zionterranova.mobile` | $0 | Play Console |
| 4 | IAP products configured in Play Console | $0 | Play Console → Products → In-app products |
| 5 | Merchant account linked | $0 | Play Console → Monetize |

#### Implementation

Same `IAPService.js` — `react-native-iap` library handles both platforms:

```bash
# Install IAP library
cd APP&WEB/mobile-app
npm install react-native-iap
```

### EAS Updates (OTA — bypass store review for JS-only changes)

Expo EAS Updates allows pushing JS bundle updates without store review:

```json
// eas.json (already configured)
{
  "build": {
    "production": {
      "channel": "production"
    }
  },
  "submit": {
    "production": {
      "ios": { "appleId": "...", "ascAppId": "com.zionterranova.mobile" },
      "android": { "serviceAccountKeyPath": "...", "track": "internal" }
    }
  }
}
```

```bash
# Push OTA update (JS-only changes, no native module changes)
eas update --branch production --message "v3.0.5 bug fixes"

# Full store update (native changes, new version)
eas build --platform all --profile production
eas submit --platform ios --profile production
eas submit --platform android --profile production
```

**Important:** OTA updates CANNOT change:
- Native modules (anything requiring `pod install` or Gradle rebuild)
- App permissions
- IAP product IDs
- App icon / splash screen

OTA updates CAN change:
- All JS/TS code (screens, services, logic)
- Assets (images, fonts)
- App configuration (non-native parts)

---

## 4. Code Signing — Complete Guide

### 4.1 Apple Developer Program (macOS + iOS)

**Cost:** $99/year

**What you get:**
- App Store distribution (iOS)
- Developer ID Application certificate (macOS direct distribution)
- TestFlight (iOS beta testing)
- Notarization service (macOS Gatekeeper bypass)
- App Store Connect (manage apps, IAPs, sales)

**How to get it:**

1. Go to https://developer.apple.com/programs/
2. Sign in with Apple ID (`estrelaisabellazion3@gmail.com` — already in `eas.json`)
3. Verify identity (phone + government ID)
4. Pay $99/year
5. Wait 24–48h for approval
6. In Xcode: Preferences → Accounts → Add Apple ID → Manage Certificates
7. Create certificates:
   - **iOS Development** — for testing on device
   - **iOS Distribution** — for App Store submission
   - **Developer ID Application** — for macOS direct distribution
   - **Developer ID Installer** — for macOS DMG installer signing

**For macOS Desktop Agent:**
```bash
export CSC_NAME="Your Name (Developer ID)"
export APPLE_ID="estrelaisabellazion3@gmail.com"
export APPLE_APP_SPECIFIC_PASSWORD="xxxx-xxxx-xxxx-xxxx"  # generate at appleid.apple.com
export APPLE_TEAM_ID="XXXXXXXXXX"  # from developer.apple.com → Membership
npm run build:mac
# electron-builder: signs + notarizes + staples automatically
```

**For iOS Mobile App:**
```bash
# EAS build handles signing automatically via Apple credentials
eas build --platform ios --profile production
```

### 4.2 Windows Code Signing

**Cost:** $60–400/year depending on CA and type

| Type | Price | SmartScreen | Verification | Hardware token |
|------|-------|-------------|--------------|----------------|
| **OV (Standard)** | $60–200/yr | Builds reputation over time (~1–2 weeks) | Business verification (1–7 days) | No (email delivery) |
| **EV (Extended)** | $200–400/yr | **No SmartScreen warning** — immediate trust | Extended business verification (1–2 weeks) | **Yes** — USB token required (Microsoft mandate since June 2023) |

**Recommended CAs:**

| CA | OV Price | EV Price | Notes |
|----|----------|----------|-------|
| **Sectigo** (formerly Comodo) | ~$60/yr via resellers | ~$200/yr | Cheapest, good for small business |
| **Certum** | ~$50/yr | ~$150/yr | Polish CA, good for EU |
| **SSL.com** | ~$70/yr | ~$180/yr | US-based, fast verification |
| **DigiCert** | ~$200/yr | ~$400/yr | Premium, fastest support |

**Where to buy (cheapest resellers):**
- https://cheapsslsecurity.com — Sectigo OV ~$60/yr
- https://store.certum.eu — Certum OV ~$50/yr
- https://www.ssl.com — SSL.com OV ~$70/yr

**Requirements:**
- Business registration (IČO / company number / trade license)
- Government-issued ID
- Phone verification
- For EV: physical address verification (utility bill or similar)

**How to use with electron-builder:**
```bash
# Set environment variables before build
export CSC_LINK="/path/to/certificate.pfx"    # or base64-encoded
export CSC_KEY_PASSWORD="your_cert_password"
npm run build:win
# electron-builder automatically signs all .exe + .dll files
```

**EV certificate workflow (USB token):**
```bash
# EV certs come on a USB hardware token (SafeNet / eToken)
# 1. Install SafeNet Authentication Client (driver)
# 2. Plug in USB token
# 3. Set env vars to reference the token:
export CSC_LINK="pkcs11:token=ZION%20Code%20Signing;slot-id=0"
export CSC_KEY_PASSWORD="your_token_pin"
# 4. Build — electron-builder will prompt for token PIN
npm run build:win
```

### 4.3 Google Play App Signing (Android)

**Cost:** $25 one-time (Google Play Console registration)

**What you get:**
- App signing key managed by Google (more secure)
- App Bundle (.aab) distribution
- Play App Signing (Google re-signs with your key)

**How to set up:**

1. Go to https://play.google.com/console
2. Register with Google account ($25 one-time)
3. Create app: `ZION Mobile` → package `com.zionterranova.mobile`
4. App integrity → Play App Signing → Opt in
5. Generate upload key:
```bash
keytool -genkey -v -keystore zion-upload.jks \
  -keyalg RSA -keysize 2048 -validity 10000 \
  -alias zion-upload
```
6. Upload key to Play Console (or let EAS manage it)

**For EAS:**
```bash
# EAS manages signing credentials automatically
eas build --platform android --profile production
```

### 4.4 Linux — No Code Signing Required

Linux doesn't have a mandatory code signing requirement. AppImage and .deb packages work without signing.

**Optional:** GPG-sign .deb packages for verification:
```bash
dpkg-sig --sign builder zion-desktop-agent-v3.0.5-linux-x64.deb
```

**Snap Store** (optional alternative distribution):
- Register at https://snapcraft.io
- `snapcraft login` + `snapcraft push`
- Auto-updates via Snap daemon

---

## 5. Pricing Strategy

### Desktop Agent

| Tier | Price | Features | Distribution |
|------|-------|----------|-------------|
| **Free** | $0 | Basic mining, 1 wallet, standard stats | Direct download |
| **Pro** | $19.99 lifetime | Unlimited wallets, advanced stats, GPU auto-tuner, priority updates | License key (own server) |
| **Enterprise** | $99/yr | Multi-rig management, API access, priority support | License key (own server) |

### Mobile App

| Tier | Price | Features | Distribution |
|------|-------|----------|-------------|
| **Free** | $0 | Wallet, send/receive, basic mining monitor, 1 wallet | App Store / Google Play |
| **Pro** | $9.99/yr or $1.99/mo | Unlimited wallets, TX history export, biometric unlock, dark mode pro, no ads | IAP (Apple/Google) |
| **Miner Boost** | $4.99 one-time | GPU mining unlock, advanced mining stats, auto-tuner, push notifications | IAP (Apple/Google) |
| **Donation** | $4.99 / $24.99 | Support development, cosmetic profile badge | IAP (Apple/Google) |

### Revenue comparison

| Channel | Price | Store fee | Net revenue | Your margin |
|---------|-------|-----------|-------------|-------------|
| Desktop Pro (own server) | $19.99 | $0 | $19.99 | 100% |
| Mobile Pro Yearly (Apple) | $9.99 | 15% (Small Business) | $8.49 | 85% |
| Mobile Pro Yearly (Google) | $9.99 | 15% (Small Business) | $8.49 | 85% |
| Mobile Pro Yearly (Apple, >$1M) | $9.99 | 30% | $6.99 | 70% |

> **Small Business Program:** Apple and Google both offer 15% fee (instead of 30%) if your total revenue is under $1M/year. Opt in at App Store Connect / Play Console. This is per-developer, not per-app.

---

## 6. Implementation Roadmap

### Phase 1 — Desktop Agent Auto-Update Live (NOW)

| # | Task | Est. effort | Dependency |
|---|------|-------------|------------|
| 1.1 | Deploy update server on `62.171.141.136` | 1h | — |
| 1.2 | DNS `updates.zionterranova.com` → server | 15min | Webglobe DNS |
| 1.3 | nginx + Let's Encrypt SSL | 30min | 1.2 |
| 1.4 | Generate admin token + JWT secret | 5min | 1.1 |
| 1.5 | First build + upload v3.0.5 | 30min | 1.3 |
| 1.6 | Generate test license + E2E test | 15min | 1.5 |
| 1.7 | Payment page on website (Stripe) | 2h | Stripe account |

### Phase 2 — Code Signing (NEXT)

| # | Task | Est. effort | Dependency |
|---|------|-------------|------------|
| 2.1 | Buy Apple Developer Program ($99) | 1h + 24–48h wait | Business docs |
| 2.2 | Buy Windows OV Code Signing cert ($60) | 1h + 1–7 day wait | Business docs |
| 2.3 | Configure electron-builder signing env vars | 30min | 2.1, 2.2 |
| 2.4 | Rebuild + re-upload signed binaries | 30min | 2.3 |
| 2.5 | Test signed auto-update end-to-end | 1h | 2.4 |

### Phase 3 — Mobile App IAP (AFTER 3.1.0)

| # | Task | Est. effort | Dependency |
|---|------|-------------|------------|
| 3.1 | Install `react-native-iap` | 30min | — |
| 3.2 | Create `IAPService.js` + `LicenseService.js` | 4h | 3.1 |
| 3.3 | Create `PaywallScreen.js` + `useIAP` hook | 4h | 3.2 |
| 3.4 | Add IAP endpoints to update server | 4h | — |
| 3.5 | Apple receipt verification (server) | 3h | Apple shared secret |
| 3.6 | Google Play verification (server) | 3h | Google service account |
| 3.7 | Configure IAP products in App Store Connect | 1h | Apple Developer |
| 3.8 | Configure IAP products in Play Console | 1h | Google Play Console |
| 3.9 | Test IAP sandbox (iOS) + test purchases (Android) | 4h | 3.7, 3.8 |
| 3.10 | Feature gating in app (Pro vs Free) | 3h | 3.2 |
| 3.11 | App Store submission with IAPs | 2h + review wait | 3.9 |
| 3.12 | Play Store submission with IAPs | 1h + review wait | 3.9 |

### Phase 4 — Mobile App Store Launch

| # | Task | Est. effort | Dependency |
|---|------|-------------|------------|
| 4.1 | App Store screenshots (6.7" iPhone + 12.9" iPad) | 2h | Working app |
| 4.2 | App Store description + keywords | 1h | — |
| 4.3 | Privacy policy URL (website) | 1h | — |
| 4.4 | App Review Information (demo account, contact) | 30min | — |
| 4.5 | Submit to App Store review | 30min + 24–48h wait | 4.1–4.4 |
| 4.6 | Play Store screenshots + description | 1h | Working app |
| 4.7 | Data safety form (Play Console) | 30min | — |
| 4.8 | Submit to Play Store review | 30min + 1–3 day wait | 4.6–4.7 |
| 4.9 | Website download page update (store links) | 30min | 4.5, 4.8 |

---

## 7. App Store Compliance Checklist

### Apple App Store (iOS)

| # | Requirement | Status | Notes |
|---|-------------|--------|-------|
| 1 | Apple Developer Program ($99/yr) | Pending | Use `estrelaisabellazion3@gmail.com` |
| 2 | Bundle ID: `com.zionterranova.mobile` | Configured | `app.json` |
| 3 | Privacy Policy URL | Needed | Host on zionterranova.com/privacy |
| 4 | App screenshots (6.7" + 5.5" + iPad) | Needed | 3–10 screenshots per size |
| 5 | App description + keywords | Needed | Max 4000 chars description |
| 6 | Support URL | Needed | zionterranova.com/support |
| 7 | Demo account (for review) | Needed | Create test wallet for reviewer |
| 8 | IAP products configured | Needed | App Store Connect → In-App Purchases |
| 9 | App Review Information | Needed | Contact info, demo notes |
| 10 | Export compliance | Needed | Determine if encryption exempt |
| 11 | Age rating | Needed | Likely 4+ (no violence, no gambling) |
| 12 | App Tracking Transparency | Needed | If tracking users (probably not) |

**Cryptocurrency-specific Apple review notes:**
- Apple requires apps that handle cryptocurrency to be from established entities
- Wallet apps must clearly state they don't facilitate illegal activity
- Mining apps are allowed but must not drain battery excessively
- IAPs cannot be used to buy cryptocurrency (only digital features/services)
- Must include risk disclosure in app description

### Google Play (Android)

| # | Requirement | Status | Notes |
|---|-------------|--------|-------|
| 1 | Google Play Console ($25 one-time) | Pending | Register with Google account |
| 2 | Package: `com.zionterranova.mobile` | Configured | `app.json` |
| 3 | Privacy Policy URL | Needed | Host on zionterranova.com/privacy |
| 4 | App screenshots (phone + tablet) | Needed | 2–8 screenshots per type |
| 5 | App description | Needed | Max 4000 chars |
| 6 | Feature graphic (1024×500) | Needed | Promo banner |
| 7 | Data safety form | Needed | Declare data collection |
| 8 | Content rating questionnaire | Needed | IARC rating |
| 9 | Target audience + content | Needed | Declare target age group |
| 10 | Government apps / Financial apps | Needed | Crypto wallet = financial category |
| 11 | App signing (Play App Signing) | Needed | Opt in during first upload |
| 12 | IAP products configured | Needed | Play Console → Products |

**Cryptocurrency-specific Google Play notes:**
- Google Play allows crypto wallet apps
- Mining apps are allowed on devices, but not on Google Play for "remote mining services"
- Must comply with local regulations (country-specific availability)
- App must not facilitate illegal transactions

---

## 8. Update Server — Unified Architecture

The same `update-server/` handles both Desktop and Mobile:

```
update-server/
├── server.js                    # Existing — desktop license + release serving
├── db.js                        # Existing — licenses, activations, releases
├── iap.js                       # NEW — IAP receipt verification (Apple + Google)
├── routes/
│   ├── desktop.js               # Existing — /api/check-update, /api/releases/*
│   ├── mobile.js                # NEW — /api/iap/validate, /api/iap/entitlements
│   └── admin.js                 # Existing — /admin/*
└── data/
    ├── licenses.db              # Unified DB (licenses + IAP receipts + entitlements)
    └── releases/
        ├── desktop/             # Desktop agent installers + latest*.yml
        │   ├── latest.yml
        │   ├── latest-mac.yml
        │   ├── latest-linux.yml
        │   └── 3.0.5/
        └── mobile/              # Mobile OTA bundles (EAS update manifests)
            └── production/
```

### Unified license/entitlement model

```sql
-- One table for all entitlements (desktop license + mobile IAP)
CREATE TABLE entitlements (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  device_id       TEXT,                  -- desktop: machine hash, mobile: device ID
  license_key     TEXT,                  -- desktop: ZION-XXXX-..., mobile: NULL
  iap_transaction TEXT,                  -- mobile: Apple/Google transaction ID, desktop: NULL
  platform        TEXT NOT NULL,         -- 'macos' | 'windows' | 'linux' | 'ios' | 'android'
  entitlement     TEXT NOT NULL,         -- 'pro' | 'miner_boost' | 'donate'
  source          TEXT NOT NULL,         -- 'license_key' | 'iap_apple' | 'iap_google'
  status          TEXT DEFAULT 'active', -- 'active' | 'expired' | 'refunded' | 'revoked'
  purchased_at    TEXT,
  expires_at      TEXT,                  -- NULL = lifetime
  created_at      TEXT DEFAULT (datetime('now'))
);
```

---

## 9. Security Considerations

### License key security

| Risk | Mitigation |
|------|------------|
| License key sharing | Max activations per key (default 1, configurable) |
| License key extraction from binary | Keys stored in encrypted config, not hardcoded |
| Man-in-the-middle on update check | HTTPS (Let's Encrypt) + JWT for download auth |
| Replay attack with stolen JWT | JWT TTL = 10 minutes, single-use download URL |
| License key brute force | 16 hex chars = 64 bits entropy, rate limiting on API |

### IAP receipt security

| Risk | Mitigation |
|------|------------|
| Fake/replayed receipt | Server-side verification with Apple/Google APIs |
| Receipt sharing | Bind receipt to device ID, verify on each launch |
| Refund abuse | Webhook from Apple/Google → auto-revoke entitlement |
| Subscription cancellation | Server checks subscription status on each launch |

### Update integrity

| Risk | Mitigation |
|------|------------|
| Tampered binary | electron-builder signs SHA512 in latest.yml, autoUpdater verifies |
| MITM on download | HTTPS + SHA512 verification by electron-updater |
| Malicious update server | Admin token required for publishing, DB tracks all releases |

---

## 10. File Inventory

### Already built (Desktop Agent auto-update)

```
update-server/
├── server.js              # Fastify server — license + release serving
├── db.js                  # SQLite — licenses, activations, releases
├── package.json
├── Dockerfile
├── docker-compose.yml
├── .env.example
├── README.md              # Full documentation
└── scripts/
    ├── migrate.js
    ├── generate-license.js
    ├── list-licenses.js
    ├── revoke-license.js
    ├── upload-release.js
    └── publish-release.sh
```

### To build (Mobile IAP)

```
update-server/
├── iap.js                 # NEW — Apple + Google receipt verification
└── routes/
    └── mobile.js          # NEW — /api/iap/* endpoints

mobile-app/
├── src/
│   ├── services/
│   │   ├── IAPService.js      # NEW — StoreKit 2 / Google Play Billing
│   │   └── LicenseService.js  # NEW — entitlement management
│   ├── context/
│   │   └── IAPContext.js      # NEW — React context for purchase state
│   ├── screens/
│   │   ├── PaywallScreen.js   # NEW — IAP purchase UI
│   │   └── SettingsScreen.js  # MODIFY — add Pro upgrade section
│   └── hooks/
│       └── useIAP.js          # NEW — purchase/restore/validate hook
```

---

## 11. Cost Summary

| Item | Cost | Frequency | Required for |
|------|------|-----------|--------------|
| Apple Developer Program | $99 | /year | macOS signing + iOS App Store |
| Google Play Console | $25 | one-time | Android Play Store |
| Windows OV Code Signing | $60–200 | /year | Windows auto-update (no SmartScreen) |
| Update server hosting | $0 | — | Existing server (62.171.141.136) |
| DNS (updates.zionterranova.com) | $0 | — | Existing Webglobe domain |
| Let's Encrypt SSL | $0 | — | HTTPS for update server |
| `react-native-iap` library | $0 | — | Mobile IAP |
| Stripe (payment processing) | 2.9% + $0.30 per transaction | per sale | Desktop license sales |
| **Total first year** | **~$184–284** | | All platforms |

---

## Related documents

- [`update-server/README.md`](./update-server/README.md) — Update server documentation
- [`3.0.5.md`](./3.0.5.md) — Current mainnet status
- [`ROADMAP.md`](./ROADMAP.md) — Forward roadmap
- [`APP&WEB/mobile-app/RELEASE_CHECKLIST.md`](./APP&WEB/mobile-app/RELEASE_CHECKLIST.md) — Mobile release checklist
- [`APP&WEB/mobile-app/eas.json`](./APP&WEB/mobile-app/eas.json) — EAS build configuration
- [`AGENTS.md`](./AGENTS.md) — Agent operating guidance
