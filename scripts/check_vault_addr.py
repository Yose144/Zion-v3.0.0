#!/usr/bin/env python3
"""
Compute ZION L1 address from Ed25519 private key (same algorithm as L1/core/src/crypto/keys.rs)
"""
import hashlib, sys

try:
    from cryptography.hazmat.primitives.asymmetric.ed25519 import Ed25519PrivateKey
    from cryptography.hazmat.primitives.serialization import Encoding, PublicFormat
except ImportError:
    print("installing cryptography...")
    import subprocess
    subprocess.run([sys.executable, "-m", "pip", "install", "cryptography", "-q"])
    from cryptography.hazmat.primitives.asymmetric.ed25519 import Ed25519PrivateKey
    from cryptography.hazmat.primitives.serialization import Encoding, PublicFormat

ZION_BASE32 = b"023456789acdefghjklmnpqrstuvwxyz"

def zion_address(secret_key_hex: str) -> str:
    # Load Ed25519 private key
    raw = bytes.fromhex(secret_key_hex)
    priv = Ed25519PrivateKey.from_private_bytes(raw)
    pub_bytes = priv.public_key().public_bytes(Encoding.Raw, PublicFormat.Raw)

    # SHA256 → RIPEMD160
    sha = hashlib.sha256(pub_bytes).digest()
    ripe = hashlib.new("ripemd160", sha).digest()

    # Encode: each byte → 2 alphabat chars (byte%32, (byte/32)%32)
    data = []
    for b in ripe:
        data.append(ZION_BASE32[b % 32])
        data.append(ZION_BASE32[(b // 32) % 32])
    body = bytes(data[:35]).decode()

    # Checksum: sha256("zion1" + body)[0:4] → alphabet
    ck_input = ("zion1" + body).encode()
    ck_hash = hashlib.sha256(ck_input).digest()
    ck = []
    for b in ck_hash[:8]:
        ck.append(chr(ZION_BASE32[b % 32]))
        ck.append(chr(ZION_BASE32[(b // 32) % 32]))
    checksum = "".join(ck[:4])

    return f"zion1{body}{checksum}"

# Check vault key
vault_key = "272b825ed992b4662c679672c5df9a06021ef9bde10b74beb6552e8c4b8b4788"
print("Vault key:", vault_key[:16] + "...")
addr = zion_address(vault_key)
print("Derived ZION address:", addr)
print("Expected bridge addr: zion1wn5nv4snxzjjlqb48z5zatungtvr4ruz6yjd4c5")
print("Match:", addr == "zion1wn5nv4snxzjjlqb48z5zatungtvr4ruz6yjd4c5")
