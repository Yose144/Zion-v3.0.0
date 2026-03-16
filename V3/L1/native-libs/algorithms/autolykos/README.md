# autolykos native module (scaffold)

Status: TODO

Planned outputs:

- Windows: zion_autolykos.dll
- Linux: libzion_autolykos.so

Acceptance checklist:

1. Build succeeds on Windows/Linux.
2. ABI symbol zion_native_get_info exports correctly.
3. Verify vectors match Rust fallback output.
4. Runtime fallback stays functional without native binary.
