import os
import base64
import json
import re
import time
import urllib.request

TOKEN = os.environ.get("SIMPLEMINING_API_TOKEN", "")
URL = "https://api.simplemining.net/rigs/518837"

for i in range(6):
    req = urllib.request.Request(URL, headers={"X-AUTH-TOKEN": TOKEN})
    with urllib.request.urlopen(req, timeout=30) as resp:
        data = json.loads(resp.read().decode("utf-8"))

    console_b64 = ((data.get("redisData") or {}).get("console") or "")
    print(f"\n=== poll {i+1}/6 online={data.get('isOnline')} proc_uptime={data.get('processUptime')} startCount={data.get('startCount')} ===")
    if not console_b64:
        print("NO_CONSOLE")
    else:
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

        keys = (
            "session_status",
            "SHARE  accepted",
            "gpu_candidate_hash_mismatch",
            "GPU/CPU HASH MISMATCH DIAGNOSTIC",
            "share accepted",
        )
        hits = [ln for ln in lines if any(k in ln for k in keys)]
        if not hits:
            print("No key lines yet")
        else:
            for ln in hits[-12:]:
                print(ln)

    if i < 5:
        time.sleep(20)
