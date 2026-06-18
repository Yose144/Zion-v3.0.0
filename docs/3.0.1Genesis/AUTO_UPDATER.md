# ZION Desktop Agent — Auto-Updater

## Overview

The desktop agent has a **two-tier auto-update system**:
1. **Electron app updater** — uses `electron-updater` to update the application itself.
2. **Miner binary updater** — downloads the correct platform-specific `zion-miner` binary from GitHub releases and hot-swaps it atomically.

Both are exposed through the **About → Updates** tab in the UI with one-click buttons.

## Release Asset Naming Convention

When creating a GitHub release in `Yose144/Zion-v3.0.0`, attach miner binaries with these exact names:

| Platform        | Asset Name                     |
|-----------------|--------------------------------|
| Windows x64     | `zion-miner-windows-x64.exe`   |
| macOS Apple Silicon | `zion-miner-macos-arm64`   |
| macOS Intel     | `zion-miner-macos-x64`         |
| Linux x64       | `zion-miner-linux-x64`         |

The desktop agent auto-detects `process.platform` and `process.arch` and picks the matching asset.

## How the Miner Binary Updater Works

1. **Check** (`check-miner-update` IPC):
   - Calls `_checkGitHubRelease()` against `api.github.com/repos/Yose144/Zion-v3.0.0/releases/latest`.
   - Finds the asset matching the current platform/arch.
   - Compares the local `zion-miner` file size with the remote asset size.
   - Returns `{ updateAvailable, assetName, assetSize, latestVersion }`.

2. **Download** (`download-miner-update` IPC):
   - Downloads the asset to a temp file in the system temp directory.
   - Sends `miner-update-progress` events to the renderer every 500 ms.
   - Verifies the downloaded size matches the expected size.
   - **Atomic swap**:
     - If a miner process is running, it is killed first.
     - The old binary is renamed to `<binary>.backup`.
     - The new temp file is renamed into place.
     - On Unix, `chmod 755` is applied.
   - Returns `{ success: true, path: <targetPath> }`.

3. **Rollback** (manual):
   - If the new binary fails to start, restore the `.backup` file manually.

## UI Flow

- **"Check for Updates"** — checks the Electron app (via `electron-updater` or GitHub fallback).
- **"Check Miner Update"** — checks the miner binary using the new system above.
- **"Update All"** (gold button) — downloads the miner update first, then triggers the app update install & restart.

## Configuration

- `package.json` → `build.publish` must point to `Yose144/Zion-v3.0.0`.
- `main.js` → `_checkGitHubRelease()` polls `api.github.com/repos/Yose144/Zion-v3.0.0/releases/latest`.

## Important Notes

- The miner binary updater works **even in dev mode** (unlike `electron-updater`).
- Size comparison is used instead of hash because GitHub release assets do not expose a reliable SHA-256 in the REST API without an extra request.
- The updater assumes assets are compiled per-platform from the same source version as the release tag.
