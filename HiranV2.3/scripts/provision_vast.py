#!/usr/bin/env python3
"""
Hiran v2.3 Vast.ai Provisioning Script
=======================================
Automates renting a GPU instance on Vast.ai for full fine-tuning.

Usage:
    # Search and provision best instance
    python scripts/provision_vast.py --gpus 4 --gpu_name "A100" --gpu_ram 80

    # Dry run (show what would be rented without actually doing it)
    python scripts/provision_vast.py --dry_run

    # Sync data after provisioning
    python scripts/provision_vast.py --sync --contract_id 12345

Requirements:
    pip install vastai
    vastai login  # or set VASTAI_API_KEY env var
"""

from __future__ import annotations

import argparse
import json
import os
import subprocess
import sys
import time
from pathlib import Path
from typing import Any

# ---------------------------------------------------------------------------
# CONFIGURATION
# ---------------------------------------------------------------------------

DEFAULT_CONFIG = {
    "image": "nvidia/cuda:12.1.0-devel-ubuntu22.04",
    "disk_space": 200,  # GB
    "onstart": "",  # startup script
}

SSH_KEY_PATH = Path.home() / ".ssh" / "vast_hiran_key"
REMOTE_DIR = "/workspace/hiran-v2.3"


# ---------------------------------------------------------------------------
# VAST.AI CLI WRAPPER
# ---------------------------------------------------------------------------

def vast_cli(cmd: list[str]) -> dict[str, Any] | list[Any]:
    """Run a vastai CLI command and parse JSON output."""
    full_cmd = ["vastai"] + cmd + ["--raw"]
    try:
        result = subprocess.run(
            full_cmd,
            capture_output=True,
            text=True,
            check=True,
        )
        return json.loads(result.stdout)
    except subprocess.CalledProcessError as e:
        print(f"ERROR: vastai command failed: {' '.join(full_cmd)}")
        print(f"  stderr: {e.stderr}")
        sys.exit(1)
    except json.JSONDecodeError as e:
        print(f"ERROR: Failed to parse vastai output: {e}")
        print(f"  stdout: {result.stdout[:500]}")
        sys.exit(1)


def search_offers(gpus: int = 4, gpu_name: str = "A100", gpu_ram: float = 80,
                  min_inet: float = 1000.0) -> list[dict[str, Any]]:
    """Search Vast.ai offers matching requirements."""
    print(f"Searching for {gpus}x {gpu_name} {gpu_ram}GB with >={min_inet} Mbps internet...")

    # Build query
    query_parts = [
        f"num_gpus>={gpus}",
        f"gpu_name={gpu_name}",
        f"gpu_ram>={gpu_ram}",
        f"inet_up>={min_inet}",
        f"inet_down>={min_inet}",
        "cuda_vers>=12",
        "verified=any",  # Include verified and unverified
    ]
    query = " ".join(query_parts)

    offers = vast_cli(["search", "offers", query])
    if not isinstance(offers, list):
        offers = [offers] if offers else []

    # Sort by price (DLPerf / $ is often a good proxy, but we'll sort by total$/hour)
    offers.sort(key=lambda x: x.get("dph_total", float("inf")))

    print(f"  Found {len(offers)} matching offers")
    for i, o in enumerate(offers[:5]):
        print(f"    {i+1}. {o.get('gpu_name', '???')} x{o.get('num_gpus', '?')} "
              f"@ ${o.get('dph_total', 0):.2f}/hr "
              f"({o.get('inet_up', 0):.0f}↑/{o.get('inet_down', 0):.0f}↓ Mbps) "
              f"[{o.get('id', '?')}]")

    return offers


def create_instance(offer_id: int, config: dict[str, Any]) -> dict[str, Any]:
    """Create an instance from an offer."""
    print(f"\nCreating instance from offer {offer_id}...")

    args = [
        "create", "instance", str(offer_id),
        "--image", config["image"],
        "--disk", str(config["disk_space"]),
    ]
    if config.get("onstart"):
        args += ["--onstart", config["onstart"]]

    result = vast_cli(args)
    print(f"  Instance created: contract_id={result.get('id') or result.get('contract_id')}")
    return result


def attach_ssh_key(contract_id: int, ssh_key_path: Path) -> None:
    """Attach SSH public key to instance."""
    pub_key = ssh_key_path.with_suffix(".pub")
    if not pub_key.exists():
        print(f"WARNING: SSH public key not found: {pub_key}")
        print(f"  Generating new key pair...")
        ssh_key_path.parent.mkdir(parents=True, exist_ok=True)
        subprocess.run(
            ["ssh-keygen", "-t", "ed25519", "-f", str(ssh_key_path), "-N", "", "-C", "hiran@vast.ai"],
            check=True,
        )

    print(f"Attaching SSH key {pub_key} to instance {contract_id}...")
    vast_cli(["attach", "ssh", str(contract_id), str(pub_key)])
    print("  SSH key attached")


