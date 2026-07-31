#!/usr/bin/env python3
"""Convert a V3 `zion-node-state.db` JSON export into a V31 checkpoint snapshot.

The checkpoint can be imported by `zion-node --v3-checkpoint <file>` and carries
both the V3 tip block header and the final UTXO/account state, so V31 can report
the same V3 height and serve balance/utxo queries without replaying history.

Usage:
    python3 v3-state-to-checkpoint.py /opt/zion/data/state /opt/zion/data/v31/v3-checkpoint.json
"""

import json
import sys
from collections import defaultdict

V3_LEGACY_FLOWERS_PER_ZION = 1_000_000_000_000
V31_FLOWERS_PER_ZION = 1_000_000
LEGACY_SCALE_FACTOR = V3_LEGACY_FLOWERS_PER_ZION // V31_FLOWERS_PER_ZION


def scale_factor(height: int) -> int:
    return LEGACY_SCALE_FACTOR if height == 0 else 1


def parse_amount(s):
    return int(s)


def main():
    if len(sys.argv) != 3:
        print("Usage: v3-state-to-checkpoint.py <v3-state.json> <checkpoint-out.json>", file=sys.stderr)
        sys.exit(1)
    in_path, out_path = sys.argv[1], sys.argv[2]

    with open(in_path, "r") as f:
        state = json.load(f)

    if not state.get("accepted_blocks"):
        raise ValueError("no accepted_blocks in V3 state")

    tip = state["accepted_blocks"][-1]

    account_balances = defaultdict(lambda: 0)
    utxo_unspent_raw = defaultdict(lambda: 0)  # (address, factor) -> raw
    utxo_pool = {}  # (tx_hash, output_index) -> (address, raw, factor)

    for block in state["accepted_blocks"]:
        factor = scale_factor(block["height"])

        for tx in block.get("transactions", []):
            amount = parse_amount(tx["amount_zion"]) // factor
            fee = tx.get("fee_zion", 0) // factor
            if tx["from"] in ("genesis", "coinbase"):
                account_balances[tx["to"]] += amount
            else:
                account_balances[tx["from"]] -= amount + fee
                account_balances[tx["to"]] += amount

        for tx in block.get("utxo_transactions", []):
            tx_hash = bytes(tx["id"]).hex()
            for inp in tx.get("inputs", []):
                key = (bytes(inp["prev_tx_hash"]).hex(), inp["output_index"])
                if key in utxo_pool:
                    addr, raw, f = utxo_pool.pop(key)
                    utxo_unspent_raw[(addr, f)] -= raw
            for i, out in enumerate(tx.get("outputs", [])):
                raw = out["amount"]
                utxo_pool[(tx_hash, i)] = (out["address"], raw, factor)
                utxo_unspent_raw[(out["address"], factor)] += raw

    # Merge UTXO totals into account balances (V31 canonical representation).
    for (addr, factor), raw in utxo_unspent_raw.items():
        converted = raw // factor
        if converted:
            account_balances[addr] += converted

    checkpoint = {
        "block_height": tip["height"],
        "block_hash_hex": tip["hash_hex"],
        "header_hex": tip["header_hex"],
        "nonce": tip["nonce"],
        "difficulty": tip["difficulty"],
        "total_zion": str(sum(v for v in account_balances.values() if v > 0)),
        "utxos": [
            {
                "tx_hash_hex": key[0],
                "output_index": key[1],
                "amount": value[1] // value[2],
                "address": value[0],
            }
            for key, value in utxo_pool.items()
            if (value[1] // value[2]) > 0
        ],
        "accounts": [
            {"address": addr, "balance": str(balance), "nonce": 0}
            for addr, balance in account_balances.items()
            if balance > 0
        ],
    }

    with open(out_path, "w") as f:
        json.dump(checkpoint, f, indent=2)

    print(f"checkpoint written: {out_path}")
    print(f"  height: {checkpoint['block_height']}")
    print(f"  hash:   {checkpoint['block_hash_hex']}")
    print(f"  utxos:  {len(checkpoint['utxos'])}")
    print(f"  accounts: {len(checkpoint['accounts'])}")
    print(f"  total_zion: {checkpoint['total_zion']}")


if __name__ == "__main__":
    main()
