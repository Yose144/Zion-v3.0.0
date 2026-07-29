#!/usr/bin/env python3
"""
Autonomous Contabo VPS reinstall + new SSH key for the Edge server.

This script runs on the operator's Mac. It:
  1. Reads Contabo API credentials from ~/.contabo-api-creds.json
  2. Generates/finds the new post-wipe SSH key and root password
  3. Calls the Contabo API to reinstall the VPS with:
       - Ubuntu 24.04
       - new public SSH key attached as a Contabo secret
       - root password attached as a Contabo secret
       - cloud-init that disables password auth and locks down sshd
  4. Waits for the server to come back and verifies SSH on port 2222

Credentials file format (~/.contabo-api-creds.json, chmod 600):
{
    "client_id": "...",
    "client_secret": "...",
    "api_user": "...",
    "api_password": "..."
}
"""

import base64
import json
import os
import re
import subprocess
import sys
import time
import uuid
from pathlib import Path

import requests

EDGE_IP = "62.171.141.136"
EDGE_HOSTNAME = "vmi3425821.contaboserver.net"
NEW_KEY = Path.home() / ".ssh" / "zion-edge-post-wipe-2026-07-29"
NEW_PUB = NEW_KEY.with_suffix(NEW_KEY.suffix + ".pub")
ROOT_PASS_FILE = Path.home() / ".zion-edge-post-wipe-root-pass"
CREDS_FILE = Path.home() / ".contabo-api-creds.json"

AUTH_URL = "https://auth.contabo.com/auth/realms/contabo/protocol/openid-connect/token"
API_BASE = "https://api.contabo.com/v1"


def fail(msg):
    print(f"[ERROR] {msg}", file=sys.stderr)
    sys.exit(1)


def load_creds():
    if not CREDS_FILE.exists():
        fail(f"Missing credentials file: {CREDS_FILE}\n"
             "Create it from the Contabo Customer Control Panel:\n"
             "  ClientId, ClientSecret, API User (email), API Password")
    with CREDS_FILE.open() as f:
        return json.load(f)


def get_token(creds):
    resp = requests.post(
        AUTH_URL,
        data={
            "grant_type": "password",
            "client_id": creds["client_id"],
            "client_secret": creds["client_secret"],
            "username": creds["api_user"],
            "password": creds["api_password"],
        },
    )
    resp.raise_for_status()
    return resp.json()["access_token"]


def api_headers(token):
    return {
        "Authorization": f"Bearer {token}",
        "x-request-id": str(uuid.uuid4()),
        "Content-Type": "application/json",
    }


def find_instance(token):
    resp = requests.get(f"{API_BASE}/compute/instances", headers=api_headers(token))
    resp.raise_for_status()
    data = resp.json().get("data", [])
    for inst in data:
        if inst.get("ipv4") == EDGE_IP:
            return inst
    fail(f"No Contabo instance with IPv4 {EDGE_IP} found.")


def find_ubuntu_image(token):
    resp = requests.get(f"{API_BASE}/compute/images", headers=api_headers(token))
    resp.raise_for_status()
    data = resp.json().get("data", [])
    for img in data:
        name = img.get("name", "").lower()
        if "ubuntu" in name and ("24.04" in name or "noble" in name):
            return img
    # Fallback: latest Ubuntu
    for img in data:
        if "ubuntu" in img.get("name", "").lower():
            return img
    fail("No Ubuntu image found in Contabo.")


def create_secret(token, name, secret_type, value):
    body = {"name": name, "type": secret_type, "value": value}
    resp = requests.post(f"{API_BASE}/secrets", headers=api_headers(token), json=body)
    resp.raise_for_status()
    return resp.json().get("data", {}).get("secretId")


def ensure_key_pair():
    if not NEW_KEY.exists():
        print(f"[INFO] Generating new SSH key: {NEW_KEY}")
        subprocess.run([
            "ssh-keygen", "-t", "ed25519", "-f", str(NEW_KEY),
            "-C", "zion-edge-post-wipe-2026-07-29", "-N", ""
        ], check=True)
    else:
        print(f"[INFO] Reusing existing SSH key: {NEW_KEY}")
    if not NEW_PUB.exists():
        fail(f"Missing public key: {NEW_PUB}")
    return NEW_PUB.read_text().strip()


def ensure_root_password():
    if not ROOT_PASS_FILE.exists():
        print(f"[INFO] Generating random root password: {ROOT_PASS_FILE}")
        import secrets
        ROOT_PASS_FILE.write_text(secrets.token_urlsafe(32))
        ROOT_PASS_FILE.chmod(0o600)
    return ROOT_PASS_FILE.read_text().strip()


