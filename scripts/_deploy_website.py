#!/usr/bin/env python3
"""Deploy updated website v2.9.9 Ekam Deeksha to server.

Tars the website source (src/, public/, package.json, configs, Dockerfile),
uploads via SFTP, rebuilds Docker image, and restarts the container.
"""

import os
import sys
import tarfile
import tempfile
import time

import paramiko

HOST = "91.98.122.165"
USER = "root"
KEY_PATH = os.path.expanduser("~/.ssh/zion_hetzner_key")
REMOTE_BASE = "/root/zion-2.9.6"
LOCAL_BASE = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))

WEBSITE_DIR = os.path.join(LOCAL_BASE, "APP&WEB", "website-v2.9")
DOCKER_DIR = os.path.join(LOCAL_BASE, "docker")

# Files/dirs to include from website-v2.9
WEBSITE_INCLUDE = [
    "src",
    "public",
    "package.json",
    "package-lock.json",
    "next.config.ts",
    "tsconfig.json",
    "tailwind.config.ts",
    "postcss.config.mjs",
    "eslint.config.mjs",
    "Dockerfile",
    "Dockerfile.production",
    ".dockerignore",
]

WEBSITE_EXCLUDE_DIRS = {".next", "node_modules", ".git", "__pycache__"}


def should_exclude(path: str) -> bool:
    parts = path.replace("\\", "/").split("/")
    return any(p in WEBSITE_EXCLUDE_DIRS for p in parts)


def create_tarball(tar_path: str) -> None:
    print("[1/4] Creating tarball...")
    with tarfile.open(tar_path, "w:gz") as tar:
        # Website files
        for item in WEBSITE_INCLUDE:
            full = os.path.join(WEBSITE_DIR, item)
            if os.path.exists(full):
                arcname = f"APP&WEB/website-v2.9/{item}"
                if os.path.isdir(full):
                    for root, dirs, files in os.walk(full):
                        dirs[:] = [d for d in dirs if d not in WEBSITE_EXCLUDE_DIRS]
                        for f in files:
                            fp = os.path.join(root, f)
                            an = os.path.join(arcname, os.path.relpath(fp, full))
                            if not should_exclude(an):
                                tar.add(fp, arcname=an)
                else:
                    tar.add(full, arcname=arcname)

        # Docker compose for website
        compose_file = os.path.join(DOCKER_DIR, "docker-compose.website.yml")
        if os.path.exists(compose_file):
            tar.add(compose_file, arcname="docker/docker-compose.website.yml")

    size_mb = os.path.getsize(tar_path) / (1024 * 1024)
    print(f"   Tarball: {size_mb:.1f} MB")


def deploy(tar_path: str) -> None:
    key = paramiko.Ed25519Key.from_private_key_file(KEY_PATH)
    client = paramiko.SSHClient()
    client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    client.connect(HOST, username=USER, pkey=key, timeout=15)

    # Upload
    print("[2/4] Uploading to server...")
    sftp = client.open_sftp()
    remote_tar = f"{REMOTE_BASE}/website_update.tar.gz"
    sftp.put(tar_path, remote_tar)
    sftp.close()
    print("   Upload complete")

    def run(cmd: str, label: str, stream: bool = False) -> str:
        print(f"   {label}...")
        stdin, stdout, stderr = client.exec_command(cmd, timeout=600)
        if stream:
            output = []
            for line in stdout:
                line = line.rstrip()
                output.append(line)
                print(f"   | {line}")
            err = stderr.read().decode()
            if err.strip():
                for el in err.strip().split("\n"):
                    print(f"   ! {el}")
            return "\n".join(output)
        else:
            out = stdout.read().decode()
            err = stderr.read().decode()
            rc = stdout.channel.recv_exit_status()
            if rc != 0:
                print(f"   WARN exit={rc}")
                if err.strip():
                    for el in err.strip().split("\n")[-5:]:
                        print(f"   ! {el}")
            return out

    # Extract
    print("[3/4] Extracting on server...")
    run(f"cd {REMOTE_BASE} && tar xzf website_update.tar.gz && rm website_update.tar.gz", "Extracting")

    # Build and restart
    print("[4/4] Building and restarting website...")
    run(
        f"cd {REMOTE_BASE} && docker compose -f docker/docker-compose.website.yml down 2>&1 || true",
        "Stopping old container"
    )
    run(
        f"cd {REMOTE_BASE} && docker compose -f docker/docker-compose.website.yml build --no-cache 2>&1",
        "Building zion-website:2.9.9",
        stream=True
    )
    run(
        f"cd {REMOTE_BASE} && docker compose -f docker/docker-compose.website.yml up -d 2>&1",
        "Starting website"
    )

    # Verify
    time.sleep(10)
    result = run("docker ps --filter name=zion-website --format '{{.Status}}'", "Checking status")
    print(f"\n=== Website container: {result.strip()} ===")

    result = run("curl -s -o /dev/null -w '%{http_code}' http://127.0.0.1:3000 2>&1 || echo 'curl failed'", "Health check")
    print(f"=== HTTP status: {result.strip()} ===")

    client.close()


def main() -> None:
    with tempfile.NamedTemporaryFile(suffix=".tar.gz", delete=False) as tmp:
        tar_path = tmp.name

    try:
        create_tarball(tar_path)
        deploy(tar_path)
        print("\n✅ Website v2.9.9 Ekam Deeksha deployed successfully!")
    finally:
        if os.path.exists(tar_path):
            os.unlink(tar_path)


if __name__ == "__main__":
    main()
