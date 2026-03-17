"""Quick paramiko SSH test — bypasses VS Code getsockname bug."""
import paramiko
import sys

HOST = "91.98.122.165"
USER = "root"
KEY  = r"C:\Users\anaha\.ssh\zion_hetzner_key"

cmd = " && ".join(sys.argv[1:]) if len(sys.argv) > 1 else 'echo SSH_OK; hostname; docker ps --format "table {{.Names}}\\t{{.Status}}"'

try:
    key = paramiko.Ed25519Key.from_private_key_file(KEY)
except Exception:
    key = paramiko.RSAKey.from_private_key_file(KEY)

client = paramiko.SSHClient()
client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
client.connect(HOST, username=USER, pkey=key, timeout=15)
stdin, stdout, stderr = client.exec_command(cmd)
out = stdout.read().decode()
err = stderr.read().decode()
if out:
    print(out)
if err:
    print("STDERR:", err, file=sys.stderr)
client.close()
