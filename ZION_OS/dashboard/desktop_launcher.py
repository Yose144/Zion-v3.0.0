#!/usr/bin/env python3
"""
ZION Dashboard — desktop launcher.

Spawns the stdlib-only ZION_OS/dashboard/app.py server bundled with the
Tauri desktop app. In a packaged build the dashboard directory is read-only,
so this launcher copies it to a writable per-user runtime directory first.
"""

import os
import shutil
import sys
import webbrowser
from pathlib import Path


def get_bundle_dir() -> Path:
    return Path(__file__).resolve().parent


def prepare_runtime_dir(runtime_dir: Path, bundle_dir: Path) -> Path:
    runtime_dir = runtime_dir.expanduser().resolve()
    dashboard_dir = runtime_dir / "dashboard"

    if not dashboard_dir.exists():
        shutil.copytree(bundle_dir, dashboard_dir, dirs_exist_ok=False)
    else:
        # Re-copy the launcher/app.py in case the bundle changed between versions,
        # but leave user data (logs, V3/data, settings) untouched.
        for name in ("app.py", "auth.py", "api.js", "ui.js", "config.json",
                     "services.json", "nodes.json", "desktop_launcher.py",
                     "dashboard.html", "dashboard.js"):
            src = bundle_dir / name
            if src.exists():
                dst = dashboard_dir / name
                shutil.copy2(src, dst)

    # app.py resolves REPO_ROOT as SCRIPT_DIR.parent.parent and writes to
    # REPO_ROOT/logs and REPO_ROOT/V3/data. Ensure those directories exist.
    (runtime_dir / "logs").mkdir(parents=True, exist_ok=True)
    (runtime_dir / "V3" / "data").mkdir(parents=True, exist_ok=True)
    (runtime_dir / "scripts").mkdir(parents=True, exist_ok=True)

    return dashboard_dir


def run_app(dashboard_dir: Path) -> None:
    app_path = dashboard_dir / "app.py"
    if not app_path.exists():
        raise FileNotFoundError(f"app.py not found at {app_path}")

    os.chdir(dashboard_dir)
    sys.path.insert(0, str(dashboard_dir))

    # The desktop shell already provides a window; do not open a browser.
    webbrowser.open = lambda *args, **kwargs: None

    code = app_path.read_bytes()
    namespace = {
        "__name__": "__main__",
        "__file__": str(app_path),
    }
    exec(compile(code, str(app_path), "exec"), namespace)


def main() -> None:
    bundle_dir = get_bundle_dir()
    args = sys.argv[1:]

    if args and args[0] == "--runtime-dir":
        if len(args) < 2:
            print("Usage: desktop_launcher.py --runtime-dir <writable-dir>", file=sys.stderr)
            sys.exit(1)
        dashboard_dir = prepare_runtime_dir(Path(args[1]), bundle_dir)
    else:
        # Development / standalone mode: run directly from the source copy.
        dashboard_dir = bundle_dir

    # Tell app.py it is running under the desktop shell so it can relax auth
    # for localhost requests and skip browser open.
    os.environ.setdefault("ZION_DESKTOP_EMBEDDED", "1")

    run_app(dashboard_dir)


if __name__ == "__main__":
    main()
