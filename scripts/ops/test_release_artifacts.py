"""Offline release fixtures; no compiler, network, production state or keys."""
import contextlib
import copy
import hashlib
import importlib.util
import io
import json
from pathlib import Path
import tarfile
import tempfile
import unittest

spec = importlib.util.spec_from_file_location("release_verifier", Path(__file__).with_name("verify-release-artifacts.py"))
verifier = importlib.util.module_from_spec(spec)
spec.loader.exec_module(verifier)


class ReleaseArtifactsTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory(prefix="zion-release-fixture-")
        self.addCleanup(self.tmp.cleanup)
        self.root = Path(self.tmp.name)
        self.commit = "a" * 40
        self.plan = {"file": "zion-fixture-x86_64-unknown-linux-gnu.tar.gz",
                     "target": "x86_64-unknown-linux-gnu", "variant": "default", "features": ""}
        self.matrix = {"version": "fixture", "commit": self.commit, "packages": ["zion-cli"], "artifacts": [self.plan]}
        self.binaries = {"zion": b"synthetic binary, never executed\n"}

    def fixture(self, *, fields=None, binaries=None, manifest=None, extra=None):
        bins = self.binaries if binaries is None else binaries
        metadata = {"version": "fixture", "commit": self.commit, "tree_state": "clean",
                    "target": self.plan["target"], "variant": self.plan["variant"],
                    "features": self.plan["features"] or "none", **(fields or {})}
        rows = manifest if manifest is not None else [
            f"  {hashlib.sha256(data).hexdigest()}  {name}  {len(data)} B" for name, data in bins.items()]
        info = "zion release artifact\n" + "".join(f"{k}: {v}\n" for k, v in metadata.items())
        info += "binaries:\n" + "\n".join(rows) + "\n"
        path = self.root / self.plan["file"]
        with tarfile.open(path, "w:gz") as archive:
            for name, data in {"BUILD-INFO.txt": info.encode(), **bins}.items():
                member = tarfile.TarInfo("./" + name)
                member.size, member.mode = len(data), 0o755
                archive.addfile(member, io.BytesIO(data))
            if extra:
                archive.addfile(extra, io.BytesIO(b"x" * extra.size) if extra.isfile() else None)
        (self.root / "SHA256SUMS").write_text(f"{hashlib.sha256(path.read_bytes()).hexdigest()}  {path.name}\n")
        (self.root / "RELEASE-MATRIX.json").write_text(json.dumps(self.matrix))

    def verify(self, commit=None):
        with contextlib.redirect_stdout(io.StringIO()):
            return verifier.verify(self.root, commit)

    def test_valid_complete_artifact(self):
        self.fixture()
        self.assertEqual(self.verify(self.commit), 1)

    def test_windows_suffix_and_warpd_binary_map(self):
        self.plan.update(target="x86_64-pc-windows-gnu", file="zion-fixture-x86_64-pc-windows-gnu.tar.gz")
        self.matrix["packages"] = ["zion-multichain"]
        self.fixture(binaries={"warpd.exe": b"fixture windows binary"})
        self.assertEqual(self.verify(), 1)

    def test_empty_checksums_never_pass(self):
        (self.root / "SHA256SUMS").write_text(" \n")
        with self.assertRaisesRegex(ValueError, "0 artifacts"):
            self.verify()

    def test_missing_matrix_never_passes_legacy_dist(self):
        self.fixture()
        (self.root / "RELEASE-MATRIX.json").unlink()
        with self.assertRaises(OSError):
            self.verify()

    def test_empty_planned_matrix(self):
        self.matrix["artifacts"] = []
        self.fixture()
        with self.assertRaisesRegex(ValueError, "empty release matrix"):
            self.verify()

    def test_omitted_target_does_not_turn_partial_release_green(self):
        other = copy.deepcopy(self.plan)
        other.update(target="aarch64-apple-darwin", file="zion-fixture-aarch64-apple-darwin.tar.gz")
        self.matrix["artifacts"].append(other)
        self.fixture()
        with self.assertRaisesRegex(ValueError, "incomplete artifact matrix"):
            self.verify()

    def test_wrong_requested_commit(self):
        self.fixture()
        with self.assertRaisesRegex(ValueError, "requested commit"):
            self.verify("b" * 40)

    def test_metadata_must_match_plan(self):
        for key, value in [("commit", "b" * 40), ("target", "other"), ("variant", "other"),
                           ("version", "other"), ("features", "gpu-opencl")]:
            with self.subTest(key=key):
                self.fixture(fields={key: value})
                with self.assertRaisesRegex(ValueError, f"BUILD-INFO {key}"):
                    self.verify()

    def test_dirty_source_is_not_verified_release(self):
        self.fixture(fields={"tree_state": "dirty (1 change)"})
        with self.assertRaisesRegex(ValueError, "dirty/unproven"):
            self.verify()

    def test_missing_and_empty_binaries(self):
        for bins in [{}, {"zion": b""}]:
            with self.subTest(bins=bins):
                self.fixture(binaries=bins)
                with self.assertRaisesRegex(ValueError, "binar"):
                    self.verify()

    def test_wrong_binary_hash_size_and_incomplete_manifest(self):
        digest = hashlib.sha256(self.binaries["zion"]).hexdigest()
        for rows in [[], [f"  {'0' * 64}  zion  {len(self.binaries['zion'])} B"], [f"  {digest}  zion  1 B"]]:
            with self.subTest(rows=rows):
                self.fixture(manifest=rows)
                with self.assertRaisesRegex(ValueError, "binary"):
                    self.verify()

    def test_wrong_archive_hash(self):
        self.fixture()
        (self.root / self.plan["file"]).write_bytes(b"changed")
        with self.assertRaisesRegex(ValueError, "archive checksum"):
            self.verify()

    def test_missing_archive(self):
        self.fixture()
        (self.root / self.plan["file"]).unlink()
        with self.assertRaisesRegex(ValueError, "missing/non-regular"):
            self.verify()

    def test_duplicate_checksum_and_matrix_entries(self):
        self.fixture()
        sums = self.root / "SHA256SUMS"
        sums.write_text(sums.read_text() * 2)
        with self.assertRaisesRegex(ValueError, "duplicate checksum"):
            self.verify()
        self.matrix["artifacts"].append(copy.deepcopy(self.plan))
        self.fixture()
        with self.assertRaisesRegex(ValueError, "duplicate artifact"):
            self.verify()

    def test_unsafe_tar_paths_and_links(self):
        for name, kind in [("../escape", tarfile.REGTYPE), ("/absolute", tarfile.REGTYPE),
                           ("nested/file", tarfile.REGTYPE), ("link", tarfile.SYMTYPE),
                           ("hardlink", tarfile.LNKTYPE), ("fifo", tarfile.FIFOTYPE)]:
            with self.subTest(name=name):
                member = tarfile.TarInfo(name)
                member.type, member.linkname = kind, "zion"
                self.fixture(extra=member)
                with self.assertRaisesRegex(ValueError, "tar member"):
                    self.verify()

    def test_duplicate_normalized_tar_member(self):
        member = tarfile.TarInfo("zion")
        self.fixture(extra=member)
        with self.assertRaisesRegex(ValueError, "duplicate tar"):
            self.verify()


if __name__ == "__main__":
    unittest.main()
