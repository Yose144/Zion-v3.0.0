#!/usr/bin/env python3
"""Quick stratum debug: connect, login, print job fields"""
import socket, json, time

s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
s.settimeout(10)
s.connect(("77.42.31.72", 3333))

login_msg = json.dumps({
    "id": 1,
    "method": "login",
    "params": {
        "login": "zion1testdebug",
        "pass": "x",
        "agent": "debug/1.0",
        "algo": ["cosmic_harmony"]
    }
}) + "\n"
s.sendall(login_msg.encode())
time.sleep(3)

data = b""
while True:
    try:
        chunk = s.recv(8192)
        if not chunk:
            break
        data += chunk
    except socket.timeout:
        break

for line in data.decode(errors="replace").strip().split("\n"):
    if not line.strip():
        continue
    try:
        j = json.loads(line)
        if "result" in j and j["result"]:
            job = j["result"].get("job", {})
            if job:
                print("=== LOGIN JOB ===")
                for k, v in job.items():
                    if k == "blob":
                        print(f"  blob_len: {len(v)} chars")
                        print(f"  blob_first40: {v[:40]}")
                    else:
                        print(f"  {k}: {v}")
        elif "method" in j:
            method = j["method"]
            params = j.get("params", {})
            print(f"\n=== NOTIFY: {method} ===")
            if isinstance(params, dict):
                for k, v in params.items():
                    if k == "blob":
                        print(f"  blob_len: {len(v)} chars")
                    else:
                        print(f"  {k}: {v}")
            elif isinstance(params, list):
                for i, v in enumerate(params):
                    label = ["job_id", "blob", "target", "height", "algo", "seed_hash", "clean"][i] if i < 7 else f"[{i}]"
                    if label == "blob":
                        print(f"  blob_len: {len(str(v))} chars")
                    else:
                        print(f"  {label}: {v}")
    except json.JSONDecodeError:
        print(f"  (non-JSON): {line[:120]}")

s.close()
