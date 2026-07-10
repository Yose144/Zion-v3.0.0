#!/usr/bin/env python3
"""Query candidate addresses and print spendable UTXO details."""

import sys
import requests

RPC_URL = "http://62.171.141.136:8443/jsonrpc"
ADDRESSES = [
    "zion13794g7k3m0f84637l2x0t855h3l258k8p3xp5t3",
    "zion1r565v3k2u8p8t6n494p0n527c0m7a5s4s5ae0x7",
]


def query_utxos(address: str):
    payload = {
        "jsonrpc": "2.0",
        "id": 1,
        "method": "getUtxos",
        "params": {"address": address},
    }
    response = requests.post(
        RPC_URL,
        json=payload,
        headers={"Content-Type": "application/json"},
        timeout=10,
    )
    response.raise_for_status()
    data = response.json()
    if data.get("error"):
        raise RuntimeError(data["error"].get("message", "unknown RPC error"))
    result = data.get("result", {}) or {}
    utxos = result.get("utxos", []) or []
    total_amount = int(result.get("total_amount", 0) or 0)
    return utxos, total_amount


def main() -> int:
    print("[*] Querying UTXO sets")
    print(f"RPC: {RPC_URL}")
    print()

    for address in ADDRESSES:
        utxos, total_flowers = query_utxos(address)
        total_zion = total_flowers / 1e12

        print("=" * 60)
        print(f"Address: {address}")
        print(f"UTXO count: {len(utxos)}")
        print(f"Total: {total_zion:.6f} ZION ({total_flowers} flowers)")

        for i, utxo in enumerate(utxos[:12], 1):
            tx_hash = str(utxo.get("tx_hash", ""))
            out_index = utxo.get("output_index")
            amount = int(utxo.get("amount", 0))
            print(
                f"  #{i} tx={tx_hash[:16]}... out={out_index} amount={amount / 1e12:.6f} ZION"
            )

        if len(utxos) > 12:
            print(f"  ... and {len(utxos) - 12} more")

        print()

    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except requests.exceptions.RequestException as exc:
        print(f"[ERROR] Network error: {exc}")
        raise SystemExit(1)
    except Exception as exc:
        print(f"[ERROR] {exc}")
        raise SystemExit(1)
