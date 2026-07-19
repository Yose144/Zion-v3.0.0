#!/usr/bin/env python3
"""
DEPRECATED — do not use.

This script used to rewrite systemd service files in-place, but it was unsafe:
it could demote zion-edge-watchdog.service to User=zion (breaking service
restarts) and append directives outside of valid [Service] sections.

Use the canonical service files in edge-deploy/systemd/ and edit them manually
or via the deployment scripts instead.
"""
import sys


def main() -> int:
    print("harden-edge-systemd.py is deprecated and does nothing.", file=sys.stderr)
    print(
        "Use the canonical edge-deploy/systemd/ service files instead.",
        file=sys.stderr,
    )
    return 1


if __name__ == "__main__":
    raise SystemExit(main())
