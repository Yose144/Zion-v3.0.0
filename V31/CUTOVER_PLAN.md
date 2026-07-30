# V31 → V3 Edge Cut-over Plan

> **Verze:** 3.1.0-alpha.2  
> **Datum:** 2026-07-30  
> **Cíl:** Bezpečně přepnout produkční Edge infrastrukturu (`62.171.141.136` / `zionterranova.com`) z V3 na V31 bez ztraty chain state, DB a bez downtime pro minery/uživatele.

## 1. Předpoklady před cut-over

- [ ] V31 workspace builduje: `cargo build --release` OK na cílové platformě (Edge VPS x86_64, macOS aarch64 pro build farmu).
- [ ] Všechny `zion-core`, `zion-pool`, `zion-miner`, `zion-multichain` unit testy procházejí.
- [ ] E2E smoke test `zion-node` + `zion-pool` + `zion-miner` lokálně reprodukován (block height 1+).
- [ ] P2P hardening (`PeerManager`, ban score, max peers) otestován proti reconnect stormu.
- [ ] DEX + rate limiting + auth API otestován (curl/Swagger).
- [ ] `V31` je možné spustit paralelně s V3 na jiných portech bez konfliktů.
- [ ] Backup stavu V3: SQLite DB, `peers.json`, `pplns-state*.json`, revenue journal, OASIS JSONs, `/etc/zion/config/*.toml`.
- [ ] `fail2ban` ignoreip whitelist obsahuje všechny operátorské IP (Mac, backup node, build farm).

## 2. Cut-over strategie — rolling blue/green

Fáze A — Parallel shadow run (D-3 až D-1):
1. Nainstalovat V31 binárky do `/opt/zion/V31/` (vedle `/opt/zion/V3/`).
2. Vytvořit `v31-shadow.toml` s vlastními porty:
   - P2P 18333/18334 (nebo 8333/8334 na jiné IP)
   - RPC 19443, WS 18445
   - multichain HTTP 18453, DEX 18454, pool stratum 18444
3. Spustit `zion-v31-node` v shadow módu s `checkpoint_dir` importujícím V3 checkpoint.
4. Nechat V31 node dosáhnout aktuální V3 výšky (sync z Edge RPC / P2P).
5. Smoke test submitu bloku na V31 pool/miner v izolované síti.

Fáze B — Read-only switch (D-day, H-2):
1. Přesměrovat RPC/WS proxy z V3 na V31 (nginx stream `rpc.zionterranova.com:8443` → `127.0.0.1:9443` V31).
2. Web frontend `/api/v3` začne číst z V31 RPC read-only endpointu.
3. Monitorovat chyby, latence, block height drift. Rollback = přepnout nginx zpět na V3.

Fáze C — Pool switch (H-1):
1. Přepnout stratum DNS/iptables z portu 8444 (V3) na 18444 (V31) nebo překonfigurovat pool service.
2. Minery se reconnectují; V31 pool posílá `mining.notify` z `zion-core` template feed.
3. Sledovat `submitBlock` akceptaci a pool payouts.

Fáze D — Full cut-over (H-0):
1. Vypnout V3 služby (`zion-edge-node1/2`, `zion-edge-pool`, `zion-edge-*` L2).
2. Přesunout V31 služby na produkční porty (8333/8334, 8444, 8453/8454, 9443).
3. Aktivovat systemd `zion-v31-*.service` a disable `zion-edge-*.service`.
4. Oznámení: web banner, Discord/Telegram, pool web status.

## 3. Konfigurační rozdíly V3 → V31

| Oblast | V3 | V31 |
|--------|-----|-----|
| L2 layout | bridge/dao/atomic-swap/warp/dex separate | `zion-multichain` jednotný crate |
| Miner | standalone + auxpow externí | Triple Stream + `HeightAwareDeeksha` |
| Pool | Python/nginx + C stratum | `zion-pool` Rust PPLNS |
| API keys | žádné / manuální | `server.auth.api_key` v TOML |
| Rate limit | nginx / žádný | vestavěný token bucket |
| P2P | legacy + V3 | PeerManager sdílený mezi canonical a V3 |

## 4. Data migration

- **Chain state:** V31 importuje V3 checkpoint z `/opt/zion/V3/data/checkpoint/` (`import_genesis_checkpoint` / `import_v3_checkpoint`).
- **Multichain DB:** nový `multichain.db`; HTLC a pool records se načtou z V3 backupu, DEX pools se přenasadí přes `/v1/swap/pool/deploy` API.
- **Pool PPLNS state:** `pplns-state.json` lze replikovat ručně; lepší postup = přestat výplaty před cut-over a začít nové okno.
- **Revenue journal:** převzít `/var/lib/zion/revenue_journal/*.jsonl` a začít nový soubor po H-0.
- **OASIS game state:** JSONs (`golden_egg`, `avatars`, `world`) zkopírovat do `V31/L4/oasis/data/` a restart služby.

## 5. Rollback

- Rychlý rollback: přepnout nginx + systemd zpět na V3, vypnout V31.
- DB: V3 SQLite zůstává nezměněná během shadow run; po D-day se provede `sqlite3 .backup` před jakýmkoliv zápisem.
- Pool payouts: po rollbacku se zastaví nové výplaty, dokud se PPLNS window nesjednotí.

## 6. Post-cutover validace

- [ ] RPC `getStatus` vrací height >= V3 height před cut-over.
- [ ] Pool `mining.subscribe`/`authorize`/`submit` flow funguje; shares jsou akceptovány.
- [ ] Miner `zion miner start` vytěží block a node ho přijme.
- [ ] Multichain `/health`, `/v1/swap/pools`, `/v1/multichain/chains` odpovídají.
- [ ] Web `/dex` quote a swap prochází.
- [ ] Watchdog + fail2ban + UFW stav odpovídá V31 portům.

## 7. Rizika a mitigace

| Riziko | Mitigace |
|--------|----------|
| V31 pool neakceptuje starší share formát | Před cut-over E2E pool+miner se shodným target formátem. |
| P2P reconnect storm zabanován fail2banem | ignoreip perzistentní whitelist, rate limiting v `PeerManager`. |
| RPC proxy timeout | Nginx read timeout 300s, fallback na V3 read-only node. |
| Data loss DB | `sqlite3 .backup` před cut-over + off-site rsync dle `ZION_OS/infra/scripts/`. |
| Miner s `--v3-miner` nekompatibilní | Ponechat V3 pool port 8444 alias dokud se klienti neaktualizují. |

## 8. Otevřené E2E před plným cut-over

- Plná L3–L6 end-to-end verifikace: Oasis game, NCL compute marketplace, AI-native agenti, Free World, Issobella. **Status 2026-07-30:** unit testy všech L3–L6 cratech procházejí (`zion-ai-native`: 337, `zion-ncl`: 42, `zion-oasis`: 124, `zion-free-world`: 3, `zion-issobella`: 3), chybí cross-layer runtime smoke test.
- Cross-chain WARP transfer (Base ↔ ZionL1) přes `zion-multichain`.
- Governance DAO proposal + vote na V31.
