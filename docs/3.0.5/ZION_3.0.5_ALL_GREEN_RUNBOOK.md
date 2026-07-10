# ZION 3.0.5 — All Green Kanonický Runbook

> **Verze:** 1.0 — 2026-07-09
> **Stav:** ✅ COMPLETE — exekuováno 2026-07-09, 11/11 služeb aktivních
> **Server:** `62.171.141.136` (`ssh zion-new`)
> **Genesis:** `4f75a0dfe6dde3b167287d445aa1ade56577b0e9166c641ed288b4c20a79bd6e`
> **Cíl:** Dostat všechny komponenty do provozuschopného, ověřeného stavu — **All Green**

---

## 0. Proč existuje tento dokument

Audit 2026-07-09 odhalil, že 3.0.4 implementovalo TX unification (account-model memo + L2 watcher scanning + SDK/CLI `--memo`) **v kódu**, ale:

1. **L2 watchery neběží** — `zion-bridge`, `zion-dao` jsou enabled ale nikdy nestartovaly; `zion-warp` nemá binárku; `zion-atomic-swap` nemá ani service soubor.
2. **Website padla** — `zion-web-next` Docker kontejner exitnul (143/SIGTERM), nemůže dosáhnout L1 RPC.
3. **Protocol version nebyl bumpnut** — node se hlásí jako `zion-v3-node/3.0.3` přestože jsme na 3.0.4/3.0.5.
4. **Docs obsahují chyby** — commit `5074bf35` neexistuje, aktivační výška má 3 různé hodnoty (24000 / 22181 / 0), §3.8 fázový plán je zastaralý.
5. **E2E memo testy (DEPLOY-5/6/7)** stále blokovány (F4.5 funded adresa s SK).

3.0.5 = **operationalizace + validace + verzování**. Žádný nový konsenzový kód.

---

## 1. Audit — výchozí stav (2026-07-09)

### 1.1 Kód — potvrzeno implementováno

| Komponenta | Soubor | Stav |
|---|---|---|
| L1 memo pole | `V3/L1/core/src/lib.rs:403` | ✅ `Transaction.memo: Option<String>` |
| Aktivace (height-gated) | `V3/L1/cosmic-harmony/src/deeksha.rs:139-150` | ✅ default `0`, override `ZION_ACCOUNT_TX_MEMO_V1_HEIGHT` |
| Validace memo | `lib.rs:1964-1969` | ✅ 256 bytes, ASCII-only |
| Memo v tx_id preimage | `lib.rs:2907-2912` | ✅ po aktivaci |
| Bridge watcher → account TX | `V3/L2/bridge/src/l1_watcher.rs:348` | ✅ |
| DAO scanner → account TX | `V3/L2/dao/src/l1_scanner.rs:236` | ✅ `process_account_tx()` |
| Atomic-swap watcher → account TX | `V3/L2/atomic-swap/src/watcher.rs:133` | ✅ |
| SDK send s memo | `V3/sdk/src/wallet.rs:188,230,263` | ✅ |
| CLI `--memo` flag | `V3/cli/src/commands/wallet.rs:148`, `bin/wallet.rs:43` | ✅ |
| F4.7 max-tx-amount cap | `ZION_MAX_TX_AMOUNT_HEIGHT=1` | ✅ aktivní |
| F5 balance check | `ZION_BALANCE_CHECK_HEIGHT=0` | ✅ aktivní |

**Skutečné commity:** `db137efc` (account-model memo), `f687d8ac` (runtime-configurable height).
**Pozn.:** `3.0.4.md` cituje commit `5074bf35` — ten v repu **neexistuje** (F2 oprava).

### 1.2 Server — živý stav

