import base64
import hashlib
import json
import struct
import sys
from pathlib import Path

U256_MAX = (1 << 256) - 1


def target_from_compact(bits):
    exponent = bits >> 24
    mantissa = bits & 0x007fffff
    if bits & 0x00800000:
        raise ValueError("negative compact target")
    value = mantissa >> (8 * (3 - exponent)) if exponent <= 3 else mantissa << (8 * (exponent - 3))
    if value > U256_MAX:
        raise ValueError("compact target exceeds U256")
    return value


def floor_compact(value):
    if not 0 <= value <= U256_MAX:
        raise ValueError("target outside U256")
    if value == 0:
        return 0, 1
    exponent = (value.bit_length() + 7) // 8
    mantissa = value << (8 * (3 - exponent)) if exponent <= 3 else value >> (8 * (exponent - 3))
    if mantissa & 0x00800000:
        mantissa >>= 8
        exponent += 1
    bits = (exponent << 24) | mantissa
    quantum = 1 << max(0, 8 * (exponent - 3))
    assert target_from_compact(bits) <= value
    return bits, quantum


def bracket_jackpot(value, factor):
    if not 0 < value <= U256_MAX or factor <= 0:
        raise ValueError("invalid jackpot/factor")
    lower, quantum = floor_compact((value - 1) // factor)
    upper, _ = floor_compact(target_from_compact(lower) + quantum)
    low = min(U256_MAX, target_from_compact(lower) * factor)
    high = min(U256_MAX, target_from_compact(upper) * factor)
    assert low < value <= high
    return lower, upper, low, high


def self_test():
    for bits, expected in [(0x1d00ffff, 0xffff << 208), (0x03123456, 0x123456), (0x02123456, 0x1234), (0x207fffff, 0x7fffff << 232)]:
        assert target_from_compact(bits) == expected
        assert target_from_compact(floor_compact(expected)[0]) == expected
    for value in [1, 127, 128, 255, 256, 65536, 0x7fffff, 0x800000, (1 << 239) - 1, 1 << 255, U256_MAX]:
        lo, hi, low, high = bracket_jackpot(value, 65536)
        assert low < value <= high
        assert not ((lo | hi) & 0x00800000)
    print(json.dumps({"compact_arithmetic_self_test": "passed"}))


def check(path, source=None):
    import pearl_mining

    source = Path(path).read_bytes() if source is None else source
    fixture = json.loads(source)
    assert fixture["cert_version"] == 3
    assert fixture["request_written"] is True
    assert fixture["transport_error"] is None
    raw_header = bytes.fromhex(fixture["header_hex"])
    raw_target = bytes.fromhex(fixture["target_hex"])
    raw_kernel_target = bytes.fromhex(fixture["kernel_target_hex"])
    raw_jackpot = bytes.fromhex(fixture["jackpot_hex"])
    assert (len(raw_header), len(raw_target), len(raw_kernel_target), len(raw_jackpot)) == (76, 32, 32, 32)
    raw_proof = base64.b64decode(fixture["plain_proof_b64"], validate=True)
    assert 0 < len(raw_proof) <= 8 * 1024 * 1024
    request = fixture["request"]
    response = fixture["response"]
    assert request["method"] == "mining.submit"
    assert request["params"] == {"job_id": fixture["external_job_id"], "plain_proof": fixture["plain_proof_b64"]}
    assert type(request["id"]) is int and request["id"] >= 2
    assert type(response["id"]) is int and response["id"] == request["id"]
    pool_accepted = response.get("result") is True and response.get("error") is None
    header = pearl_mining.IncompleteBlockHeader(
        version=int.from_bytes(raw_header[:4], "little"),
        prev_block=raw_header[4:36][::-1],
        merkle_root=raw_header[36:68][::-1],
        timestamp=int.from_bytes(raw_header[68:72], "little"),
        nbits=int.from_bytes(raw_header[72:76], "little"),
    )
    restored = struct.pack("<I", header.version) + bytes(header.prev_block)[::-1] + bytes(header.merkle_root)[::-1] + struct.pack("<II", header.timestamp, header.nbits)
    assert restored == raw_header
    proof = pearl_mining.PlainProof.from_base64(fixture["plain_proof_b64"])
    pearl_mining.check_cert_version_eligible(3, proof)
    dimensions = (proof.m, proof.n, proof.k, proof.noise_rank)
    assert dimensions == (fixture["m"], fixture["n"], fixture["k"], fixture["rank"]) == (1024, 1024, 2048, 128)
    tile = (len(proof.a.row_indices), len(proof.bt.row_indices))
    assert tile == (4, 8)
    factor = tile[0] * tile[1] * (proof.k // proof.noise_rank) * 128
    assert factor == 65536
    share_target = int.from_bytes(raw_target, "big")
    share_bound = share_target * factor
    assert share_bound <= U256_MAX and share_bound == int.from_bytes(raw_kernel_target, "big")
    gpu_value = int.from_bytes(raw_jackpot, "little")
    exact_gpu_target_match = gpu_value <= share_bound
    lower, upper, low_bound, high_bound = bracket_jackpot(gpu_value, factor)
    lower_ok, lower_message = pearl_mining.verify_plain_proof_v3(header, proof, nbits_override=lower)
    upper_ok, upper_message = pearl_mining.verify_plain_proof_v3(header, proof, nbits_override=upper)
    floor_bits, _ = floor_compact(share_target)
    floor_ok, floor_message = pearl_mining.verify_plain_proof_v3(header, proof, nbits_override=floor_bits)
    independent_share_valid = bool(floor_ok or (upper_ok and high_bound <= share_bound))
    report = {
        "scope": "Frozen external-pool receipt and offline official V3 verification; not ZION live acceptance or node acceptance",
        "artifact": str(path), "fixture_sha256": hashlib.sha256(source).hexdigest(),
        "proof_sha256": hashlib.sha256(raw_proof).hexdigest(), "proof_bytes": len(raw_proof),
        "pool": fixture["pool"], "job_id": fixture["external_job_id"], "height": fixture["height"],
        "cert_version": fixture["cert_version"], "nonce": fixture["nonce"], "tile_index": fixture["tile_index"],
        "request_id": request["id"], "request_written": fixture["request_written"],
        "response": response, "pool_accepted": pool_accepted,
        "dimensions": dimensions, "tile": tile, "factor": factor,
        "issued_target_decimal": str(share_target), "kernel_bound_decimal": str(share_bound),
        "exact_gpu_target_match": exact_gpu_target_match,
        "upstream_floor_nbits": hex(floor_bits), "upstream_floor_valid": bool(floor_ok), "upstream_floor_message": floor_message,
        "lower_nbits": hex(lower), "upper_nbits": hex(upper),
        "lower_bound_decimal": str(low_bound), "upper_bound_decimal": str(high_bound),
        "upstream_lower_valid": bool(lower_ok), "upstream_lower_message": lower_message,
        "upstream_upper_valid": bool(upper_ok), "upstream_upper_message": upper_message,
        "independently_below_exact_pool_bound": independent_share_valid,
        "node_acceptance": "not_observed",
    }
    if not (pool_accepted and exact_gpu_target_match and independent_share_valid and upper_ok and not lower_ok and "Jackpot condition not satisfied" in lower_message):
        raise ValueError("pool receipt / upstream proof or target boundary check failed: " + json.dumps(report, sort_keys=True))
    return report


def main():
    import argparse
    import shlex
    import subprocess

    if sys.flags.optimize:
        raise SystemExit("verification requires Python assertions; do not use -O")
    if sys.argv[1:] == ["--stdin-fixtures"]:
        reports = [
            check(item["artifact"], base64.b64decode(item["source_b64"], validate=True))
            for item in json.load(sys.stdin)
        ]
        print(json.dumps({"receipts": reports}, sort_keys=True, indent=2))
        return

    parser = argparse.ArgumentParser(description="Offline official V3 verification of frozen Pearl pool receipts; no RPC or submissions")
    parser.add_argument("--self-test", action="store_true")
    parser.add_argument("--remote", help="SSH host with /opt/pearl/.venv installed")
    parser.add_argument("--output", type=Path, help="Create a fresh JSON result file; never overwrite")
    parser.add_argument("receipts", nargs="*", type=Path)
    args = parser.parse_args()
    if args.self_test:
        self_test()
        return
    if not args.receipts:
        parser.error("supply at least one submit receipt")
    if args.remote:
        sources = [(str(path), path.read_bytes()) for path in args.receipts]
        packet = [{"artifact": path, "source_b64": base64.b64encode(source).decode("ascii")} for path, source in sources]
        program = Path(__file__).read_text()
        command = "PYTHONOPTIMIZE=0 /opt/pearl/.venv/bin/python -c " + shlex.quote(program) + " --stdin-fixtures"
        result = subprocess.run(
            ["ssh", "-o", "BatchMode=yes", "-o", "ConnectTimeout=10", "--", args.remote, command],
            input=json.dumps(packet), capture_output=True, text=True, timeout=180,
        )
        if result.stderr:
            sys.stderr.write(result.stderr)
        if result.returncode:
            raise SystemExit(result.returncode)
        reports = json.loads(result.stdout)["receipts"]
        assert len(reports) == len(sources)
        for report, (path, source) in zip(reports, sources):
            assert report["artifact"] == path
            assert report["fixture_sha256"] == hashlib.sha256(source).hexdigest()
    else:
        reports = [check(path) for path in args.receipts]
    output = {"receipts": reports}
    rendered = json.dumps(output, sort_keys=True, indent=2) + "\n"
    if args.output:
        with args.output.open("x") as stream:
            stream.write(rendered)
    print(rendered, end="")


if __name__ == "__main__":
    main()
