"""
Full sync deploy: tar + SFTP + untar on server.
Uploads entire L1/, docker/, config/, Cargo.toml, Cargo.lock.
"""
import paramiko
import tarfile
import os
import io
import sys
import time

HOST = "91.98.122.165"
USER = "root"
KEY_FILE = os.path.expanduser(r"~\.ssh\zion_hetzner_key")
LOCAL_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
REMOTE_ROOT = "/root/zion-2.9.6"

# Directories/files to sync (relative to LOCAL_ROOT)
SYNC_DIRS = ["L1", "docker", "config"]
SYNC_FILES_TOP = ["Cargo.toml", "Cargo.lock"]

# Exclude patterns
EXCLUDE = {"target", ".git", "node_modules", "__pycache__", "Zion-2.9.5-main"}


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
    stdin, stdout, stderr = client.exec_command(cmd, timeout=900)
    if stream:
        for line in stdout:
            sys.stdout.write(line)
            sys.stdout.flush()
        for line in stderr:
            sys.stderr.write(line)
            sys.stderr.flush()
    else:
        out = stdout.read().decode()
        err = stderr.read().decode()
        if out:
            print(out.rstrip())
        if err:
            print("STDERR:", err.rstrip(), file=sys.stderr)
    return stdout.channel.recv_exit_status()


def should_exclude(path):
    parts = path.replace("\\", "/").split("/")
    return any(p in EXCLUDE for p in parts)


def create_tar():
    """Create in-memory tar.gz of needed files."""
    buf = io.BytesIO()
    count = 0
    with tarfile.open(fileobj=buf, mode="w:gz") as tar:
        for d in SYNC_DIRS:
            base = os.path.join(LOCAL_ROOT, d)
            if not os.path.isdir(base):
                print(f"  SKIP dir (not found): {d}")
                continue
            for root, dirs, files in os.walk(base):
                # Filter excluded dirs in-place
                dirs[:] = [dd for dd in dirs if dd not in EXCLUDE]
                for f in files:
                    full = os.path.join(root, f)
                    rel = os.path.relpath(full, LOCAL_ROOT).replace("\\", "/")
                    if should_exclude(rel):
                        continue
                    tar.add(full, arcname=rel)
                    count += 1
        for f in SYNC_FILES_TOP:
            full = os.path.join(LOCAL_ROOT, f)
            if os.path.exists(full):
                tar.add(full, arcname=f)
                count += 1
    buf.seek(0)
    size_mb = len(buf.getvalue()) / (1024 * 1024)
    print(f"  Archive: {count} files, {size_mb:.1f} MB")
    return buf


def main():
    print("=" * 60)
    print("ZION Tier 1+2 Full Sync Deploy")
    print(f"Host: {HOST}")
    print(f"Features: testnet (NPU_EPOCH_LENGTH=100)")
    print("=" * 60)

    client = ssh_connect()
    print("\n[1/6] Connected")

    print("\n[2/6] Creating tar archive...")
    t0 = time.time()
    tar_buf = create_tar()
    print(f"  Done in {time.time()-t0:.1f}s")

    print("\n[3/6] Uploading to server...")
    sftp = client.open_sftp()
    remote_tar = f"{REMOTE_ROOT}/_deploy.tar.gz"
    sftp.putfo(tar_buf, remote_tar)
    print(f"  Uploaded to {remote_tar}")
    sftp.close()

    print("\n[4/6] Extracting on server...")
    ssh_exec(client, f"cd {REMOTE_ROOT} && tar xzf _deploy.tar.gz && rm _deploy.tar.gz && echo 'EXTRACT_OK'")

    # Quick verify
    ssh_exec(client, f"ls {REMOTE_ROOT}/L1/cosmic-harmony/src/hugepages.rs && echo 'HUGEPAGES_OK'")

    print("\n[5/6] Stopping old testnet stack...")
    ssh_exec(client, f"cd {REMOTE_ROOT} && docker compose -f docker/docker-compose.testnet.yml down --remove-orphans 2>&1 || true")

    print("\n[6/6] Building images with testnet feature...")
    print("  (This will take several minutes...)")
    rc = ssh_exec(client,
        f"cd {REMOTE_ROOT} && docker compose -f docker/docker-compose.testnet.yml build --no-cache core pool miner 2>&1",
        stream=True)

    if rc != 0:
        print(f"\n!!! BUILD FAILED (exit {rc})")
        client.close()
        sys.exit(1)

    print("\n--- Starting stack ---")
    ssh_exec(client, f"cd {REMOTE_ROOT} && docker compose -f docker/docker-compose.testnet.yml up -d 2>&1")

    print("\n=== Status ===")
    ssh_exec(client, "docker ps --format 'table {{.Names}}\t{{.Status}}\t{{.Image}}'")

    print("\n=== Chain stats ===")
    ssh_exec(client, "sleep 5 && curl -s http://localhost:8444/stats 2>/dev/null | python3 -m json.tool || echo 'RPC not ready yet'")

    client.close()
    print("\n=== Deploy complete ===")


if __name__ == "__main__":
    main()
