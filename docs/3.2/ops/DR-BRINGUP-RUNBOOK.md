# DR bringup runbook — ZION V31 pool (EDGE → EDGE2 warm standby)

> **Stav: MANUÁLNÍ failover. Watchdog je alert-only a NIKDY nepromotuje.**
> Kanonický postup pro **aktivaci, promote, ověření, rollback a failback** warm standby poolu.
> Ověřeno živými sondami **2026-10-31** (EDGE `62.171.141.136` + EDGE2 `207.180.217.100`).
> Nadřazený dokument: [`infra/RUNBOOK.md`](../../../infra/RUNBOOK.md) §Pool HA · plán: [`NIRVANA-V3.3-KRALOVSTVI-SRDCE-PLAN.md`](../../../NIRVANA-V3.3-KRALOVSTVI-SRDCE-PLAN.md) §W1.3

---

## §0 TL;DR — co je hotové a co blokuje promote

**Hotové:** replikace běží (PPLNS + payout ledger ≤60 s, `pool-store.db` ≤60 min), standby binárka startuje, watchdog měří a alertuje, `ACTIVATED` marker brání náhodnému startu.

**Blokující zjištění (5) — promote bez jejich opravy = tichá chyba:**

| # | Defekt | Dopad při promotu |
|---|---|---|
| **B1** | standby **nepředává `--miner-address`** a v env není `ZION_POOL_MINER_ADDRESS` | coinbase bloků jde na default **`zion1pool`** = neplatná adresa → pool těží bloky, které si nemůže vyplatit |
| **B2** | `ZION_POOL_WALLET_KEY` na standby **≠** klíč primáru (sha256 se liší) | payout sweep podepisuje **jiným klíčem** → výplaty z nesprávné/vyprázdněné peněženky, nebo selžou |
| **B3** | `--pplns-window-size` primár **500 000 000** vs standby env **500 000** (1000×) | jiné PPLNS okno = **jiný split** než minery viděly před výpadkem |
| **B4** | EDGE `zion-v31-watchdog.timer` **auto-restartuje `zion-v31-pool`** | po promotu watchdog vzkřísí primár → **dvě instance = dvojí výplata** |
| **B5** | veřejná stratum cesta na EDGE2 neexistuje (UFW 8444/8445 jen z EDGE + `::/64`), nginx `pool.` API míří na tunel `:8080` | minery se nepřipojí; `pool.` API vrací 502 |

Opravy jsou v §9 jako backlog s vlastníkem; **promote procedura v §6 je obsahuje jako povinné kroky**.

---

## §1 Architektura HA stacku (EDGE2, živě)

| Unit | Role | Kadence | Stav 31. 10. |
|---|---|---|---|
| `zion-pool-standby.service` | replika poolu, `ExecStart=/opt/zion/bin/zion-pool-standby`, **žádný `[Install]`** | `systemctl start` jen ručně | `inactive` (marker chybí) |
| `zion-pool-standby-sync.timer` | pull PPLNS + payout ledger (`MODE=json`) | 60 s | active |
| `zion-pool-standby-dbsync.timer` | pull `pool-store.db` snapshot (`MODE=db`, `VACUUM INTO`) | 60 min | active |
| `zion-pool-ha-watchdog.timer` | health primary (API + stratum TCP), **jen Telegram alert** | 30 s | active, `fails=0 status=ok` |

**Zdroj replikace = HTTP export na primáru** (`X-API-Key`): `/api/v1/state/pplns`, `/api/v1/state/payouts`, `/api/v1/state/db` (viz `V31/L1/pool/src/api.rs`, `respond_state_export`). Pull dělá EDGE2 — primár o standby neví (žádný push kód v poolu).

**Datový adresář standby:** `/opt/zion/data/v31-standby/` (`root:root 700`)

| Soubor | Velikost 31. 10. | Význam |
|---|---|---|
| `pool-pplns.json` | 54 086 696 B | PPLNS okno + unpaid debt |
| `pool-pplns.json.payouts.json` | 543 159 B | payout idempotency ledger |
| `pool-store.db` | 140 398 592 B | blocks/payouts/miner history |
| `.sync-state/{pplns,payouts,db}.stamp` | — | `ts`/`iso`/`sha256`/`bytes` — **RPO důkaz** |

