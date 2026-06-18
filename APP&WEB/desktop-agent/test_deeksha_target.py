from pathlib import Path
import sys


ROOT = Path(__file__).resolve().parent
sys.path.insert(0, str(ROOT / "resources" / "mining"))

from cosmic_harmony_deeksha_fallback import parse_target, meets_target, submit_nonce_hex  # noqa: E402


def main() -> None:
    target = parse_target("000a8261")
    assert target == 0x000A8261, hex(target)

    long_target = parse_target("00418937ffffffffffffffffffffffffffffffffffffffffffffffffffffffff")
    assert long_target == 0x00418937, hex(long_target)

    rejected_hash = bytes.fromhex(
        "000845a6507aa876000000000000000000000000000000000000000000000000"
    )
    assert not meets_target(rejected_hash, target, "little")

    accepted_hash = bytes.fromhex(
        "5c000000507aa876000000000000000000000000000000000000000000000000"
    )
    assert meets_target(accepted_hash, 0x000000CC, "little")

    assert submit_nonce_hex(0x1234ABCD) == "1234abcd"
    assert submit_nonce_hex(0x100000001) == "00000001"

    print("Deeksha target parsing OK")


if __name__ == "__main__":
    main()