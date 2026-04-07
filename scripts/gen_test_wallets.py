#!/usr/bin/env python3
"""Generate test wallet addresses for PPLNS multi-miner testing."""
import hashlib

ALPHABET = b"023456789acdefghjklmnpqrstuvwxyz"

def zion_address(seed_bytes: bytes) -> str:
    sha = hashlib.sha256(seed_bytes).digest()
    rip = hashlib.new("ripemd160", sha).digest()
    body = ""
    for b in rip:
        body += chr(ALPHABET[b % 32])
        body += chr(ALPHABET[(b // 32) % 32])
    body = body[:35]
    ck_hash = hashlib.sha256(("zion1" + body).encode()).digest()
    ck = ""
    for b in ck_hash[:2]:
        ck += chr(ALPHABET[b % 32])
        ck += chr(ALPHABET[(b // 32) % 32])
    return f"zion1{body}{ck}"

for i in range(4):
    addr = zion_address(f"pplns-test-miner-{i}".encode())
    print(f"Miner {i}: {addr}")
