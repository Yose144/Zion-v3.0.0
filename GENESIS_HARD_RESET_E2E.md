# ZION Hard Genesis Reset — End-to-End Runbook

> **Verze:** 1.0 — 2026-06-11  
> **Provedl:** Devin + operátor  
> **Kontext:** Nahrazení poškozeného chainu (chybějící ~1.6M ZION miner rewards kvůli backdořenému mineru) čistým Genesis #0.

---

## Kdy pouzit tento postup

Pouze kdyz je nutny **hard genesis reset** — vsechny nody musi zacit z bloku #0.

| Scenar | Pouzit |
|--------|--------|
| Chain fork (node1 a node2 maji jiny tip hash) | Ano |
| Chybejici miner rewards (nejasna fee split adresa) | Ano |
| Backdoor v miner binarce (napr. DCR stealth) | Ano |
| Obnova po katastrofalnim selhani validatoru | Ano |
| Normalni upgrade | Ne — pouzij `soft-upgrade` postup |

---

## Klicove adresy (Mainnet)

| Role | Adresa | Kontrola |
|------|--------|----------|
| Pool payout (miner 89 %) | `zion16825y2v5f3q507e5c2e0j8n666z43558l3zt604` | MUST ověřit na zacatku |
| Humanitarian (5 %) | `zion1s29403j538w6p6n0p783l6w5v6t254c0380c2d4` | MUST ověřit na zacatku |
| Issobella (5 %) | `zion140n8a8t6f3083232r0g6c498r6c0d423f4h9702` | MUST ověřit na zacatku |
| Default miner (fallback) | `zion1w523a76830x2t5m7f3j023w265e8g5c400a4790` | Should NOT receive pool shares |
| Children Future Fund (premine) | `zion1z7g4u3s2w3c5z5u4a60864m2y7q8e5j304g46r7` | 1.44B ZION — nemenit |

---

## Vstupni kontrola pred resetem

### 1. Overit genesis premine (14 outputs)

```bash
# Edge RPC check
curl -s -X POST -H 'Content-Type: application/json' \
  -d '{"jsonrpc":"2.0","method":"getBlockByHeight","params":{"height":0},"id":1}' \
  http://127.0.0.1:8443 | python3 -c "
import sys,json
r=json.load(sys.stdin)['result']
for tx in r.get('transactions',[]):
    if tx.get('from')=='coinbase':
        print(tx['to'], tx['amount_zion'])
print('Total:', sum(int(t['amount_zion']) for t in r.get('transactions',[]) if t.get('from')=='coinbase'))
"
```

**Ocekavano:** 14 coinbase transakci, soucet **16 780 000 000 ZION**.

### 2. Overit fee split v zdrojaku

```bash
# V3/L1/core/src/genesis.rs nebo consensus modulu
grep -n "miner_reward\|humanitarian\|issobella\|pool_fee" V3/L1/core/src/*.rs
```

**Ocekavano:** `miner_reward = subsidy * 89 / 100`, humanitarian = `5 / 100`, issobella = `5 / 100`, pool_fee = `1 / 100` (burn).

---

## Krok 0: Zabit VSECHNY procesy

### Edge (pres SSH):

```bash
ssh root@77.42.71.94

# Zabit miner pokud bezi nohup
killall -9 zion-miner 2>/dev/null; pkill -9 zion-miner

# Stopnout vsechny sluzby (poradi: pool → node2 → node1 → bridge → dao → warp → atomic-swap)
systemctl stop zion-edge-pool
systemctl stop zion-edge-node2
systemctl stop zion-edge-node1
systemctl stop zion-edge-bridge
systemctl stop zion-edge-dao
systemctl stop zion-edge-warp
systemctl stop zion-edge-atomic-swap

# Overit
systemctl is-active zion-edge-node1 zion-edge-node2 zion-edge-pool 2>&1 | grep -v "inactive"
```

### Local W11:

