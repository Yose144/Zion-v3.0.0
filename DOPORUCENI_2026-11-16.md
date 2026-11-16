# ZION — doporučení, jak pokračovat

> **Datum:** 16. 11. 2026 · **Autor:** Devin (read-only průchod + živé sondy)
> **Rozsah:** starý root `~/Projects/2.9.6`, nový repo `3.3.0/`, plány (`PLAN.md`, `ROADMAP.md`, `3.3.0/v3.3Nirvana.md`, `docs/canon/DECISIONS.md`, `docs/migration/PHASES.md`, `docs/ops/STATUS.md`, `CODE_VS_DOCS.md`, `docs/3.3/TRUSTEE-CONTINUITY.md`), reporty 12.–16. 11. a **živé sondy EDGE1 a EDGE2** (15. 11. 17:56–18:10 CET a 16. 11. 13:49–13:52 CET).
> **Co jsem změnil:** nic na serverech, nic v kódu. Jen tento soubor. Všechny příkazy byly read-only (`systemctl show`, `ss`, `journalctl`, `sar`, Prometheus API, RPC `getChainInfo`, `curl` na veřejné hostname, `openssl` na certifikáty).
> **Hierarchie:** kód + sonda > `DECISIONS.md` > master plán. Kde je něco odvozené, a ne změřené, píšu to jako **hypotézu**.
> **Pozor na paralelní práci:** v noci 15./16. 11. běžela jiná session (v obou repech je 20+ nových commitů). Tento dokument s nimi počítá — §3 shrnuje, co už je vyřešené, §4 obsahuje jen to, co zůstává otevřené.

---

## 0. Ve zkratce

**Co je v pořádku**

- Chain je zdravý: výška **126 307** (16. 11. 13:51), **60,6 s/blok** za posledních 20 h, primary i oba followeři na stejném tipu, node `f5db9d232`.
- G8 **běh #8** `g8-20261116T015534Z` běží: 100 % uptime, 100 % evidence, 0 incidentů, okno do **16. 12. 01:55 UTC**. Sonda měří ze dvou stanovišť (D-022 v `DECISIONS.md`).
- 3.3 je technicky připravená: 7 služeb na stagingu EDGE2, F6 akceptace uzavřená, market parita 16/16, `npm run verify` zelený (typecheck 15 workspace, build 6 appek), testy workspace zelené (identity 72, db-sync 24, realtime 29, games 89, desktop 45 …), `cargo test -p zion-pool` **446/1** (jediný pád je známý `pearl_stratum_end_to_end`, deterministický).

**Co je potřeba řešit (seřazeno podle rizika)**

1. **Skutečný mechanismus výpadku 15. 11. pořád platí.** sshd proces tunelu na EDGE2 má soft limit **1 024 fd**. Ten byl 15. 11. vyčerpaný (chyby `channel 1035–1042: open failed`). Guard `LimitNOFILE=8192` z 16. 11. je jen na straně EDGE1, kde limit nikdy nebyl problém. → §4.1
2. **Hodinový cron v :17 na obou boxech** (`drop_caches` + `fstrim`). Latence čtení bloku v minutách :18–:20 je 4–5× vyšší než průměr. Všech 5 restartů primary nodu watchdogem za 7 dní padlo na :17. → §4.2
3. **Watchdog EDGE2 restartuje primary node po jediném neúspěšném pokusu** (5 s timeout, bez počítadla). → §4.3
4. **Paměť poolu není vyřešená.** I s memfixem jde pool po startu z 0,55 na 3,8 GB za 9 h a ustálí se kolem **4,4 GB** na boxu s 7,9 GB RAM, kde běží i těžba. → §4.4
5. **V31 se rozdvojil.** PPLNS persist knob existuje jen ve starém rootu, QTC a memfix opravy jen ve `3.3.0`. Běžící pool `ed24cef65` knob nemá. → §4.5
6. **Kotva 144 000 nepřijde v prosinci, ale kolem 29. 11.** (17 693 bloků × 60,6 s). Spadá doprostřed běhu #8. → §5
7. **Vývoj běží dvakrát.** Do 3.2 dál přistávají funkce (wallet v `app.`, 75 3D avatarů v nirvaně, IntroPage), zatímco 3.3 čeká na flipy. Bez rozhodnutí se migrace nedokončí. → §4.9
8. **Kontinuita 0/15** (`TRUSTEE-CONTINUITY.md` ČÁST 13): žádná obnova ze zálohy nebyla vyzkoušena, trustee mnemonic prošel chatem, Erika nemá žádný přístup. → §4.11
9. **Externí používání je zatím nulové:** realtime 0 spojení, nirvana 0 spojení, v poolu 3 mineři a všichni jsou naši. → §4.10

**Hlavní doporučení:** Na začátku běhu #8 (tento týden) udělat jedno plánované servisní okno a v něm zavřít body 1–5. Během běhu #8 dělat jen flipy, které se nedotýkají required služeb (apex, `app.`, `kingdom.`/`nirvana.`), každý po 👤 vizuálním schválení. Po 16. 12. a po Vánocích udělat `auth.`, `market.`, Stable sign-off a vypnout 3.2. Do té doby nepřidávat nové povrchy ani do 3.2, ani do 3.3.

---

## 1. Jak jsem měřil

