import sys
import os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "resources", "mining"))
from cosmic_harmony_deeksha_fallback import deeksha_hash_python, CANONICAL_TEST_HEADER

print("Genering 1 MB of Deeksha hashes...")
with open("deeksha_entropy.bin", "wb") as f:
    for i in range(32768):
        h = deeksha_hash_python(CANONICAL_TEST_HEADER, i)
        f.write(h)
        if i % 8192 == 0 and i > 0:
            print(f"  {i} hashes done...")
            
print("Done. Saved to deeksha_entropy.bin")
