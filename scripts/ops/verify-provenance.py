#!/usr/bin/env python3
"""classify a deploy-provenance JSONL stream (8.S2).

Reads the manifest produced by `deploy-provenance.sh` and answers one question:
does every running binary trace back to a known commit?

    bash scripts/ops/deploy-provenance.sh | python3 scripts/ops/verify-provenance.py
    ... | python3 scripts/ops/verify-provenance.py --expect <sha> --strict

States:
  PROVEN        build id is a bare commit sha
  TAGGED        commit + custom suffix (e.g. `-g8fix`) — traceable, not clean
  DIRTY         commit + `-dirty` marker — built from an uncommitted tree
  UNKNOWN       no build id at all — provenance is a guess
  WRONG-COMMIT  build id does not start with --expect

Exit 1 on UNKNOWN/WRONG-COMMIT always, and on TAGGED/DIRTY with --strict.
"""
import json
import re
import sys

CLEAN_SHA = re.compile(r"[0-9a-f]{7,12}")


def classify(build_id: str) -> tuple[str, str]:
    if not build_id:
        return "UNKNOWN", "bez build id — nelze dohledat commit"
    if build_id.endswith("-dirty"):
        return "DIRTY", build_id
    if CLEAN_SHA.fullmatch(build_id):
        return "PROVEN", build_id
    return "TAGGED", build_id


def main() -> int:
    args = sys.argv[1:]
    strict = "--strict" in args
    expect = next((a.split("=", 1)[1] for a in args if a.startswith("--expect=")), "")

    rows: list[tuple[str, str, str, str]] = []
    bad = 0
    for line in sys.stdin:
        line = line.strip()
        if not line:
            continue
        try:
            doc = json.loads(line)
        except json.JSONDecodeError as exc:
            print(f"ERROR: nerozumím řádku manifestu: {exc}", file=sys.stderr)
            return 2
        for b in doc.get("binaries", []):
            state, detail = classify(b.get("build_id", ""))
            if expect and not b.get("build_id", "").startswith(expect):
                state, detail = "WRONG-COMMIT", f'{b.get("build_id", "") or "—"} (čekáno {expect})'
            if state in ("UNKNOWN", "WRONG-COMMIT") or (strict and state in ("DIRTY", "TAGGED")):
                bad += 1
            rows.append((doc.get("host", "?"), b.get("unit", "?"), state, detail))

    if not rows:
        print("ERROR: manifest je prázdný (host nedostupný?)", file=sys.stderr)
        return 2

    print(f'{"host":<7} {"unit":<28} {"state":<13} detail')
    for host, unit, state, detail in sorted(rows):
        print(f"{host:<7} {unit:<28} {state:<13} {detail}")

    counts: dict[str, int] = {}
    for _, _, state, _ in rows:
        counts[state] = counts.get(state, 0) + 1
    print("\nsouhrn: " + ", ".join(f"{k}={v}" for k, v in sorted(counts.items())))
    if expect:
        print(f"očekávaný commit: {expect}")
    return 1 if bad else 0


if __name__ == "__main__":
    sys.exit(main())
