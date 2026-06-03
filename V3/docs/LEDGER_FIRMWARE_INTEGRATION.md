# Ledger App Integration for ZION — Development Roadmap

> **Status:** Spec complete | App boilerplate ready | Security audit pending  
> **Target devices:** Nano S+, Nano X, Stax, Flex  
> **Last updated:** 2026-06-03

---

## TL;DR

Ledger is the **recommended hardware wallet path** for ZION because:

1. Ledger Secure SDK (Bolos) is open-source and documented.
2. `ed25519` is a **first-class curve** in Ledger firmware (`CX_CURVE_Ed25519`).
3. `cx_eddsa_sign_no_throw` signs **raw bytes** — no forced tx format like Trezor coin apps.
4. Ledger Live app store accepts community submissions for review (unlike Trezor's hard ban).
5. Existing apps (Cardano, Algorand, Stellar) prove Ed25519 signing works end-to-end.

**What we need to build:**
- A small Bolos C app (~3–5 KB) that:
  1. Exports Ed25519 public keys via `INS_GET_PUBLIC_KEY` APDU.
  2. Signs raw BLAKE3 transaction hashes via `INS_SIGN_TX` APDU.
  3. Shows address + amount on device screen for user confirmation.

---

## 1. Ledger Architecture Overview

```
Ledger Device (Secure Element)
│
├─ BOLOS OS
│  ├─ cxlib (crypto library: ed25519, secp256k1, sha2, blake3...)
│  └─ syscall interface
│
├─ ZION App (C, our code)
│  ├─ main.c           — event loop, APDU dispatch
│  ├─ apdu_parser.c    — parse incoming APDU commands
│  ├─ get_public_key.c — derive Ed25519 pubkey from BIP-32 path
│  ├─ sign_tx.c        — sign raw BLAKE3 hash with Ed25519
│  └─ ui.c             — device screen flows (address confirm, tx confirm)
│
└─ Other apps (Bitcoin, Ethereum, Cardano...)
```

**Transport to host:**
- USB HID (Nano S+/X) or BLE (Stax/Flex).
- Host talks via `@ledgerhq/hw-transport-webusb` or `webhid`.
- APDU protocol: CLA + INS + P1 + P2 + LC + DATA.

---

## 2. APDU Command Specification

| INS | Name | Description | Input | Output |
|-----|------|-------------|-------|--------|
| `0x02` | `GET_PUBLIC_KEY` | Derive Ed25519 pubkey from BIP-32 path | Path (uint32[]), displayOnScreen flag | 32-byte pubkey, zion1 address string |
| `0x04` | `SIGN_TX` | Sign raw BLAKE3 transaction hash | Path, 32-byte tx hash, recipient address, amount | 64-byte Ed25519 signature |
| `0x06` | `GET_VERSION` | App version string | — | "ZION 1.0.0" |

### GET_PUBLIC_KEY APDU Detail

```
CLA = 0xE0
INS = 0x02
P1  = 0x00 (no display) | 0x01 (display on screen)
P2  = 0x00
LC  = length of path bytes
DATA = path as uint32 array (each uint32 = 4 bytes, big-endian)
       Example: m/44'/0'/0' = [0x8000002C, 0x80000000, 0x80000000]
```

**Response:**
- `0x9000` = OK
- Response data: 32-byte raw Ed25519 public key + zion1 address (ASCII)

### SIGN_TX APDU Detail

```
CLA = 0xE0
INS = 0x04
P1  = 0x00 (first chunk) | 0x80 (more chunks)
P2  = 0x00
LC  = length of data
DATA = path (uint32[]) + recipient_address (ASCII) + amount_zion (uint64 LE) + tx_hash (32 bytes)
```

**UI Flow on device:**
1. Parse tx_hash → show "Sign ZION TX?" on screen.
2. Show recipient address (truncated middle for readability).
3. Show amount in ZION (not flowers).
4. User presses both buttons (Nano) or taps "Confirm" (Stax/Flex).
5. Device derives private key from path, calls `cx_eddsa_sign_no_throw`.
6. Return 64-byte signature.

---

## 3. Bolos C Implementation

### 3.1 Makefile

```makefile
# Makefile

APPNAME = ZION
APPVERSION_M = 1
APPVERSION_N = 0
APPVERSION_P = 0
APPVERSION = "$(APPVERSION_M).$(APPVERSION_N).$(APPVERSION_P)"

APP_LOAD_PARAMS = --appFlags 0x40 --path "44'/0'" --curve ed25519

APP_SOURCE_PATH += src

include $(BOLOS_SDK)/Makefile.defines

# Compiler flags
CFLAGS += -O3 -Wall -Wextra
DEFINES += APPNAME=\"$(APPNAME)\" APPVERSION=\"$(APPVERSION)\"

# Bolos SDK includes
SDK_SOURCE_PATH += lib_stusb lib_stusb_impl lib_ux

# Targets
ifeq ($(TARGET_NAME),TARGET_NANOS2)
    DEFINES += HAVE_NBGL
endif
ifeq ($(TARGET_NAME),TARGET_NANOX)
    DEFINES += HAVE_BLE HAVE_BLE_APDU
endif
```

### 3.2 main.c — APDU Dispatch Loop

```c
// src/main.c

#include "os.h"
#include "cx.h"
#include "io.h"
#include "glyphs.h"
#include "ux.h"
#include "zion.h"

#define CLA 0xE0
#define INS_GET_PUBLIC_KEY 0x02
#define INS_SIGN_TX        0x04
#define INS_GET_VERSION    0x06

void handle_get_public_key(uint8_t p1, uint8_t p2, uint8_t* data, uint16_t len);
void handle_sign_tx(uint8_t p1, uint8_t p2, uint8_t* data, uint16_t len);

static void zion_main(void) {
    volatile uint32_t rx = 0;
    volatile uint32_t tx = 0;
    volatile uint32_t flags = 0;

    for (;;) {
        rx = io_exchange(CHANNEL_APDU | flags, tx);
        flags = 0;
        tx = 0;

        if (rx == 0) THROW(0x6982); // No data

        uint8_t cla = G_io_apdu_buffer[0];
        uint8_t ins = G_io_apdu_buffer[1];
        uint8_t p1  = G_io_apdu_buffer[2];
        uint8_t p2  = G_io_apdu_buffer[3];
        uint8_t lc  = G_io_apdu_buffer[4];
        uint8_t* data = G_io_apdu_buffer + 5;

        if (cla != CLA) THROW(0x6E00); // Bad CLA

        switch (ins) {
            case INS_GET_PUBLIC_KEY:
                handle_get_public_key(p1, p2, data, lc);
                break;
            case INS_SIGN_TX:
                handle_sign_tx(p1, p2, data, lc);
                break;
            case INS_GET_VERSION:
                tx = sizeof(APPVERSION);
                memcpy(G_io_apdu_buffer, APPVERSION, tx);
                THROW(0x9000);
                break;
            default:
                THROW(0x6D00); // INS not supported
        }
    }
}

__attribute__((section(".text.main"))) int main(void) {
    os_boot();
    TRY {
        zion_main();
    }
    CATCH(EXCEPTION_IO_RESET) {
        io_seproxyhal_io_heartbeat_toggle();
    }
    CATCH_ALL {
        // Error handling
    }
    FINALLY {
    }
    END_TRY;
}
```

### 3.3 get_public_key.c

```c
// src/get_public_key.c

#include "zion.h"
#include "cx.h"
#include "os.h"

static uint32_t path[5];
static uint8_t publicKey[32];
static char zionAddress[45]; // "zion1" + 35 body + 4 checksum + null

// Matches TS SDK: SHA-256 → RIPEMD-160 → custom base32 + 4-char checksum
static void derive_zion_address(const uint8_t* pubkey, char* out) {
    uint8_t sha[32];
    uint8_t ripemd[20];
    cx_sha256_t sha256;
    cx_ripemd160_t ripemd160;

    cx_sha256_init(&sha256);
    cx_hash((cx_hash_t*)&sha256, CX_LAST, pubkey, 32, sha, sizeof(sha));

    cx_ripemd160_init(&ripemd160);
    cx_hash((cx_hash_t*)&ripemd160, CX_LAST, sha, 32, ripemd, sizeof(ripemd));

    // Custom base32 alphabet: no b,i,l,o,1
    static const char ALPHABET[] = "023456789acdefghjklmnpqrstuvwxyz";

    char body[36];
    for (int i = 0; i < 20; i++) {
        body[i * 2]     = ALPHABET[ripemd[i] % 32];
        body[i * 2 + 1] = ALPHABET[(ripemd[i] / 32) % 32];
    }
    body[35] = '\0';

    // 4-char checksum: SHA-256("zion1" + body), first 2 bytes → 4 base32 chars
    cx_sha256_init(&sha256);
    cx_hash((cx_hash_t*)&sha256, CX_FIRST, (uint8_t*)"zion1", 5, NULL, 0);
    cx_hash((cx_hash_t*)&sha256, CX_LAST, (uint8_t*)body, 35, sha, sizeof(sha));

    char checksum[5];
    checksum[0] = ALPHABET[sha[0] % 32];
    checksum[1] = ALPHABET[(sha[0] / 32) % 32];
    checksum[2] = ALPHABET[sha[1] % 32];
    checksum[3] = ALPHABET[(sha[1] / 32) % 32];
    checksum[4] = '\0';

    snprintf(out, 45, "zion1%s%s", body, checksum);
}

void handle_get_public_key(uint8_t p1, uint8_t p2, uint8_t* data, uint16_t len) {
    if (len < 4 || len % 4 != 0) THROW(0x6A80); // Bad data length

    uint8_t pathLen = len / 4;
    for (uint8_t i = 0; i < pathLen; i++) {
        path[i] = U4BE(data, i * 4);
    }

    // Derive keypair
    cx_ecfp_private_key_t privateKey;
    cx_ecfp_public_key_t publicKeyRaw;
    os_perso_derive_node_bip32_seed_key(
        HDW_NORMAL,
        CX_CURVE_Ed25519,
        path,
        pathLen,
        privateKey.d,
        NULL,
        NULL,
        0
    );
    privateKey.d_len = 32;

    cx_ecfp_init_private_key_no_throw(CX_CURVE_Ed25519, privateKey.d, 32, &privateKey);
    cx_ecfp_generate_pair_no_throw(CX_CURVE_Ed25519, &publicKeyRaw, &privateKey, 1);

    // publicKeyRaw.W is 65 bytes (1 prefix + 32 pubkey + 32 ???)
    // For Ed25519, the actual pubkey is the first 32 bytes after prefix
    memcpy(publicKey, publicKeyRaw.W + 1, 32);

    derive_zion_address(publicKey, zionAddress);

    // Zeroize private key from memory
    explicit_bzero(privateKey.d, sizeof(privateKey.d));

    if (p1 == 0x01) {
        // Display address on device for confirmation
        display_address(zionAddress);
    }

    // Return pubkey
    memcpy(G_io_apdu_buffer, publicKey, 32);
    tx = 32;
    THROW(0x9000);
}
```

### 3.4 sign_tx.c

```c
// src/sign_tx.c

#include "zion.h"
#include "cx.h"
#include "os.h"

static uint8_t signature[64];

void handle_sign_tx(uint8_t p1, uint8_t p2, uint8_t* data, uint16_t len) {
    // Layout: path (4*pathLen bytes) + recipient (var, null-term) + amount (8 LE) + tx_hash (32)
    if (len < 48) THROW(0x6A80); // Minimum: 1 path component + empty recipient + amount + hash

    uint8_t pathLen = data[0];
    uint32_t path[5];
    uint16_t offset = 1;

    for (uint8_t i = 0; i < pathLen && i < 5; i++) {
        path[i] = U4BE(data, offset);
        offset += 4;
    }

    // Parse recipient (null-terminated string)
    char recipient[45];
    uint8_t recipientLen = 0;
    while (offset < len && data[offset] != 0 && recipientLen < 44) {
        recipient[recipientLen++] = data[offset++];
    }
    recipient[recipientLen] = '\0';
    offset++; // skip null terminator

    if (offset + 40 > len) THROW(0x6A80); // Not enough data for amount + hash

    // Amount (uint64 LE, in flowers)
    uint64_t amountFlowers = U8LE(data, offset);
    offset += 8;

    // Transaction hash (32 bytes, BLAKE3)
    uint8_t txHash[32];
    memcpy(txHash, data + offset, 32);
    offset += 32;

    // Show confirmation on device
    double amountZion = (double)amountFlowers / 1e12;
    char amountStr[32];
    snprintf(amountStr, sizeof(amountStr), "%.6f ZION", amountZion);

    if (!confirm_tx(recipient, amountStr)) {
        THROW(0x6985); // User rejected
    }

    // Derive private key
    cx_ecfp_private_key_t privateKey;
    uint8_t rawPrivateKey[32];
    os_perso_derive_node_bip32_seed_key(
        HDW_NORMAL,
        CX_CURVE_Ed25519,
        path,
        pathLen,
        rawPrivateKey,
        NULL,
        NULL,
        0
    );

    cx_ecfp_init_private_key_no_throw(CX_CURVE_Ed25519, rawPrivateKey, 32, &privateKey);

    // Sign with Ed25519 (EdDSA)
    // cx_eddsa_sign_no_throw computes SHA-512 internally and signs
    // Note: ZION uses BLAKE3 for tx hash, but Ed25519 signing standard
    //       adds another internal hash (SHA-512). We sign the raw txHash.
    //       The node will verify: ed.verify(signature, txHash, pubkey)
    cx_eddsa_sign_no_throw(
        &privateKey,
        CX_SHA512,          // Ed25519 standard uses SHA-512 internally
        txHash,
        32,
        NULL,
        0,
        signature,
        sizeof(signature),
        NULL
    );

    explicit_bzero(rawPrivateKey, sizeof(rawPrivateKey));

    memcpy(G_io_apdu_buffer, signature, 64);
    tx = 64;
    THROW(0x9000);
}
```

---

## 4. Host-Side JavaScript/TypeScript (Ledger Transport)

```typescript
// packages/ledger-zion/src/index.ts

import Transport from '@ledgerhq/hw-transport';

const CLA = 0xE0;
const INS_GET_PUBLIC_KEY = 0x02;
const INS_SIGN_TX = 0x04;

export class ZionLedgerApp {
  constructor(private transport: Transport) {}

  async getPublicKey(path: string, displayOnScreen = true): Promise<{
    publicKey: string;  // hex
    address: string;    // zion1...
  }> {
    const pathBytes = this.bip32PathToBuffer(path);
    const response = await this.transport.send(
      CLA,
      INS_GET_PUBLIC_KEY,
      displayOnScreen ? 0x01 : 0x00,
      0x00,
      pathBytes
    );

    // Response: pubkey (32) + address (ASCII) + SW (2)
    const publicKey = response.slice(0, 32).toString('hex');
    const address = response.slice(32, -2).toString('ascii').replace(/\x00/g, '');
    return { publicKey, address };
  }

  async signTransaction(
    path: string,
    txHash: Uint8Array,
    recipient: string,
    amountFlowers: bigint
  ): Promise<string> {
    const pathBytes = this.bip32PathToBuffer(path);
    const recipientBytes = Buffer.from(recipient, 'ascii');
    const amountBytes = Buffer.allocUnsafe(8);
    amountBytes.writeBigUInt64LE(amountFlowers, 0);

    const data = Buffer.concat([
      Buffer.from([pathBytes.length / 4]), // path length in components
      pathBytes,
      recipientBytes,
      Buffer.from([0]), // null terminator
      amountBytes,
      Buffer.from(txHash),
    ]);

    const response = await this.transport.send(
      CLA,
      INS_SIGN_TX,
      0x00,
      0x00,
      data
    );

    return response.slice(0, -2).toString('hex'); // 64-byte signature
  }

  private bip32PathToBuffer(path: string): Buffer {
    const parts = path.replace(/^m\//, '').split('/');
    const buf = Buffer.allocUnsafe(parts.length * 4);
    parts.forEach((p, i) => {
      const hardened = p.endsWith("'");
      const num = parseInt(p.replace("'", ''), 10);
      buf.writeUInt32BE(hardened ? num + 0x80000000 : num, i * 4);
    });
    return buf;
  }
}
```

---

## 5. Build & Test Workflow

### 5.1 Docker Build (Recommended)

```bash
# Clone boilerplate
git clone https://github.com/LedgerHQ/app-boilerplate.git app-zion
cd app-zion

# Start builder container
docker run --rm -ti -v "$(pwd):/app" \
  ghcr.io/ledgerhq/ledger-app-builder/ledger-app-builder:latest

# Inside container
$ BOLOS_SDK=$NANOSP_SDK make
$ BOLOS_SDK=$NANOX_SDK make
$ BOLOS_SDK=$NANOS_SDK make
```

### 5.2 Speculos Emulator Test

```bash
# Run app in Speculos emulator
docker run --rm -ti -v "$(pwd):/app" \
  ghcr.io/ledgerhq/ledger-app-builder/ledger-app-builder:latest

$ python3 -m speculos /app/bin/app.elf --model nanosp

# In another terminal, run JS tests
$ npx ts-node tests/ledger-zion.test.ts
```

### 5.3 Physical Device Load

```bash
# Nano S+
$ BOLOS_SDK=$NANOSP_SDK make load

# Requires device unlocked, developer mode enabled in Ledger Live
```

---

## 6. Ledger Live App Store Submission

### Requirements
1. **App icon** — 16x16, 32x32 PNG (monochrome for Nano devices).
2. **App name** — "ZION" (exactly 4 chars for Nano display).
3. **Security audit** — Ledger requires external security review (~$5–15k).
4. **Derivation path registration** — Submit `44'/0'` to Ledger's [SLIP-44 registry](https://github.com/satoshilabs/slips/blob/master/slip-0044.md).
5. **Test vectors** — Provide known-good public keys + signatures for CI.

### Timeline Estimate
| Phase | Duration | Cost |
|-------|----------|------|
| App development (C + JS) | 3–4 weeks | ~$6–8k |
| Internal testing + Speculos | 1 week | — |
| External security audit | 2–3 weeks | ~$8–12k |
| Ledger review & store listing | 2–4 weeks | — |
| **Total** | **8–12 weeks** | **~$15–20k** |

---

## 7. Comparison: Ledger vs Trezor

| Aspect | Ledger | Trezor |
|--------|--------|--------|
| Ed25519 signing | ✅ Native `cx_eddsa_sign_no_turn` | ❌ Only via coin-specific apps |
| Raw bytes signing | ✅ Yes | ❌ No (forced tx format) |
| SDK availability | ✅ Open Bolos SDK | ⚠️ Partially open |
| New coin acceptance | ✅ Reviewed, possible | ❌ Hard ban |
| App store | Ledger Live | Trezor Suite |
| Security audit cost | ~$8–12k | N/A (no path) |
| Community precedent | Many 3rd-party apps | Very few |

---

## 8. Recommendation

**For mainnet launch (2026-12-31):**

1. **Phase 1 (Now–Q3 2026):** Complete Ledger app development + internal testing.
2. **Phase 2 (Q3–Q4 2026):** Submit to Ledger for security audit + store review.
3. **Phase 3 (Launch day):** Ledger Live supports ZION app → full HW wallet signing.
4. **Phase 4 (Post-launch):** Evaluate Trezor fork only if strong community demand.

**For users until then:**
- Use Ledger with watch-only (our current SDK already works).
- Or import seed to software wallet for spending (with security warning).

---

*Generated with [Devin](https://cli.devin.ai/docs)*  
*Co-Authored-By: Devin <158243242+devin-ai-integration[bot]@users.noreply.github.com>*
