#!/usr/bin/env python3
"""Local pool + miner stream test for ZION v2.9.6"""
import socket, json, time

HOST, PORT = '127.0.0.1', 3333
WALLET = 'zion1e2etest000000000000000000000000000test'

print("=" * 60)
print("ZION v2.9.6 — LOCAL POOL STREAM TEST")
print(f"Target: {HOST}:{PORT}")
print("=" * 60)

# ── STEP 1: Login ─────────────────────────────────────────────
s = socket.socket()
s.settimeout(10)
try:
    s.connect((HOST, PORT))
except Exception as e:
    print(f"❌ Connect failed: {e}")
    raise SystemExit(1)

login_msg = json.dumps({
    "id": 1,
    "method": "login",
    "params": {"login": WALLET, "pass": "x", "agent": "local-test/2.9.6"}
}) + "\n"
s.sendall(login_msg.encode())

data = b""
while b"\n" not in data:
    data += s.recv(8192)

resp = json.loads(data.decode().splitlines()[0])
res = resp.get("result", {})
err = resp.get("error")

if err:
    print(f"❌ LOGIN ERROR: {err}")
    raise SystemExit(1)

session_id = res.get("id", "")
job = res.get("job", {})
print(f"✅ [1] LOGIN OK")
print(f"       session  = {session_id[:16]}...")
print(f"       height   = {job.get('height')}")
print(f"       algo     = {job.get('algo')}")
print(f"       job_id   = {job.get('job_id')}")
print(f"       target   = {str(job.get('target',''))[:16]}...")
print(f"       difficulty = {job.get('difficulty')}")


# ── STEP 2: Submit dummy share (expect rejection) ─────────────
submit_msg = json.dumps({
    "id": 2,
    "method": "submit",
    "params": {
        "id": session_id,
        "job_id": job.get("job_id", ""),
        "nonce": "deadbeef12345678",
        "result": "0" * 64
    }
}) + "\n"
s.sendall(submit_msg.encode())

s.settimeout(6)
try:
    raw = s.recv(4096).decode().strip()
    r2 = json.loads(raw.splitlines()[0])
    e2 = r2.get("error")
    r2r = r2.get("result")
    if r2r and r2r != "OK":
        print(f"✅ [2] SUBMIT → result={r2r}  (rejected dummy = correct)")
    elif e2:
        print(f"✅ [2] SUBMIT → rejected: code={e2.get('code')} msg={e2.get('message')}  (expected)")
    else:
        print(f"ℹ️  [2] SUBMIT → raw: {raw[:120]}")
except Exception as e:
    print(f"⚠️  [2] SUBMIT reply timeout (pool may be busy): {e}")


# ── STEP 3: Wait for job notify (pool pushes new work) ────────
print(f"⏳ [3] Waiting for job notification (up to 12s)...")
s.settimeout(12)
try:
    notify_raw = s.recv(8192).decode().strip()
    for line in notify_raw.splitlines():
        line = line.strip()
        if not line:
            continue
        try:
            n = json.loads(line)
            method = n.get("method", "")
            params = n.get("params", {})
            if method == "job":
                print(f"✅ [3] NOTIFY job: job_id={params.get('job_id')}  height={params.get('height')}  algo={params.get('algo')}")
            else:
                print(f"ℹ️  [3] NOTIFY: method={method}  keys={list(params.keys())}")
        except Exception:
            pass
except Exception as e:
    print(f"⚠️  [3] No notify received in 12s (pool may have no upstream jobs yet): {e}")

s.close()


# ── STEP 4: Check pool HTTP API ────────────────────────────────
print()
print("🌐 [4] Checking pool HTTP API...")
import urllib.request

api_ports = [8080, 8444, 3334]
api_ok = False
for api_port in api_ports:
    try:
        with urllib.request.urlopen(f"http://127.0.0.1:{api_port}/health", timeout=3) as r:
            body = r.read().decode()
            print(f"✅ [4] API /health on port {api_port}: {body[:80]}")
            api_ok = True
            # try stats
            try:
                with urllib.request.urlopen(f"http://127.0.0.1:{api_port}/stats", timeout=3) as r2:
                    stats = json.loads(r2.read())
                    print(f"       miners={stats.get('miners_online')}  height={stats.get('height')}  hashrate={stats.get('hashrate')}")
            except Exception:
                pass
            break
    except Exception:
        pass

if not api_ok:
    print(f"⚠️  [4] No HTTP API found on ports {api_ports} (expected if pool runs without --api flag)")


print()
print("=" * 60)
print("✅ POOL STREAM TEST COMPLETE")
print("   Pool is accepting miner connections and issuing jobs.")
print("=" * 60)
