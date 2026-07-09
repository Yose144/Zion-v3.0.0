import os
#!/usr/bin/env python3
"""Full rig console + dmesg with decoded HTML."""
import base64, json, html, re, requests

API = "https://api.simplemining.net"
TOKEN = os.environ.get("SIMPLEMINING_API_TOKEN", "")
RIG = 518837

def api_get(path):
    r = requests.get(f"{API}{path}", headers={"X-AUTH-TOKEN": TOKEN}, timeout=30)
    return r.json()

def decode_console(raw):
    try:
        decoded = base64.b64decode(raw).decode(errors="replace")
    except Exception:
        decoded = raw
    text = re.sub(r"<[^>]+>", "", decoded)
    text = html.unescape(text)
    return text

# Rig status
rig = api_get(f"/rigs/{RIG}")
rg = rig.get("rigGroup", {})
rd = rig.get("redisData", {})
print(f"=== RIG: {rig.get('name')} | Group: {rg.get('name')} | Online: {rig.get('isOnline')} ===")
if rd:
    print(f"Hashrate: {rd.get('hashrate')} | Miner: {rd.get('miner')}")
    gpus = rd.get("gpuList", [])
    for g in gpus:
        print(f"  GPU: {g.get('name')} T={g.get('temp')}C fan={g.get('fan')}%")

# Miner console
data = api_get(f"/rigs/{RIG}/console")
txt = decode_console(data.get("console", ""))
lines = [l.strip() for l in txt.split("\n") if l.strip()]
print("\n=== MINER CONSOLE (last 60 lines) ===")
for line in lines[-60:]:
    print(line)

# dmesg
print("\n=== DMESG (GPU-related) ===")
data2 = api_get(f"/rigs/{RIG}/console?type=dmesg")
txt2 = decode_console(data2.get("console", ""))
dlines = txt2.split("\n")
gpu_lines = [l for l in dlines if any(kw in l.lower() for kw in
    ["amdgpu", "gfx", "gpu", "drm", "vega", "opencl", "atombios", "pcie",
     "error", "fault", "stuck", "hang", "reset", "zion", "miner"])]
print("\n".join(gpu_lines[-40:]) if gpu_lines else "(no GPU-related lines)")

# Rig state
rig = api_get(f"/rigs/{RIG}")
print("\n\n=== CURRENT STATE ===")
print("Online:", rig.get("isOnline"))
print("Process uptime:", rig.get("processUptime"), "min")
print("Date start:", rig.get("dateStart"))
print("Execute status:", rig.get("executeStatus"))
print("Alerts:", rig.get("alerts"))
print("Errors:", rig.get("errors"))
# redisData extras
rd = rig.get("redisData", {})
for k in ["gpuTemp", "gpuFanPercent", "gpuPwrCur", "gpuCoreClock", "gpuMemoryClock",
           "gpuCount", "gpuName", "gpuHashrate", "hashrate", "uptime"]:
    if k in rd:
        print(f"  redis.{k}: {rd[k]}")