**Druhý (osiřelý) kanál:** EDGE `zion-pool-state-replicate.timer` (15 min, **active + enabled**) pushuje do `/opt/zion/data/v31-pool-standby/` (140 MB, `store.db` 0 B). **Standby tuto cestu nečte.** Není to mrtvý proces — je to **zdvojená replikace s jiným cílem**; matoucí, ale neškodná (viz G9).

**Fencing gate:** jediná pojistka proti nechtěnému promotu je `ConditionPathExists=/opt/zion/data/v31-standby/ACTIVATED`. Marker **není** → `systemctl start` se tiše skipne (journal: *„skipped because of an unmet condition check"*). V kódu watchdogu **neexistuje** `log-only` ani `armed` mód; hlavička skriptu to říká explicitně („this script NEVER starts the standby… auto-promotion would risk a split-brain").

---

## §2 Reálné RPO (měřeno, ne odhad)

Měřeno 2026-10-31 ~09:55Z na živém stavu:

| Vrstva | Poslední sync | RPO |
|---|---|---|
| PPLNS okno | `09:54:41Z` | **≤60 s** |
| Payout ledger | `09:54:42Z` | **≤60 s** |
| `pool-store.db` | `09:09:52Z` | **≤60 min** |

Konzistence obsahu v okamžiku měření:

| Metrika | Primár (EDGE) | Standby | Δ |
|---|---|---|---|
| payout řádků | 228 769 | 228 664 | −105 |
| max block height | 103 651 | 103 616 | −35 bloků (~25 min) |

> **Nepoužívej staré číslo „RPO ≤ 15 min".** To platilo pro osiřelý push kanál. Skutečné RPO = **60 s pro PPLNS + ledger**, 60 min pro DB.

**Co RPO znamená ekonomicky:** po promotu může standby resubmitovat payouty, které primár stihl odeslat v posledních ≤60 s (ledger je o ≤105 řádků pozadu). Proto je **povinný** krok „stop primary first" + `pgrep` verifikace — ne jen zdvořilost.

---

## §3 Paritní matice (efektivní hodnoty, 31. 10.)

Efektivní hodnota = CLI flag > env > default (clap precedence). Primár má většinu parametrů ve `ExecStart` flagách, standby v env souboru — proto se rozejly.

| Parametr | Primár (efektivní) | Standby (efektivní) | Parita |
|---|---|---|---|
| stratum bind | `0.0.0.0:8444` (flag) | `0.0.0.0:8444` (env) | ✅ |
| SOLO port | `0.0.0.0:8446` (env) | `0.0.0.0:8446` (env) | ✅ |
| API bind | `127.0.0.1:8080` (env) | `127.0.0.1:8090` (unit override) | ⚠️ **záměrně** (kolize s tunelem) |
| L1 RPC | `http://127.0.0.1:9445` (flag) | `http://127.0.0.1:9445` (unit override) | ✅ (jiný význam: tunel vs. lokální node) |
| **miner-address** | `${ZION_POOL_WALLET}` = `zion1d2k5v0p6p2z667l7g522v2z0w0y6e7w742zq8k6` | **`zion1pool`** (default) | 🚨 **B1** |
| **pool-wallet-key** | `sha256:707490011268e8ec…` (klíč k `zion1d2k…`) | `sha256:10d0b93534ed99c0…` (klíč k `zion1n4k4…`) | 🚨 **B2** |
| pool-fee-bps | `100` (flag) | `100` (default) | ✅ |
| **pplns-window-size** | **500 000 000** (flag) | **500 000** (env) | 🚨 **B3** |
| payout-interval-s | `30` (default) | `30` (default) | ✅ |
| min-payout-flowers | `10 000 000` (default) | `10 000 000` | ✅ |
| native-payout-coins | `prl` (env) | `prl` (env) | ✅ |
| vardiff min/start/max | `100 / 500 / 100 000` | `100 / 500 / 100 000` | ✅ |
| vardiff target / retarget | `5 s / 20` | `5 s / 20` | ✅ |
| state path | `/opt/zion/data/v31/pool-pplns.json` | `/opt/zion/data/v31-standby/pool-pplns.json` | ✅ (izolace) |
| store db | `/opt/zion/data/v31/pool-store.db` | `/opt/zion/data/v31-standby/pool-store.db` | ✅ (izolace) |

