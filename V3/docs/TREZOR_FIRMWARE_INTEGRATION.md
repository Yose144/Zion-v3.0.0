# Trezor Firmware Integration for ZION — Deep Dive

> **Status:** Watch-only ✅ | Transaction signing ❌ (blocked by firmware)  
> **Last updated:** 2026-06-03  
> **Author:** ZION Dev Team  

---

## TL;DR

Trezor **Model T** and **Model One** can already export ZION-compatible Ed25519 public keys (`getPublicKey` with `curve: 'ed25519'`). However, **transaction signing is impossible today** because:

1. `TrezorConnect.signMessage` is hard-coded to **secp256k1** (Bitcoin-like) curves.
2. Ed25519 signing exists in firmware only via **coin-specific apps** (Cardano, Stellar, NEM, Monero, Tezos).
3. The Trezor team **does not accept new cryptocurrency PRs** as of 2024+.

This document describes the exact firmware changes required, the effort estimate, and alternative paths.

---

## 1. Why `signMessage` Fails for Ed25519

### Current Trezor `SignMessage` Flow

```
Connect API          Protobuf                Firmware
-----------          --------                --------
signMessage()  →  SignMessage msg      →  apps/bitcoin/sign_message()
                  { path, message,         (C code or Rust port)
                    coin_name,              1. Derives secp256k1 key from path
                    script_type }            2. Prepends Bitcoin message prefix
                                             3. Double-SHA256 hashes
                                             4. ECDSA signs with secp256k1
```

The firmware `apps/bitcoin/sign_message.c` (or its Rust equivalent) **does not read `ecdsa_curve_name`**. Even though `GetPublicKey` accepts `curve: 'ed25519'`, `SignMessage` ignores it entirely.

### What Would Need to Change

#### Option A: Extend `SignMessage` with `curve` parameter (Minimal Change)

**Files to modify in `trezor-firmware`:**

| File | Change |
|------|--------|
| `common/protob/messages-bitcoin.proto` | Add `optional string ecdsa_curve_name = 6 [default="secp256k1"];` to `SignMessage` |
| `core/src/apps/bitcoin/sign_message.py` (or `.c`/`.rs`) | Read `ecdsa_curve_name`; if `"ed25519"`, use `ed25519_sign` instead of `ecdsa_sign` |
| `core/src/trezor/crypto/curves.py` | Ensure `ed25519` curve is available in the signing context |
| `connect` packages | Pass `ecdsa_curve_name` from `TrezorConnect.signMessage()` params |

**Pros:** Reuses existing Ed25519 primitives (`ed25519-dalek` / `ed25519-donna` already in firmware).  
**Cons:** Touches core Bitcoin app; high review barrier; breaks existing assumptions about message prefixing (Bitcoin adds `\x18Bitcoin Signed Message:\n` prefix + length — Ed25519 should sign raw bytes).

#### Option B: New `Ed25519SignMessage` protobuf message (Cleanest)

| File | Change |
|------|--------|
| `common/protob/messages-crypto.proto` | Add `Ed25519SignMessage` / `Ed25519MessageSignature` messages |
| `core/src/apps/zion/` (new directory) | New micro-app: derive Ed25519 key from path, sign raw bytes, return 64-byte sig |
| `connect` packages | Add `TrezorConnect.ed25519SignMessage()` method |

**Pros:** No risk of breaking Bitcoin `signMessage`; clean separation.  
**Cons:** New firmware app = more code size; still needs Trezor team review.

---

## 2. Trezor Team Policy Reality Check