def wait_for_instance(contract_id: int, timeout: int = 300) -> dict[str, Any]:
    """Wait for instance to become running and return SSH info."""
    print(f"\nWaiting for instance {contract_id} to start (timeout: {timeout}s)...")
    start = time.time()

    while time.time() - start < timeout:
        instances = vast_cli(["show", "instances"])
        if not isinstance(instances, list):
            instances = [instances] if instances else []

        for inst in instances:
            if inst.get("id") == contract_id or inst.get("contract_id") == contract_id:
                status = inst.get("actual_status", inst.get("intended_status", "unknown"))
                print(f"  Status: {status}")

                if status == "running":
                    ssh_host = inst.get("ssh_host", "")
                    ssh_port = inst.get("ssh_port", 22)
                    if ssh_host:
                        print(f"  Instance ready!")
                        print(f"  SSH: ssh -p {ssh_port} root@{ssh_host}")
                        return inst

                break
        else:
            print("  Instance not found in list yet...")

        time.sleep(10)

    print("ERROR: Timeout waiting for instance to start")
    sys.exit(1)


def sync_to_vast(contract_id: int, ssh_host: str, ssh_port: int) -> None:
    """Sync local HiranV2.3 to remote instance."""
    print(f"\nSyncing HiranV2.3 to remote instance...")

    ssh_key = SSH_KEY_PATH
    ssh_opts = f"-i {ssh_key} -p {ssh_port} -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null"

    # Create remote dir
    subprocess.run(
        ["ssh", *ssh_opts.split(), f"root@{ssh_host}", f"mkdir -p {REMOTE_DIR}"],
        check=True,
    )

    # Sync
    repo_root = Path(__file__).resolve().parents[2]
    subprocess.run(
        [
            "rsync", "-avz", "--progress",
            "--exclude=__pycache__",
            "--exclude=*.pyc",
            "--exclude=checkpoints",
            "--exclude=logs",
            "--exclude=tensorboard",
            "--exclude=models",
            "--exclude=knowledge/vector_db",
            "-e", f"ssh {ssh_opts}",
            str(repo_root / "HiranV2.3" / "") + "/",
            f"root@{ssh_host}:{REMOTE_DIR}/",
        ],
        check=True,
    )

    print("  Sync complete!")


def setup_environment(ssh_host: str, ssh_port: int) -> None:
    """Install dependencies on remote instance."""
    print("\nSetting up remote environment...")

    ssh_key = SSH_KEY_PATH
    ssh_opts = f"-i {ssh_key} -p {ssh_port} -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null"

    # Install Python, git, and training deps
    setup_script = f"""
set -e
cd {REMOTE_DIR}

# Install system deps
apt-get update -qq
apt-get install -y -qq python3-pip python3-venv git wget

# Create venv
python3 -m venv venv
source venv/bin/activate

# Install training dependencies
pip install -q --upgrade pip
pip install -q -r requirements-train.txt

# Verify
python3 -c "import torch; import deepspeed; print(f'PyTorch {{torch.__version__}} CUDA={{torch.cuda.is_available()}}')"
python3 -c "import transformers; print(f'Transformers {{transformers.__version__}}')"

# Pre-download base model (optional but recommended)
# huggingface-cli download nvidia/OpenReasoning-Nemotron-32B --local-dir models/base --local-dir-use-symlinks False

echo "Environment setup complete!"
"""

    subprocess.run(
        ["ssh", *ssh_opts.split(), f"root@{ssh_host}", setup_script],
        check=True,
    )

    print("  Remote environment ready!")


# ---------------------------------------------------------------------------
# MAIN
# ---------------------------------------------------------------------------

