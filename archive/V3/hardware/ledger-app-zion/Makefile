# Ledger ZION App Makefile
# Targets: nanos, nanox, nanos2 (Nano S+), stax, flex

APPNAME      = "ZION"
APPVERSION_M = 1
APPVERSION_N = 0
APPVERSION_P = 0
APPVERSION   = "$(APPVERSION_M).$(APPVERSION_N).$(APPVERSION_P)"

APP_LOAD_PARAMS  = --appFlags 0x40
APP_LOAD_PARAMS += --path "44'/0'"
APP_LOAD_PARAMS += --curve ed25519

APP_SOURCE_PATH += src

include $(BOLOS_SDK)/Makefile.defines

# Compiler flags
CFLAGS += -O3 -Wall -Wextra
DEFINES += APPNAME=\"$(APPNAME)\" APPVERSION=\"$(APPVERSION)\"

# UI includes
SDK_SOURCE_PATH += lib_stusb lib_stusb_impl

ifeq ($(TARGET_NAME),TARGET_NANOS2)
    DEFINES += HAVE_NBGL
    SDK_SOURCE_PATH += lib_nbgl
endif
ifeq ($(TARGET_NAME),TARGET_NANOX)
    DEFINES += HAVE_BLE HAVE_BLE_APDU
    SDK_SOURCE_PATH += lib_ble lib_ux
endif
ifeq ($(TARGET_NAME),TARGET_STAX)
    DEFINES += HAVE_NBGL
    SDK_SOURCE_PATH += lib_nbgl
endif

load:
    BOLOS_SDK=$(BOLOS_SDK) make load

delete:
    BOLOS_SDK=$(BOLOS_SDK) make delete
