#!/usr/bin/env python3
"""Offline, fail-closed verification of a planned release artifact matrix."""
import argparse
import hashlib
import json
from pathlib import Path, PurePosixPath
import re
import tarfile

PACKAGE_BINS = {
    "zion-miner": ["zion-miner"],
    "zion-core": ["zion-node", "zion-migrate"],
    "zion-cli": ["zion"],
    "zion-pool": ["zion-pool"],
    "zion-dao": ["zion-dao"],
    "zion-multichain": ["warpd"],
}
SHA = re.compile(r"[0-9a-f]{64}")
COMMIT = re.compile(r"[0-9a-f]{40}")
LABEL = re.compile(r"[A-Za-z0-9_][A-Za-z0-9_.-]*")


def sha256_stream(stream):
    """Bounded memory; also works with Python <3.11 on older build hosts."""
    digest = hashlib.sha256()
    for chunk in iter(lambda: stream.read(1024 * 1024), b""):
        digest.update(chunk)
    return digest.hexdigest()


def verify(directory, expected_commit=None):
    directory = Path(directory)
    sums_path = directory / "SHA256SUMS"
    if not sums_path.is_file():
        raise ValueError(f"missing {sums_path.name}")
    if not sums_path.read_text().strip():
        raise ValueError("0 artifacts verified")
    matrix = json.loads((directory / "RELEASE-MATRIX.json").read_text())
    commit = matrix.get("commit", "")
    if not COMMIT.fullmatch(commit) or expected_commit and commit != expected_commit:
        raise ValueError("matrix commit missing or different from requested commit")
    version = matrix.get("version", "")
    if not LABEL.fullmatch(version):
        raise ValueError("matrix version missing or invalid")
    packages = matrix.get("packages")
    if not isinstance(packages, list) or not packages or any(not isinstance(p, str) or p not in PACKAGE_BINS for p in packages):
        raise ValueError("matrix packages missing or unknown")
    if len(set(packages)) != len(packages):
        raise ValueError("duplicate matrix packages")
    artifacts = matrix.get("artifacts")
    if not isinstance(artifacts, list) or not artifacts:
        raise ValueError("empty release matrix")
    planned = {}
    for artifact in artifacts:
        name = artifact.get("file", "")
        if not name or Path(name).name != name or name in planned or not name.endswith(".tar.gz"):
            raise ValueError("invalid/duplicate artifact name")
        if not LABEL.fullmatch(artifact.get("target", "")) or not LABEL.fullmatch(artifact.get("variant", "")):
            raise ValueError("matrix target/variant missing or invalid")
        if not isinstance(artifact.get("features"), str):
            raise ValueError("matrix features missing")
        tag = artifact["target"] + ("+" + artifact["variant"] if artifact["variant"] != "default" else "")
        if name != f"zion-{version}-{tag}.tar.gz":
            raise ValueError("artifact name disagrees with target/variant/version")
        planned[name] = artifact

    sums = {}
    for line in (directory / "SHA256SUMS").read_text().splitlines():
        if not line.strip():
            continue
        fields = line.split()
        if len(fields) != 2 or not SHA.fullmatch(fields[0]):
            raise ValueError("invalid SHA256SUMS line")
        digest, name = fields
        if name not in planned or name in sums:
            raise ValueError("unplanned/duplicate checksum entry")
        sums[name] = digest
    if not sums or set(sums) != set(planned):
        raise ValueError("empty or incomplete artifact matrix in SHA256SUMS")

    for name, digest in sums.items():
        path = directory / name
        if path.is_symlink() or not path.is_file():
            raise ValueError(f"missing/non-regular archive: {name}")
        with path.open("rb") as f:
            actual = sha256_stream(f)
        if actual != digest:
            raise ValueError(f"archive checksum mismatch: {name}")
        with tarfile.open(path, "r:gz") as archive:
            members = {}
            for member in archive.getmembers():
                rel = PurePosixPath(member.name)
                if rel.is_absolute() or ".." in rel.parts or not (member.isdir() or member.isfile()):
                    raise ValueError(f"unsafe tar member in {name}")
                if member.isdir() and str(rel) == ".":
                    continue
                key = str(rel)
                if member.isdir() or "/" in key or key in members:
                    raise ValueError(f"nested/duplicate tar member in {name}")
                members[key] = member
            if "BUILD-INFO.txt" not in members or members["BUILD-INFO.txt"].size > 1_000_000:
                raise ValueError(f"missing/oversized BUILD-INFO.txt: {name}")
            info = archive.extractfile(members["BUILD-INFO.txt"]).read().decode()
            metadata = re.findall(r"^([a-z_]+): (.+)$", info, re.M)
            fields = dict(metadata)
            if len(fields) != len(metadata):
                raise ValueError(f"duplicate BUILD-INFO metadata: {name}")
            plan = planned[name]
            for key, expected in [("commit", commit), ("version", version), ("target", plan["target"]),
                                  ("variant", plan["variant"]), ("features", plan["features"] or "none")]:
                if fields.get(key) != expected:
                    raise ValueError(f"BUILD-INFO {key} mismatch: {name}")
            if fields.get("tree_state") != "clean":
                raise ValueError(f"dirty/unproven source tree: {name}")
            required = {b + (".exe" if "windows" in plan["target"] else "") for p in packages for b in PACKAGE_BINS[p]}
            if set(members) != required | {"BUILD-INFO.txt"}:
                raise ValueError(f"missing or unexpected binaries: {name}")
            declared = re.findall(r"^  ([0-9a-f]{64})  (\S+)  ([0-9]+) B$", info, re.M)
            if len(declared) != len(required) or {b for _, b, _ in declared} != required:
                raise ValueError(f"binary manifest incomplete: {name}")
            for expected_hash, binary, expected_size in declared:
                member = members[binary]
                if member.size <= 0 or member.size != int(expected_size):
                    raise ValueError(f"empty/incorrect binary size: {name}/{binary}")
                if "windows" not in plan["target"] and not member.mode & 0o111:
                    raise ValueError(f"binary is not executable: {name}/{binary}")
                actual_hash = sha256_stream(archive.extractfile(member))
                if actual_hash != expected_hash:
                    raise ValueError(f"binary checksum mismatch: {name}/{binary}")
        print(f"  PASS {name} (commit, target, variant, {len(required)} binaries)")
    return len(sums)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("directory")
    parser.add_argument("--commit")
    args = parser.parse_args()
    try:
        count = verify(args.directory, args.commit)
    except (OSError, ValueError, TypeError, KeyError, AttributeError, tarfile.TarError) as error:
        print(f"RESULT: FAIL ({error})")
        return 1
    print(f"RESULT: PASS ({count} artifacts verified)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
