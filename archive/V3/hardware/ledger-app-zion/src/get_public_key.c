/**
 * ZION Ledger App — Get Public Key (Ed25519) + Address Derivation
 */

#include "zion.h"
#include "os.h"
#include "cx.h"

static uint32_t path[MAX_PATH_COMPONENTS];
static uint8_t publicKey[32];
static char zionAddress[ZION_ADDRESS_LEN];

// Custom base32 alphabet (no b, i, l, o, 1 to avoid visual ambiguity)
static const char ZION_ALPHABET[] = "023456789acdefghjklmnpqrstuvwxyz";

void derive_zion_address(const uint8_t *pubkey, char *out) {
    uint8_t sha[32];
    uint8_t ripemd[20];
    cx_sha256_t sha256_ctx;
    cx_ripemd160_t ripemd160_ctx;

    // SHA-256(pubkey)
    cx_sha256_init(&sha256_ctx);
    cx_hash((cx_hash_t *)&sha256_ctx, CX_LAST, pubkey, 32, sha, sizeof(sha));

    // RIPEMD-160(SHA-256)
    cx_ripemd160_init(&ripemd160_ctx);
    cx_hash((cx_hash_t *)&ripemd160_ctx, CX_LAST, sha, 32, ripemd, sizeof(ripemd));

    // Encode each byte as 2 base32 chars
    char body[36];
    for (int i = 0; i < 20; i++) {
        body[i * 2]     = ZION_ALPHABET[ripemd[i] % 32];
        body[i * 2 + 1] = ZION_ALPHABET[(ripemd[i] / 32) % 32];
    }
    body[35] = '\0';  // truncate to 35 chars

    // 4-char checksum: SHA-256("zion1" + body), first 2 bytes → 4 base32 chars
    cx_sha256_init(&sha256_ctx);
    cx_hash((cx_hash_t *)&sha256_ctx, CX_FIRST, (uint8_t *)"zion1", 5, NULL, 0);
    cx_hash((cx_hash_t *)&sha256_ctx, CX_LAST, (uint8_t *)body, 35, sha, sizeof(sha));

    char checksum[5];
    checksum[0] = ZION_ALPHABET[sha[0] % 32];
    checksum[1] = ZION_ALPHABET[(sha[0] / 32) % 32];
    checksum[2] = ZION_ALPHABET[sha[1] % 32];
    checksum[3] = ZION_ALPHABET[(sha[1] / 32) % 32];
    checksum[4] = '\0';

    snprintf(out, ZION_ADDRESS_LEN, "zion1%s%s", body, checksum);
}

void handle_get_public_key(uint8_t p1, uint8_t p2, uint8_t *data, uint16_t len) {
    (void)p2;

    if (len < 4 || len % 4 != 0) THROW(0x6A80);

    uint8_t pathLen = len / 4;
    if (pathLen > MAX_PATH_COMPONENTS) THROW(0x6A80);

    for (uint8_t i = 0; i < pathLen; i++) {
        path[i] = U4BE(data, i * 4);
    }

    // Derive Ed25519 keypair from BIP-32 path
    cx_ecfp_private_key_t privateKey;
    cx_ecfp_public_key_t publicKeyRaw;
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
    cx_ecfp_generate_pair_no_throw(CX_CURVE_Ed25519, &publicKeyRaw, &privateKey, 1);

    // Extract 32-byte Ed25519 pubkey (skip 1-byte prefix in W)
    memcpy(publicKey, publicKeyRaw.W + 1, 32);

    derive_zion_address(publicKey, zionAddress);

    // Zeroize private key material
    explicit_bzero(rawPrivate, sizeof(rawPrivate));
    explicit_bzero(privateKey.d, sizeof(privateKey.d));

    if (p1 == 0x01) {
        // Show address on device for user confirmation
        if (!display_address(zionAddress)) {
            THROW(0x6985); // User rejected
        }
    }

    // Return pubkey (32 bytes) + address (ASCII) + SW 9000
    uint16_t addrLen = strnlen(zionAddress, ZION_ADDRESS_LEN);
    memcpy(G_io_apdu_buffer, publicKey, 32);
    memcpy(G_io_apdu_buffer + 32, zionAddress, addrLen);
    tx = 32 + addrLen;
    THROW(0x9000);
}
