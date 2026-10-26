# ZION Dashboard — Audit report 2026-10-26

> **Předmět:** kompletní audit `dashboard.zionterranova.com/dashboard` po splitu EDGE → EDGE2
> **Metodika:** statický diff frontend↔backend rout · živý produkční scan (auth) · validace service registry · kontrola POST dispatch, TABS/pane konzistence a alert logiky · live health probes
> **Kód:** `ZION_OS/dashboard/{app.py,dashboard.js,dashboard.html,v31.py}` — nasazeno na EDGE `zion-edge-python-dashboard` (127.0.0.1:8766, za nginx + Basic Auth)

---

## TL;DR — výsledek

| Oblast | Stav |
|---|---|
| Frontend ↔ backend mapa | ✅ 168 FE endpointů × 228 BE rout — **0 chybějících** |
| Živý GET scan | ✅ 165/222 OK; zbylých 57 = POST-only artefakty (správné 404 na GET) |
| POST dispatch | ✅ 34/34 FE POST volání obslouženo (`/api/dao/*`, `/api/hiran/proxy/*` prefixy + dynamické cesty) |
| Service registry | ✅ 33/33 služeb `running`, 0 `not-running`, `depends_on`/`ports`/`systemd` konzistentní |
| Alerty | ✅ prázdné — share-rejection rolling window aktivní |
| **Reálný defekt** | ⚠️→✅ `zion-v31-miner` crash-loop (955 restartů) — opraveno |

---

## 1. Kritický nález — `zion-v31-miner` crash-loop

**Příznak:** unit v `activating/auto-restart`, restart counter **955+**, exit `2/INVALIDARGUMENT` každých 30 s.

**Root cause:** drop-in `99-zz-liveness-tune.conf` obsahoval literal:

```
ExecStart=…/zion-miner --pool 127.0.0.1:8444 --wallet  --worker  --threads 4 …
```

Deploy skript expandoval `${ZION_MINER_WALLET}`/`${ZION_MINER_WORKER}` **do souboru** v době prázdného env → hodnoty se pečetí prázdné. Poslední drop-in (alfabeticky `99-zz-`) vždy vyhrál → crash. Zároveň přepsán trustee tuning (Nice/CPUQuota/CPUWeight).

**Fix:** drop-in znovu používá runtime `${ZION_MINER_WALLET}`/`${ZION_MINER_WORKER}` + `--v3-trinity` zachován. Miner `active`, připojen jako worker `Trustee`, pool handshake OK.

**Pravidlo do AGENTS.md:** v systemd drop-ins vždy runtime `${VAR}` — nikdy shell-expandovat hodnoty do souboru.

---

## 2. Dříve opravené defekty (stejný auditový cyklus)

| Defekt | Příčina | Fix |
|---|---|---|
| Share-rejection false alert | prometheus counter reset po restartu poolu → stale-job burst dominoval poměru (122 %) | `_share_rejection_rate()` — **DELTA za ~15 min window** (min 30 accepted), reset counterů detekován (`74ac36cb1`) |
| `/api/v31/*` shadowing | `v31.handle_get` zachytával routy před chainem a volal **lokální** journalctl/systemd | EDGE2 SSH routing v `v31.py` + `_UNIT_OVERRIDES` (`877a23ec0`) |
| `service-log?id=<edge2>` | lokální journalctl pro EDGE2 unity | `journalctl@edge2` přes probe |
| `/api/pool/{cpu,gpu}-coin` 401 | proxy na neexistující pool endpoint | env pravda: cpu=`VRSC`, gpu routes; POST hlásí "env + restart" |
| `/api/keyscan` refused | mrtvý `:8777` | `BTCUNLOCK_COORD_URL` → `:8779` |
| `/api/services` 502 | `svc["ports"]` KeyError na `ports_remote`-only kartě | `.get` + `"ports": {}` |
| `edge2-l1-watcher` degraded | `depends_on` na neexistující id | `zion-marketplace` → `marketplace` |

---

## 3. Ověřené ne-defekty (falešné poplachy scanu)

- `/api/agent/control` GET → 404 — POST-only route, správně
- `/api/poc/html` → text/html — servíruje HTML stránku záměrně
- `tabs w/o pane` nálezy — CSS třídy (`tab-active`…), ne navigační prvky
- `v31_node.height=None` v printu — pole se jmenuje `chain_height` (96753, parita s backup nodem)
- DAO `:8450` refused — pouze zastaralý komentář v kódu; proxy reálně na `:8456` (200, 3.7 ms)
- `/api/maestro/*`, `/api/metrics/collector` — `ok:false` je **pravdivé**: binárka/collector nejsou deploynuté nikde (ne dashboard bug)
- `/api/edge-agent/*` refused — agent není nasazený, frontend nevolá
- `/api/units` — mrtvá trasa, frontend nevolá

---

## 4. Topologie (post-split stav)

| Vrstva | Host | Poznámka |
|---|---|---|
| Public ingress | EDGE `62.171.141.136` + EDGE2 `207.180.217.100` (apex flip 10-22) | dashboard zůstává na EDGE; apex web na EDGE2 |
| V31 primary | EDGE2 :9445/:8335 | přes `zion-chain-tunnel` z edge |
| Followeři | EDGE node2 :9446, node3 :9447 | peerují EDGE2:8335 |
| Local backup | operátorská stanice `zionserver-144` | beacon 15 s, **parita 96753** |
| Pool | EDGE :8444/:8445 + API :8080 | stratum musí vidět reálné IP |
| `/vast-ops/*` | EDGE2 nginx → `:8088` | `vastctl-tunnel-edge2.service` (nový `-R` leg) |

---

## 5. Známé limity / open items

- **`/api/v31/status` + `/api/v31/services` = 15–20 s** — sekvenciální SSH probes na EDGE2; funkční, kandidát na paralelizaci.
- **Pool coin override je env-only** — NG pool nemá runtime hot-switch endpointy; dashboard čestně ukazuje env hodnoty + "restart required".
- `PRL_PAYOUT_DRY_RUN=1`, `WARP_API_KEY` unset, `WARP_BTC_SWAP_ENABLED=0` — pre-existing safety holds.
- Edge sshd IPv4 občas fail2ban-bane rapid sekvence — použít IPv6 alias `zion-v6`.
- `zionterranova.com` apex DNS teď míří na EDGE2 — `.bak` soubory v `sites-enabled/` načítá include glob `*` (duplicitní `server_name` warnings).

---

## 6. Artefakty

- Commits: `74ac36cb1` (share window), `877a23ec0` (v31.py EDGE2), `a45526af8` (EDGE2 karty), `95a99ce48` (vast-ops ingress docs), `bf9c09f48` (tato audit poznámka)
- Živé ověření: `/api/health` 33/33 up · `/api/services` 0 not-running · alert list prázdný
- Auth pro scan: `scripts/backup-beacon.env` (`ZION_DASHBOARD_USER/PASS`) — platné pro GET