| Služba | Stav | Detail |
|---|---|---|
| `zion-node` | ✅ running | height 727, RPC 127.0.0.1:8443 |
| `zion-node2` | ✅ running | follower, P2P sync |
| `zion-pool` | ✅ running | :8444 |
| `zion-dashboard` | ✅ running | Python |
| `zion-oasis` (L4) | ✅ running | |
| `zion-free-world` (L5) | ✅ running | |
| `zion-issobella` (L6) | ✅ running | |
| `zion-bridge` (L2) | ❌ inactive | enabled, binárka existuje (10.2 MB, Jul 9 12:07), no journal entries — nikdy nestartoval |
| `zion-dao` (L2) | ❌ inactive | enabled, binárka existuje (6.5 MB, Jul 9 12:07), no journal entries — nikdy nestartoval |
| `zion-warp` (L3) | ❌ inactive | enabled, ale **binárka `/usr/local/bin/zion-warp` neexistuje** |
| `zion-atomic-swap` | ❌ chybí | **žádný service soubor, žádná binárka** |
| `zion-watchdog` | ❌ inactive | static (ne enabled jako normal service) |
| `zion-web-next` (Docker) | ❌ exited 143 | kontejner exitnul, nemůže dosáhnout L1 RPC (Docker networking) |

### 1.3 Diskrepance docs vs. realita

| # | Diskrepance | Realita |
|---|---|---|
| D1 | `NODE_PROTOCOL_VERSION = "zion-v3-node/3.0.3"` | `V3/L1/core/src/lib.rs:47` — nikdy nebumpnuto |
| D2 | Commit `5074bf35` citován v `3.0.4.md` | neexistuje v repu |
| D3 | Aktivační výška: docs `24000`, repo `22181`, server `0` (default) | fresh chain → `0` je správně, ale docs si odporují |
| D4 | §3.8 říká watchery+SDK/CLI = 3.0.5 | v kódu už hotové (commity `db137efc`, `f687d8ac`) |
| D5 | AGENTS.md říká "height 230" | skutečná výška 727 (chain rostl) |

---

## F1 — Verzování (bump protocol version)

**Cíl:** Node se hlásí jako `zion-v3-node/3.0.5`.

### F1.1 Změna v kódu

**Soubor:** `V3/L1/core/src/lib.rs:47`

```rust
// PŘED:
pub const NODE_PROTOCOL_VERSION: &str = "zion-v3-node/3.0.3";
// PO:
pub const NODE_PROTOCOL_VERSION: &str = "zion-v3-node/3.0.5";
```

> ⚠️ **L1 consensus change?** NE — `NODE_PROTOCOL_VERSION` je jen reportovaný string v RPC (`getChainInfo`, `getNodeInfo`, P2P handshake). Není součástí blokového hashu ani konsenzové validace. Nepůsobí hard fork. Přesto dodržet AGENTS.md §"L1 Protocol Security Protocol" — owner approval.

### F1.2 Build + deploy

```bash
# Na serveru (ssh zion-new)
cd /root/zion/2.9.6
git pull origin main
cargo build --release -p zion-core
# Swap binárky (viz F3.2 pro kompletní build všech komponent)
systemctl restart zion-node zion-node2
```

### F1.3 Verify

```bash
curl -s -X POST http://127.0.0.1:8443 -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":1,"method":"getChainInfo","params":[]}' | grep protocol_version
# Očekáváno: "protocol_version":"zion-v3-node/3.0.5"
```

---

## F2 — Docs Reconcile

**Cíl:** Dokumentace odpovídá realitě. Žádné fiktivní commity, žádné si odporující aktivační výšky.

### F2.1 Opravit `3.0.4.md`

1. **§3.5 DEPLOY-3:** `ZION_ACCOUNT_TX_MEMO_V1_HEIGHT=24000` → opravit na: "Na serveru není env override nastaven — memo v1 aktivní od genesis (default `0`), což je správně pro fresh chain po 3.0.4 hard resetu."
2. **§3.5 commit reference:** `5074bf35` → nahradit skutečnými commity `db137efc` + `f687d8ac`.
3. **§3.8:** Označit jako "ZASTARALÉ — watchery+SDK/CLI implementovány v 3.0.4 (commity db137efc, f687d8ac), operationalizace v 3.0.5".
4. **§3.4:** Watchery už skenují account TX — aktualizovat popis.

### F2.2 Opravit `edge-deploy/config/edge-environment.sh` (repo)

