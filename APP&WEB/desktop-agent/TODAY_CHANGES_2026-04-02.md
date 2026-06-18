# Desktop Agent V3 Cleanup - Daily Report (2026-04-02)

## Scope
Cleanup and stabilization of `APP&WEB/desktop-agent` toward V3-only runtime surface.

## Files Updated
- `src/main.js`
- `src/preload.js`
- `src/ui/renderer.js`
- `src/ui/index.html`
- `scripts/cleanup_v3.py` (added)
- `scripts/cleanup_v3_v2.py` (added)

## Key Changes
1. Removed remaining legacy runtime hooks from desktop-agent main/renderer/preload paths.
2. Removed stale IPC bridge channels in preload (Afterburner/AI Native/Bridge/DAO/WARP and other legacy channels).
3. Removed orphaned Afterburner UI blocks from HTML and corresponding renderer dead paths.
4. Fixed dangling renderer references by introducing V3-safe normalization/no-op helpers.
5. Restored missing network constants in main process (`PRIMARY_TESTNET_HOST`, pool/RPC defaults) to prevent runtime startup errors.
6. Removed dead helper (`getStatsPath`) and stale comments left from legacy paths.

## Validation
- `node --check src/main.js`
- `node --check src/preload.js`
- `node --check src/ui/renderer.js`
- Runtime smoke check via Electron launch (`npx electron .`)

Result: no syntax errors, startup no longer throws `ReferenceError: PRIMARY_TESTNET_HOST is not defined`.

## Notes
- Working tree also contains unrelated edits outside desktop-agent scope (website/V3/test artifacts). They are intentionally excluded from this report and commit.
