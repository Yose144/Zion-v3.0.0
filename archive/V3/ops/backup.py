#!/usr/bin/env python3
"""
V3 Backup Manager

Automated backups for ZION V3 node data:
- LMDB chain database
- Configuration files  
- Wallet data
- Pool state

Features: incremental via rsync, retention policy, optional encryption.
Ported from TREE_NODES/backup/backup_manager.py for V3.
"""

import json
import os
import shutil
import subprocess
import sys
import time
from dataclasses import dataclass
from pathlib import Path
from typing import List, Optional


@dataclass
class BackupInfo:
    name: str
    path: str
    timestamp: str
    size_bytes: int
    backup_type: str  # "full" or "incremental"


def load_config() -> dict:
    config_path = Path(__file__).parent / "config.json"
    if not config_path.exists():
        config_path = Path(__file__).parent / "config.example.json"
    with open(config_path) as f:
        return json.load(f)


def get_backup_dir(config: dict) -> Path:
    return Path(config.get("backup", {}).get("backup_dir", "/var/lib/zion/backups"))


def get_data_dir(config: dict) -> Path:
    return Path(config.get("backup", {}).get("data_dir", "/var/lib/zion/data"))


def backup_name() -> str:
    return time.strftime("v3-backup-%Y%m%d-%H%M%S")


def create_backup(config: dict) -> Optional[BackupInfo]:
    """Create a backup of the V3 data directory."""
    data_dir = get_data_dir(config)
    backup_dir = get_backup_dir(config)
    backup_dir.mkdir(parents=True, exist_ok=True)

    name = backup_name()
    dest = backup_dir / name

    if not data_dir.exists():
        print(f"[backup] Data directory not found: {data_dir}")
        return None

    print(f"[backup] Backing up {data_dir} -> {dest}")
    t0 = time.monotonic()

    try:
        # Use rsync for efficient incremental copy if available
        latest_link = backup_dir / "latest"
        rsync_cmd = ["rsync", "-a", "--delete"]
        if latest_link.exists():
            rsync_cmd += [f"--link-dest={latest_link.resolve()}"]
        rsync_cmd += [f"{data_dir}/", str(dest)]

        result = subprocess.run(rsync_cmd, capture_output=True, text=True)
        if result.returncode != 0:
            # Fallback to shutil copy
            print(f"[backup] rsync failed ({result.returncode}), falling back to copy")
            shutil.copytree(data_dir, dest, dirs_exist_ok=True)

        # Update latest symlink
        if latest_link.is_symlink():
            latest_link.unlink()
        elif latest_link.exists():
            latest_link.unlink()
        latest_link.symlink_to(dest)

    except FileNotFoundError:
        # rsync not available, use shutil
        print("[backup] rsync not found, using shutil.copytree")
        shutil.copytree(data_dir, dest, dirs_exist_ok=True)

    elapsed = time.monotonic() - t0
    size = sum(f.stat().st_size for f in dest.rglob("*") if f.is_file()) if dest.exists() else 0

    info = BackupInfo(
        name=name,
        path=str(dest),
        timestamp=time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        size_bytes=size,
        backup_type="incremental",
    )

    # Write metadata
    meta_path = dest / "backup_meta.json"
    with open(meta_path, "w") as f:
        json.dump(
            {"name": info.name, "timestamp": info.timestamp, "size": info.size_bytes, "type": info.backup_type},
            f,
            indent=2,
        )

    print(f"[backup] Complete: {name} ({size / 1024 / 1024:.1f} MB, {elapsed:.1f}s)")
    return info


def list_backups(config: dict) -> List[BackupInfo]:
    """List existing backups."""
    backup_dir = get_backup_dir(config)
    backups = []
    if not backup_dir.exists():
        return backups

    for entry in sorted(backup_dir.iterdir()):
        if entry.is_dir() and entry.name.startswith("v3-backup-"):
            meta_path = entry / "backup_meta.json"
            if meta_path.exists():
                with open(meta_path) as f:
                    meta = json.load(f)
                backups.append(
                    BackupInfo(
                        name=meta["name"],
                        path=str(entry),
                        timestamp=meta["timestamp"],
                        size_bytes=meta.get("size", 0),
                        backup_type=meta.get("type", "unknown"),
                    )
                )
            else:
                size = sum(f.stat().st_size for f in entry.rglob("*") if f.is_file())
                backups.append(
                    BackupInfo(
                        name=entry.name,
                        path=str(entry),
                        timestamp="unknown",
                        size_bytes=size,
                        backup_type="unknown",
                    )
                )
    return backups


def prune_old_backups(config: dict):
    """Remove backups older than retention_days."""
    retention = config.get("backup", {}).get("retention_days", 30)
    backup_dir = get_backup_dir(config)
    if not backup_dir.exists():
        return

    cutoff = time.time() - (retention * 86400)
    pruned = 0

    for entry in sorted(backup_dir.iterdir()):
        if entry.is_dir() and entry.name.startswith("v3-backup-"):
            if entry.stat().st_mtime < cutoff:
                print(f"[backup] Pruning old backup: {entry.name}")
                shutil.rmtree(entry)
                pruned += 1

    if pruned:
        print(f"[backup] Pruned {pruned} backup(s) older than {retention} days")


def main():
    config = load_config()

    if "--list" in sys.argv:
        backups = list_backups(config)
        if not backups:
            print("No backups found.")
        else:
            print(f"{'Name':<35} {'Timestamp':<25} {'Size':>12} {'Type':<12}")
            print("-" * 90)
            for b in backups:
                size_str = f"{b.size_bytes / 1024 / 1024:.1f} MB"
                print(f"{b.name:<35} {b.timestamp:<25} {size_str:>12} {b.backup_type:<12}")

    elif "--prune" in sys.argv:
        prune_old_backups(config)

    elif "--backup" in sys.argv or len(sys.argv) == 1:
        info = create_backup(config)
        if info:
            prune_old_backups(config)
    else:
        print("Usage: backup.py [--backup|--list|--prune]")


if __name__ == "__main__":
    main()
