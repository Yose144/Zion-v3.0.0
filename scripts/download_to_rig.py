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

# Step 1: Clear any corrupted cache first
print('>> clear rig cache')
api('PATCH', '/rigs/execute-command', {
    'rigIds': [RIG], 'commandId': 7,
    'commandOptions': 'rm -rf /tmp/zion-sm3042c* /root/miner/custom_* /var/tmp/miner/custom_*',
})
time.sleep(5)

# Step 2: Download miner directly to rig
print('>> download miner to rig')
api('PATCH', '/rigs/execute-command', {
    'rigIds': [RIG], 'commandId': 7,
    'commandOptions': 'curl -L -o /tmp/zion-sm3042c.zip http://77.42.71.94/zion-miner/zion-sm3042c.zip',
})
time.sleep(30)

# Step 3: Extract
print('>> extract miner')
api('PATCH', '/rigs/execute-command', {
    'rigIds': [RIG], 'commandId': 7,
    'commandOptions': 'unzip -o /tmp/zion-sm3042c.zip -d /tmp/zion-sm3042c && chmod +x /tmp/zion-sm3042c/zion-sm3042c/zion-miner && ls -la /tmp/zion-sm3042c/zion-sm3042c/',
})
time.sleep(10)

# Step 4: Move to SMOS expected location
print('>> move to expected location')
api('PATCH', '/rigs/execute-command', {
    'rigIds': [RIG], 'commandId': 7,
    'commandOptions': 'mkdir -p /root/miner/custom_miner && cp /tmp/zion-sm3042c/zion-sm3042c/zion-miner /root/miner/custom_miner/miner',
})
time.sleep(5)

print('>> done')
