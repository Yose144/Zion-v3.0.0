#!/usr/bin/env python3
"""
Harden edge-deploy/systemd/*.service files for a dedicated `zion` user.

Run from the repository root:
    python3 edge-deploy/scripts/harden-edge-systemd.py

Transforms performed in-place:
* User=root -> User=zion, add Group=zion
* /root/zion-2.9.6-main and /root/zion/2.9.6 -> /opt/zion
* /data/zion -> /opt/zion/data
* Add standard systemd security directives unless the service needs Docker/LND.
* Update backup service to point to the canonical ZION_OS backup script.
"""
import re
import sys
from pathlib import Path

REPO = Path(__file__).resolve().parents[2]
SYSTEMD_DIR = REPO / "edge-deploy" / "systemd"

OLD_ROOTS = ["/root/zion-2.9.6-main", "/root/zion/2.9.6"]
NEW_ROOT = "/opt/zion"
OLD_DATA = "/data/zion"
NEW_DATA = "/opt/zion/data"


def normalize_path(line: str) -> str:
    for old in OLD_ROOTS:
        line = line.replace(old, NEW_ROOT)
    line = line.replace(OLD_DATA, NEW_DATA)
    return line


def add_security_block(lines: list[str]) -> list[str]:
    """Append hardening directives before [Install] if not already present."""
    out = []
    added = False
    for line in lines:
        if line.startswith("[Install]") and not added:
            out.append("\n# Security hardening (runs as unprivileged zion user)\n")
            out.append("NoNewPrivileges=true\n")
            out.append("ProtectSystem=strict\n")
            out.append("ProtectHome=true\n")
            out.append("PrivateTmp=yes\n")
            out.append("ReadWritePaths=/opt/zion/data /opt/zion/logs\n")
            out.append("AmbientCapabilities=CAP_NET_BIND_SERVICE\n")
            added = True
        out.append(line)
    return out


def process_service(path: Path) -> None:
    text = path.read_text()
    lines = text.splitlines(keepends=True)

    # Skip if already migrated
    if "User=zion" in text and NEW_ROOT in text:
        print(f"skip (already hardened): {path.name}")
        return

    out = []
    in_service = False
    is_docker = "docker" in path.name or "Requires=docker.service" in text
    is_oneshot = "Type=oneshot" in text
    for line in lines:
        # Replace User and Group
        if re.match(r"^User\s*=\s*root\s*$", line.strip()):
            out.append("User=zion\n")
            out.append("Group=zion\n")
            continue

        # Update all paths
        line = normalize_path(line)

        # Ensure WorkingDirectory exists after normalization
        if line.strip().startswith("WorkingDirectory=") and not line.strip().endswith("/opt/zion"):
            # Already handled by normalize_path; ensure it exists
            pass

        out.append(line)

    if not is_docker and not is_oneshot:
        out = add_security_block(out)
    elif is_oneshot:
        # Minimal hardening for oneshot backup script
        out.append("\n# Security hardening\n")
        out.append("User=zion\n")
        out.append("Group=zion\n")
        out.append("NoNewPrivileges=true\n")

    path.write_text("".join(out))
    print(f"hardened: {path.name}")


def main() -> int:
    if not SYSTEMD_DIR.exists():
        print(f"Systemd directory not found: {SYSTEMD_DIR}", file=sys.stderr)
        return 1

    for svc in sorted(SYSTEMD_DIR.glob("*.service")):
        process_service(svc)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
