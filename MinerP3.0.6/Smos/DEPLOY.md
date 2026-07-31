# SMOS Deploy — Postup nasazení

## Předpoklady

- Edge server běží (`62.171.141.136`), pool na `8444`
- Nginx servuje `/var/www/zion-miner/` na portu 80
- SMOS rig `ZionRig` (ID 518837) je online
- Build skript `build_complete.sh` na Edge v `/tmp/`
- Wrapper `wrapper_complete.sh` na Edge v `/tmp/`

## 1. Build binárky (na Macu + Edge)

```bash
# Mac: syntax check build
cd /Users/yeshuae/Projects/2.9.6/V3
export PATH="$HOME/.cargo/bin:$PATH"
export LDFLAGS="-L/opt/homebrew/opt/libomp/lib"
export CPPFLAGS="-I/opt/homebrew/opt/libomp/include"
export LIBRARY_PATH="/opt/homebrew/opt/libomp/lib:$LIBRARY_PATH"
cargo build --release -p zion-miner \
  --features gpu-metal,native-hashers,native-verushash,native-randomx \
  --bin zion-miner

# Mac: rsync zdroje na Edge
cd /Users/yeshuae/Projects/2.9.6
rsync -avz --exclude='.git' --exclude='target' --exclude='node_modules' \
  --exclude='.next' --exclude='APP&WEB' --exclude='public' --exclude='docs' \
  --exclude='ZION_OS' --exclude='ZionDex' --exclude='ZionStart' \
  --exclude='PoC-lab' --exclude='HiranV2.x' --exclude='edge-deploy' \
  --exclude='*.log' --exclude='*.db' --exclude='*.db-wal' --exclude='*.db-shm' \
  --exclude='.DS_Store' --delete \
  -e 'ssh -i ~/.ssh/zion-edge-2026-07-29 -p 2222 -o StrictHostKeyChecking=no' \
  . root@62.171.141.136:/home/zionserver/zion-build-local/

# Edge: Docker build (Linux x86_64, GLIBC 2.31)
ssh -i ~/.ssh/zion-edge-2026-07-29 -p 2222 root@62.171.141.136 \
  'sed -i "s/VERSION=\"v3.1.9-vega-complete-[0-9]*\"/VERSION=\"v3.1.9-vega-complete-70\"/" /tmp/build_complete.sh && /tmp/build_complete.sh'
```

Build trvá ~8 min. Binárka se instaluje do `/var/www/zion-miner/zion-miner`.

## 2. Vytvoření ZIP balíčku

```bash
ssh -i ~/.ssh/zion-edge-2026-07-29 -p 2222 root@62.171.141.136 << 'EOF'
V="v3.1.9-vega-complete-70"
Z="zion-miner-${V}.zip"
F="zion-miner-${V}"
rm -rf /tmp/$F && mkdir -p /tmp/$F
# Reuse the v70 binary; v71 crashed, v72/v73 4M/2M gave lower hashrate
cp /var/www/zion-miner/zion-miner-v3.1.9-vega-complete-70.zip /tmp/v70.zip
unzip -o /tmp/v70.zip -d /tmp/v70x >/dev/null
cp /tmp/v70x/zion-miner-v3.1.9-vega-complete-70/miner /tmp/$F/miner
cp /tmp/wrapper_complete.sh /tmp/$F/miner
chmod +x /tmp/$F/miner
cd /tmp && rm -f /var/www/zion-miner/$Z
zip -r /var/www/zion-miner/$Z $F/
ls -la /var/www/zion-miner/$Z
EOF
```

## 3. Nasazení na SMOS

```bash
# Nastavit minerOptions na rig group
curl -s -X PUT \
  -H "X-AUTH-TOKEN: <SMOS_API_TOKEN>" \
  -H "Content-Type: application/json" \
  https://api.simplemining.net/rig-groups/1773590 \
  -d '{"minerOptions":"http://62.171.141.136/zion-miner/zion-miner-v3.1.9-vega-complete-70.zip"}'

# Smazat staré cache na rigu
curl -s -X PATCH \
  -H "X-AUTH-TOKEN: <SMOS_API_TOKEN>" \
  -H "Content-Type: application/merge-patch+json" \
  https://api.simplemining.net/rigs/execute-command \
  -d '{"rigIds":[518837],"commandId":7,"commandOptions":"rm -rf /root/miner/zion-miner-v3.1.9-vega-* /var/tmp/miner/zion-miner-v3.1.9-vega-* /root/miner_org/zion-miner-v3.1.9-vega-* ; echo OK"}'

# REBOOT (ne reload — reload nestáhne nový ZIP)
curl -s -X PUT \
  -H "X-AUTH-TOKEN: <SMOS_API_TOKEN>" \
  -H "Content-Type: application/json" \
  https://api.simplemining.net/rigs/518837 \
  -d '{"execute":"reboot"}'
```

## 4. Verifikace

Počkat 3-5 min po rebootu (rig se restartuje, stáhne ZIP, spustí miner).

### Konzole SMOS

```bash
curl -s -H "X-AUTH-TOKEN: <SMOS_API_TOKEN>" \
  https://api.simplemining.net/rigs/518837 | python3 -c "
import sys, json, base64, re
d = json.load(sys.stdin)
print('processUptime:', d.get('processUptime'))
print('hash:', d.get('redisData',{}).get('hash'))
console = d.get('redisData',{}).get('console','')
try: console = base64.b64decode(console).decode('utf-8', errors='replace')
except: pass
console = re.sub(r'<[^>]+>', '', console)
for i, ln in enumerate(console.splitlines()[-19:]):
    print(f'{i}: {ln}')
"
```

Konzole by měla ukazovat:
```
SHARE_ACCEPTED  job=XXXX  height=XXXX  algo=deeksha_lite_v1
external_stream coin=ZANO algo=progpow_zano
external_stream_cpu coin=VRSC algo=verushash
```

### Pool log (Edge)

```bash
ssh -i ~/.ssh/zion-edge-2026-07-29 -p 2222 root@62.171.141.136 << 'EOF'
echo "=== Accepted shares last 5 min ==="
journalctl --no-pager -u zion-edge-pool.service --since "5 min ago" 2>&1 | \
  grep -cE "share_status=Accepted"
echo "=== Per coin ==="
journalctl --no-pager -u zion-edge-pool.service --since "5 min ago" 2>&1 | \
  grep -iE "external_share_result.*accepted=true" | \
  grep -oE "coin=[A-Z]+" | sort | uniq -c
echo "=== Errors ==="
journalctl --no-pager -u zion-edge-pool.service --since "5 min ago" 2>&1 | \
  grep -cE "kernel_hang|ext_gpu_batch_error"
EOF
```

Očekávaný výsledek:
- ~300+ accepted shares / 5 min
- coin=VRSC ~15, coin=ZANO ~2, ZION ~283 (wire_submit)
- 0 kernel hang
