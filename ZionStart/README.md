# ZionStart — Launchers for Windows 11 and Ubuntu

> One place for all OS-level launch, run, stop, and restart scripts.
> These are user-facing convenience wrappers; canonical service definitions live in `V3/docker/`, `V3/systemd/`, and `scripts/`.

## Layout

| Directory | Purpose |
|-----------|---------|
| [`windows/`](./windows/) | Windows 11 `.bat` launchers (visible/minimized windows) |
| [`powershell/`](./powershell/) | PowerShell `.ps1` scripts (tasks, watchdogs, optimized miners) |
| [`ubuntu/`](./ubuntu/) | Ubuntu / Linux `.sh` launchers |

## Quick start

### Windows 11

```powershell
# Full stack (dashboard + node + miner) in separate windows
ZionStart\windows\start-all.bat

# Or visible windows for debugging
ZionStart\windows\start-all-visible.bat

# Just dashboard
ZionStart\windows\start-dashboard.bat

# Setup Task Scheduler autostart
ZionStart\windows\setup-zion-tasks.bat
```

### Ubuntu / Linux

```bash
# Full stack in background
ZionStart/ubuntu/start-all.sh

# Individual services
ZionStart/ubuntu/start-node.sh
ZionStart/ubuntu/start-miner.sh
ZionStart/ubuntu/start-dashboard.sh

# Stop everything
ZionStart/ubuntu/stop-all.sh
```

## Notes

- Most Windows `.bat` files hardcode `C:\Users\yosef\Desktop\Zion\2.9.6-main` as the repo path and `cd` there before running. They work regardless of where the `.bat` file is located.
- `start-zion-cli.bat` and `start-zionos-dashboard.bat` compute `REPO_ROOT` from `%~dp0\..\..` so they also work from the new location.
- Ubuntu `.sh` scripts compute `REPO_ROOT` as `$(dirname "$0")/../..` so they can be run from any path.
- Setup scripts (`setup-zion-tasks.bat`, `setup-zion-tasks.ps1`) reference the new `ZionStart\windows\` paths.

---

*Moved here as part of 2026-07-01 root cleanup. Previous location was repository root.*