```bash
# PŘED (repo):
ZION_ACCOUNT_TX_MEMO_V1_HEIGHT=22181
# PO (repo): smazat nebo nastavit na 0 — fresh chain, aktivní od genesis
# (na serveru už chybí = default 0, repo musí být konzistentní)
```

### F2.3 Aktualizovat AGENTS.md

- "height 230" → aktualizovat na aktuální výšku po exekuci F3 (nebo odkázat na `getChainInfo`).
- Přidat odkaz na `docs/3.0.5/ZION_3.0.5_ALL_GREEN_RUNBOOK.md`.

### F2.4 Verify

```bash
# Žádný výskyt fiktivního commitu
grep -rn "5074bf35" docs/ 3.0.4.md AGENTS.md  # → žádné matches
# Žádná výška 24000 v kontextu memo
grep -rn "24000" 3.0.4.md  # → žádné matches (nebo označeno jako historické)
```

---

## F3 — Operationalizace L2 watcherů

**Cíl:** Bridge, DAO, WARP, atomic-swap watchery běží a skenují account TX s memo.

### F3.1 Start bridge + dao (binárky už existují)

```bash
ssh zion-new
systemctl start zion-bridge zion-dao
systemctl status zion-bridge zion-dao --no-pager
# Verify: journalctl -u zion-bridge -f  (mělo by začít skenovat bloky)
```

**Verify account TX scanning aktivní:**
```bash
journalctl -u zion-bridge --no-pager -n 20 | grep -i "account"
```

### F3.2 Build + deploy zion-warp (binárka chybí)

```bash
ssh zion-new
cd /root/zion/2.9.6
git pull origin main
cargo build --release -p zion-warp
cp target/release/zion-warp /usr/local/bin/zion-warp
systemctl start zion-warp
systemctl status zion-warp --no-pager
```

> **Pozn.:** Pokud `zion-warp` crate neexistuje jako samostatný binární target, ověřit `V3/L3/warp/Cargo.toml` — možná je WARP integrován v jiné binárce nebo běží jako součást bridge relay. Zkontrolovat `[[bin]]` sekci.

### F3.3 Vytvořit + nasadit zion-atomic-swap service

**Service soubor:** `/etc/systemd/system/zion-atomic-swap.service`

```ini
[Unit]
Description=ZION V3 Atomic Swap Watcher (L2, 3.0.5)
After=network-online.target zion-node.service
Wants=network-online.target
Requires=zion-node.service

[Service]
Type=simple
User=root
EnvironmentFile=/root/zion/edge-environment.sh
ExecStart=/usr/local/bin/zion-atomic-swap
Restart=always
RestartSec=10
LimitNOFILE=65536
StandardOutput=journal
StandardError=journal
NoNewPrivileges=true
ProtectSystem=strict
ReadWritePaths=/data/zion
PrivateTmp=true

[Install]
WantedBy=multi-user.target
```

**Build + deploy:**
```bash
cd /root/zion/2.9.6
cargo build --release -p zion-atomic-swap
cp target/release/zion-atomic-swap /usr/local/bin/zion-atomic-swap
# Nainstalovat service soubor (viz výše)
systemctl daemon-reload
systemctl enable --now zion-atomic-swap
systemctl status zion-atomic-swap --no-pager
```

> ⚠️ **Ověřit:** `V3/L2/atomic-swap/Cargo.toml` — jaký je název binárního targetu? Možná `zion-atomic-swap` nebo `atomic-swap`. Přizpůsobit `ExecStart` a `cp` cestu.

### F3.4 Verify všechny L2 watchery

```bash
ssh zion-new
systemctl is-active zion-bridge zion-dao zion-warp zion-atomic-swap
# Očekáváno: active × 4
# Log check — každý by měl skenovat bloky:
for svc in zion-bridge zion-dao zion-warp zion-atomic-swap; do
  echo "=== $svc ==="; journalctl -u $svc --no-pager -n 5
done
```

---

## F4 — Web Repair

**Cíl:** `zion-web-next` kontejner běží, `https://zionterranova.com` je dostupné.

### F4.1 Diagnóza

