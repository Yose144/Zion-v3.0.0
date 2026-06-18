#!/usr/bin/env python3
import json, os, sys, time, urllib.request

API = 'https://api.simplemining.net'
RIG = 518837

def token():
    t = os.environ.get('SMOS_API_TOKEN', '').strip()
    if not t:
        sys.exit('Set SMOS_API_TOKEN')
    return t

def api(method, path, body=None):
    data = json.dumps(body).encode() if body else None
    ct = 'application/merge-patch+json' if method == 'PATCH' else 'application/json'
    req = urllib.request.Request(
        f'{API}{path}', data=data, method=method,
        headers={'X-AUTH-TOKEN': token(), 'Content-Type': ct},
    )
    with urllib.request.urlopen(req, timeout=45) as r:
        raw = r.read()
        return json.loads(raw) if raw.strip() else {}

print('>> poll rig status')
for i in range(3):
    try:
        rig = api('GET', f'/rigs/{RIG}')
        print(f"  rig {rig['id']}: {rig}")
    except Exception as e:
        print(f"  rig {RIG} error: {e}")
    time.sleep(10)
print('>> done')