| Zdroj | Co |
|---|---|
| EDGE1 `62.171.141.136:2222` (`vmi3425821`) | `systemctl`, `/proc/<pid>/{status,limits,fd}`, `ss -tan`, `journalctl` (tunel, pool, watchdog), `sar -q`, Prometheus `:9090` (query_range), `/opt/zion/data/g8_run.json`, pool `/health` + `/stats`, RPC followerů 9446/9447 |
| EDGE2 `207.180.217.100` (`vmi3684458`) | totéž + `/etc/cron.hourly`, `/etc/crontab`, `systemctl list-timers`, `sar -u/-W`, sshd procesy, RPC 9445, `zion-core --version` |
| Veřejně (z Macu) | `curl` na 13 hostname, `openssl s_client` na 6 certifikátů, `rpc.zionterranova.com/jsonrpc` |
| Repa | `git log/status` obou rep, `package.json` skripty, `npm run verify` + `npm test` po workspace, `cargo check/test -p zion-pool` (logy `/tmp/zion-verify-npm.log`, `/tmp/zion-verify-tests.log`, `/tmp/zion-verify-cargo.log`) |

---

## 2. Měřený stav

### 2.1 Chain a G8

| Veličina | Hodnota | Kdy |
|---|---|---|
| Výška | 126 307, obtížnost 3 160, mempool 2 | 16. 11. 13:51 |
| Tempo | 1 181 bloků za 19,9 h = **60,6 s/blok** | 15. 11. 17:56 → 16. 11. 13:51 |
| Node | `zion-core 3.2.0 build f5db9d232…`, primary start 15. 11. 17:17:53 (restart watchdogem) | 16. 11. |
| G8 #7 | `stopped`, `gate_status=failed`, `critical_incident` 1 140 s (15. 11. 14:14–14:33 UTC), 39 incidentů | archiv na EDGE1 |
| G8 #8 | `running`, `pending`, 100 % / 100 %, 0 incidentů, konec 16. 12. 01:55 UTC | 16. 11. 13:50 |

### 2.2 EDGE1 — pool, followeři, ops, monitoring

| Veličina | 15. 11. 18:00 | 16. 11. 13:50 |
|---|---|---|
| Load (4 vCPU) | 4,36 | 4,58 |
| RAM available | 1,3 GB | 2,1 GB |
| Disk `/` | 67 % (96/145 G) | — |
| Pool build | `aecfa6344` | **`ed24cef65`** (start 16. 11. 03:56) |
| Pool RssAnon | 3,90 GB (35,7 h) | **3,42 GB po 9,9 h** |
| `pool-pplns.json` | 122,6 MB, přepis každých 30 s | — |
| Těžba na boxu | `zion-fallback-miner` 156 % CPU + `zion-miner` 90 % CPU | — |
| TCP ESTABLISHED | 768 → 37 při restartu nodu | stabilně 37–47 od 06 UTC |
| Čekající aktualizace | 62 | — |
| `backups/daily` | 26 GB / 42 tarballů | — |
| `/etc/cron.hourly` | `free`, `fstrim` | **pořád tam** |

### 2.3 EDGE2 — primary node, web, 3.3 staging

| Veličina | Hodnota |
|---|---|
| RAM | available 5,7 GB, **swap 2,3 / 4 GB** a roste (15. 11.: 1,96 GB). Ve swapu quantus-node 512 MB, llama-server 213 MB, pearl-gateway 201 MB, bitcoind 119 MB |
| CPU | ~68 % idle, %system ~13 % (sar celý den stejný) |
| 3.3 staging | onboard `20261113T141211Z` (:3030, veřejně `3.3.zionterranova.com`), portal `20261113T153327Z`, market `20261112T203258Z`, realtime `20261112T173744Z`, update-server `20261113T071356Z`, kingdom + identity-33 active |
| 3.2 produkce | website (deploy 16. 11.), marketplace, kingdom :3020, zis :8096, db-sync — active |
| Vypnuté záměrně | `zion-db-sync-33`, `zion-v31-pool` (standby jen data) |
| sshd tunelů | `sshd: chaintunnel` ×2 (14. 11. a 16. 11.), **soft limit 1 024 fd**, `ssh.service LimitNOFILESoft=1024` |
| SSH | 674 neúspěšných přihlášení za 24 h na :22 |
| `/etc/cron.hourly` | `free`, `fstrim` |

### 2.4 Veřejné hostname (15. 11. 18:00, doplněno 16. 11.)