def main():
    parser = argparse.ArgumentParser(description="Provision Vast.ai instance for Hiran v2.3 training")
    parser.add_argument("--gpus", type=int, default=4, help="Number of GPUs (default: 4)")
    parser.add_argument("--gpu_name", type=str, default="A100", help="GPU name (default: A100)")
    parser.add_argument("--gpu_ram", type=float, default=80, help="GPU RAM in GB (default: 80)")
    parser.add_argument("--min_inet", type=float, default=1000, help="Minimum internet speed in Mbps (default: 1000)")
    parser.add_argument("--dry_run", action="store_true", help="Show what would be rented without creating instance")
    parser.add_argument("--contract_id", type=int, help="Existing contract ID to sync/setup")
    parser.add_argument("--sync", action="store_true", help="Sync data to existing instance")
    parser.add_argument("--setup", action="store_true", help="Setup environment on existing instance")
    args = parser.parse_args()

    # Check vastai CLI
    if not args.dry_run and not args.contract_id:
        try:
            subprocess.run(["vastai", "--version"], capture_output=True, check=True)
        except FileNotFoundError:
            print("ERROR: vastai CLI not found. Install with: pip install vastai")
            print("  Then login: vastai login")
            sys.exit(1)

    # Handle existing instance
    if args.contract_id:
        print(f"Using existing contract: {args.contract_id}")
        inst = wait_for_instance(args.contract_id, timeout=60)
        ssh_host = inst["ssh_host"]
        ssh_port = inst.get("ssh_port", 22)

        if args.sync:
            sync_to_vast(args.contract_id, ssh_host, ssh_port)
        if args.setup:
            setup_environment(ssh_host, ssh_port)

        print("\n" + "=" * 60)
        print("EXISTING INSTANCE")
        print("=" * 60)
        print(f"Contract ID: {args.contract_id}")
        print(f"SSH: ssh -p {ssh_port} root@{ssh_host}")
        print(f"Remote dir: {REMOTE_DIR}")
        print(f"\nTo start training:")
        print(f"  ssh -p {ssh_port} -i {SSH_KEY_PATH} root@{ssh_host}")
        print(f"  cd {REMOTE_DIR}")
        print(f"  bash scripts/run_training_fullft.sh")
        return

    # Search offers
    offers = search_offers(args.gpus, args.gpu_name, args.gpu_ram, args.min_inet)

    if not offers:
        print("\nWARNING: No offers found with exact requirements.")
        print("  Trying fallback: 2x A100 80GB...")
        offers = search_offers(gpus=2, gpu_name="A100", gpu_ram=80, min_inet=args.min_inet)

        if not offers:
            print("  Trying fallback: any 4x GPU with >=40GB RAM...")
            offers = search_offers(gpus=4, gpu_name="", gpu_ram=40, min_inet=500)

        if not offers:
            print("ERROR: No suitable offers found.")
            sys.exit(1)

    best = offers[0]
    offer_id = best["id"]
    print(f"\nBest offer: {best.get('gpu_name', '???')} x{best.get('num_gpus', '?')} "
          f"@ ${best.get('dph_total', 0):.2f}/hr")

    if args.dry_run:
        print("\nDRY RUN — instance NOT created.")
        print("Remove --dry_run to provision.")
        return

    # Create instance
    contract = create_instance(offer_id, DEFAULT_CONFIG)
    contract_id = contract.get("id") or contract.get("contract_id")

    # Attach SSH
    attach_ssh_key(contract_id, SSH_KEY_PATH)

    # Wait for start
    inst = wait_for_instance(contract_id)
    ssh_host = inst["ssh_host"]
    ssh_port = inst.get("ssh_port", 22)

    # Sync
    sync_to_vast(contract_id, ssh_host, ssh_port)

    # Setup environment
    setup_environment(ssh_host, ssh_port)

    # Final report
    print("\n" + "=" * 60)
    print("PROVISIONING COMPLETE")
    print("=" * 60)
    print(f"Contract ID: {contract_id}")
    print(f"GPU: {best.get('gpu_name', '???')} x{best.get('num_gpus', '?')}")
    print(f"Cost: ${best.get('dph_total', 0):.2f}/hr")
    print(f"SSH: ssh -p {ssh_port} -i {SSH_KEY_PATH} root@{ssh_host}")
    print(f"Remote dir: {REMOTE_DIR}")
    print("")
    print("To start training:")
    print(f"  ssh -p {ssh_port} -i {SSH_KEY_PATH} root@{ssh_host}")
    print(f"  cd {REMOTE_DIR}")
    print(f"  bash scripts/run_training_fullft.sh")
    print("")
    print("To monitor:")
    print(f"  tail -f {REMOTE_DIR}/logs/training_*.log")
    print("")
    print("To destroy when done:")
    print(f"  vastai destroy instance {contract_id}")

    # Save connection info
    info = {
        "contract_id": contract_id,
        "ssh_host": ssh_host,
        "ssh_port": ssh_port,
        "ssh_key": str(SSH_KEY_PATH),
        "remote_dir": REMOTE_DIR,
        "gpu_name": best.get("gpu_name"),
        "num_gpus": best.get("num_gpus"),
        "cost_per_hour": best.get("dph_total"),
        "created_at": time.strftime("%Y-%m-%dT%H:%M:%S"),
    }
    info_path = Path("vast_instance_info.json")
    with open(info_path, "w") as f:
        json.dump(info, f, indent=2)
    print(f"\nInstance info saved to: {info_path}")


if __name__ == "__main__":
    main()
