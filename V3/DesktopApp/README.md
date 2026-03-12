# ZION V3 DesktopApp

Clean desktop control plane for the V3 mainnet line.

This app is intentionally separate from `APP&WEB/desktop-agent`.
It reuses the good operator UX direction from the testnet agent, but it does not carry over legacy mining fallbacks, website coupling, or historical packaging/runtime ballast.

## Scope

- wallet manager foundation
- L1-L6 navigation shell for future operator workflows
- clean IPC boundary between UI and local services
- auto-update integration hooks
- thin supervision over prebuilt V3 node / pool / miner binaries
- no embedded legacy mining orchestration

## Initial Modules

- `src/main.js` - Electron bootstrap and IPC registration
- `src/preload.js` - renderer-safe bridge
- `src/services/wallet-manager.js` - encrypted-at-rest wallet metadata store
- `src/services/runtime-manager.js` - thin local supervisor for V3 binaries
- `src/services/update-service.js` - clean wrapper around `electron-updater`
- `src/renderer/*` - UI shell for operators

## Wallet Storage

- wallet metadata is stored under Electron `userData`
- secrets are encrypted with Electron `safeStorage` when available
- the renderer only receives secrets on create/import response, not on normal listing

## Next Intended Expansion

- network profile management
- signing flows and transaction drafting
- update channels and release provenance validation
