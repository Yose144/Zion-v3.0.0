#!/usr/bin/env python3
import json, urllib.request, urllib.error

req_data = {
    "recipient": "zion166e6v3k204h8p5w4w3a7m0x790q5m7z5z6n252p",
    "amount_atomic": 100000000,
    "evm_tx_hash": "0xdeadbeef1234567890abcdef1234567890abcdef1234567890abcdef12345678",
    "burn_id": "e2e-test-burn-001",
    "evm_chain": "base",
    "validator_id": "validator-1"
}

body = json.dumps(req_data).encode()
req = urllib.request.Request(
    "http://localhost:8444/api/bridge/unlock",
    data=body,
    headers={"Content-Type": "application/json"}
)

try:
    r = urllib.request.urlopen(req, timeout=30)
    print("SUCCESS:", r.read().decode())
except urllib.error.HTTPError as e:
    print("HTTP ERROR", e.code, ":", e.read().decode())
except Exception as e:
    print("ERROR:", e)
