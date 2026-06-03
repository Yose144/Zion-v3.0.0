# ZION Hardware Wallet Integration Roadmap

> **Document:** walletHW.md  
> **Version:** 1.0.0  
> **Date:** 2026-06-03  
> **Status:** Trezor watch-only DONE | Ledger watch-only IN-PROGRESS | Generic HID PLANNED

---

## Executive Summary

ZION uses **Ed25519** for keypairs and a custom Bech32-style address encoding (`zion1…`). This curve choice is post-quantum ready but creates friction with commercial hardware wallets, which gate Ed25519 signing behind coin-specific firmware apps (Cardano, Stellar, NEM, Monero, Tezos). No generic Ed25519 `signMessage` / `signTransaction` API exists in Trezor or Ledger firmware today.

This document defines the integration architecture, current limitations, and path to full hardware-wallet transaction signing.

---

## 1. Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    zion-wallet-sdk                         │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────┐  │
│  │ SoftwareWallet│  │ TrezorWallet │  │  LedgerWallet    │  │
│  │  (Ed25519)    │  │  (watch-only)│  │  (watch-only)    │  │
│  └──────┬───────┘  └──────┬───────┘  └────────┬─────────┘  │
│         │                 │                    │            │
│         └─────────────────┴────────────────────┘            │
│                           │                                 │
│                    HardwareWalletInterface                 │
│                     connect / disconnect                    │
│                     getAddress (with on-device verify)      │
│                     signTransaction (optional)              │
└─────────────────────────────────────────────────────────────┘
```

All hardware wallet implementations live in `APP&WEB/zion-wallet-sdk/src/hardware/`.

---

## 2. Supported Devices

| Device | Status | Address Verify | Balance / History | TX Signing | Notes |
|--------|--------|---------------|-------------------|------------|-------|
| **Trezor Model T / One** | ✅ Implemented | ✅ On-screen | ✅ RPC watch-only | ❌ Blocked | Firmware `signMessage` is secp256k1-only. Ed25519 only via coin-specific apps. |
| **Ledger Nano S / X / S Plus** | 🔄 In Progress | ✅ On-screen | ✅ RPC watch-only | ❌ Blocked | Cardano/Stellar/Algorand app can export Ed25519 pubkey. TX signing requires coin-specific tx format. |
| **Generic WebUSB HID** | 📋 Planned | Depends on device | ✅ RPC watch-only | ❌ Blocked | Framework for any WebUSB HID device. |
| **Ledger + Custom ZION App** | 📋 Future | ✅ | ✅ | ✅ | Requires Ledger app built with Ledger SDK (C/Bolos). |
| **Trezor + Custom ZION App** | 📋 Future | ✅ | ✅ | ✅ | Requires Trezor firmware PR adding ZION coin. |

---

## 3. Curve & Derivation Facts

### Ed25519 on Trezor
- `TrezorConnect.getPublicKey({ curve: 'ed25519' })` works.
- `TrezorConnect.signMessage()` uses `secp256k1` only, regardless of path.
- Coin-specific methods (`cardanoSignTransaction`, `stellarSignTransaction`, …) enforce their own tx format.

### Ed25519 on Ledger
- Ledger apps (Cardano, Stellar, Algorand, NEM, Tezos, Mina) each use Ed25519 internally.
- `@ledgerhq/hw-app-ada` → `getPublicKey(path)` returns raw Ed25519 pubkey (usable for ZION address derivation).
- `@ledgerhq/hw-app-algorand` → `signTransaction(path, message)` signs raw bytes, but the Algorand app may validate Algorand tx format.
- No generic `signRawEd25519(message)` API exists.

### Derivation Path Strategy
We default to `m/44'/0'/0'` (inside the Bitcoin BIP-44 tree) with `curve: 'ed25519'`. This is recognised by Trezor and Ledger as a valid path, and the curve override gives us Ed25519 keys.

---

## 4. Implementation Layers

### Layer 1 – Device Communication (`hardware/*.ts`)
- Handle transport lifecycle (WebUSB / WebHID / Bridge).
- Export `getAddress(path, verifyOnDevice)` → `{ address, publicKey, path }`.
- Optionally export `signTransaction(txHash, path)` → `Uint8Array` (throws if unsupported).

### Layer 2 – Wallet Manager Bridge (`wallet-manager.ts`)
- `importFromTrezor(options)` → creates watch-only wallet with `keyType: 'trezor'`.
- `importFromLedger(options)` → creates watch-only wallet with `keyType: 'ledger'`.
- `importFromHID(options)` → generic hook.
- Block `send()`, `exportPrivateKey()`, `exportMnemonic()` for hardware wallets.

