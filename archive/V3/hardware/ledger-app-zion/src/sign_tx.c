/**
 * ZION Ledger App — Sign Raw Transaction (Ed25519 EdDSA)
 */

#include "zion.h"
#include "os.h"
#include "cx.h"

static uint8_t signature[ED25519_SIG_LEN];

void handle_sign_tx(uint8_t p1, uint8_t p2, uint8_t *data, uint16_t len) {
    (void)p1;
    (void)p2;

    if (len < 48) THROW(0x6A80); // minimum: 1 path comp + empty recipient + amount + hash

    uint16_t offset = 0;

    // Parse path length (1 byte) + path components
    uint8_t pathLen = data[offset++];
    if (pathLen > MAX_PATH_COMPONENTS) THROW(0x6A80);

    uint32_t path[MAX_PATH_COMPONENTS];
    for (uint8_t i = 0; i < pathLen; i++) {
        if (offset + 4 > len) THROW(0x6A80);
        path[i] = U4BE(data, offset);
        offset += 4;
    }

    // Parse recipient address (null-terminated ASCII)
    char recipient[ZION_ADDRESS_LEN];
    uint8_t recipientLen = 0;
    while (offset < len && data[offset] != 0 && recipientLen < ZION_ADDRESS_LEN - 1) {
        recipient[recipientLen++] = data[offset++];
    }
    recipient[recipientLen] = '\0';
    if (offset >= len || data[offset] != 0) THROW(0x6A80);
    offset++; // skip null terminator

    if (offset + 40 > len) THROW(0x6A80); // need amount (8) + hash (32)

    // Amount in flowers (uint64 LE)
    uint64_t amountFlowers = U8LE(data, offset);
    offset += 8;

    // Transaction hash (32 bytes, BLAKE3)
    uint8_t txHash[TX_HASH_LEN];
    memcpy(txHash, data + offset, TX_HASH_LEN);
    offset += TX_HASH_LEN;

    // Convert flowers to ZION for display
    double amountZion = (double)amountFlowers / 1e12;
    char amountStr[32];
    snprintf(amountStr, sizeof(amountStr), "%.6f ZION", amountZion);

    // Show confirmation on device screen
    if (!confirm_tx(recipient, amountStr)) {
        THROW(0x6985); // User rejected
    }

    // Derive Ed25519 private key
    cx_ecfp_private_key_t privateKey;
    uint8_t rawPrivate[32];

    os_perso_derive_node_bip32_seed_key(
        HDW_NORMAL,
        CX_CURVE_Ed25519,
        path,
        pathLen,
        rawPrivate,
        NULL,
        NULL,
        0
    );

    cx_ecfp_init_private_key_no_throw(CX_CURVE_Ed25519, rawPrivate, 32, &privateKey);

    // Sign raw txHash with Ed25519 (EdDSA)
    // cx_eddsa_sign_no_throw internally computes SHA-512(message) then signs
    cx_eddsa_sign_no_throw(
        &privateKey,
        CX_SHA512,          // Ed25519 standard internal hash
        txHash,
        TX_HASH_LEN,
        NULL,
        0,
        signature,
        ED25519_SIG_LEN,
        NULL
    );

    // Zeroize private key
    explicit_bzero(rawPrivate, sizeof(rawPrivate));
    explicit_bzero(privateKey.d, sizeof(privateKey.d));

    // Return 64-byte signature + SW 9000
    memcpy(G_io_apdu_buffer, signature, ED25519_SIG_LEN);
    tx = ED25519_SIG_LEN;
    THROW(0x9000);
}
