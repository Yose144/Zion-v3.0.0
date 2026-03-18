"""
Deploy Tier 1+2 ASIC resistance to canary via paramiko SFTP + SSH.
Bypasses VS Code getsockname SSH bug.
"""
import paramiko
import os
import stat
import sys

HOST = "91.98.122.165"
USER = "root"
KEY_FILE = os.path.expanduser(r"~\.ssh\zion_hetzner_key")
LOCAL_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
REMOTE_ROOT = "/root/zion-2.9.6"

# Files that changed in Tier 1+2 + testnet commits
SYNC_FILES = [
    # Cosmic Harmony (Tier 1+2 core changes)
    "L1/cosmic-harmony/Cargo.toml",
    "L1/cosmic-harmony/src/algorithms_npu.rs",
    "L1/cosmic-harmony/src/algorithms_opt.rs",
    "L1/cosmic-harmony/src/deeksha.rs",
    "L1/cosmic-harmony/src/lib.rs",
    "L1/cosmic-harmony/src/scratchpad_ekam.rs",
    "L1/cosmic-harmony/build.rs",
    # Miner
    "L1/miner/Cargo.toml",
    "L1/miner/src/miner/native_algos.rs",
    "L1/miner/src/miner/gpu/kernels/cosmic_harmony_deeksha.cl",
    "L1/miner/src/miner/gpu/kernels/cosmic_harmony_v3.cl",
    "L1/miner/src/miner/gpu/kernels/cosmic_harmony_v3.cu",
    # Pool
    "L1/pool/Cargo.toml",
    "L1/pool/tests/chv4_e2e.rs",
    # Core
    "L1/core/Cargo.toml",
    # Docker
    "docker/Dockerfile.core",
    "docker/Dockerfile.miner",
    "docker/Dockerfile.pool",
    "docker/docker-compose.testnet.yml",
    # Workspace
    "Cargo.toml",
    "Cargo.lock",
]


def ssh_connect():
    try:
        key = paramiko.Ed25519Key.from_private_key_file(KEY_FILE)
    except Exception:
        key = paramiko.RSAKey.from_private_key_file(KEY_FILE)
    client = paramiko.SSHClient()
    client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    client.connect(HOST, username=USER, pkey=key, timeout=15)
    return client


def ssh_exec(client, cmd, stream=False):
    print(f"  > {cmd}")
    stdin, stdout, stderr = client.exec_command(cmd, timeout=600)
    if stream:
        for line in stdout:
            print(line, end="")
        for line in stderr:
            print(line, end="", file=sys.stderr)
    else:
        out = stdout.read().decode()
        err = stderr.read().decode()
        if out:
            print(out)
        if err:
            print("STDERR:", err, file=sys.stderr)
    return stdout.channel.recv_exit_status()


def sftp_mkdir_p(sftp, remote_dir):
    """Recursively create remote directories."""
    dirs_to_create = []
    d = remote_dir
    while d and d != "/":
        try:
            sftp.stat(d)
            break
        except FileNotFoundError:
            dirs_to_create.append(d)
            d = os.path.dirname(d)
    for d in reversed(dirs_to_create):
        try:
            sftp.mkdir(d)
        except IOError:
            pass


def upload_files(client):
    sftp = client.open_sftp()
    uploaded = 0
    skipped = 0
    for rel_path in SYNC_FILES:
        local_path = os.path.join(LOCAL_ROOT, rel_path.replace("/", os.sep))
        remote_path = f"{REMOTE_ROOT}/{rel_path}"
        if not os.path.exists(local_path):
            print(f"  SKIP (not found locally): {rel_path}")
            skipped += 1
            continue
        remote_dir = os.path.dirname(remote_path).replace("\\", "/")
        sftp_mkdir_p(sftp, remote_dir)
        sftp.put(local_path, remote_path)
        uploaded += 1
        print(f"  PUT {rel_path}")
    sftp.close()
    print(f"\nUploaded {uploaded} files, skipped {skipped}")


def main():
    print("=" * 60)
    print("ZION Tier 1+2 Canary Deploy (paramiko)")
    print(f"Host: {HOST}")
    print(f"Features: testnet (NPU_EPOCH_LENGTH=100)")
    print("=" * 60)

    client = ssh_connect()
    print("\n[1/5] Connected to server")

    print("\n[2/5] Uploading changed files...")
    upload_files(client)

    print("\n[3/5] Stopping existing testnet stack...")
    ssh_exec(client, f"cd {REMOTE_ROOT} && docker compose -f docker/docker-compose.testnet.yml down --remove-orphans 2>&1 || true")

    print("\n[4/5] Building images with testnet feature (this takes a while)...")
    rc = ssh_exec(client, f"cd {REMOTE_ROOT} && docker compose -f docker/docker-compose.testnet.yml build --no-cache core pool miner 2>&1", stream=True)
    if rc != 0:
        print(f"\nBUILD FAILED (exit {rc}). Check output above.")
        client.close()
        sys.exit(1)

    print("\n[5/5] Starting canary stack...")
    ssh_exec(client, f"cd {REMOTE_ROOT} && docker compose -f docker/docker-compose.testnet.yml up -d 2>&1")

    print("\n=== Status ===")
    ssh_exec(client, "docker ps --format 'table {{.Names}}\t{{.Status}}\t{{.Image}}'")

    print("\n=== Chain stats ===")
    ssh_exec(client, "curl -s http://localhost:8444/stats 2>/dev/null | python3 -m json.tool || echo 'RPC not ready yet'")

    client.close()
    print("\n=== Deploy complete ===")
    print("Monitor: python scripts/_ssh_test.py \"docker logs -f zion-miner 2>&1 | tail -50\"")


if __name__ == "__main__":
    main()