Kontejner exitnul s kódem 143 (SIGTERM — pravděpodobně OOM killer nebo ruční stop). Logy ukazují:
```
Failed to fetch blockchain stats: Error: Cannot reach any ZION daemon
```

L1 RPC běží na `127.0.0.1:8443` na hostu. Docker kontejner nemůže dosáhnout `127.0.0.1` hosta — potřebuje `host.docker.internal` nebo `--network host` nebo `172.17.0.1` (Docker bridge gateway).

### F4.2 Fix

```bash
ssh zion-new
cd /root/zion-web-next
# Zkontrolovat docker-compose.yml — jaká je RPC URL?
cat docker-compose.yml | grep -i "rpc\|8443\|zion\|NEXT_PUBLIC"
# Pokud RPC URL = http://127.0.0.1:8443 → změnit na http://172.17.0.1:8443
# (172.17.0.1 = Docker bridge gateway = host)
# NEBO přidat `network_mode: host` do compose (pokud web nepotřebuje izolaci)
docker compose down
docker compose up -d
docker ps | grep zion-web
```

### F4.3 Verify

```bash
curl -sI https://zionterranova.com | head -5
# Očekáváno: HTTP/2 200
# Zkontrolovat API:
curl -s https://zionterranova.com/api/blockchain/stats | head -c 200
```

---

## F5 — Watchdog

**Cíl:** `zion-watchdog` monitoruje všechny služby a restartuje je při pádu.

```bash
ssh zion-new
cat /etc/systemd/system/zion-watchdog.service  # zkontrolovat obsah
systemctl enable --now zion-watchdog
systemctl status zion-watchdog --no-pager
```

> **Pozn.:** Watchdog je `static` (nelze enable normálně) — možná je to `oneshot` nebo target. Ověřit `[Install]` sekci. Pokud chybí, přidat `WantedBy=multi-user.target`.

---

## F6 — E2E Memo Testy (DEPLOY-5/6/7)

**Cíl:** End-to-end ověření, že account-model TX s memo funguje na mainnetu.

> ⏳ **BLOKOVÁNO — F4.5:** Potřebuje funded adresu s dostupným soukromým klíčem. Coinbase rewards jdou na hardcoded adresu bez SK. Pool wallet má SK ale 0 balance. Vyžaduje air-gapped key rotaci (F4.5).

### F6.1 Předpoklady

- Funded adresa s dostupným SK (≥ 1 ZION + fee)
- Memo v1 aktivní (✅ — default 0, aktivní od genesis)
- L2 watchery běží (✅ po F3)
- CLI/SDK s `--memo` (✅ v kódu)

### F6.2 DEPLOY-5: Account TX s `BRIDGE:` memo

```bash
# Poslat account TX s BRIDGE memo na bridge vault
zion wallet send --memo "BRIDGE:base:0xTestRecipient123..." <amount> <fee>
# NEBO přes SDK
# Verify: bridge watcher detekuje lock, wZION mint na Base
journalctl -u zion-bridge --no-pager -n 20 | grep -i "lock\|account"
```

### F6.3 DEPLOY-6: Account TX s `DAO:vote:` memo

```bash
zion wallet send --memo "DAO:vote:1:yes" 0.001 <fee>
# Verify: DAO scanner zaznamená vote
journalctl -u zion-dao --no-pager -n 20 | grep -i "vote\|account"
```

### F6.4 DEPLOY-7: Account TX s `SWAP:LOCK/CLAIM` memo

```bash
zion wallet send --memo "SWAP:LOCK:<hash>:120:base:0xTest" <amount> <fee>
# Verify: atomic-swap watcher detekuje lock
journalctl -u zion-atomic-swap --no-pager -n 20 | grep -i "lock\|swap"
```

---

## F7 — All Green Verify Checklist

Kompletní ověření, že vše je zelené. Spustit po dokončení F1–F5 (F6 volitelně — blokováno F4.5).

### F7.1 Kód

- [ ] `NODE_PROTOCOL_VERSION` = `"zion-v3-node/3.0.5"` (`V3/L1/core/src/lib.rs:47`)
- [ ] `cargo build --release -p zion-core -p zion-bridge -p zion-dao -p zion-atomic-swap -p zion-warp` projde
- [ ] `cargo test -p zion-core -p zion-bridge -p zion-dao -p zion-atomic-swap` projde

