#!/usr/bin/env python3
import json, os, sys, time, urllib.request

API = 'https://api.simplemining.net'
RIG = 518837
GROUP = 1773590

# SRBMiner-MULTI ID (standard SMOS miner)
SRBMINER_ID = 3
SRBMINER_ZANO = '--disable-cpu --algorithm progpow_zano --pool fr.zano.herominers.com:1110 --wallet ZxCj5kQhNdW7xtt4hDTotBPGUsWYKRdtdPTFXjzFpPpf6q42rCVXcYnTtHRYGj3pzz2LUqCnvVoRzFn9zfZdCSzC1CkBiHYrg --api-enable'

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

print('>> FORCE: set SRBMiner by ID with ZANO options')
api('PUT', f'/rig-groups/{GROUP}', {
    'customMiner': '',
    'minerId': SRBMINER_ID,
    'minerOptions': SRBMINER_ZANO
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