**Mrtvé env (nulový výskyt ve `V31/**/*.rs`)** — v `pool-standby.env` jen matou, neodstraňovat naslepo, ale **nevěřit jim**: `ZION_POOL_WALLET`, `ZION_POOL_PAYOUT_SK_HEX`, `ZION_POOL_FEE_PCT`, `ZION_POOL_LOOP_COUNT`, `ZION_POOL_AUXPOW_{ENABLED,SPLIT_ZION,SPLIT_EXTERNAL}`.
> `ZION_POOL_WALLET` **není čten binárkou** — na primáru ho používá jen systemd substituce v `ExecStart` (`--miner-address ${ZION_POOL_WALLET}`). Na standby má hodnotu staré peněženky `zion1n4k4…` = **dekorace, ale nebezpečná past**: `ZION_POOL_WALLET_KEY` (`332780a6…`, sha256 `10d0b935…`) je **párový klíč právě k této staré peněžence**, takže po promotu by payout sweep podepisoval klíčem k peněžence s ~6,8 k ZION místo k `zion1d2k…` (~187 k ZION) — a adresa coinbase by navíc byla `zion1pool`.

**Ověřeno 31. 10. 2026 naostro (`dr-parity-check.sh`):** B1, B2, B3 hlášeny jako `FAIL`; `native-payout-coins`, vardiff, fee, intervaly, min-payout a izolace `state`/`store-db` jako `PASS`; `api-bind` jako `WARN` (záměrná divergence `8080` vs `8090`); `binary` jako `FAIL` (skew) a `network` jako 3× `WARN` (B4 watchdog, B5 UFW/nginx, osiřelý replikační adresář).

**Binárky:**

| | Cesta | Velikost | Datum | Verze |
|---|---|---|---|---|
| primár | `/opt/zion/V31/target/release/zion-pool` | 12 011 392 B | 31. 10. 10:18 | `build fdeda709a`, schema v13 |
| standby | `/opt/zion/bin/zion-pool-standby` | 11 023 168 B | 27. 10. 11:12 | `zion-pool 3.2.0`, schema v13 |

**Binary skew = 4 dny vývoje** (G5). Před každým promotem platí: *standby musí být rebuild z aktuálního RC commitu*, jinak promote vrací pool do starší logiky (payout lifecycle, dedup marks, snapshoty).

---

## §4 Předpoklady (fencing rules)

Promote je **bezpečný jen tehdy**, když platí všechny tři:

1. **Primár je prokázaně mrtvý** — proces neběží (`pgrep -af zion-pool` prázdné), `systemctl is-active zion-v31-pool` = `inactive`, **a** je zastaven **auto-restart** (`zion-v31-watchdog.timer` na EDGE pool restartuje!). Degradace (pomalá odpověď, wedged API) **není** smrt — na wedged API se dělá `systemctl restart` na primáru, nikdy promote.
2. **Stratum cesta je uzavřená** na straně primáru dřív, než se otevře na standby (jinak minery pendlují mezi instancemi).
3. **Parita je doložená** — `scripts/ops/dr-parity-check.sh` skončí bez `FAIL` **po** aplikaci oprav z §6.2.

Pokud nelze prokázat bod 1 (EDGE nedostupná, stav neznámý) → **čekej na dosažitelnost EDGE** (VNC/console). Promote „naslepo" je horší než 1 h výpadku: payout historie se needituje zpětně.

---

## §5 Bringup (bez promotu) — jak zjistit, že by standby vůbec nastartoval

Bez markeru se unit nespustí. Validace se dělá **nasucho**:

```bash
# 1) paritní gate (z operátorské stanice; read-only, žádné secrety se netisknou)
bash scripts/ops/dr-parity-check.sh

# 2) binárka žije a umí --help (nezapisuje stav)
ssh zion-edge2 '/opt/zion/bin/zion-pool-standby --version'

# 3) data jsou čerstvá
ssh zion-edge2 'for f in /opt/zion/data/v31-standby/.sync-state/*.stamp; do echo "-- $f"; cat "$f"; done'

# 4) unit opravdu odmítá start bez markeru (očekávej "unmet condition")
ssh zion-edge2 'systemctl start zion-pool-standby; systemctl is-active zion-pool-standby; journalctl -u zion-pool-standby -n 3 --no-pager'
```

