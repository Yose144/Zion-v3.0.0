# randomx native module (scaffold)

Status: TODO

Planned outputs:

- Windows: zion_randomx.dll
- Linux: libzion_randomx.so

Acceptance checklist:

1. Build succeeds on Windows/Linux.
2. ABI symbol zion_native_get_info exports correctly.
3. Deterministic hash verify test passes against Rust reference path.
4. Missing library fallback path in miner remains functional.
