#include <stdio.h>
#include <stdint.h>

extern void kawpow_test();
extern double kawpow_benchmark_cpu(int iterations);
extern const char* kawpow_version();

int main() {
    printf("=== ZION KawPow Native Library Test ===\n\n");
    printf("Version: %s\n\n", kawpow_version());
    kawpow_test();
    printf("\nBenchmark (5000 iterations):\n");
    double hashrate = kawpow_benchmark_cpu(5000);
    printf("  Result: %.2f H/s\n", hashrate);
    return 0;
}