`dr-parity-check.sh` je jediný povolený gate — nevytvářej ruční „vypadá to dobře".

**Sekce a vlastnosti gate:**

```bash
bash scripts/ops/dr-parity-check.sh --only params    # efektivní parametry (flag > unit env > env file > default)
bash scripts/ops/dr-parity-check.sh --only secrets   # sha256 secrety (hodnoty nikdy neopustí host)
bash scripts/ops/dr-parity-check.sh --only binary    # velikost / datum / sha256 / --version
bash scripts/ops/dr-parity-check.sh --only data      # stáří .sync-state stampů + obsahový lag (rows, height)
bash scripts/ops/dr-parity-check.sh --only network   # fencing marker, watchdog, UFW 8444, nginx proxy port, L1 node
```

- **read-only** — nikdy nic nestartuje, nezastavuje ani needituje.
- **jedno SSH na hostitele a běh** (`ControlMaster` + `ControlPersist=120`) — EDGE `fail2ban` banuje operátorskou IP při sérii krátkých spojení. Skript proto nesbírá data po jednom dotazu; všechno jde jedním strukturovaným proudem. **Nepřidávej další `ssh` volání** — rozbije to fail2ban-safety.
- exit `0` = žádný `FAIL` (WARN povolen), `1` = aspoň jeden `FAIL`, `2` = chyba přenosu (častý příznak fail2ban banu; hint v `stderr`).
- `--only secrets` je **povinný** po každé editaci `pool-standby.env` (§6.2) — ověří, že klíč na standby je byte-identický s primárem, aniž by ho vypsal.

> **Pozor na metodiku hashe:** `sha256(grep … | cut …)` s `echo`/`printf '%s\n'` přidá trailing newline a dá **jiné číslo** než skutečná hodnota. Referenční hodnoty 31. 10.: primár `70749001…` (bez newline) vs `ebb3c803…` (s newline) — vždy měř bez newline (`printf %s`).

---

## §6 Promote (řez: EDGE → EDGE2)

> ⏱ Očekávaný čas: **15–25 min** (většinu tvoří parita a ověření, ne start).
> 🔴 **Nikdy nespouštěj obě instance současně, ani na „jen pár sekund".**

### 6.1 Zastav primár a jeho auto-restart

```bash
ssh zion-v6 'systemctl stop zion-v31-watchdog.timer'          # B4: jinak vzkřísí pool
ssh zion-v6 'systemctl stop zion-v31-pool'                     # drain (SIGTERM → "drain: complete")
ssh zion-v6 'systemctl is-active zion-v31-pool'                # MUSÍ být: inactive
ssh zion-v6 'pgrep -af zion-pool || echo NO_PROCESS'           # MUSÍ být: NO_PROCESS
ssh zion-v6 'journalctl -u zion-v31-pool -n 20 --no-pager | tail -5'   # potvrď čistý drain
```

Pokud `pgrep` něco vrátí: **STOP.** Řeš proces (SIGKILL až po 30 s grace) a znovu verifikuj.

### 6.2 Aplikuj paritní opravy (B1, B2, B3, B4')

Na EDGE2, v `/etc/zion/pool-standby.env` (`600 root`):

| Klíč | Hodnota | Proč |
|---|---|---|
| `ZION_POOL_MINER_ADDRESS` | `zion1d2k5v0p6p2z667l7g522v2z0w0y6e7w742zq8k6` | coinbase musí jít na kanonickou pool peněženku |
| `ZION_PPLNS_WINDOW_SIZE` | `500000000` | stejné okno = stejný split |
| `ZION_POOL_NATIVE_PAYOUT_COINS` | `prl` | pearl shares nesmí do ZION PPLNS |
| `ZION_POOL_WALLET_KEY` | **zkopíruj hodnotu z EDGE** (`/etc/zion/edge-environment.sh`) | podpis payoutů stejným klíčem |

