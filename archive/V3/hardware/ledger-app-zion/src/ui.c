/**
 * ZION Ledger App — UI Flows (Nano S+/X screen handling)
 *
 * This is a minimal UI implementation for Nano devices.
 * For Stax/Flex, replace with NBGL (touchscreen) APIs.
 */

#include "zion.h"
#include "os.h"
#include "ux.h"

// Nano S+/X UI context
ux_state_t G_ux;
bolos_ux_params_t G_ux_params;

static char displayAddress[ZION_ADDRESS_LEN];
static char confirmRecipient[ZION_ADDRESS_LEN];
static char confirmAmount[32];

// ─── Display Address ─────────────────────────────────────────────────────────

static const bagl_element_t ui_address[] = {
    // Screen 1: title + address
    {{BAGL_RECTANGLE, 0x00, 0, 0, 128, 32, 0, 0, BAGL_FILL, 0x000000, 0xFFFFFF, 0, 0}},
    {{BAGL_LABELINE, 0x01, 0, 12, 128, 12, 0, 0, 0, 0xFFFFFF, 0x000000,
      BAGL_FONT_OPEN_SANS_REGULAR_11px | BAGL_FONT_ALIGNMENT_CENTER, 0},
     "Confirm Address"},
    {{BAGL_LABELINE, 0x02, 0, 26, 128, 12, 0, 0, 0, 0xFFFFFF, 0x000000,
      BAGL_FONT_OPEN_SANS_EXTRABOLD_11px | BAGL_FONT_ALIGNMENT_CENTER, 0},
     displayAddress},
};

static unsigned int ui_address_button(unsigned int button_mask, unsigned int button_mask_counter) {
    (void)button_mask_counter;
    switch (button_mask) {
        case BUTTON_EVT_RELEASED | BUTTON_RIGHT:
            // User confirmed
            G_io_apdu_buffer[0] = 0x01;
            io_exchange(CHANNEL_APDU | IO_RETURN_AFTER_TX, 1);
            break;
        case BUTTON_EVT_RELEASED | BUTTON_LEFT:
            // User rejected
            G_io_apdu_buffer[0] = 0x00;
            io_exchange(CHANNEL_APDU | IO_RETURN_AFTER_TX, 1);
            break;
    }
    return 0;
}

int display_address(const char *address) {
    strlcpy(displayAddress, address, sizeof(displayAddress));
    UX_DISPLAY(ui_address, ui_address_button);
    // Execution continues; actual result is handled by button callback
    // For synchronous simplicity, we return 1 here and rely on APDU flow
    return 1;
}

// ─── Confirm Transaction ─────────────────────────────────────────────────────

static const bagl_element_t ui_tx[] = {
    {{BAGL_RECTANGLE, 0x00, 0, 0, 128, 32, 0, 0, BAGL_FILL, 0x000000, 0xFFFFFF, 0, 0}},
    {{BAGL_LABELINE, 0x01, 0, 10, 128, 12, 0, 0, 0, 0xFFFFFF, 0x000000,
      BAGL_FONT_OPEN_SANS_REGULAR_11px | BAGL_FONT_ALIGNMENT_CENTER, 0},
     confirmAmount},
    {{BAGL_LABELINE, 0x02, 0, 24, 128, 12, 0, 0, 0, 0xFFFFFF, 0x000000,
      BAGL_FONT_OPEN_SANS_EXTRABOLD_11px | BAGL_FONT_ALIGNMENT_CENTER, 0},
     confirmRecipient},
};

static unsigned int ui_tx_button(unsigned int button_mask, unsigned int button_mask_counter) {
    (void)button_mask_counter;
    switch (button_mask) {
        case BUTTON_EVT_RELEASED | BUTTON_RIGHT:
            G_io_apdu_buffer[0] = 0x01;
            io_exchange(CHANNEL_APDU | IO_RETURN_AFTER_TX, 1);
            break;
        case BUTTON_EVT_RELEASED | BUTTON_LEFT:
            G_io_apdu_buffer[0] = 0x00;
            io_exchange(CHANNEL_APDU | IO_RETURN_AFTER_TX, 1);
            break;
    }
    return 0;
}

int confirm_tx(const char *recipient, const char *amount) {
    strlcpy(confirmRecipient, recipient, sizeof(confirmRecipient));
    strlcpy(confirmAmount, amount, sizeof(confirmAmount));
    UX_DISPLAY(ui_tx, ui_tx_button);
    return 1;
}