From [`trezor-firmware/docs/misc/contributing.md`](https://github.com/trezor/trezor-firmware/blob/main/docs/misc/contributing.md):

> *"At the moment, we do not have the capacity to add new coins that do not fit the aforementioned category [Bitcoin fork / Ethereum fork / NEM mosaic]. Our current product goal is to unite what we support in firmware and in Trezor Suite … this effectively means that **our team will not be accepting any requests to add new cryptocurrencies.**"*

**Translation:** Even a perfect PR with tests, docs, and changelog will likely be **rejected** unless ZION is a direct fork of an already-supported coin.

---

## 3. Practical Paths Forward

### Path A — Community Fork (Recommended for Power Users)

Fork `trezor/trezor-firmware`, apply Option B above, build signed/unsigned firmware, and flash via `trezorctl firmware-update`.

**Effort:**
- Rust/C embedded development: **2–4 weeks** (familiar developer)
- Protobuf + Connect SDK changes: **1 week**
- Testing on physical devices: **1 week**
- **Total: ~1 month, 1 senior embedded Rust dev**

**Risks:**
- Custom firmware voids device warranty (Trezor policy).
- Users must manually flash; no auto-update via Trezor Suite.
- Fork drifts from upstream security patches.

### Path B — `cipherKeyValue` Workaround (Not Recommended)

Trezor has `CipherKeyValue` which derives a **symmetric key** from a BIP-32 path + user-visible label. It does **not** expose raw asymmetric signing.

```javascript
// This gives you a symmetric key, NOT an Ed25519 signature
TrezorConnect.cipherKeyValue({
  path: "m/44'/0'/0'",
  key: 'ZION TX SIGN',
  value: txHashHex,
  encrypt: true,
});
```

**Verdict:** Cannot produce Ed25519 signatures. Useless for ZION UTXO signing.

### Path C — Wait for Generic Ed25519 API (Unlikely)

There is no public roadmap from Trezor for generic Ed25519 `signMessage`. The only Ed25519 paths in firmware are:
- `cardanoSignTransaction` (Cardano tx format)
- `stellarSignTransaction` (Stellar tx format)
- `nemSignTransaction` (NEM tx format)
- `tezosSignTransaction` (Tezos tx format)

Each enforces its native transaction serialization. ZION cannot piggyback on any of them.

### Path D — Use Ledger Instead (More Promising)

Ledger ecosystem is more open:
- Ledger SDK (C/Bolos) is documented.
- Community apps exist for many chains.
- Ledger Live does not gate app store submissions as strictly as Trezor firmware.

See [`walletHW.md`](../../walletHW.md) §2 for Ledger track details.

---

## 4. Exact Files to Patch (Option B — Reference Spec)

If you decide to fork, here is the file-by-file specification:

### 4.1 Protobuf Definitions

```protobuf
// common/protob/messages-zion.proto (new file)
syntax = "proto2";
package hw.trezor.messages.zion;

message ZionSignMessage {
    repeated uint32 address_n = 1;
    required bytes message = 2;     // raw bytes to sign (BLAKE3 hash)
}

message ZionMessageSignature {
    required bytes signature = 1;     // 64-byte Ed25519 signature
    required string address = 2;    // zion1... address for verification
}
```

### 4.2 Firmware App

```python
# core/src/apps/zion/__init__.py (new)
# core/src/apps/zion/sign_message.py (new)

from trezor.crypto import hashlib
from trezor.crypto.curve import ed25519
from trezor.messages import ZionSignMessage, ZionMessageSignature
from apps.common import paths

async def sign_message(ctx, msg: ZionSignMessage) -> ZionMessageSignature:
    # Verify path is allowed
    await paths.validate_path(ctx, keychain, msg.address_n)
    
    # Derive Ed25519 keypair
    node = keychain.derive(msg.address_n, curve_name='ed25519')
    seckey = node.private_key()
    pubkey = ed25519.publickey(seckey)
    
    # Sign raw message (no Bitcoin prefix!)
    signature = ed25519.sign(seckey, msg.message)
    
    # Derive ZION address for display
    address = derive_zion_address(pubkey)
    
    # Show confirmation on device screen
    await confirm_zion_tx(ctx, address, msg.message)
    
    return ZionMessageSignature(
        signature=signature,
        address=address,
    )
```

### 4.3 Connect SDK (Web)

```typescript
// packages/connect/src/api/zionSignMessage.ts (new)

export default class ZionSignMessage extends AbstractMethod {
    async run() {
        const cmd = this.getDevice().getCommands();
        const { message } = await cmd.typedCall(
            'ZionSignMessage',
            'ZionMessageSignature',
            {
                address_n: this.params.path,
                message: this.params.message,
            }
        );
        return {
            signature: message.signature,  // hex
            address: message.address,
        };
    }
}
```

### 4.4 ZION SDK Update

```typescript
// APP&WEB/zion-wallet-sdk/src/hardware/trezor-wallet.ts

async signTransaction(txHash: Uint8Array, path: string = DEFAULT_TREZOR_PATH): Promise<Uint8Array> {
    // After firmware fork + Connect update:
    const result = await this.trezor.zionSignMessage({
        path,
        message: Buffer.from(txHash).toString('hex'),
    });
    return Buffer.from(result.payload.signature, 'hex');
}
```

---

## 5. Effort & Resource Estimate

| Phase | Task | Person | Duration | Cost |
|-------|------|--------|----------|------|
| 1 | Fork trezor-firmware, add protobuf + app | Senior Rust/C Dev | 3–4 weeks | ~$6–8k |
| 2 | Fork trezor-connect, add JS/TS API | Frontend/TS Dev | 1 week | ~$2k |
| 3 | Test on Model T + Model One hardware | QA / Dev | 1 week | Hardware cost |
| 4 | Build & distribute unsigned firmware | DevOps | 3 days | CI time |
| 5 | User documentation & flash guide | Technical Writer | 3 days | — |
| | | **Total** | **~6 weeks** | **~$10k** |

---

## 6. Security Considerations for Custom Firmware

| Risk | Mitigation |
|------|------------|
| Supply chain (malicious build) | Publish reproducible build instructions + CI hashes |
| Firmware verification | Users verify `firmware-fingerprint` against published hash before flash |
| Auto-update conflict | Pin Trezor Suite to ignore firmware version; manual updates only |
| Seed compromise | Custom firmware cannot extract seed (Trezor Secure Element / SRAM design unchanged) |

---

## 7. Conclusion & Recommendation

**For mainnet launch (2026-12-31):**

1. **Keep Trezor as watch-only** (current implementation). Users verify addresses on-device and monitor balances via RPC.
2. **Prioritize Ledger track** — Ledger SDK is more accessible; custom app store submission is feasible.
3. **Do not block on Trezor firmware fork** — ~6 weeks + ongoing maintenance is too heavy for pre-launch timeline.
4. **Post-launch:** If community demand is high, crowdfund or bounty-fund a Trezor firmware fork maintained by a dedicated HW wallet team.

**For users who need hardware signing today:**

- Import the same BIP39 seed into the ZION software wallet (less secure, but functional).
- Use a Ledger with watch-only monitoring until Ledger app is ready.

---

*Generated with [Devin](https://cli.devin.ai/docs)*  
*Co-Authored-By: Devin <158243242+devin-ai-integration[bot]@users.noreply.github.com>*
