#ifndef ZION_NATIVE_ABI_H
#define ZION_NATIVE_ABI_H

#ifdef __cplusplus
extern "C" {
#endif

// Placeholder ABI for V3 native libraries.
// Final signatures will be versioned before production use.

typedef struct {
    const char* algorithm;
    const char* version;
} zion_native_info;

// Returns static metadata for the native library.
const zion_native_info* zion_native_get_info(void);

#ifdef __cplusplus
}
#endif

#endif // ZION_NATIVE_ABI_H
