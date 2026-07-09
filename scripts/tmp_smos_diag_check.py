import os
import base64
import json
import re
import urllib.request

TOKEN = os.environ.get("SIMPLEMINING_API_TOKEN", "")
URL = "https://api.simplemining.net/rigs/518837"

req = urllib.request.Request(URL, headers={"X-AUTH-TOKEN": TOKEN})
with urllib.request.urlopen(req, timeout=30) as resp:
    data = json.loads(resp.read().decode("utf-8"))

console_b64 = ((data.get("redisData") or {}).get("console") or "")
print(f"isOnline={data.get('isOnline')} processUptime={data.get('processUptime')} startCount={data.get('startCount')}")
if not console_b64:
    print("NO_CONSOLE")
    raise SystemExit(0)

text = base64.b64decode(console_b64).decode("utf-8", errors="replace")
text = re.sub(r"<[^>]+>", "", text)
text = (
    text.replace("&nbsp;", " ")
    .replace("&gt;", ">")
    .replace("&lt;", "<")
    .replace("&amp;", "&")
    .replace("&apos;", "'")
)

print("DIAG_PRESENT=", "GPU/CPU HASH MISMATCH DIAGNOSTIC" in text)
print("--- MATCH/DIAG LINES ---")
for ln in text.splitlines():
    l = ln.strip()
    ll = l.lower()
    if not l:
        continue
    if (
        "gpu/cpu hash mismatch diagnostic" in ll
        or "gpu_candidate_hash_mismatch" in ll
        or "cpu_s" in ll
        or "mismatch" in ll
        or "full_input_hex" in ll
        or "gpu_hash=" in ll
        or "cpu_hash=" in ll
    ):
        print(l)
