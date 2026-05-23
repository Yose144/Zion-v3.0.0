#include <stdio.h>
extern void kawpow_gpu_test();
extern const char* kawpow_gpu_version();
int main() {
    printf("Version: %s\n\n", kawpow_gpu_version());
    kawpow_gpu_test();
    return 0;
}
