#!/usr/bin/env python3
"""Compile native mining kernels and direct probes without a CUDA device.

This checks NVRTC and assembler acceptance, NOT on-device correctness or speed.
It requires an installed CUDA 11.1+ NVRTC library with CUBIN support.
"""

import argparse
import ctypes
import ctypes.util
import hashlib
import json
from pathlib import Path
import re
import sys


TYPEDEFS = """typedef unsigned char uint8_t;
typedef unsigned short uint16_t;
typedef unsigned int uint32_t;
typedef int int32_t;
typedef unsigned long long uint64_t;
typedef long long int64_t;
"""


def preprocess(source):
    """Mirror cuda_external::preprocess_kernel, including qualifier handling."""
    lines = []
    for line in source.splitlines():
        if line.strip().startswith(
            ("#pragma once", "#include <cuda_runtime.h>", "#include <stdint.h>")
        ):
            continue
        if not line.startswith("__constant__"):
            line = line.replace("__constant__ ", "")
        lines.append(line)
    return TYPEDEFS + "\n".join(lines) + "\n"


def rust_probe(path, name):
    text = path.read_text()
    match = re.search(rf'const {name}: &str = r#"(.*?)"#;', text, re.DOTALL)
    if match is None:
        raise ValueError(f"missing direct probe {name} in {path}")
    return match.group(1)


def load_nvrtc():
    library = ctypes.util.find_library("nvrtc")
    if library is None:
        raise RuntimeError("NVRTC is not installed or not on the library path")
    lib = ctypes.CDLL(library)
    signatures = {
        "nvrtcVersion": [ctypes.POINTER(ctypes.c_int), ctypes.POINTER(ctypes.c_int)],
        "nvrtcCreateProgram": [
            ctypes.POINTER(ctypes.c_void_p), ctypes.c_char_p, ctypes.c_char_p,
            ctypes.c_int, ctypes.c_void_p, ctypes.c_void_p,
        ],
        "nvrtcCompileProgram": [
            ctypes.c_void_p, ctypes.c_int, ctypes.POINTER(ctypes.c_char_p),
        ],
        "nvrtcDestroyProgram": [ctypes.POINTER(ctypes.c_void_p)],
    }
    for kind in ["ProgramLog", "PTX", "CUBIN"]:
        signatures[f"nvrtcGet{kind}Size"] = [
            ctypes.c_void_p, ctypes.POINTER(ctypes.c_size_t),
        ]
        signatures[f"nvrtcGet{kind}"] = [ctypes.c_void_p, ctypes.c_void_p]
    for name, arguments in signatures.items():
        function = getattr(lib, name)
        function.argtypes = arguments
        function.restype = ctypes.c_int
    return lib


def require(code, operation):
    if code != 0:
        raise RuntimeError(f"{operation}: NVRTC error {code}")


def read_artifact(lib, program, kind):
    size = ctypes.c_size_t()
    require(getattr(lib, f"nvrtcGet{kind}Size")(program, ctypes.byref(size)), kind)
    buffer = ctypes.create_string_buffer(size.value)
    require(getattr(lib, f"nvrtcGet{kind}")(program, buffer), kind)
    return buffer.raw


def compile_case(lib, source, options, output, label):
    program = ctypes.c_void_p()
    require(
        lib.nvrtcCreateProgram(
            ctypes.byref(program), source.encode(), f"{label}.cu".encode(),
            0, None, None,
        ),
        "create program",
    )
    try:
        encoded = (ctypes.c_char_p * len(options))(*(o.encode() for o in options))
        status = lib.nvrtcCompileProgram(program, len(options), encoded)
        log = read_artifact(lib, program, "ProgramLog").rstrip(b"\0")
        (output / f"{label}.log").write_bytes(log)
        require(status, f"compile {label}; see {output / (label + '.log')}")
        cubin = read_artifact(lib, program, "CUBIN")
        (output / f"{label}.cubin").write_bytes(cubin)
        (output / f"{label}.ptx").write_bytes(read_artifact(lib, program, "PTX"))
        return {
            "case": label,
            "options": options,
            "source_sha256": hashlib.sha256(source.encode()).hexdigest(),
            "cubin_sha256": hashlib.sha256(cubin).hexdigest(),
            "cubin_bytes": len(cubin),
            "status": "compiled_only",
        }
    finally:
        require(lib.nvrtcDestroyProgram(ctypes.byref(program)), "destroy program")


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--output", type=Path, required=True, help="new artifact directory")
    mode = parser.add_mutually_exclusive_group()
    mode.add_argument(
        "--pearl-cumulative-only", action="store_true",
        help="compile only the experimental cumulative-MMA SM75/SM86 cases",
    )
    mode.add_argument(
        "--qpow-single-only", action="store_true",
        help="compile only QPoW SM61/SM75/SM86 with both nonce entry points",
    )
    args = parser.parse_args()
    output = args.output.resolve()
    output.mkdir(mode=0o700)
    miner = Path(__file__).resolve().parents[1] / "L1/miner"
    pearl_source = preprocess((miner / "csrc/cuda/pearl_pouw_native.cu").read_text())
    qpow_source = preprocess((miner / "csrc/cuda/poseidon2_kernel.cu").read_text())
    pearl_probe = rust_probe(miner / "src/gpu/pearl_cuda_tests.rs", "MMA_PROBE")
    qpow_probes = "\n".join(
        rust_probe(miner / "src/gpu/qpow_cuda_tests.rs", name)
        for name in ["ARITH_PROBE", "FIRST_SQUEEZE_PROBE"]
    )
    lib = load_nvrtc()
    major, minor = ctypes.c_int(), ctypes.c_int()
    require(lib.nvrtcVersion(ctypes.byref(major), ctypes.byref(minor)), "version")
    manifest = {"nvrtc": [major.value, minor.value], "cases": [], "errors": []}
    for sm in [61, 75, 86]:
        options = ["--use_fast_math", f"-arch=sm_{sm}", "--std=c++14"]
        if args.pearl_cumulative_only:
            if sm < 75:
                continue
            cases = [(
                f"pearl_sm{sm}_cumulative1", pearl_source + pearl_probe,
                options + ["-DPEARL_CUMULATIVE_MMA=1"],
            )]
        elif args.qpow_single_only:
            cases = [(
                f"qpow_sm{sm}_single", qpow_source + qpow_probes,
                options + ["-DQPOW_FUSED_MDS=0"],
            )]
        else:
            cases = [
                (f"pearl_sm{sm}", pearl_source + (pearl_probe if sm >= 75 else ""), options),
            ]
            for fused in [0, 1]:
                cases.append((
                    f"qpow_sm{sm}_fused{fused}",
                    qpow_source + qpow_probes,
                    options + [f"-DQPOW_FUSED_MDS={fused}"],
                ))
        for label, source, flags in cases:
            try:
                manifest["cases"].append(compile_case(lib, source, flags, output, label))
                print(f"COMPILED {label}", flush=True)
            except RuntimeError as error:
                manifest["errors"].append({"case": label, "error": str(error)})
                print(f"FAILED {label}: {error}", file=sys.stderr, flush=True)
            (output / "manifest.json").write_text(json.dumps(manifest, indent=2) + "\n")
    return 1 if manifest["errors"] else 0


if __name__ == "__main__":
    sys.exit(main())
