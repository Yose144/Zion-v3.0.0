#!/usr/bin/env python3
"""Verify key derivation and run bridge test transaction."""
import socket
import json
import hashlib
import struct
import time
import sys
import os

import blake3 as _blake3
from nacl.signing import SigningKey

# --- ZION address derivation (matches V3/L1/core/src/crypto.rs) ---
ZION_BASE32 = b"023456789acdefghjklmnpqrstuvwxyz"

def derive_address(pk_bytes):
    sha = hashlib.sha256(pk_bytes).digest()
    ripemd = hashlib.new("ripemd160", sha).digest()
    data = ""
    for b in ripemd:
        data += chr(ZION_BASE32[b % 32])
        data += chr(ZION_BASE32[(b // 32) % 32])
    data = data[:35]
    ck_hash = hashlib.sha256(("zion1" + data).encode()).digest()
    ck = ""
    for b in ck_hash[:2]:
        ck += chr(ZION_BASE32[b % 32])
        ck += chr(ZION_BASE32[(b // 32) % 32])
    return f"zion1{data}{ck}"

def blake3_hash(data):
    return _blake3.blake3(data).digest()

# --- Config ---
NODE_HOST = "127.0.0.1"
NODE_PORT = 8443

SENDER_SK_HEX = os.environ.get("ZION_SENDER_SK_HEX")
SENDER_PK_HEX = os.environ.get("ZION_SENDER_PK_HEX")
SENDER_ADDRESS = os.environ.get("ZION_SENDER_ADDRESS")

VAULT_ADDRESS = os.environ.get("ZION_BRIDGE_VAULT_ADDRESS", "zion1j53677g5k83030x3s2z2z644e7h07792q0u02t7")

# 100 ZION = 100 * 1e12 flowers
SEND_AMOUNT = 100 * 1_000_000_000_000
TX_FEE = 10_000

def rpc_call(method, params):
    s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    s.settimeout(10)
    s.connect((NODE_HOST, NODE_PORT))
    req = json.dumps({"jsonrpc": "2.0", "method": method, "params": params, "id": 1})
    s.sendall((req + "\n").encode())
    buf = b""
    while b"\n" not in buf:
        chunk = s.recv(8192)
        if not chunk:
            break
        buf += chunk
    s.close()
    resp = json.loads(buf.decode().strip())
    if "error" in resp and resp["error"]:
        raise RuntimeError(f"RPC error: {resp['error']}")
    return resp.get("result")

def calculate_tx_hash(version, inputs, outputs, fee, timestamp):
    data = bytearray()
    data += struct.pack("<I", version)
    for inp in inputs:
        data += bytes.fromhex(inp["prev_tx_hash_hex"])
        data += struct.pack("<I", inp["output_index"])
        data += bytes.fromhex(inp["public_key_hex"])
    for out in outputs:
        data += struct.pack("<Q", out["amount"])
        data += out["address"].encode()
        if out.get("memo"):
            data += out["memo"].encode()
    data += struct.pack("<Q", fee)
    data += struct.pack("<Q", timestamp)
    return blake3_hash(bytes(data))

def main():
    required = {
        "ZION_SENDER_SK_HEX": SENDER_SK_HEX,
        "ZION_SENDER_PK_HEX": SENDER_PK_HEX,
        "ZION_SENDER_ADDRESS": SENDER_ADDRESS,
    }
    missing = [name for name, value in required.items() if not value]
    if missing:
        print("ERROR: Missing required environment variables:")
        for name in missing:
            print(f"  - {name}")
        print("\nSet wallet secrets via environment instead of storing them in the repository.")
        sys.exit(1)

    sk_bytes = bytes.fromhex(SENDER_SK_HEX)
    sk = SigningKey(sk_bytes)
    pk_bytes = bytes(sk.verify_key)
    derived_addr = derive_address(pk_bytes)
    print(f"[0] Key verification:")
    print(f"    PK match: {pk_bytes.hex() == SENDER_PK_HEX}")
    print(f"    Address derived: {derived_addr}")
    print(f"    Address expected: {SENDER_ADDRESS}")
    print(f"    Address match: {derived_addr == SENDER_ADDRESS}")
    if derived_addr != SENDER_ADDRESS:
        print("WARNING: Address mismatch! TX may fail sig verification.")

    if len(sys.argv) > 1:
        evm_recipient = sys.argv[1]
    else:
        print("ERROR: EVM recipient address required as first argument.")
        print("Usage: bridge-test-tx.py <0xEVM_ADDRESS>")
        sys.exit(1)
    if not evm_recipient.startswith("0x") or len(evm_recipient) != 42:
        print(f"ERROR: Invalid EVM address: {evm_recipient}")
        sys.exit(1)
    bridge_memo = f"BRIDGE:base:{evm_recipient}"

    print(f"\n=== ZION Bridge Test Transaction ===")
    print(f"From:   {SENDER_ADDRESS} (pool fee 1%)")
    print(f"To:     {VAULT_ADDRESS} (bridge vault)")
    print(f"Amount: {SEND_AMOUNT / 1e12:.6f} ZION")
    print(f"Memo:   {bridge_memo}")
    print(f"Fee:    {TX_FEE} flowers")

    print(f"\n[1] Fetching UTXOs for {SENDER_ADDRESS}...")
    result = rpc_call("getUtxos", {"address": SENDER_ADDRESS})
    utxos = result.get("utxos", [])
    print(f"    Found {len(utxos)} UTXOs")
    for u in utxos[:5]:
        print(f"    - {u['amount']} flowers (height {u['height']}, idx {u['output_index']})")

    if not utxos:
        print("ERROR: No spendable UTXOs!")
        sys.exit(1)

    needed = SEND_AMOUNT + TX_FEE
    utxos_sorted = sorted(utxos, key=lambda u: u["amount"], reverse=True)
    selected = []
    total_input = 0
    for u in utxos_sorted:
        selected.append(u)
        total_input += u["amount"]
        if total_input >= needed:
            break

    if total_input < needed:
        print(f"ERROR: Insufficient funds. Have {total_input}, need {needed}")
        sys.exit(1)

    change = total_input - needed
    print(f"\n[2] Selected {len(selected)} UTXOs, total {total_input} flowers")
    print(f"    Change: {change} flowers ({change / 1e12:.6f} ZION)")

    version = 1
    timestamp = int(time.time())

    inputs_raw = []
    for u in selected:
        inputs_raw.append({
            "prev_tx_hash_hex": u["tx_hash"],
            "output_index": u["output_index"],
            "public_key_hex": SENDER_PK_HEX,
        })

    outputs_raw = [
        {"amount": SEND_AMOUNT, "address": VAULT_ADDRESS, "memo": bridge_memo},
    ]
    if change > 0:
        outputs_raw.append({"amount": change, "address": SENDER_ADDRESS})

    tx_hash = calculate_tx_hash(version, inputs_raw, outputs_raw, TX_FEE, timestamp)
    print(f"\n[3] TX hash: {tx_hash.hex()}")

    signed_inputs = []
    for inp in inputs_raw:
        sig = sk.sign(tx_hash).signature
        signed_inputs.append({
            "prev_tx_hash": list(bytes.fromhex(inp["prev_tx_hash_hex"])),
            "output_index": inp["output_index"],
            "signature": list(sig),
            "public_key": list(pk_bytes),
        })
    print(f"[4] Signed {len(signed_inputs)} inputs")

    tx_outputs_json = []
    for out in outputs_raw:
        o = {"amount": out["amount"], "address": out["address"]}
        if out.get("memo"):
            o["memo"] = out["memo"]
        tx_outputs_json.append(o)

    tx_json = {
        "id": list(tx_hash),
        "version": version,
        "inputs": signed_inputs,
        "outputs": tx_outputs_json,
        "fee": TX_FEE,
        "timestamp": timestamp,
    }

    print(f"[5] TX JSON: {len(json.dumps(tx_json))} bytes")

    print(f"\n[6] Submitting to node RPC...")
    result = rpc_call("submitTransaction", {"transaction": tx_json})
    print(f"    Result: {json.dumps(result, indent=2)}")

    if result and result.get("accepted"):
        print(f"\n{'='*60}")
        print(f"  BRIDGE LOCK TX ACCEPTED!")
        print(f"  TX ID: {result.get('tx_id')}")
        print(f"  Amount: {SEND_AMOUNT / 1e12:.6f} ZION -> wZION")
        print(f"  EVM recipient: {evm_recipient}")
        print(f"  Bridge watcher will pick this up in next mined block.")
        print(f"{'='*60}")
    else:
        print(f"\n  Transaction REJECTED")

if __name__ == "__main__":
    main()
