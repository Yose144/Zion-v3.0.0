import os
import base64
import json
import re
import urllib.request

TOKEN = os.environ.get("SIMPLEMINING_API_TOKEN", "")
URL = "https://api.simplemining.net/rigs/518837/console"

req = urllib.request.Request(URL, headers={"X-AUTH-TOKEN": TOKEN})
with urllib.request.urlopen(req, timeout=30) as resp:
    data = json.loads(resp.read().decode("utf-8"))

console_b64 = data.get("console") or ""
print("len_b64", len(console_b64))
if not console_b64:
    print("NO_CONSOLE")
    raise SystemExit

text = base64.b64decode(console_b64).decode("utf-8", errors="replace")
text = re.sub(r"<[^>]+>", "", text)
text = (
    text.replace("&nbsp;", " ")
    .replace("&gt;", ">")
    .replace("&lt;", "<")
    .replace("&amp;", "&")
    .replace("&apos;", "'")
)
print("diag_present", "GPU/CPU HASH MISMATCH DIAGNOSTIC" in text)
for ln in text.splitlines():
    l = ln.strip()
    if not l:
        continue
    if "GPU/CPU HASH MISMATCH DIAGNOSTIC" in l or "cpu_s" in l or "gpu_candidate_hash_mismatch" in l:
        print(l)
print("--- last 200 lines ---")
lines = [ln.strip() for ln in text.splitlines() if ln.strip()]
for ln in lines[-200:]:
    print(ln)