Postup bez vyzrazení secretu (hash musí sedět, hodnoty se nikam nelogují):

```bash
# před editací záloha
ssh zion-edge2 'install -m 600 /etc/zion/pool-standby.env /etc/zion/pool-standby.env.bak-$(date +%Y%m%d-%H%M)'
# po editaci: hash obou klíčů musí být SHODNÝ
bash scripts/ops/dr-parity-check.sh --only secrets
```

> ⚠️ **Nikdy** nekopíruj klíč přes shell historii ani `echo` do terminálu. Použij `scp` mezi hosty s `root:root 600`, nebo `ssh zion-v6 'cat …'` **do souboru** na EDGE2.
> ⚠️ Env soubor **nesmí** mít trailing-newline past: `echo >>` slepí poslední proměnnou s novou. Edituj `python3`/`sed -i`, ne `echo >>`.

### 6.3 Otevři stratum cestu (B5)

Minery dnes jedou na **IP `62.171.141.136:8444`**, ale `pool.zionterranova.com` už DNS → **EDGE2** (`207.180.217.100`). Rozhodni se vědomě:

**Varianta A (doporučená, DNS-first — žádná změna u minerů na IP):** ponech minery na IP a přidej dočasné pravidlo na EDGE2

```bash
ssh zion-edge2 'ufw allow 8444/tcp && ufw allow 8445/tcp && ufw status | grep -E "8444|8445"'
```

**Varianta B (DNS-only):** otevři 8444/8445 jen pro rozsahy, které reálně těží — vyžaduje odečet aktivních IP z `/public/v1/miners`. Pomalejší, ale užší.

> Současný stav: `8444/8445/8080` na EDGE2 = **jen z `62.171.141.136` + `2a02:c207:2342:5821::/64`**. Bez tohoto kroku se žádný veřejný miner nepřipojí.

### 6.4 Přepni pool API (nginx + monitoring)

`pool.` vhost proxuje `/public/v1/` na `127.0.0.1:8080` = **tunel na EDGE**. Po promotu primár neběží → 502.

```bash
ssh zion-edge2 'cp /etc/nginx/sites-enabled/pool.zionterranova.com.conf \
                  /etc/nginx/sites-enabled/pool.zionterranova.com.conf.bak-$(date +%Y%m%d-%H%M)'
# v souboru: proxy_pass http://127.0.0.1:8080;  →  proxy_pass http://127.0.0.1:8090;
ssh zion-edge2 'sed -i "s#proxy_pass http://127.0.0.1:8080;#proxy_pass http://127.0.0.1:8090;#" \
                /etc/nginx/sites-enabled/pool.zionterranova.com.conf && nginx -t && systemctl reload nginx'
```

⚠️ **Past:** `.bak` soubory **nesmí** zůstat v `sites-enabled/` — include glob `*` je načte a `server_name` koliduje. Zálohu ukládej mimo (`/etc/nginx/backups/`).

Monitoring: `zion-writepath-probe.py` na EDGE2 má `http://127.0.0.1:8080/{stats,/public/v1/payouts,/public/v1/blocks}` hardcoded → po promotu měří mrtvý tunel. Buď přepni na `8090`, nebo (čistěji) nech probe běžet a ber `ZionPoolStatsApiUnresponsive` jako očekávaný alert, dokud se tunel nevrátí — rozhodni a **zapiš do incident logu**, ať se alert nevyhodnocuje jako nová porucha.

### 6.5 Start standby

```bash
ssh zion-edge2 'touch /opt/zion/data/v31-standby/ACTIVATED && chmod 600 /opt/zion/data/v31-standby/ACTIVATED'
ssh zion-edge2 'systemctl start zion-pool-standby && sleep 5 && systemctl is-active zion-pool-standby'
ssh zion-edge2 'journalctl -u zion-pool-standby -n 40 --no-pager'
```

V journalu **musí** být vidět: načtení PPLNS okna, `share dedup restored`, payout tracker, listenery `8444/8445/8446`, API `127.0.0.1:8090`.

### 6.6 Verifikace (všechny body povinné)