```powershell
# Kill vsechno
Get-Process | Where-Object { $_.ProcessName -match "node|miner|pool|python" } | Stop-Process -Force

# Extra — nekdy node.exe zustane viset
Get-Process node -ErrorAction SilentlyContinue | Stop-Process -Force
```

**Kontrola:** `node.exe`, `miner.exe`, `python.exe` nesmi bezet.

---

## Krok 1: Zalohovat pred resetem

### Edge:

```bash
/root/zion-2.9.6-main/edge-deploy/scripts/backup-edge.sh
ls -la /root/zion-backups/daily/
```

### Local:

```powershell
cd "C:\Users\yosef\Desktop\Zion\2.9.6-main"
powershell -ExecutionPolicy Bypass -File scripts\auto-backup-all.ps1
```

---

## Krok 2: Smazat Edge DB

```bash
ssh root@77.42.71.94

# Node1
rm -f /var/lib/zion/edge-state.db
rm -f /var/lib/zion/edge-state.db-journal
rm -f /var/lib/zion/peers.json

# Node2
rm -f /var/lib/zion/edge2-state.db
rm -f /var/lib/zion/edge2-state.db-journal
rm -f /var/lib/zion/peers2.json

# V3 data (pokud existuje)
rm -f /root/zion-2.9.6-main/V3/data/*.db
rm -f /root/zion-2.9.6-main/V3/data/*.db-journal

# Overit — musi byt pryc
ls -la /var/lib/zion/
```

**Proc to delat:** Bez vymazani DB node nacita stary chain a nezacne z genesis. Zvlast `edge2-state.db` muze mit jiny chain (fork).

---

## Krok 3: Smazat Local W11 DB

```powershell
cd "C:\Users\yosef\Desktop\Zion\2.9.6-main"

Remove-Item -Force V3\data\zion-node-state.db     -ErrorAction SilentlyContinue
Remove-Item -Force V3\data\zion-node-state.db-journal -ErrorAction SilentlyContinue
Remove-Item -Force V3\data\peers.json               -ErrorAction SilentlyContinue

# Overit
Get-ChildItem V3\data\ -Name
```

---

## Krok 4: Opravit Edge config (`edge-environment.sh`)

```bash
ssh root@77.42.71.94
nano /root/zion-2.9.6-main/edge-environment.sh
```

**Ocekavany obsah:**

```bash
export ZION_MINER_ADDRESS="zion16825y2v5f3q507e5c2e0j8n666z43558l3zt604"
export ZION_HUMANITARIAN_WALLET="zion1s29403j538w6p6n0p783l6w5v6t254c0380c2d4"
export ZION_ISSOBELLA_WALLET="zion140n8a8t6f3083232r0g6c498r6c0d423f4h9702"
export ZION_POOL_FEE_BURN_PCT=1
export ZION_NETWORK="Mainnet"
export ZION_SEED_PEERS="100.76.16.108:8333"
```

**Proc:** Predchozi config pouzival spatnou fee-split adresu — miner 89 % sel na neznamou adresu misto pool walletu.

---

## Krok 5: Opravit Local config (`start-node-window.bat`)

Upravit `start-node-window.bat` (nebo ekvivalent):

```batch
set ZION_NODE_ID=local-backup-node
set ZION_P2P_BIND=0.0.0.0:8333
set ZION_RPC_BIND=0.0.0.0:8443
set ZION_NODE_STATE_PATH=V3\data\zion-node-state.db
set ZION_MINER_ADDRESS=zion16825y2v5f3q507e5c2e0j8n666z43558l3zt604
set ZION_HUMANITARIAN_WALLET=zion1s29403j538w6p6n0p783l6w5v6t254c0380c2d4
set ZION_ISSOBELLA_WALLET=zion140n8a8t6f3083232r0g6c498r6c0d423f4h9702
set ZION_SEED_PEERS=77.42.71.94:8333
V3\target\release\node.exe
```

