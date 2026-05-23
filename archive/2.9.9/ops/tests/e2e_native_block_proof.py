#!/usr/bin/env python3
"""ZION v2.9.5 — P0 Block-Found/SubmitBlock Proof (dev/regtest)

Goal:
- Prove the full core path accepts a mined block via JSON-RPC:
  getBlockTemplate -> mine nonce (Blake3) -> submitBlock -> height increments.

Assumptions:
- Core JSON-RPC is reachable at http://HOST:PORT/jsonrpc.
- Core is started with ZION_DEV_MODE=1 so we can set low difficulty and bypass
  difficulty retarget rules (deterministic proof).

This script mines ONLY Blake3 (it expects template height % 4 == 1).

Exit code:
- 0 = PASS
- 1 = FAIL
"""

from __future__ import annotations

import argparse
import json
import struct
import sys
import time
import urllib.request
from dataclasses import dataclass
from typing import Any, Dict, Optional, Tuple


def jsonrpc_call(url: str, method: str, params: Any, timeout: int = 10) -> Dict[str, Any]:
    req = {
        "jsonrpc": "2.0",
        "id": 1,
        "method": method,
        "params": params,
    }
    data = json.dumps(req).encode("utf-8")
    request = urllib.request.Request(url, data=data, headers={"Content-Type": "application/json"})
    with urllib.request.urlopen(request, timeout=timeout) as resp:
        body = resp.read().decode("utf-8", errors="replace")
        out = json.loads(body)
    return out


def must_result(resp: Dict[str, Any]) -> Any:
    if "error" in resp and resp["error"] is not None:
        raise RuntimeError(f"JSON-RPC error: {resp['error']}")
    return resp.get("result")


def parse_target_hex(target_hex: str) -> bytes:
    t = str(target_hex).strip().lower().removeprefix("0x")
    if len(t) % 2 == 1:
        t = "0" + t
    raw = bytes.fromhex(t)
    if len(raw) > 32:
        raw = raw[-32:]
    if len(raw) < 32:
        raw = (b"\x00" * (32 - len(raw))) + raw
    return raw


def blake3_hash(data: bytes) -> bytes:
    try:
        from blake3 import blake3  # type: ignore
    except Exception as e:
        raise RuntimeError("Missing python package 'blake3'. Install via: pip install blake3") from e
    return blake3(data).digest()


def meets_target(hash_bytes: bytes, target: bytes) -> bool:
    hb = hash_bytes[:32].ljust(32, b"\x00")
    for i in range(32):
        if hb[i] < target[i]:
            return True
        if hb[i] > target[i]:
            return False
    return False


def build_header_bytes(
    version: int,
    height: int,
    prev_hash_hex: str,
    merkle_root_hex: str,
    timestamp: int,
    difficulty: int,
    nonce: int,
) -> bytes:
    # Must match zion-core BlockHeader::calculate_hash serialization:
    # little-endian ints + ASCII bytes of hex strings.
    out = bytearray()
    out += struct.pack("<I", int(version))
    out += struct.pack("<Q", int(height))
    out += str(prev_hash_hex).encode("utf-8")
    out += str(merkle_root_hex).encode("utf-8")
    out += struct.pack("<Q", int(timestamp))
    out += struct.pack("<Q", int(difficulty))
    out += struct.pack("<Q", int(nonce))
    return bytes(out)


@dataclass
class Template:
    version: int
    height: int
    difficulty: int
    prev_hash: str
    target: str
    timestamp: int
    merkle_root: str
    blob: str


def mine_blake3_nonce(tpl: Template, max_nonce: int) -> Tuple[int, str]:
    target = parse_target_hex(tpl.target)

    for nonce in range(max_nonce + 1):
        header_bytes = build_header_bytes(
            version=tpl.version,
            height=tpl.height,
            prev_hash_hex=tpl.prev_hash,
            merkle_root_hex=tpl.merkle_root,
            timestamp=tpl.timestamp,
            difficulty=tpl.difficulty,
            nonce=nonce,
        )
        h = blake3_hash(header_bytes)
        if meets_target(h, target):
            return nonce, h.hex()

    raise RuntimeError(f"nonce not found within max_nonce={max_nonce}")


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--host", default="127.0.0.1")
    ap.add_argument("--port", type=int, default=18091)
    ap.add_argument("--wallet", default="zion1e2eblockproof0000000000000000000000000test")
    ap.add_argument("--difficulty", type=int, default=1)
    ap.add_argument("--max-nonce", type=int, default=200_000)
    args = ap.parse_args()

    url = f"http://{args.host}:{args.port}/jsonrpc"

    info0 = must_result(jsonrpc_call(url, "getInfo", {}))
    tip_h = int(info0.get("height", 0))

    # dev: set low difficulty
    must_result(jsonrpc_call(url, "dev.set_difficulty", {"difficulty": int(args.difficulty)}))

    tpl_raw = must_result(jsonrpc_call(url, "getBlockTemplate", {"wallet_address": args.wallet}))
    tpl = Template(
        version=int(tpl_raw["version"]),
        height=int(tpl_raw["height"]),
        difficulty=int(tpl_raw["difficulty"]),
        prev_hash=str(tpl_raw["prev_hash"]),
        target=str(tpl_raw["target"]),
        timestamp=int(tpl_raw["timestamp"]),
        merkle_root=str(tpl_raw["merkle_root"]),
        blob=str(tpl_raw["blob"]),
    )

    if tpl.height != tip_h + 1:
        raise RuntimeError(f"template height mismatch: tip={tip_h} template={tpl.height}")

    if tpl.height % 4 != 1:
        raise RuntimeError(
            f"this proof mines only Blake3, but template height={tpl.height} implies algo={tpl.height % 4}"
        )

    t0 = time.time()
    nonce, pow_hash = mine_blake3_nonce(tpl, args.max_nonce)
    dt = time.time() - t0

    submit = must_result(jsonrpc_call(url, "submitBlock", [tpl.blob, int(nonce), args.wallet]))
    if not isinstance(submit, dict) or submit.get("status") != "OK":
        raise RuntimeError(f"submitBlock failed: {submit}")

    info1 = must_result(jsonrpc_call(url, "getInfo", {}))
    new_h = int(info1.get("height", -1))

    if new_h != tpl.height:
        raise RuntimeError(f"height did not advance: expected={tpl.height} got={new_h}")

    print("=" * 70)
    print("✅ P0 BLOCK PROOF OK")
    print(f"core: {url}")
    print(f"mined height: {tpl.height} (tip was {tip_h})")
    print(f"difficulty: {tpl.difficulty}")
    print(f"nonce: {nonce}")
    print(f"pow_hash: {pow_hash}")
    print(f"time: {dt:.3f}s")
    print("=" * 70)
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except Exception as e:
        print("=" * 70)
        print(f"❌ P0 BLOCK PROOF FAIL — {e}")
        print("=" * 70)
        raise
