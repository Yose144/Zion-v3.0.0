#!/usr/bin/env python3
import urllib.request

# Check vault address balance
vault = "zion1wn5nv4snxzjjlqb48z5zatungtvr4ruz6yjd4c5"
url = f"http://localhost:8444/api/address/{vault}/balance"
try:
    r = urllib.request.urlopen(url, timeout=15)
    print("Vault balance:", r.read().decode())
except Exception as e:
    print("ERROR:", e)

# Check UTXOs
url2 = f"http://localhost:8444/api/address/{vault}/utxos"
try:
    r2 = urllib.request.urlopen(url2, timeout=15)
    print("Vault UTXOs:", r2.read().decode()[:500])
except Exception as e:
    print("UTXOs ERROR:", e)