**DULEZITE:** `ZION_SEED_PEERS` smeřuje na Edge node1. Na zacatku resetu (krok 7) ho dočasne odstranime pro izolovany start.

---

## Krok 6: Izolovany start Edge node1 (bez seed peers)

**Proc:** Node1 musi vygenerovat Genesis #0 SAM — bez vlivu ostatnich nodu. Jinak muze prijmout stary chain.

### Docasne odstranit seed peers z systemd:

```bash
ssh root@77.42.71.94
nano /etc/systemd/system/zion-edge-node1.service

# Komentovat nebo odstranit radek:
# Environment="ZION_SEED_PEERS=100.76.16.108:8333"

systemctl daemon-reload
```

### Spustit node1 izolovane:

```bash
systemctl start zion-edge-node1
sleep 5
journalctl -u zion-edge-node1 -n 20 --no-pager
```

### Verifikace Genesis #0:

```bash
curl -s -X POST -H 'Content-Type: application/json' \
  -d '{"jsonrpc":"2.0","method":"getChainInfo","params":{},"id":1}' \
  http://127.0.0.1:8443 | python3 -c "
import sys,json
r=json.load(sys.stdin)['result']
assert r['height']==0, 'FAIL: height != 0'
assert r['accepted_blocks']==1, 'FAIL: accepted != 1'
assert r['tip_hash']=='000000007543004cade5d7e3745459b2ffe0a803e1fc3d4baa0a8d5a4b1e2e4', 'FAIL: wrong genesis hash'
print('Genesis #0 OK — height:', r['height'], 'accepted:', r['accepted_blocks'], 'tip:', r['tip_hash'])
"
```

**Ocekavano:** `height: 0`, `accepted_blocks: 1`, `tip_hash: 000000007543004c...`

---

## Krok 7: Obnovit seed peers, restart node1, spustit node2

```bash
ssh root@77.42.71.94

# Obnovit seed peers v systemd
nano /etc/systemd/system/zion-edge-node1.service
# Environment="ZION_SEED_PEERS=100.76.16.108:8333"  # obnovit

systemctl daemon-reload
systemctl restart zion-edge-node1
sleep 3
systemctl start zion-edge-node2

# Overit
systemctl is-active zion-edge-node1 zion-edge-node2
```

### Kontrola sync:

```bash
curl -s -X POST -H 'Content-Type: application/json' \
  -d '{"jsonrpc":"2.0","method":"getChainInfo","params":{},"id":1}' \
  http://127.0.0.1:8443 | python3 -c "
import sys,json
r=json.load(sys.stdin)['result']
print('height:', r.get('height','N/A'), 'accepted:', r['accepted_blocks'])
"
```

**Ocekavano:** `accepted_blocks` roste, oba nody se syncuji.

---

## Krok 8: Spustit lokalni W11 node

```batch
cd "C:\Users\yosef\Desktop\Zion\2.9.6-main"

set ZION_NODE_ID=local-backup-node
set ZION_P2P_BIND=0.0.0.0:8333
set ZION_RPC_BIND=0.0.0.0:8443
set ZION_NODE_STATE_PATH=V3\data\zion-node-state.db
set ZION_SEED_PEERS=77.42.71.94:8333
set ZION_MINER_ADDRESS=zion16825y2v5f3q507e5c2e0j8n666z43558l3zt604
set ZION_HUMANITARIAN_WALLET=zion1s29403j538w6p6n0p783l6w5v6t254c0380c2d4
set ZION_ISSOBELLA_WALLET=zion140n8a8t6f3083232r0g6c498r6c0d423f4h9702

V3\target\release\node.exe
```

**Kontrola syncu:** V logu by melo byt videt:

```
p2p_in={"type":"hello","node_id":"zion-edge-primary",...}
p2p_out={"type":"welcome","node_id":"local-backup-node",...}
chain_height=27
accepted_blocks=27
```

Local node syncne z Edge node1 na aktualni vysku.

---

## Krok 9: Spustit Edge pool

