import sys
import math
import ctypes
import os

path = "/Users/yeshuae/Projects/2.9.6/target/release/libzion_cosmic_harmony_v3.dylib"
if not os.path.exists(path):
    print("Building rust lib...")
    os.system("cd /Users/yeshuae/Projects/2.9.6 && cargo build --release -p zion-cosmic-harmony-v3")

try:
    lib = ctypes.CDLL(path)
    fn = lib.zion_deeksha_hash
    fn.argtypes = [ctypes.POINTER(ctypes.c_uint8), ctypes.c_size_t, ctypes.c_uint64, ctypes.POINTER(ctypes.c_uint8)]
except OSError:
    print("Failed to load lib")
    sys.exit(1)

def hash_ffi(nonce):
    hdr = b"ZION_DEEKSHA_GENESIS_V298_CANONICAL"
    out = (ctypes.c_uint8 * 32)()
    fn((ctypes.c_uint8 * len(hdr))(*hdr), len(hdr), nonce, out)
    return bytes(out)

print("Generuji 1 MB dat...")
data = bytearray()
for i in range(32768):
    data.extend(hash_ffi(i))
    
print("Analýza entropie (Shannon)...")
freq = [0]*256
for b in data:
    freq[b] += 1
    
entropy = 0.0
for c in freq:
    if c > 0:
        p = c / len(data)
        entropy -= p * math.log2(p)
        
print(f"Bytes: {len(data)}")
print(f"Entropy: {entropy:.6f} bits per byte (ideal is 8.000000)")

# Chi-square
expected = len(data) / 256.0
chi2 = sum((c - expected)**2 / expected for c in freq)
print(f"Chi-Square: {chi2:.2f} (expected for 255 dof: ~255.0, range 210-300)")

if entropy > 7.99 and 200 < chi2 < 300:
    print("✅ ENTROPIE JE PERFEKTNÍ (odpovídá rovnoměrnému náhodnému rozdělení a kvalitní kryptografické hašovací funkci).")
else:
    print("❌ ANALÝZA SELHALA.")