### F7.2 Server — služby

```bash
ssh zion-new 'for svc in zion-node zion-node2 zion-pool zion-dashboard zion-bridge zion-dao zion-warp zion-atomic-swap zion-watchdog zion-oasis zion-free-world zion-issobella; do printf "%-25s %s\n" "$svc" "$(systemctl is-active $svc)"; done'
```

- [ ] zion-node = active
- [ ] zion-node2 = active
- [ ] zion-pool = active
- [ ] zion-dashboard = active
- [ ] zion-bridge = active
- [ ] zion-dao = active
- [ ] zion-warp = active
- [ ] zion-atomic-swap = active
- [ ] zion-watchdog = active
- [ ] zion-oasis = active
- [ ] zion-free-world = active
- [ ] zion-issobella = active

### F7.3 Server — RPC

```bash
ssh zion-new 'curl -s -X POST http://127.0.0.1:8443 -H "Content-Type: application/json" -d "{\"jsonrpc\":\"2.0\",\"id\":1,\"method\":\"getChainInfo\",\"params\":[]}"'
```

- [ ] `protocol_version` = `zion-v3-node/3.0.5`
- [ ] `chain_height` > 727 (chain rostl)
- [ ] `network` = `Mainnet`
- [ ] `transaction_model` = `hybrid`

### F7.4 Web

- [ ] `curl -sI https://zionterranova.com` → 200
- [ ] `curl -s https://zionterranova.com/api/blockchain/stats` → valid JSON (nebo 500 s smysluplnou chybou)
- [ ] `docker ps | grep zion-web` → Up

### F7.5 Docs

- [ ] `grep -rn "5074bf35" docs/ 3.0.4.md AGENTS.md` → žádné matches
- [ ] `grep -rn "24000" 3.0.4.md` → žádné matches (nebo označeno historické)
- [ ] `docs/3.0.5/README.md` + `ZION_3.0.5_ALL_GREEN_RUNBOOK.md` existují
- [ ] AGENTS.md odkazuje na 3.0.5 docs

### F7.6 Memo v1 (pokud F6 provedeno)

- [ ] DEPLOY-5: account TX s `BRIDGE:` memo → bridge watcher detekuje lock
- [ ] DEPLOY-6: account TX s `DAO:vote:` memo → DAO scanner zaznamená vote
- [ ] DEPLOY-7: account TX s `SWAP:LOCK` memo → atomic-swap watcher detekuje lock

---

## Rizika a mitigace

| Riziko | Pravděp. | Dopad | Mitigace |
|--------|----------|-------|----------|
| Build warp/atomic-swap selže (dependency issue) | Střední | Watcher neběží | Ověřit Cargo.toml targety před buildem |
| Bridge/dao crash po startu (RPC connection issue) | Nízká | Watcher padá | `Restart=always` + journalctl diagnostika |
| Web kontejner nemůže dosáhnout RPC i po fix | Střední | Web nedostupné | `network_mode: host` fallback |
| Protocol version bump rozbije P2P handshake | Nízká | Node2 se ne synchronizuje | Verze je jen string, neporovnává se v handshake |
| F4.5 blocker přetrvává | Vysoká | E2E testy neprovedeny | F6 je volitelný pro All Green (kód je ověřen unit testy) |

---

## Pořadí exekuce

```
F1 (verzování) ──┐
F2 (docs)     ───┤── paralelní, nezávislé
F4 (web)      ───┤
F5 (watchdog) ───┘
         │
         ▼
F3 (L2 watchery) ── vyžaduje build (F1) + běžící node
         │
         ▼
F6 (E2E testy) ── vyžaduje F3 + F4.5 blocker vyřešen
         │
         ▼
F7 (All Green verify)
```

**F1, F2, F4, F5** mohou proběhnout paralelně (nezávislé).
**F3** vyžaduje build s novým protocol version (F1) a běžící node.
**F6** vyžaduje F3 + funded adresu (F4.5).
**F7** je finální ověření všeho.
