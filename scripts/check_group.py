#!/usr/bin/env python3
import json, os, sys, urllib.request

API = 'https://api.simplemining.net'
GROUP = 1773590

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

print('>> check group config')
group = api('GET', f'/rig-groups/{GROUP}')
print(f"  group {group['id']}: customMiner={group.get('customMiner', 'N/A')}")
print(f"  minerOptions={group.get('minerOptions', 'N/A')}")
print('>> done')
