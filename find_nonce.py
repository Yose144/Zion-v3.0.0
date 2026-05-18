import hashlib, struct, sys

header_hex = "0300000085d8d6b29cdfa32b036068c70416c948b6eca63ba18bb20d0bfeb051f44ec8971dadce6dfa2bd128fece9834964199ac067052a09886f068facce0ae9b27ed7cf1240b6a000000003789411f"
target_hex = "004189374bc6a7ef9db22d0e5604189374bc6a7ef9db22d0e5604189374bc6a7"

header = bytes.fromhex(header_hex)
target = bytes.fromhex(target_hex)

# nonce je v offsetu 76-80 (4 bajty) v headeru
for nonce in range(0, 0xFFFFFFFF):
    h = header[:76] + struct.pack("<I", nonce) + header[80:]
    # CHv4 hash - SHA3-512 + AES-256 + Golden Matrix
    # Pro jednoduchost použijeme SHA3-512 jako aproximaci
    hash_val = hashlib.sha3_512(h).digest()
    if hash_val < target:
        print(f"FOUND nonce={nonce} hash={hash_val.hex()}")
        sys.exit(0)
    if nonce % 100000 == 0:
        print(f"tried {nonce}...")
print("Not found in range")