def build_cloud_init(pub_key: str) -> str:
    # cloud-init YAML user-data
    return f"""#cloud-config
ssh_authorized_keys:
  - {pub_key}
ssh_pwauth: false
chpasswd:
  expire: false
runcmd:
  - |
    # Harden sshd immediately
    cat > /etc/ssh/sshd_config.d/zz-zion-disable-passwords.conf <<'SSHEOF'
    Port 2222
    PasswordAuthentication no
    KbdInteractiveAuthentication no
    AuthenticationMethods publickey
    PermitRootLogin prohibit-password
    MaxAuthTries 3
    LoginGraceTime 30
    SSHEOF
    chmod 600 /etc/ssh/sshd_config.d/zz-zion-disable-passwords.conf
  - sed -i 's/^#*Port .*/Port 2222/' /etc/ssh/sshd_config
  - sed -i 's/^#*PasswordAuthentication .*/PasswordAuthentication no/' /etc/ssh/sshd_config
  - sed -i 's/^#*KbdInteractiveAuthentication .*/KbdInteractiveAuthentication no/' /etc/ssh/sshd_config
  - sed -i 's/^#*PermitRootLogin .*/PermitRootLogin prohibit-password/' /etc/ssh/sshd_config
  - echo 'AuthenticationMethods publickey' >> /etc/ssh/sshd_config
  - systemctl restart sshd || true
  - |
    # Create zion user and directories
    id -u zion >/dev/null 2>&1 || useradd --system --home-dir /opt/zion --create-home zion
    mkdir -p /opt/zion/data /opt/zion/logs /opt/zion/backups /var/log/zion /etc/zion /etc/zion/keys
    chown -R zion:zion /opt/zion /var/log/zion /etc/zion
  - |
    # Basic firewall
    ufw allow 2222/tcp
    ufw allow 22/tcp
    ufw --force enable
  - apt-get update && apt-get install -y fail2ban ufw auditd rsyslog logrotate
  - systemctl enable --now fail2ban auditd rsyslog
final_message: "ZION Edge post-wipe cloud-init finished."
"""


def reinstall(token, instance_id, image_id, root_pass_secret_id, ssh_key_secret_id):
    pub_key = NEW_PUB.read_text().strip()
    user_data = build_cloud_init(pub_key)
    payload = {
        "imageId": image_id,
        "rootPassword": root_pass_secret_id,
        "sshKeys": [ssh_key_secret_id],
        "defaultUser": "root",
        "userData": user_data,
    }
    print("[INFO] Triggering Contabo reinstall...")
    resp = requests.put(
        f"{API_BASE}/compute/instances/{instance_id}",
        headers=api_headers(token),
        json=payload,
    )
    try:
        resp.raise_for_status()
    except requests.HTTPError as e:
        print(f"[ERROR] Reinstall request failed: {e}")
        print(f"[ERROR] Response: {resp.text}")
        raise
    print("[OK] Reinstall triggered:")
    print(json.dumps(resp.json(), indent=2))
    # Save cloud-init for reference
    ref = Path.home() / f"zion-edge-cloud-init-{time.strftime('%Y%m%d-%H%M%S')}.txt"
    ref.write_text(user_data)
    print(f"[INFO] Cloud-init saved to: {ref}")


def wait_for_ssh(timeout_seconds=1800):
    print(f"[INFO] Waiting for SSH on {EDGE_IP}:2222 (timeout {timeout_seconds}s)...")
    start = time.time()
    cmd = [
        "ssh",
        "-4", "-p", "2222",
        "-i", str(NEW_KEY),
        "-o", "StrictHostKeyChecking=accept-new",
        "-o", "UserKnownHostsFile=/dev/null",
        "-o", "IdentitiesOnly=yes",
        "-o", "ConnectTimeout=10",
        f"root@{EDGE_IP}",
        "echo 'POST-WIPE-SSH-OK'",
    ]
    while time.time() - start < timeout_seconds:
        result = subprocess.run(cmd, capture_output=True, text=True)
        if "POST-WIPE-SSH-OK" in result.stdout:
            print("[OK] SSH reachable with new key.")
            return True
        print(f"[INFO] Not yet reachable ({int(time.time()-start)}s)...")
        time.sleep(20)
    fail("Timed out waiting for SSH after reinstall.")


def main():
    print("=== Contabo Edge Reinstall ===")
    creds = load_creds()
    pub_key = ensure_key_pair()
    root_pass = ensure_root_password()
    print(f"[OK] New SSH key fingerprint: {NEW_PUB}")
    subprocess.run(["ssh-keygen", "-lf", str(NEW_PUB)], check=True)

    token = get_token(creds)
    print("[OK] Contabo access token acquired.")

    inst = find_instance(token)
    image = find_ubuntu_image(token)
    print(f"[OK] Instance: {inst.get('displayName')} ({inst['id']}) @ {inst.get('ipv4')}")
    print(f"[OK] Image: {image.get('name')} ({image['id']})")

    print("[INFO] Creating Contabo secrets for root password and SSH key...")
    ts = time.strftime("%Y%m%d-%H%M%S")
    root_secret = create_secret(token, f"zion-edge-root-{ts}", "password", root_pass)
    ssh_secret = create_secret(token, f"zion-edge-ssh-{ts}", "ssh", pub_key)
    print(f"[OK] rootPassword secretId: {root_secret}")
    print(f"[OK] sshKeys secretId: {ssh_secret}")

    reinstall(token, inst["id"], image["id"], root_secret, ssh_secret)
    wait_for_ssh()
    print("\n[OK] Edge VPS reinstalled and accessible via:")
    print(f"  ssh -p 2222 -i {NEW_KEY} root@{EDGE_IP}")
    print("  or: ssh zion-post-wipe")
    print(f"\n[OK] Next step: run `edge-deploy/restore-edge-from-backup.sh` to restore data.")


if __name__ == "__main__":
    main()
