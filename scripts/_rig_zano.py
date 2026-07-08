#!/usr/bin/env python3
import base64, json, urllib.request, re

API = "https://api.simplemining.net"
TOKEN = "api-7a77595ab5176d2ea864c14e8b976a937c34b7e29cb486840e30729ad40f06c8"
RIG = 518837

req = urllib.request.Request(
    f"{API}/rigs/{RIG}", method="GET",
    headers={"X-AUTH-TOKEN": TOKEN, "Content-Type": "application/json"})
with urllib.request.urlopen(req, timeout=30) as r:
    rig = json.loads(r.read())

grp = rig.get("rigGroup", {})
grp_id = grp.get("id")
print("Group ID:", grp_id)
print("Group Name:", grp.get("name"))
print("Process uptime:", rig.get("processUptime"), "min")
print("Rig uptime since:", rig.get("dateStart"))
print("OC profile:", rig.get("rigOc", {}).get("name"))
print("Alerts:", rig.get("alerts"))
print("Errors:", rig.get("errors"))
print("Warnings:", rig.get("warnings"))

req2 = urllib.request.Request(
    f"{API}/rig-groups/{grp_id}", method="GET",
    headers={"X-AUTH-TOKEN": TOKEN, "Content-Type": "application/json"})
with urllib.request.urlopen(req2, timeout=30) as r:
    group = json.loads(r.read())
print("\nZANO group minerOptions:", group.get("minerOptions", "N/A"))
print("ZANO group minerOptionsExtra:", group.get("minerOptionsExtra", "N/A"))

req3 = urllib.request.Request(
    f"{API}/rigs/{RIG}/console", method="GET",
    headers={"X-AUTH-TOKEN": TOKEN, "Content-Type": "application/json"})
with urllib.request.urlopen(req3, timeout=30) as r:
    data = json.loads(r.read())
txt = data.get("console", "")
decoded = base64.b64decode(txt).decode(errors="replace")
clean = re.sub(r"<[^>]+>", "", decoded)
print("\n=== FULL CONSOLE ===")
print(clean)
