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
lines = [ln.strip() for ln in text.splitlines() if ln.strip()]
for ln in lines[-220:]:
    print(ln)
