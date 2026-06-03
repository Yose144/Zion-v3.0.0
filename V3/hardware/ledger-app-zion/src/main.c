/**
 * ZION Ledger App — Main Entry Point
 *
 * APDU dispatch loop for Ed25519 public key export and raw transaction signing.
 */

#include "os.h"
#include "cx.h"
#include "io.h"
#include "zion.h"

#define CLA 0xE0
#define INS_GET_PUBLIC_KEY 0x02
#define INS_SIGN_TX        0x04
#define INS_GET_VERSION    0x06

static void handle_get_public_key(uint8_t p1, uint8_t p2, uint8_t *data, uint16_t len);
static void handle_sign_tx(uint8_t p1, uint8_t p2, uint8_t *data, uint16_t len);

static void zion_main(void) {
    volatile uint32_t rx = 0;
    volatile uint32_t tx = 0;
    volatile uint32_t flags = 0;

    for (;;) {
        rx = io_exchange(CHANNEL_APDU | flags, tx);
        flags = 0;
        tx = 0;

        if (rx < 5) THROW(0x6982); // No data or too short

        uint8_t cla = G_io_apdu_buffer[CLA_OFFSET];
        uint8_t ins = G_io_apdu_buffer[INS_OFFSET];
        uint8_t p1  = G_io_apdu_buffer[P1_OFFSET];
        uint8_t p2  = G_io_apdu_buffer[P2_OFFSET];
        uint8_t lc  = G_io_apdu_buffer[LC_OFFSET];
        uint8_t *data = G_io_apdu_buffer + DATA_OFFSET;

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
        // Error recovery — could log to screen if debug build
    }
    FINALLY {
    }
    END_TRY;
}