### Layer 3 – UI Contexts
- Website: `ZionWalletContext` exposes `importFromTrezor()`, `importFromLedger()`.
- Mobile: `WalletService` exposes `importFromTrezor()`, `importFromLedger()`.
- Desktop: `ElectronStorage` already persists hardware wallet metadata securely.

---

## 5. Security Model

| Threat | Mitigation |
|--------|-----------|
| Malicious website requests tx signing | HW wallet shows tx details on-device; user must confirm. |
| Address substitution attack | `verifyOnDevice: true` forces the user to visually confirm the address on the HW screen. |
| Seed extraction via SDK | Hardware wallet private keys never enter JavaScript heap. |
| XSS steals wallet index | Index is just IDs; encrypted keys remain in storage. |
| Malware replaces transport | WebUSB requires user permission per session; WebHID likewise. |

---

## 6. Roadmap to Full TX Signing

### Phase A – Watch-Only (NOW)
- Trezor: ✅
- Ledger: 🔄
- Generic HID: 📋

**Goal:** Users can verify addresses on-device and monitor balances. Spending requires importing the same seed into a software wallet (less secure but functional).

### Phase B – Firmware-Level Support (Future)
1. **Trezor track:** Submit PR to `trezor-firmware` adding ZION coin definition + Ed25519 `signMessage` support.
   - Effort: Medium (Rust firmware, protobuf definitions, review cycle ~3 months).
   - Blocking: Trezor core team review.
2. **Ledger track:** Build custom ZION Ledger app with Ledger SDK.
   - Effort: High (C/Bolos, Ledger security audit, $~5k audit fee).
   - Blocking: Ledger app store approval.

### Phase C – Alternative Paths (Exploration)
1. **Curve migration:** Switch ZION from Ed25519 to secp256k1 in a future consensus upgrade (hard fork).
   - Impact: Breaks all existing addresses; massive coordination needed.
   - Benefit: Instant Trezor/Ledger full support via existing Bitcoin/Ethereum apps.
2. **Sidecar signing:** Run a local lightweight signer daemon that holds the decrypted key in memory only during the signing session.
   - Impact: Reduces HW wallet benefit; seed is briefly exposed in RAM.

---

## 7. API Surface

### `HardwareWalletInterface` (shared)
```typescript
interface HardwareWalletInterface {
  connect(manifest?: { email: string; appUrl: string }): Promise<void>;
  disconnect(): void;
  getAddress(path?: string, verifyOnDevice?: boolean): Promise<{
    address: string;
    publicKey: string;
    path: string;
  }>;
  signTransaction?(txHash: Uint8Array, path?: string): Promise<Uint8Array>;
  signMessage?(message: string | Uint8Array, path?: string): Promise<string>;
}
```

### Wallet Manager Additions
```typescript
class WalletManager {
  importFromTrezor(options: { name?: string; path?: string }): Promise<WalletPublicView>;
  importFromLedger(options: { name?: string; path?: string }): Promise<WalletPublicView>;
}
```

---

## 8. Build & Dependency Notes

- Trezor libs (`@trezor/connect-web`, `@trezor/connect`) are **optional peer dependencies**.
- Ledger libs (`@ledgerhq/hw-transport-webusb`, `@ledgerhq/hw-app-ada`) are **optional peer dependencies**.
- SDK compiles cleanly even when peer deps are absent (dynamic `import()` + `@ts-ignore`).
- Trezor Connect requires a `manifest` object for production use (TOS compliance).

---

## 9. Known Issues & Risks

| ID | Risk | Mitigation |
|----|------|------------|
| R1 | Trezor `signMessage` silently uses secp256k1 even with `curve: 'ed25519'` in `getPublicKey`. | `signTransaction` throws with clear error message. |
| R2 | Ledger Cardano app may change protobuf format in firmware updates. | Pin peer dependency versions; test on latest firmware before releases. |
| R3 | WebUSB is Chromium-only (no Safari, no Firefox). | Document browser requirements; recommend Trezor Bridge / Ledger Live for non-Chromium. |
| R4 | User imports same seed into software wallet for spending (Phase A workaround). | Warn user in UI; recommend minimal balance on watch-only wallets until Phase B. |

---

*Generated with [Devin](https://cli.devin.ai/docs)  
Co-Authored-By: Devin <158243242+devin-ai-integration[bot]@users.noreply.github.com>*
