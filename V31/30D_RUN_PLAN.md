# V31 30-Day Continuous Run Plan

> Cíl: ověřit stabilitu V31 node, pool a multichain před mainnet beta a v3.1.0 release.

---

## 1. Scope

- **Node:** `zion-v31-node` na Edge (`62.171.141.136`, P2P 8335, RPC 9445).
- **Pool:** `zion-v31-pool` na Edge (Stratum 8444, HTTP API 8455).
- **Multichain:** `zion-v31-multichain` (port 8453, WARP/bridge/DEX).
- **Miner:** alespoň 1 externí miner připojený k poolu.
- **Dashboard:** `https://dashboard.zionterranova.com`.

---

## 2. Monitoring metriky

| Metrika | Zdroj | Prahová hodnota pro alert |
|---------|-------|---------------------------|
| block height / sync lag | `zion-node` RPC `getStatus` | sync_lag > 3 bloky |
| pool hashrate | dashboard `/api/v31/pool-metrics` | hashrate < 0.1 MH/s > 5 min |
| share accept rate | pool telemetry | accept rate < 90% > 10 min |
| orphaned / rejected blocks | pool RPC `/api/v31/pool-stats` | orphan > 1/hod |
| multichain `/health` | L2 HTTP | status != 200 |
| CPU / RAM / disk | node exporter / htop | disk > 80%, RAM > 90% |
| systemd service state | `systemctl status zion-v31-*` | failed state |
| fail2ban bans | `fail2ban-client status zion-p2p` | own IPs banned |

---

## 3. Runbook operace

### Denní kontroly (automaticky + manuálně)

1. Zkontroluj dashboard — všechny služby `running`.
2. Ověř height oproti public RPC `rpc.zionterranova.com:8443`.
3. Zkontroluj pool shares/sec a accept rate.
4. Zkontroluj `/health` multichain a `zion-dao`.
5. Záloha: `ZION_OS/infra/scripts/backup-edge.sh` běží každé 4h.

### Týdenní kontroly

1. Review logů: `journalctl -u zion-v31-* -n 10000 --since "7 days ago"`.
2. Analýza orphanů a rejectů.
3. Rotace logů a disk space.
4. Kontrola revenue journal a payout stavu.

### Incident response

1. **Node nedosahuje height**: zkontroluj peers (`getpeerinfo`), restart node, zkontroluj P2P port a fail2ban.
2. **Pool neakceptuje share**: zkontroluj difficulty, template feed, stratum job broadcast.
3. **Multichain down**: restart služby, ověř DB, zkontroluj RPC spojení na node.
4. **fail2ban ban own IP**: IPv6 fallback SSH, přidej IP do `ignoreip`.

---

## 4. Ukončení a report

Po 30 dnech vygeneruj report s:
- uptime procenty,
- počtem bloků, orphanů, payoutů,
- incidenty a jejich řešením,
- doporučením pro mainnet beta / v3.1.0 release.