```bash
ssh root@77.42.71.94

systemctl start zion-edge-pool
sleep 3
systemctl is-active zion-edge-pool

# Overit port
ss -tlnp | grep 8444
```

**Ocekavano:** `zion-pool-serve` nasloucha na `0.0.0.0:8444`.

---

## Krok 10: Nahradit backdoor miner binarku

**Pokud je podezreni na backdoor** (napr. `dcr_stealth=enabled` v `/usr/local/bin/zion-miner`):

### Build ciste binarky pres WSL:

```bash
# Na W11
wsl

cd /mnt/c/Users/yosef/Desktop/Zion/2.9.6-main

cargo build --release -p zion-miner

# Overit — NESMI obsahovat "dcr"
strings V3/target/release/zion-miner | grep -i dcr || echo "OK: no DCR strings"

# Copy na Edge
scp V3/target/release/zion-miner root@77.42.71.94:/usr/local/bin/zion-miner
```

---

## Krok 11: Spustit Edge CPU miner

```bash
ssh root@77.42.71.94

killall -9 zion-miner 2>/dev/null
> /var/log/zion-edge-miner.log

export ZION_POOL_ADDR=127.0.0.1:8444
export ZION_WORKER_NAME=edge-cpu
export ZION_MINER_ID=edge-cpu-01
export ZION_LOOP_COUNT=1000000
export ZION_PAYOUT_ADDRESS=zion1y4q6k774r2a7h0x287k7h2s0z3w3t5w863lu825
export ZION_MINER_ALGORITHM=deeksha_lite_v1
export ZION_THREADS=2
export ZION_INTERACTIVE=false

nohup /usr/local/bin/zion-miner >> /var/log/zion-edge-miner.log 2>&1 &
```

### Verifikace:

```bash
# Overit ze bezi
ps aux | grep zion-miner | grep -v grep

# Overit payout_address v logu
grep "payout_address" /var/log/zion-edge-miner.log | head -1
```

**Ocekavano:** `payout_address` musi byt validni `zion1...` adresa. Pool ho akceptuje — jinak odpoji.

---

## Krok 12: Overit fee split na prvnim vyresenem bloku

Fee split je invariant: **89 % miner / 5 % humanitarian / 5 % issobella / 1 % burn**.

### Kontrola RPC:

```bash
HEIGHT=$(curl -s -X POST -H 'Content-Type: application/json' \
  -d '{"jsonrpc":"2.0","method":"getChainInfo","params":{},"id":1}' \
  http://127.0.0.1:8443 | python3 -c "import sys,json; print(json.load(sys.stdin)['result']['height'])")

curl -s -X POST -H 'Content-Type: application/json' \
  -d "{\"jsonrpc\":\"2.0\",\"method\":\"getBlockByHeight\",\"params\":{\"height\":$HEIGHT},\"id\":1}" \
  http://127.0.0.1:8443 | python3 -c "
import sys,json
r=json.load(sys.stdin)['result']
subsidy = int(r['subsidy_zion'])
miner = int(r['miner_reward_zion'])
human = int(next((t['amount_zion'] for t in r['transactions'] if t['to']==r['humanitarian_address']),0))
isso  = int(next((t['amount_zion'] for t in r['transactions'] if t['to']==r['issobella_address']),0))

assert miner == int(subsidy * 0.89), f'Miner mismatch: {miner} != {int(subsidy*0.89)}'
assert human == int(subsidy * 0.05), f'Humanitarian mismatch: {human} != {int(subsidy*0.05)}'
assert isso  == int(subsidy * 0.05), f'Issobella mismatch: {isso} != {int(subsidy*0.05)}'

print('Fee split OK on block', r['height'])
print('  miner (89%):     ', miner)
print('  humanitarian (5%):', human)
print('  issobella (5%):  ', isso)
print('  pool_fee (1%):   ', subsidy - miner - human - isso, '(burned)')
"
```

### Predchozi verifikace z 2026-06-11 (blok 36):