```bash
# a) stratum přijímá shares
ssh zion-edge2 'curl -s http://127.0.0.1:8090/stats | head -c 400'

# b) coinbase adresa = kanonická peněženka (B1 důkaz)
ssh zion-edge2 'journalctl -u zion-pool-standby -n 200 --no-pager | grep -iE "miner_address|coinbase" | tail -5'

# c) payout sweep podepisuje správným klíčem (B2 důkaz) — MUSÍ být zion1d2k…
ssh zion-edge2 'journalctl -u zion-pool-standby -n 300 --no-pager | grep -E "payout_utxos_fetched|payout_submitted" | tail -5'

# d) veřejné API přes vhost
curl -s -o /dev/null -w "%{http_code}\n" https://pool.zionterranova.com/public/v1/blocks?limit=1

# e) chain liveness (standby čte lokální node)
ssh zion-edge2 'curl -s http://127.0.0.1:9445 -X POST -H "Content-Type: application/json" \
  -d "{\"jsonrpc\":\"2.0\",\"id\":1,\"method\":\"getChainInfo\"}" | head -c 200'

# f) nový blok přibyl (po ~5 min)
ssh zion-edge2 'journalctl -u zion-pool-standby -n 300 --no-pager | grep -E "block_found|notify_orphan" | tail -3'
```

**Fail-fast pravidla:** pokud (b) neukáže `zion1d2k…`, nebo (c) neukáže `payout_utxos_fetched zion1d2k…`, **okamžitě rollback** (§8) — pool vyrábí bloky, které neumí vyplatit.

### 6.7 Zapiš incident

```markdown
- čas rozhodnutí / čas stop primáru / čas start standby:
- klasifikace: PROKÁZANÝ FAIL (proces/port dead) / plánovaná údržba
- RPO v okamžiku promotu: pplns=…Z, payouts=…Z, db=…Z
- Δ payout řádků / Δ height:
- kdo rozhodl:
- follow-up: (regen klíče, rebuild standby, failback okno)
```

---

## §7 Co promote **nezahrnuje**

- **Automatický failback** — nikdy. Vrací se ručně (§8), jinak split-brain.
- **Přesun DAO/bridge/warp/website** — ty zůstávají na EDGE2 a jsou nezávislé na poolu.
- **Změnu DNS pro stratum** — `pool.` už na EDGE2 míří; mění se jen to, kdo na EDGE2 poslouchá.
- **Zapnutí `armed` watchdogu** — ten v kódu neexistuje (§9 G11).

---

## §8 Rollback / failback (zpět na EDGE)

```bash
# 1) stop standby + zavři marker (aby ho nikdo omylem nenastartoval)
ssh zion-edge2 'systemctl stop zion-pool-standby'
ssh zion-edge2 'rm -f /opt/zion/data/v31-standby/ACTIVATED && systemctl is-active zion-pool-standby'   # inactive

# 2) vrať API proxy na tunel
ssh zion-edge2 'sed -i "s#proxy_pass http://127.0.0.1:8090;#proxy_pass http://127.0.0.1:8080;#" \
                /etc/nginx/sites-enabled/pool.zionterranova.com.conf && nginx -t && systemctl reload nginx'

# 3) zavři veřejnou stratum cestu (jen pokud byla otevřená jen pro promote)
ssh zion-edge2 'ufw delete allow 8444/tcp; ufw delete allow 8445/tcp'

# 4) nastartuj primár (v tomto pořadí!)
ssh zion-v6 'systemctl start zion-v31-pool && systemctl is-active zion-v31-pool'
ssh zion-v6 'systemctl start zion-v31-watchdog.timer && systemctl is-active zion-v31-watchdog.timer'

# 5) verifikuj primár
ssh zion-v6 'curl -s http://127.0.0.1:8080/stats | head -c 300'
ssh zion-v6 'journalctl -u zion-v31-pool -n 200 --no-pager | grep -E "payout_utxos_fetched|block tracker restored" | tail -3'
```

**Failback poznámka:** standby má po promotu **novější** ledger než primár (pokud něco odeslal). Před failbackem zkontroluj, jestli standby odeslal payouty, které primár nemá → ty je nutné dořešit (ledger = evidence), jinak hrozí dvojí výplata po restartu primáru.

---

## §9 Backlog — co opravit, aby promote nebyl riskantní

