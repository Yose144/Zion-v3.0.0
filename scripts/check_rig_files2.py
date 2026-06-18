#!/usr/bin/env python3
import json, os, sys, time, urllib.request, base64

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

# Write output to file, then read it back
print('>> check files on rig')
api('PATCH', '/rigs/execute-command', {
    'rigIds': [RIG], 'commandId': 7,
    'commandOptions': 'ls -la /tmp/zion-sm3042c/ > /tmp/check.log 2>&1; ls -la /root/miner/custom_miner/ >> /tmp/check.log 2>&1; ls -la /root/miner/ >> /tmp/check.log 2>&1; echo "---done---" >> /tmp/check.log',
})
time.sleep(10)

# Read the file back via another command... but we can't read files directly
# Instead, we poll the rig logs to see if commands were executed
print('>> poll rig for console output')
for i in range(3):
    try:
        rig = api('GET', f'/rigs/{RIG}')
        console = rig.get('redisData', {}).get('console', '')
        if console:
            decoded = base64.b64decode(console).decode('utf-8', errors='ignore')
            print(f"=== console last 20 lines ===")
            for line in decoded.split('\n')[-20:]:
                print(f"  {line}")
        else:
            print("  no console data")
    except Exception as e:
        print(f"  error: {e}")
    time.sleep(10)

print('>> done')