```
miner_reward_zion = 4806059630000000 (89 %)
humanitarian tx     =  270003350000000 (5 %)
issobella tx      =  270003350000000 (5 %)
subsidy_zion      = 5400067000000000
total fees        = 1000 (puvodne z tx fee, neni cast subsidy)
```

---

## Krok 13: Push konfigurace na Git

```bash
cd /mnt/c/Users/yosef/Desktop/Zion/2.9.6-main

git add -A
git commit -m "feat(reset): hard genesis reset

- Reset Edge + local nodes to genesis #0
- Fixed ZION_MINER_ADDRESS to canonical pool payout wallet
- Correct fee split verified: 89/5/5/1
- Replaced backdoored miner with clean build
- Pool running on 8444, CPU miner verified

git push origin main
```

---

## Post-reset monitoring checklist

| Kontrola | Prikaaz | Ocekavano |
|----------|---------|-----------|
| Edge node1 height | `curl ... getChainInfo` | roste |
| Edge node2 sync | `curl ... getChainInfo` na node2 port | == node1 |
| Local node sync | `curl ... getChainInfo` na 127.0.0.1:8443 | == Edge |
| Pool nasloucha | `ss -tlnp \| grep 8444` | `zion-pool-serve` |
| Miner bězí | `ps aux \| grep zion-miner` | bezi |
| Miner payout | `grep payout_address /var/log/zion-edge-miner.log` | validni zion1... |
| Fee split | `getBlockByHeight` | 89/5/5/1 |
| DCR backdoor | `strings /usr/local/bin/zion-miner \| grep -i dcr` | prazdne |
| Disk space | `df -h /var/lib/zion` | < 80 % |

---

## Zname pasti a jak se jim vyhnout

| Past | Proc se stane | Reseni |
|------|---------------|--------|
| **Edge node2 ma jiny chain** | `edge2-state.db` nebyl smazan | Vzdy smazat OBA DB soubory |
| **Genesis neni #0** | Node pripojil k existujici siti | Izolovany start (krok 6) |
| **Fee split na spatnou adresu** | `ZION_MINER_ADDRESS` je spatne | Overit adresu pred kazdym startem |
| **Pool odmita minera** | `payout_address` chybi nebo je nevalidni | Nastavit `ZION_PAYOUT_ADDRESS` |
| **0 accepted shares** | DCR backdoor krade GPU | Nahradit cistou binarkou |
| **Miner padne po submit_solution** | GPU/CPU hash mismatch | Aktualizovat pool i miner ze stejneho buildu |

---

## Appenda A: Rychly recovery (pokud uz mate cistou binarku)

Pokud uz mate overeny config a cistou binarku:

```bash
# Edge (1 prikaz pres SSH)
ssh root@77.42.71.94 'killall zion-miner; systemctl stop zion-edge-pool zion-edge-node2 zion-edge-node1; rm -f /var/lib/zion/*.db* /var/lib/zion/*.json; systemctl start zion-edge-node1; sleep 5; systemctl start zion-edge-node2 zion-edge-pool; nohup /usr/local/bin/zion-miner >> /var/log/zion-edge-miner.log 2>&1 &'

# Local W11 (PowerShell)
Get-Process node -EA SilentlyContinue | Stop-Process -Force
Remove-Item -Force V3\data\zion-node-state.db* -EA SilentlyContinue
# pak spustit start-node-window.bat
```

---

## Appenda B: Overit cistotu miner binarky

```bash
# Kontrola DCR backdoor (NESMI vratit nic)
strings /usr/local/bin/zion-miner | grep -iE "dcr|2miners|stealth"

# Kontrola BuildID
readelf -n /usr/local/bin/zion-miner | grep BuildID

# Ocekavana hodnota z cisteho buildu (2026-06-11):
# Build ID: 9a3105de...
```

---

*Generováno s pomocí [Devin](https://cli.devin.ai/docs). Poslední aktualizace: 2026-06-11.*
