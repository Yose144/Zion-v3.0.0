#!/usr/bin/env python3
import json, os, sys, time, urllib.request

API = 'https://api.simplemining.net'
RIG = 518837
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

print('>> RESET: clear all group settings')
api('PUT', f'/rig-groups/{GROUP}', {
    'customMiner': '',
    'minerId': None,
    'minerOptions': ''
})
time.sleep(2)

print('>> clear cache')
api('PATCH', '/rigs/execute-command', {
    'rigIds': [RIG], 'commandId': 7,
    'commandOptions': 'rm -rf /root/miner/custom_* /var/tmp/miner/custom_*',
})
time.sleep(5)

print('>> reload rig')
api('PATCH', '/rigs/execute-reload', {'rigIds': [RIG]})

print('>> waiting 90s...')
time.sleep(90)
print('>> done')
