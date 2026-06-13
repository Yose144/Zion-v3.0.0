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

# Check what files are on rig
print('>> check /tmp/zion-sm3042c')
api('PATCH', '/rigs/execute-command', {
    'rigIds': [RIG], 'commandId': 7,
    'commandOptions': 'ls -la /tmp/zion-sm3042c/ && ls -la /tmp/zion-sm3042c/zion-sm3042c/',
})
time.sleep(5)

print('>> check /root/miner/custom_miner')
api('PATCH', '/rigs/execute-command', {
    'rigIds': [RIG], 'commandId': 7,
    'commandOptions': 'ls -la /root/miner/custom_miner/',
})
time.sleep(5)

print('>> check /root/miner/')
api('PATCH', '/rigs/execute-command', {
    'rigIds': [RIG], 'commandId': 7,
    'commandOptions': 'ls -la /root/miner/',
})
time.sleep(5)

print('>> done')
