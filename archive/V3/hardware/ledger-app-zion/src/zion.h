/**
 * ZION Ledger App — Common Headers
 */

#ifndef ZION_H
#define ZION_H

#include "os.h"
#include "cx.h"

#define CLA_OFFSET   0
#define INS_OFFSET   1
#define P1_OFFSET    2
#define P2_OFFSET    3
#define LC_OFFSET    4
#define DATA_OFFSET  5

#define MAX_PATH_COMPONENTS 5
#define ZION_ADDRESS_LEN    45
#define TX_HASH_LEN         32
#define ED25519_SIG_LEN     64

extern const char APPVERSION[];

void handle_get_public_key(uint8_t p1, uint8_t p2, uint8_t *data, uint16_t len);
void handle_sign_tx(uint8_t p1, uint8_t p2, uint8_t *data, uint16_t len);

void derive_zion_address(const uint8_t *pubkey, char *out);
int display_address(const char *address);
int confirm_tx(const char *recipient, const char *amount);

#endif