| ID | Co | Blokuje promote | Vlastník |
|---|---|---|---|
| **G1** | sjednotit `ZION_POOL_WALLET_KEY` (parita hashem) | 🔴 ano (B2) | 👤/W1 |
| **G2** | doplnit `ZION_POOL_MINER_ADDRESS` do standby env **a** do unit flagů (make it explicit, ne implicit default) | 🔴 ano (B1) | W1 |
| **G3** | sjednotit `--pplns-window-size` (500 000 000) — ideálně jako **flag** v unit, ne env | 🔴 ano (B3) | W1 |
| **G4** | `ZION_POOL_NATIVE_PAYOUT_COINS=prl` na standby | 🟠 ano (minor) | W1 |
| **G5** | rebuild `zion-pool-standby` z aktuálního RC commitu + `ZION_BUILD_ID` provenance | 🔴 ano | W1.4/W1.5 |
| **G6** | veřejná stratum cesta (UFW) nebo vědomé DNS-only rozhodnutí | 🔴 ano (B5) | 👤 |
| **G7** | `pool.` nginx proxy + probe target po promotu (runbook krok, ne permanentní změna) | 🟠 procesní | ops |
| **G8** | `zion-v31-watchdog.timer` na EDGE musí být součástí promote kroku (nebo dostat pool-exclusion flag) | 🔴 ano (B4) | W1 |
| **G9** | osiřelý `zion-pool-state-replicate.timer` → buď vypnout, nebo přejmenovat cíl a zdokumentovat jako cold-spare | ⚪ ne | ops |
| **G10** | `zion-v31-node.service` na EDGE2 je `disabled` → po rebootu EDGE2 nemusí node naběhnout = standby bez L1 | 🟠 pro reboot resilienci | 👤 (rozpor #3 plánu) |
| **G11** | fencing + `log-only`/`armed` mód watchdogu (dnes neexistuje; `armed` = až po auditu fencingu) | ⚪ blokuje jen auto-promote | 👤 W2 |
| **G12** | úklid 0 B `.in-*` temp souborů v `/opt/zion/data/v31-standby/` (4 ks, od 28. 10.) | ⚪ kosmetika | ops |
| **G13** | standby unit nemá `[Install]` — po rebootu EDGE2 během incidentu pool nenaběhne | ⚪ akceptováno (záměr: žádný auto-start) | — |
| **G14** | `store.db` 0 B + 140 MB duplikát v `/opt/zion/data/v31-pool-standby/` (osiřelý kanál) | ⚪ kosmetika | ops |

**Doporučené pořadí:** G1 → G2 → G3 → G4 (jeden sed do `pool-standby.env` + unit) → G5 (rebuild) → G8 (watchdog) → G6/G7 (síť/API) → pak je promote rutina, ne risk.

---

## §10 Rychlé diagnostiky

| Symptom | První kontrola |
|---|---|
| standby se „tváří mrtvě" po `systemctl start` | `journalctl -u zion-pool-standby -n 5` — hledej „unmet condition" → chybí `ACTIVATED` |
| sync stampy zamrzlé | `journalctl -u zion-pool-standby-sync -n 20`; `curl -H "X-API-Key: …" http://127.0.0.1:8080/api/v1/state/pplns` na EDGE2 (přes tunel) |
| `pool.` API 502 po promotu | nginx proxy stále na `:8080` (§6.4) |
| minery se nepřipojují po promotu | UFW na EDGE2 (§6.3) + `ss -tlnp \| grep 8444` |
| watchdog posílá alerty i po promotu | watchdog měří `62.171.141.136:8444` = mrtvý primár → po promotu ho **dočasně vypni** a zapiš to |
| payouty po promotu nula | (b)/(c) v §6.6 → klíč nebo miner_address |

---

## §11 Změnový log

| Datum | Změna |
|---|---|
| 2026-10-31 | Nový dokument (W1.3). Živé sondy EDGE + EDGE2: paritní matice, měřené RPO, 5 blokujících defektů (B1–B5), backlog G1–G14. Nahrazuje nepodložené „RPO ≤15 min" a „watchdog rozhoduje o promote" z `infra/RUNBOOK.md`. |
