# SMOS Deployment — DeekshaLite v1

## Binary Ready

Edge server: `https://zionterranova.com/zion-miner/zion-sm3033.zip`

Zip obsahuje:
- `miner` — bash wrapper (nastaví `ZION_MINER_ALGORITHM=deeksha_lite_v1`)
- `zion-miner-bin` — aktuální binary s DeekshaLite OpenCL backendem
- `kernels/*.cl` — OpenCL kernely (cosmic_harmony + deeksha_lite)

## Pool konfigurace (Edge server)

**Aktuálně:** Pool běží na `cosmic_harmony_ekam_deeksha_v2` (default).

**Pro test DeekshaLite:**
```bash
ssh root@77.42.71.94
sed -i '/ZION_POOL_ALGORITHM/d' /etc/systemd/system/zion-edge-pool.service
echo 'Environment="ZION_POOL_ALGORITHM=deeksha_lite_v1"' >> /etc/systemd/system/zion-edge-pool.service
systemctl daemon-reload
systemctl restart zion-edge-pool.service
```

**Zpět na cosmic_harmony:**
```bash
sed -i '/ZION_POOL_ALGORITHM/d' /etc/systemd/system/zion-edge-pool.service
systemctl daemon-reload
systemctl restart zion-edge-pool.service
```

## Manualní update SMOS rigu

Protože API endpoint se změnil, použij prosím SMOS dashboard:

1. Přihlaš se na https://simplemining.net
2. Najdi rig **518837** (ve skupině 1773590)
3. Klikni na **Actions** → **Change Miner**
4. Vyber **Custom Miner**
5. Nastav URL:
   ```
   https://zionterranova.com/zion-miner/zion-sm3033.zip
   ```
6. Extra parameters: (nech prázdné — wrapper nastaví env vars)
7. Klikni **Apply**
8. Rig se automaticky restartuje a stáhne nový miner

## Co se změnilo v mineru

- **Default algoritmus**: `deeksha_lite_v1` (GCN-safe, bez NPU)
- **GPU backend**: OpenCL s novým `deeksha_lite.cl` kernelem
- **Wrapper script**: Automaticky nastaví `ZION_MINER_ALGORITHM=deeksha_lite_v1`
- **Pool sync**: Pool signáluje algoritmus v job message, miner ho respektuje

## Test share acceptance

Po restartu rigu sleduj pool logy:
```bash
ssh root@77.42.71.94
journalctl -u zion-edge-pool.service -f | grep -E 'accepted|rejected|hash_mismatch'
```

**Očekávaný výsledek:**
- `wire_hello` s `algorithm="deeksha_lite_v1"` → accepted
- `valid_share` nebo `share_below_target` (s vardiff=16 je normální reject)
- Žádné `hash_mismatch` (DeekshaLite je deterministic)

## Troubleshooting

### "unsupported miner algorithm"
Pool odmítl hello. Buď:
- Rig používá starý miner (stáhni znovu zip)
- Pool má jiný algoritmus (zkontroluj `ZION_POOL_ALGORITHM`)

### "OpenCL init failed"
- AMD driver není nainstalován správně
- Zkus `clinfo` na rigu přes SMOS terminal

### Share rejection (hash_mismatch)
- DeekshaLite by neměl mít mismatch (deterministic kernel)
- Pokud ano, kontaktuj mě okamžitě

## Status

- [x] Pool dual-algo support
- [x] Miner dual-algo support  
- [x] DeekshaLite OpenCL kernel
- [x] SMOS zip s wrapperem
- [ ] Share acceptance test na rigu (čeká na tvůj input)
