#!/usr/bin/env python3
"""Move rig to ZANO group — try different API methods."""
import json, urllib.request, time, base64, re

API = "https://api.simplemining.net"
TOKEN = "api-7a77595ab5176d2ea864c14e8b976a937c34b7e29cb486840e30729ad40f06c8"
RIG = 518837
ZANO_GROUP = 1765837

def api(method, path, body=None):
    data = json.dumps(body).encode() if body else None
    ct = "application/merge-patch+json" if method == "PATCH" else "application/json"
    req = urllib.request.Request(
        f"{API}{path}", data=data, method=method,
        headers={"X-AUTH-TOKEN": TOKEN, "Content-Type": ct})
    try:
        with urllib.request.urlopen(req, timeout=30) as r:
            raw = r.read()
            return json.loads(raw) if raw.strip() else {}
    except Exception as e:
        print(f"  ERR: {method} {path} => {e}")
        return None

def decode_con(data):
    txt = data.get("console", "")
    try:
        d = base64.b64decode(txt).decode(errors="replace")
        return re.sub(r"<[^>]+>", "", d)
    except Exception:
        return txt

# Try PATCH to move rig
print("=== Try 1: PATCH /rigs/{id} with rigGroup ===")
r1 = api("PATCH", f"/rigs/{RIG}", {"rigGroup": ZANO_GROUP})
print(f"  Result: {r1}")

if not r1 or (r1 and r1.get("rigGroup", {}).get("id") != ZANO_GROUP):
    # Try adding to group via group endpoint
    print("\n=== Try 2: PATCH /rig-groups/{id}/add-rigs ===")
    r2 = api("PATCH", f"/rig-groups/{ZANO_GROUP}/add-rigs", {"rigIds": [RIG]})
    print(f"  Result: {r2}")

if not r1 or (r1 and r1.get("rigGroup", {}).get("id") != ZANO_GROUP):
    print("\n=== Try 3: PUT /rig-groups/{zano_id} with rig assignment ===")
    r3 = api("PUT", f"/rigs/{RIG}", {"rigGroup": {"id": ZANO_GROUP}})
    print(f"  Result: {r3}")

# Check current state
time.sleep(3)
rig = api("GET", f"/rigs/{RIG}")
if rig:
    print(f"\nCurrent group: {rig.get('rigGroup', {}).get('name')} (id={rig.get('rigGroup',{}).get('id')})")

# List all groups to see available options
print("\n=== All groups ===")
groups = api("GET", "/rig-groups")
if groups:
    for g in groups:
        gid = g.get("id")
        gname = g.get("name")
        opts = g.get("minerOptions", "")[:80] if g.get("minerOptions") else "N/A"
        print(f"  {gid}: {gname} -> {opts}")