| Hostname | HTTP | Poznámka |
|---|---|---|
| `zionterranova.com` | 503 → **200 od 16. 11.** | IntroPage 3.2. Onboard 3.3 je na `3.3.zionterranova.com` (noindex, banner „Web je ve výstavbě") |
| `app.` | 200 | website 3.2, deploy 16. 11. |
| `market.` | 200 | MarketPlace 3.2 (:3100). 3.3 je :3102 |
| `nirvana.` `/api/health` | 200 | proto 38, `proto_match: true`, **0 spojení, 0 místností** |
| `kingdom.` | 200 | starý Kingdom :3020 |
| `kingdom.` `/net/health` | 200 | realtime proto 3, **0 spojení**, uptime 2,5 dne |
| `pool.` `rpc.` `auth.` `lumi.` | 200 | |
| `explorer.` | 301 | |
| `dashboard.` | 401 | basic auth, očekávané |
| `updates.` | 000 | DNS + cert čekají na 👤 |

Certifikáty: `app.` do 27. 12. 2026, `market.` do 29. 12. 2026, apex do 3. 1. 2027, `pool.` do 16. 1. 2027, **`auth.` do 24. 1. 2027**, `nirvana.` do 28. 1. 2027. `certbot.timer` na EDGE2 běží.

### 2.5 Repa

| | `3.3.0` | starý root `2.9.6` |
|---|---|---|
| HEAD | `aaaa8fe6c` (16. 11. 06:49), **1 commit nepushnutý** | `42bce12bb` (16. 11. 10:29), synchronní s `origin` |
| `.git` | 258 MB | 3,1 GB, z toho **532 MB trackovaných ZIPů** (EB-3.3 dávky a Hero balíčky ~160 MB přidané 12.–14. 11.) |
| Pracovní strom | **224 smazaných souborů `apps/lumi/**`** + upravené `infra/dns/zionterranova.com.zone{,.md}` — necommitnuté, z paralelní session | upravené lumi nginx + `newearth.cz.conf`, untracked `apps/lumi/deploy/nginx/lumi2.eu.conf`, `udrzba.md`, JPG |
| `npm run verify` | zelený — ale je to jen `typecheck && build`. Lint ani testy neobsahuje, i když to tvrdí `AGENTS.md` §5. `@zion/market` build ani `clients/desktop` v něm nejsou | — |
| `npm test` | vše zelené kromě `@zion/sdk`: skript volá `test/*.test.mjs`, ale adresář `test/` neexistuje (sdk nemá žádné testy) | — |
| CI | vypnuté na žádost 👤 | — |

---

## 3. Co už paralelní session 16. 11. vyřešila (neopakovat)

| Téma | Stav | Zdroj |
|---|---|---|
| G8 #7 | uzavřen jako `failed`, archivován | `REPORT_2026-11-16_G8_GATE_FAILED_DUAL_VANTAGE.md`, D-022 |
| G8 sonda | dvě stanoviště (EDGE1 přes tunel + EDGE2 na loopbacku), agregace `max by (service)` | tamtéž, `b9ef919b3` |
| Alert na pomalou cestu | `G8ProbePathSlow` (> 1 s po 10 min) | `93cc02306` |
| Pool RPC | vlastní tunel `127.0.0.1:9455` (`zion-chain-tunnel-pool`), fallback na lokální followery | `64f6a0f9c` |
| Linka | `tcp_reordering=10`, BBR, `fq` na obou boxech | tamtéž |
| QTC fronta | 60 455 → 0, ledger 18 → 2,7 MB, `QTC_PAYOUT_ENABLED=0` v env i v procesu, O-007 otevřené | `ed24cef65`, `REPORT_2026-11-16_LINK_SPLIT_QTC_WEB.md` |
| CODE_VS_DOCS / STATUS | pool build, G8 #8, apex IntroPage + 3.3 preview | `f652b89e3`, `7b73071ad`, `aaaa8fe6c` |
| ADMIN_API_KEY marketu | rotován 15. 11. (podle reportu, živě jsem neověřoval) | `REPORT_2026-11-15_EDGE_PRUZKUM.md` |
| Offsite pull záloh na Mac | launchd agenti `com.zion.pull-edge{,2}-backups` | `edd312fec` |
| Orchestrator (D-018) | `/dashboard/orchestrator`, 15/15 uzlů | `REPORT_2026-11-16_ORCHESTRATOR.md` |

Zlepšení je vidět i v datech: od přesunu poolu na vlastní tunel se počet ESTABLISHED spojení na EDGE1 přestal hromadit (15. 11. 17 UTC → 16. 11. 03 UTC rostl 37 → 226, od 06 UTC drží 37–47).

---

## 4. Otevřené nálezy

### 4.1 Tunel: limit 1 024 fd na straně EDGE2 (mechanismus výpadku 15. 11.)

**Fakta:**

- Tunel na EDGE1 od 15. 11. **12:21:19 CET** hlásil `channel 1035: open failed: connect failed: open failed`. Do 17:18 to bylo přes 55 000 hlášek (po hodinách 5 485 / 13 318 / 12 605 / 11 470 / 8 919 / 3 577). Čísla kanálů 1035–1042 znamenají, že na jednom SSH spojení bylo otevřených přes 1 000 kanálů.
- Na EDGE2 má proces `sshd: chaintunnel` **soft limit 1 024 fd** (`ssh.service`: `LimitNOFILESoft=1024`). Platí to i pro nové spojení otevřené 16. 11. 03:23.
- Sondy přes tunel padaly **rychle**: maximální doba sondy v 15minutových oknech byla 0,2–1 s. Timeout sondy je 3 s. Lokální sondy na EDGE1 (pool, followeři) byly celou dobu v pořádku.
- Počet ESTABLISHED spojení rostl celý den (EDGE1 ~700 → 800, EDGE2 ~1 080 → 1 300). Ve 17:18:16–18 spadl na 37 a 231, **do 30 s po tom, co watchdog restartoval primary node** (17:17:52). Hned potom sondy prošly.
- Na EDGE2 měly ZIS, DAO i multichain celou dobu `NRestarts=0` a EDGE2 byl ze ~68 % nevytížený.

**Interpretace:** Rychlé `open failed` u kanálů s ID nad 1 024 je podpis vyčerpaných file descriptorů v sshd procesu na EDGE2 (`socket()` → `EMFILE`). Saturace linky (vysvětlení z reportu 16. 11.) by vyráběla pomalé sondy a timeouty, ne rychlá odmítnutí. Obojí může platit současně: reordering a head-of-line blokování prodlužují život spojení, a ta se pak hromadí. Hromadící se spojení byla navázaná na RPC 9445 — zmizela s restartem nodu. Od přesunu poolu na vlastní tunel se nehromadí. **Kdo přesně je držel, je hypotéza** (nejpravděpodobněji pool přes sdílený tunel).

**Proč to není hotové:** guard `LimitNOFILE=8192` z 16. 11. je nastavený na unitách tunelu **na EDGE1** (klient `ssh`). Ten měl soft limit 65 536 už předtím. Strop, do kterého se 15. 11. narazilo, je na **EDGE2** a je pořád 1 024 — teď pro dva tunely místo jednoho.

**Doporučení:**

1. EDGE2: `systemctl edit ssh` → `[Service] LimitNOFILE=65536`, `systemctl restart ssh` (existující session to neshodí), pak restart `zion-chain-tunnel` a `zion-chain-tunnel-pool`, aby si nové sshd procesy limit vzaly. Ověřit `grep "open files" /proc/$(pgrep -f "sshd: chaintunnel$" | head -1)/limits`. Restart tunelu na chvíli přeruší EDGE1 stanoviště G8 — EDGE2 stanoviště evidenci drží (D-022). Pool přepne na followery.
2. Textfile metrika každou minutu: počet fd obou `sshd: chaintunnel` procesů a `ss -tan` po cílových portech tunelu. Alert, když fd > 600.
3. Střednědobě nahradit 18 forwardů jednoho SSH spojení **WireGuardem** mezi EDGE1 a EDGE2 (služby na wg IP, UFW allowlist). Žádné fd na kanál, žádný head-of-line. Report 16. 11. §5 bod 2 to navrhuje taky.

### 4.2 Hodinový cron v :17 (`drop_caches` + `fstrim`)

**Fakta:**

- Na **obou** boxech je `/etc/cron.hourly/free` (`echo 1 > /proc/sys/vm/drop_caches`) a `/etc/cron.hourly/fstrim` (`fstrim /`). Na EDGE2 mají soubory datum 21. 10. 09:21. `/etc/crontab` spouští `cron.hourly` v **:17**. Týdenní `fstrim.timer` od systemd běží navíc.
- `zion_node_rpc_block_read_latency_seconds` (Prometheus, 48 h, krok 1 min, n = 2 879):

| Minuta | Max | Průměr | Vzorků > 2 s |
|---|---:|---:|---:|
| :18 | 5,06 s | 0,648 s | 5 |
| :19 | 2,51 s | 0,610 s | 1 |
| :20 | 2,08 s | 0,254 s | 1 |
| :17 | 1,52 s | 0,140 s | 0 |
| ostatní (max. z nich) | 1,46 s | ~0,12–0,16 s | 0 |
| **celkem** | | **0,139 s** | **7** |

  Všech 7 vzorků nad 2 s padlo do minut :18–:20.
- Restarty primary nodu watchdogem EDGE2 za 7 dní: 12. 11. 15:17, 13. 11. 15:17, 14. 11. 08:17, 14. 11. 20:17, 15. 11. 17:17 — **všechny v :17**.
- G8 `chain_live` incidenty běhu #7: 8. 11. 23:17, 9. 11. 00:17, 00:21, 01:17, 12. 11. 17:17 (všechny 60 s) — taky :17. Report 15. 11. zmiňuje `l1-watcher` timeouty ve 04:17 a 07:17.

**Interpretace (silná korelace, kauzalita neověřená):** `drop_caches` vyhodí z page cache stránky SQLite DB nodu (i Postgresu a poolu). `fstrim` přidá I/O. Node čte přes jeden globální `Mutex<Connection>`, takže první minuty po :17 čtení vázne. Watchdog to vidí jako mrtvé RPC a node restartuje (§4.3). **Tohle je nejpravděpodobnější vysvětlení dlouho otevřené „G8 `chain_live` RCA".**

**Doporučení:** smazat `/etc/cron.hourly/free` na obou boxech. Na serveru s databázemi nemá `drop_caches` žádný přínos. Smazat i hodinový `fstrim` — týdenní `fstrim.timer` stačí. Nic se při tom nerestartuje, dá se to udělat hned i během běhu #8. Zálohu souborů dát do `/root/cron-hourly.bak-<datum>/`. **Ověření:** za 48 h stejný dotaz — minuty :18–:20 by měly splynout s průměrem a restarty v :17 by měly zmizet.

### 4.3 Watchdog restartuje primary node po jednom pokusu

**Fakta:** EDGE2 `/opt/zion/scripts/watchdog.sh` (timer ~1 min): `if ! check_node_http; then restart_service "$NODE_SERVICE" …`. Kontrola dělá jeden pokus s `timeout 5`. Počítadlo opakovaných selhání (pattern `/run/zion-watchdog/*-fails` z 12. 11., použitý pro pool API) tady není. Výjimka existuje jen pro start (grace 300 s a „process busy > 20 % CPU").

**Doporučení:** stejný pattern jako u pool API — restartovat node až po **3 po sobě jdoucích selháních** (~3 min). Do té doby jen logovat a alertovat. Kanonickou verzi upravit v `3.3.0/scripts/watchdog.sh`, nasadit kopií se zálohou. Primary s dvěma zdravými followery nemá důvod restartovat se kvůli 5s zádrhelu — restart sám dělá `chain_live` incident a shazuje spojení všem klientům.

### 4.4 Paměť poolu

**Fakta:**

- Prometheus `zion_pool_memory_bytes` (cgroup): před restartem 16. 11. drží **4,25–4,54 GB** (15. 11. 16 UTC → 16. 11. 02 UTC, build `aecfa6344`). Po startu `ed24cef65` (16. 11. 02:56 UTC): **551 MB → 2,12 GB (1 h) → 3,19 GB (4 h) → 3,81 GB (9 h)**. RssAnon 3,42 GB.
- Report memfixu z 13. 11. čekal „flat ~0,7–0,9 GB". Typované čtení RPC odstranilo jeden zdroj churnu, ale konečný stav je stejný jako předtím (plateau ~3,5–4,5 GB).
- `pool-pplns.json` má 122,6 MB a přepisuje se každých 30 s, PPLNS okno `500000000`. Pool má 64 vláken, `MemoryHigh=6G`, `MemoryMax=infinity`. Na stejném boxu běží těžba (~250 % CPU), followeři node2/3, nginx, Prometheus, Grafana, `zion-lumi`.

**Doporučení (v tomto pořadí):**

1. **Změřit, ne hádat:** jeden běh s `MALLOC_ARENA_MAX=2` v drop-inu. Pokud plateau spadne pod ~1,5 GB, je to fragmentace glibc arén (64 vláken), ne leak. Pak trvale přejít na jemalloc (`tikv-jemallocator`). Pokud ne, heap profil (`heaptrack` nebo jemalloc `prof`).
2. Nasadit PPLNS persist knob (po portu do 3.3, §4.5) s intervalem 120–300 s a ověřit, že se `pool-pplns.json` serializuje streamem (`to_writer` + `BufWriter`), ne přes 122MB `String`.
3. Zvážit menší PPLNS okno — to je změna payout semantiky, takže **👤**.
4. `MemoryMax` kolem 5,5 G jako pojistka, aby případné OOM zabilo pool (watchdog ho zvedne), a ne náhodně followera nebo `zion-lumi`.

### 4.5 Dva stromy V31

**Fakta:** `grep` 16. 11.:

| Změna | starý root `V31/` | `3.3.0/V31/` |
|---|---|---|
| `ZION_POOL_PPLNS_PERSIST_INTERVAL_S` (`edd312fec`, 15. 11.) | ✅ | ❌ |
| `try_lock` `/stats` (`00985e44d`) | ❌ | ✅ |
| typované RPC / memfix (`aecfa6344`) | ❌ | ✅ |
| `ZION_POOL_DISABLED_PAYOUT_CHAINS` (`ed24cef65`) | ❌ | ✅ |
| batch `getBlockByHeight` (`f5db9d232`) | ❌ | ✅ |

Běžící pool je postavený z 3.3, knob tedy nemá. Další build ze starého rootu by tiše vrátil čtyři opravy.

**Doporučení:**

1. Pravidlo bez výjimky: **V31 se mění jen v `3.3.0/V31`** (D-001, D-010). Starý `V31/` je zmrazený — dát do `V31/AGENTS.md` ve starém rootu hlavičku „NEEDITOVAT, kanon je 3.3.0/V31".
2. Přenést pool část `edd312fec` (12 řádků v `V31/L1/pool/src/main.rs`) do 3.3 (`git format-patch` → `git apply` ve `3.3.0`, cesty sedí), `cargo test -p zion-pool`, commit.
3. Pool stavět jen z commitu 3.3 s `ZION_GIT_SHA` a ověřit `/health.build` (už se tak děje).
4. Ops skripty z `edd312fec` (`scripts/pull-edge*-backups.sh`) a launchd agenti ukazují do starého rootu. Při archivaci starého rootu (F10) se rozbijí — zapsat do F10 checklistu a mezitím je přenést do `3.3.0/scripts/` (D-017).

### 4.6 Automatické aktualizace restartují required služby (hypotéza)

**Fakta:** 13. 11. v 06:15:01 se na EDGE2 spustil `apt-daily-upgrade` a v 06:17:44–48 se restartovaly `sshd`, `zion-zis`, `zion-v31-dao`, `zion-v31-multichain` i node. ZIS, DAO a multichain od té doby běží bez restartu. V `needrestart.conf` jsem nenašel explicitní `$nrconf{restart}`. Default Ubuntu 24.04 v neinteraktivním režimu služby restartuje automaticky.

**Doporučení:** ověřit v `/var/log/unattended-upgrades/` a `/var/log/apt/history.log` z 13. 11. Pokud se potvrdí, přidat `/etc/needrestart/conf.d/zion.conf` s `$nrconf{override_rc}` pro `zion-*` (jen hlásit, nerestartovat) a restarty dělat v plánovaném okně. Jinak se služby počítané do G8 restartují v náhodnou ranní hodinu.

### 4.7 Dokumenty a rozhodnutí

| # | Rozpor | Co s tím |
|---|---|---|
| 1 | **Dvě různá D-022.** `v3.3Nirvana.md` §9.1: D-022 = batch `getBlockByHeight`, D-023 = shadow sonda, D-024 = flippy na 👤. `DECISIONS.md`: D-022 = G8 dual vantage (16. 11.), **D-023 a D-024 tam vůbec nejsou** | V `DECISIONS.md` doplnit D-022/23/24 z masteru a G8 rozhodnutí přečíslovat na **D-025**. Opravit odkazy v STATUS, CODE_VS_DOCS a reportu |
| 2 | D-022 (16. 11.) píše o „prosincových kotvách (cert `auth.`, výška 144 000)" | TLS cert `auth.` platí do **24. 1. 2027** (pokud byla myšlena jiná kotva než TLS, doplnit ji). Výška 144 000 přijde podle tempa **kolem 29. 11.** Opravit (§5) |
| 3 | `AGENTS.md` (3.3) §5: „`npm run verify` = tsc + lint + testy" | Skutečnost je `typecheck && build`. Buď doplnit `npm test` a lint do verify, nebo opravit text. Doporučuji doplnit — CI je vypnuté, takže verify je jediná brána |
| 4 | `@zion/sdk` má `test` skript bez testů | Napsat testy (BIP39, Ed25519, adresy, podpis — `packages/sdk` drží peněženku, tohle je money-path), nebo skript zatím smazat |
| 5 | `@zion/market` build a `clients/desktop` nejsou ve `verify` | Přidat — market je money-path |
| 6 | Starý root `AGENTS.md` = 356 KB / 1 689 řádků. Always-on pravidlo se ořízne na 16 KB, takže agent vidí jen 2–3 nejnovější bloky a pravidla dole nikdy | Zkrátit na ~100 řádků pravidel + odkaz na `3.3.0/AGENTS.md`. Historii přesunout (ne smazat) do `docs/3.2/AGENTS_HISTORY_2026.md` |
| 7 | `ROADMAP.md` (26. 10.) mluví o G8 běhu #6 | Dát banner „historické" jako `PLAN.md` |
| 8 | Report 15. 11. (`REPORT_2026-11-15_EDGE_PRUZKUM.md`) leží ve starém rootu | Nové reporty patří do `3.3.0/docs/reports/` (3.3 `AGENTS.md` §9) |

### 4.8 Necommitnutý stav v `3.3.0`

V pracovním stromu `3.3.0` je **224 smazaných souborů `apps/lumi/**`** a upravená DNS zóna. Neudělal jsem to já — je to z paralelní session nebo ruční zásah. `apps/lumi` je v 3.3 trackovaný od `7d964944e` (12. 11.), přestože D-016 říká, že Lumi do 3.3 nepatří.

**Doporučení:** rozhodnout záměr (👤). Pokud má Lumi z 3.3 odejít podle D-016, udělat to vědomým commitem `git rm -r apps/lumi` s odkazem na D-016 a ověřit, že deploy `lumi.` jede ze starého rootu (`apps/lumi/deploy/`). Hlavně **nespouštět `git add -A`** (3.3 `AGENTS.md` §10), jinak se smazání commitne omylem spolu s něčím jiným. DNS změny commitnout zvlášť.

### 4.9 Vývoj běží dvakrát

Od 13. 11. přistálo do **3.2** (starý root): wallet funkce a nový deploy `app.`, 75 3D avatarů v nirvaně, IntroPage menu, banner a apex, Lumi, Kingdom desktop wallet backport, pool knob. Do **3.3** ve stejné době: portal session, design, G8, tunel, QTC, onboard banner. Všechny čtyři nové appky jsou hotové na stagingu od 12.–13. 11. a veřejně je nikdo nevidí.

**Riziko:** každá nová funkce v 3.2 se musí znovu udělat v 3.3 (D-007), jinak flip znamená regresi. Například tab **Přijmout** a UTXO count z `app.` 16. 11. — ověřit, že je má i `apps/portal`. Parita portálu (`probe:parity` 22/22) byla změřená před tímto deployem.

**Doporučení:** od teď **feature freeze v 3.2** — jen ops opravy a Lumi (D-016). Novou funkci psát jen do 3.3. Výjimky zapisovat do `3.3.0/docs/migration/PORT-FROM-3.2.md` jako dluh k portu. Před každým flipem znovu pustit `probe:parity` a `probe:surface`.

### 4.10 Kapacity a skutečné používání

- **EDGE1 je nejzatíženější box a nese nejvíc rolí:** stratum, followeři, monitoring, ops, `zion-lumi`, nginx pro 9 vhostů — a k tomu ~250 % CPU vlastní těžby do vlastního walletu. Volné RAM 1,3–2,1 GB proti 4,4 GB poolu.
- **Decentralizace:** report 15. 11. naměřil, že 100 % posledních 100 bloků vytěžil vlastní miner. Pro Stable, listing (CoinGecko) a bezpečnost chainu je to slabé místo. Technicky to není chyba, ale musí to být vědomé rozhodnutí.
- **Používání:** realtime 0 spojení, nirvana 0 spojení, pool 3 mineři (všichni naši). 3.3 přidává povrchy, které zatím nikdo nepoužívá.
- **EDGE2 swap** roste (1,96 → 2,3 GB za 20 h). quantus-node (QTC mining leg dál běží), pearl, bitcoind (31 GB dat) a llama drží paměť. Po flipu 3.3 a vypnutí 3.2 služeb se uvolní paměť 3.2 Next serverů (website, marketplace, kingdom :3020).
- **Disk EDGE1:** `hiran` modely 23 GB a `canonical-main` 2,6 GB (checkout z 29. 9.) — kandidáti na archiv mimo box (👤, report 15. 11. O10).

### 4.11 Kontinuita a bezpečnost

Z `TRUSTEE-CONTINUITY.md` ČÁST 13 (0/15) a auditu vybírám to, co je nejdražší, když chybí:

| Priorita | Co | Proč teď |
|---|---|---|
| 1 | **Druhá offsite záloha nezávislá na Macu + zkušební obnova** na čistém VPS (blokátory 1 a 14) | Launchd na Macu je první krok, ale Mac je pořád jediné místo mimo servery. DR drill 2. 11. byl jen dry-run (varianta A). Obnova nikdy neproběhla |
| 2 | **Rotace trustee walletu** (blokátor 10) | Mnemonic prošel chatem, adresa je zároveň payout adresa EDGE těžby. Money-path = 👤, ale nečekat |
| 3 | EDGE2 SSH: allowlist nebo port 2222 jako EDGE1 | 674 pokusů za 24 h. Riziko 0-day v sshd + hluk v logu |
| 4 | Přístupy pro Eriku (SSH klíč, GitHub, Contabo, Webglobe, password manager) — blokátory 2–6 | Bez nich je kontinuitní manuál jen přání |
| 5 | P0-3: rotace PRL RPC credentialu + env subsety po službách | Otevřené od začátku listopadu |
| 6 | 3 admin klíče (Rama/Sita/Hanuman) — fyzické umístění (blokátor 15) | Nutné před kotvou 144 000 (§5) |

---

## 5. Kalendář a kotvy

| Datum | Událost | Dopad |
|---|---|---|
| **17.–18. 11.** | doporučené servisní okno (§6 fáze A) | začátek běhu #8, rozpočet výpadků je plný |
| **~29. 11.** (±1 den) | **výška 144 000** — `DAO_TREASURY_LOCK_HEIGHT` (`V31/L1/core/src/v3_compat.rs:42`), uvolnění timelock slotů premine (`docs/ops/legacy/3.2/PREMINE_144K_CHECKLIST.md`, 3-of-3 admin + DAO) | L1 událost **uprostřed** běhu #8. Checklist počítal s koncem G8 #6 (28. 11.) — přepsat na běh #8. Žádný restart required služeb kolem té výšky. Pohyb premine jen 👤 |
| 12. 12. | 30 dní od gates 1–4 marketu (12. 11.) | nejdřívější technický termín flipu `market.` |
| **16. 12. 01:55 UTC** | konec běhu #8 | Stable sign-off 👤 |
| 24.–26. 12. | Vánoce — hlavní prodejní okno Lumi (`lumi.` na EDGE1) a lampionů v marketu | nic rizikového na EDGE1 ani na money-path |
| 27. 12. / 29. 12. | expirace certů `app.` / `market.` | certbot renew; ověřit 14 dní předem |
| leden 2027 | flip `market.` a `auth.`, vypnutí 3.2 | po Vánocích |

Rozpočet běhu #8: 99,9 % z 30 dní = **~43 min** výpadků na službu a žádný jednotlivý incident ≥ 900 s. Plánovaný restart poolu (~10 s) stojí jeden 60s vzorek.

---

## 6. Doporučený postup

Značky: 🤖 = autonomně (agent), 🔀 = připraví agent, spustí 👤, 👤 = rozhodnutí operátora.

### Fáze A — servisní okno, tento týden (17.–18. 11.)

Cíl: zavřít příčiny, než se běh #8 rozjede. Každý krok má rollback do 15 min.

| # | Krok | Kdo | Ověření | Rollback |
|---|---|---|---|---|
| A1 | Smazat `/etc/cron.hourly/{free,fstrim}` na EDGE1 i EDGE2 (záloha do `/root/`) | 🔀 | 48 h latence :18–:20 ≈ průměr, žádný restart v :17 | vrátit soubory |
| A2 | Watchdog EDGE2: 3 striky pro node (`/run/zion-watchdog/node-fails`), nejdřív v `3.3.0/scripts/watchdog.sh` | 🤖 kód, 🔀 nasazení | `bash -n`, simulace 1 a 3 selhání, log | `watchdog.sh.bak-*` |
| A3 | EDGE2 `ssh.service` `LimitNOFILE=65536`, restart ssh a obou tunelů | 🔀 | `/proc/<sshd chaintunnel>/limits` = 65536, sondy obou stanovišť `up` | smazat drop-in, restart |
| A4 | Metrika + alert: fd `sshd: chaintunnel` > 600, spojení po portech tunelu | 🤖 | `promtool test rules` s firing testem | smazat pravidlo |
| A5 | Port PPLNS knobu do `3.3.0/V31`, `cargo test -p zion-pool` | 🤖 | 448/1 (známý pád) | git revert |
| A6 | Pool redeploy z 3.3: knob 180 s + test `MALLOC_ARENA_MAX=2` | 🔀 | `/health.build`, `zion_pool_memory_bytes` 24 h, accept/reject, payout sweep | `zion-pool.bak-ed24cef65-*` |
| A7 | Ověřit needrestart (§4.6), případně override pro `zion-*` | 🤖 průzkum, 🔀 změna | log apt z 13. 11. | smazat conf |
| A8 | Truth-sync dokumentů (§4.7 body 1–5), commit v 3.3 | 🤖 | `check-doc-links` 0 chyb | git revert |
| A9 | Rozhodnout o 224 smazaných `apps/lumi` v 3.3 (§4.8) | 👤 | čistý `git status` | `git checkout -- apps/lumi` |
| A10 | `PREMINE_144K_CHECKLIST` přepsat na běh #8 a ~29. 11., zjistit, kde jsou 3 admin klíče | 🤖 text, 👤 klíče | checklist v `3.3.0/docs/ops/` | — |

### Fáze B — během běhu #8 (do 16. 12.), bez zásahu do required služeb

| # | Krok | Kdo | Brána |
|---|---|---|---|
| B1 | **Feature freeze 3.2** (§4.9), nové funkce jen v 3.3 | 👤 rozhodnutí | zapsat jako D-026 |
| B2 | Dorovnat paritu portálu po deployi `app.` z 16. 11. (tab Přijmout, UTXO count, oprava `?address=`) | 🤖 | `probe:parity` + `probe:surface` zelené |
| B3 | Flip **apexu** na onboard 3.3 (dnes `3.3.zionterranova.com`) | 👤 vizuální sign-off → 🔀 | 301 mapa, Lighthouse ≥ 90, rollback = `udrzba.md` |
| B4 | Flip **`app.`** → portál :3002 + vykonat 301 mapu (`flip-portal.sh`) | 👤 → 🔀 | CoinGecko/CMC payload shodný (`/api/supply/*`, `/api/listing/*`), 404 monitoring 7 dní |
| B5 | Flip **`kingdom.`/`nirvana.`** → kingdom :3010 (vypnout proto 38 spolu s nirvana-net) | 👤 → 🔀 | §6 `KINGDOM.md`, klient a server protokolu spolu |
| B6 | Kotva **144 000** (~29. 11.) podle checklistu | 👤 | žádný incident G8 v ten den |
| B7 | DNS + cert `updates.` (D-019) | 👤 Webglobe | `https://updates.…/health` 200 |
| B8 | Druhá offsite záloha + **zkušební obnova** na jednorázovém VPS | 🔀 | obnovený node dojede na tip, obnovená Postgres DB projde `schema:check` |
| B9 | F9f: podepsané buildy desktopu (Apple Developer ID, Windows cert) | 👤 náklad → 🤖 build | `RELEASE.md` matice, SHA256SUMS |
| B10 | Návrh WireGuard EDGE1↔EDGE2 (runbook, bez nasazení) | 🤖 | runbook + rollback |

Mezi flipy B3–B5 nechat aspoň 2–3 dny monitoringu 404/5xx. Jsou to povrchy mimo G8, ale sdílí nginx na EDGE2.

### Fáze C — po běhu #8 a po Vánocích (prosinec–leden)

| # | Krok | Kdo |
|---|---|---|
| C1 | Stable sign-off (G8 #8), podepsaný tag a release z RC commitu (9.S1) | 👤 |
| C2 | Flip `auth.` → ZIS 3.3 :8099, sondu `zis` přepnout na :8099 ve stejném kroku | 👤 → 🔀 |
| C3 | Flip `market.` → :3102 (30 dní parity jsou splněné od 12. 12.), money-path e2e na produkci s malou objednávkou | 👤 |
| C4 | Vypnout 3.2 služby (website, marketplace, kingdom :3020, nirvana, nirvana-net) — po 30 dnech bez 404 nárůstu | 🔀 |
| C5 | WireGuard místo SSH tunelů, zrušit `zion-chain-tunnel*` | 🔀 |
| C6 | `apt upgrade` + reboot EDGE1 a EDGE2 v plánovaném okně | 🔀 |
| C7 | Pool HA: aktivovat warm standby, nebo vědomě nechat manuální (blokátor 11) | 👤 |
| C8 | Self-mining: snížit nebo přesunout na Vast/rigy, plán externích minerů (public miner F9f + `updates.`) | 👤 |
| C9 | F10: archiv starého rootu, přenos launchd/ops skriptů do 3.3, výběr firmy pro G9 audit | 🔀 / 👤 |

---

## 7. Rozhodnutí pro 👤

| # | Otázka | Doporučuji | Proč |
|---|---|---|---|
| 1 | Servisní okno A1–A7 tento týden | **ano** | běh #8 je na začátku, rozpočet je plný, příčiny jsou známé |
| 2 | Smazat hodinový `drop_caches` a `fstrim` | **ano** | žádný přínos, změřená škoda, nic se nerestartuje |
| 3 | Feature freeze v 3.2 | **ano** | jinak se migrace nedokončí a parita se rozjíždí |
| 4 | Pořadí flipů | apex → `app.` → `kingdom.`/`nirvana.` během #8; `auth.` + `market.` v lednu | povrchy mimo G8 teď, money-path a auth po Vánocích |
| 5 | `apps/lumi` v 3.3 | odstranit commitem podle D-016 | rozhodnutí už existuje, jen ho dotáhnout |
| 6 | PPLNS okno menší | nejdřív změřit `MALLOC_ARENA_MAX` | změna okna mění payouty |
| 7 | Self-mining na EDGE1 | snížit až po externích minerech, mezitím nechat | chain je dnes na vlastní těžbě závislý |
| 8 | Trustee wallet | rotovat do konce listopadu | mnemonic prošel chatem |
| 9 | Hiran modely 23 GB + `canonical-main` na EDGE1 | archivovat mimo box | disk 67 % |
| 10 | ZIPy v gitu starého rootu (532 MB) | přestat přidávat, nové balíčky do Releases/object storage. Přepis historie jen po samostatném rozhodnutí | D-008, `.git` 3,1 GB |
| 11 | Podpisové certifikáty Apple/Windows | rozhodnout náklad | bez nich F9f neskončí a externí mineři nepřijdou |
| 12 | O-007 QTC treasury | nechat leg vypnutý, dokud není funding | fronta už neroste (ed24cef65) |

---

## 8. Co bych teď nedělal

- Nové hry, světy a povrchy (ani ve 3.2, ani ve 3.3), dokud nejsou B3–B5 venku.
- Změny L1 (konsensus, emise, genesis) — kotva 144 000 je dost.
- Restart required služeb mimo plánované okno, a už vůbec ne kolem výšky 144 000.
- Flip `market.` v prosinci.
- `git add -A` v kterémkoli repu, dokud běží paralelní session.
- Commity ZIPů a zdrojových PNG do gitu.

---

## 9. Příloha — jak ověřit nálezy

```bash
# 4.1 limit sshd tunelu na EDGE2
ssh zion-edge2 'for p in $(pgrep -f "sshd: chaintunnel$"); do grep "open files" /proc/$p/limits; ls /proc/$p/fd | wc -l; done; systemctl show ssh -p LimitNOFILESoft'

# 4.1 chyby tunelu po hodinách (EDGE1)
ssh edge 'journalctl -u zion-chain-tunnel --since today -o short-iso | grep "open failed" | cut -c12-13 | sort | uniq -c'

# 4.2 hodinový cron
ssh zion-edge2 'grep cron.hourly /etc/crontab; ls -la /etc/cron.hourly; cat /etc/cron.hourly/free'

# 4.2 latence čtení bloku po minutách (EDGE1 Prometheus)
ssh edge 'curl -sG http://127.0.0.1:9090/api/v1/query_range \
  --data-urlencode "query=max(zion_node_rpc_block_read_latency_seconds)" \
  --data-urlencode "start=$(date -u -d "-48 hours" +%FT%TZ)" --data-urlencode "end=$(date -u +%FT%TZ)" \
  --data-urlencode step=60'

# 4.3 restarty primary nodu watchdogem
ssh zion-edge2 'journalctl --since "7 days ago" | grep "RESTART: zion-v31-node"'

# 4.4 paměť poolu
ssh edge 'curl -s 127.0.0.1:8080/health; grep RssAnon /proc/$(systemctl show zion-v31-pool -p MainPID --value)/status'

# 4.5 rozdvojený V31
grep -c ZION_POOL_PPLNS_PERSIST_INTERVAL_S V31/L1/pool/src/main.rs 3.3.0/V31/L1/pool/src/main.rs

# §5 odhad výšky 144 000
curl -s -H 'content-type: application/json' -d '{"jsonrpc":"2.0","id":1,"method":"getChainInfo","params":{}}' https://rpc.zionterranova.com/jsonrpc
```
