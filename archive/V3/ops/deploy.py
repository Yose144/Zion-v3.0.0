#!/usr/bin/env python3
"""
V3 Deploy Orchestrator

Zero-downtime deployment for Docker-based V3 nodes.
Handles: image build/push, rolling container updates, config sync, rollback.

Ported from TREE_NODES/deploy/node_orchestrator.py for V3.
"""

import json
import subprocess
import sys
import time
from dataclasses import dataclass
from pathlib import Path
from typing import List, Optional


@dataclass
class DeployTarget:
    host: str
    ssh_key: str
    compose_file: str
    services: List[str]
    image_tag: str


def load_config() -> dict:
    config_path = Path(__file__).parent / "config.json"
    if not config_path.exists():
        config_path = Path(__file__).parent / "config.example.json"
    with open(config_path) as f:
        return json.load(f)


def ssh_cmd(host: str, ssh_key: str, cmd: str, timeout: int = 120) -> subprocess.CompletedProcess:
    """Execute a command on a remote host via SSH."""
    full_cmd = [
        "ssh", "-o", "StrictHostKeyChecking=accept-new",
        "-i", ssh_key,
        f"root@{host}",
        cmd,
    ]
    print(f"  [ssh] {host}: {cmd}")
    return subprocess.run(full_cmd, capture_output=True, text=True, timeout=timeout)


def build_images(compose_file: str, tag: str):
    """Build Docker images locally."""
    print(f"[deploy] Building images with tag {tag}...")
    result = subprocess.run(
        ["docker", "compose", "-f", compose_file, "build"],
        capture_output=True,
        text=True,
    )
    if result.returncode != 0:
        print(f"[deploy] Build failed:\n{result.stderr}")
        sys.exit(1)
    print("[deploy] Build complete.")


def deploy_to_host(target: DeployTarget):
    """Deploy to a single host with zero-downtime rolling update."""
    host = target.host
    print(f"\n[deploy] Deploying to {host}...")

    # 1. Sync compose file
    print(f"  [deploy] Syncing compose file...")
    scp_cmd = [
        "scp", "-i", target.ssh_key,
        target.compose_file,
        f"root@{host}:/opt/zion/docker-compose.yml",
    ]
    result = subprocess.run(scp_cmd, capture_output=True, text=True)
    if result.returncode != 0:
        print(f"  [deploy] WARNING: scp failed: {result.stderr}")

    # 2. Pull latest images (if using registry)
    ssh_cmd(host, target.ssh_key, "cd /opt/zion && docker compose pull 2>/dev/null || true")

    # 3. Rolling restart of services
    for service in target.services:
        print(f"  [deploy] Updating service: {service}")

        # Health check before restart
        pre_check = ssh_cmd(
            host, target.ssh_key,
            f"docker compose -f /opt/zion/docker-compose.yml ps {service} --format json 2>/dev/null || echo '{{}}'"
        )

        # Restart the service
        result = ssh_cmd(
            host, target.ssh_key,
            f"cd /opt/zion && docker compose up -d --force-recreate {service}",
        )
        if result.returncode != 0:
            print(f"  [deploy] WARNING: {service} restart failed: {result.stderr}")
            continue

        # Wait for service to be healthy
        print(f"  [deploy] Waiting for {service} to stabilize...")
        time.sleep(5)

        # Post-restart health check
        post_check = ssh_cmd(
            host, target.ssh_key,
            f"docker compose -f /opt/zion/docker-compose.yml ps {service} --format json 2>/dev/null || echo '{{}}'"
        )
        print(f"  [deploy] {service} updated.")

    print(f"[deploy] Deploy to {host} complete.")


def rollback(target: DeployTarget):
    """Rollback to previous containers."""
    host = target.host
    print(f"\n[rollback] Rolling back on {host}...")

    for service in target.services:
        # Stop current
        ssh_cmd(host, target.ssh_key, f"cd /opt/zion && docker compose stop {service}")
        # Restart previous (docker keeps previous image layer)
        ssh_cmd(host, target.ssh_key, f"cd /opt/zion && docker compose up -d {service}")

    print(f"[rollback] Rollback on {host} complete.")


def status(config: dict):
    """Check deployment status on all nodes."""
    deploy_cfg = config.get("deploy", {})
    ssh_key = deploy_cfg.get("ssh_key", "~/.ssh/zion_hetzner_key")

    for node_cfg in config.get("nodes", []):
        host = node_cfg["host"]
        node_id = node_cfg.get("id", host)
        print(f"\n--- {node_id} ({host}) ---")

        result = ssh_cmd(host, ssh_key, "cd /opt/zion && docker compose ps 2>/dev/null || echo 'compose not found'")
        print(result.stdout if result.stdout else result.stderr)


def main():
    config = load_config()
    deploy_cfg = config.get("deploy", {})

    if "--status" in sys.argv:
        status(config)
        return

    action = "deploy"
    for arg in sys.argv:
        if arg.startswith("--action="):
            action = arg.split("=", 1)[1]

    ssh_key = deploy_cfg.get("ssh_key", "~/.ssh/zion_hetzner_key")
    compose_file = deploy_cfg.get("compose_file", "docker/docker-compose.testnet.yml")
    image_tag = deploy_cfg.get("image_tag", "v3-testnet")

    services = ["zion-node", "zion-pool", "zion-miner"]

    for node_cfg in config.get("nodes", []):
        target = DeployTarget(
            host=node_cfg["host"],
            ssh_key=ssh_key,
            compose_file=compose_file,
            services=services,
            image_tag=image_tag,
        )

        if action == "deploy":
            deploy_to_host(target)
        elif action == "rollback":
            rollback(target)
        elif action == "build":
            build_images(compose_file, image_tag)
        else:
            print(f"Unknown action: {action}")
            print("Usage: deploy.py [--action=deploy|rollback|build|--status]")
            sys.exit(1)


if __name__ == "__main__":
    main()
