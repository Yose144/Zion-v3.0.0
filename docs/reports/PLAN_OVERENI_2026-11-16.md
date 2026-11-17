# Plán ověření po servisním okně A — 16. 11. 2026

> **Navazuje na:** [`DOPORUCENI_2026-11-16.md`](DOPORUCENI_2026-11-16.md) (audit, fáze A–C)
> **Technický detail provedeného:** `3.3.0/docs/reports/REPORT_2026-11-16_SERVISNI_OKNO_A.md`
> **Stav:** fáze A hotová 16. 11. ~14:00–15:00 CET. Tenhle plán je **ověření, že to drží** — ne seznam dalších oprav.
> **Proč samostatný soubor:** „hotovo a nasazeno" není totéž jako „funguje". U šesti z deseti kroků se výsledek pozná až za dny (paměť poolu, latence v :17), takže bez plánu se na to zapomene.

---

## 0. Co je hotové a co se jen čeká

| Krok | Stav | Kdy se pozná výsledek |
|---|---|---|
| A1 cron `drop_caches`+`fstrim` pryč | nasazeno | **48 h** (18. 11.) |
| A2 watchdog 3 striky (EDGE1+EDGE2) | nasazeno | až přijde reálný stall (nebo 7 dní bez restartu) |
| A3 fd limit sshd tunelu 1 024 → 65 536 | nasazeno, ověřeno živě | **7 dní** bez `open failed` v journalu |
| A4 metrika + 4 alerty na fd | nasazeno | alerty samy (0 firing) |
| A5 PPLNS knob do 3.3 | commit `151b37793` | hotovo |
| A6 pool redeploy + arena cap | nasazeno | **24 h** plateau paměti (17. 11.) |
| A7 `needrestart` nerestartuje `zion-*` | nasazeno | až přijde další apt upgrade |
| A8 truth-sync dokumentů + testy SDK | hotovo | hotovo |
| A9 `apps/lumi` pryč z 3.3 | hotovo (`05cb258f3`) | hotovo |
| A10 premine 144k checklist | hotovo | **~29. 11.** |
| 4 služby doenabledované (mimo doporučení) | hotovo | až reboot |

---

## 1. Kontrolní body podle data

### 📅 17. 11. (útok, T+24 h) — paměť poolu

**Rozhoduje experiment `MALLOC_ARENA_MAX=2`.** Před restartem držel pool 4,25–4,54 GB na boxu s 7,9 GB RAM.

```bash
ssh edge 'curl -sG http://127.0.0.1:9090/api/v1/query \
  --data-urlencode "query=max_over_time(zion_pool_memory_bytes[24h])" \
  | python3 -c "import sys,json;v=json.load(sys.stdin)[\"data\"][\"result\"][0][\"value\"][1];print(round(int(float(v))/1048576,1),\"MiB peak\")"'
```

**Pozor na okno:** restart poolu byl 16. 11. 14:38, takže `[24h]` má smysl číst až **17. 11. po 14:38** — jinak do peaku započítá starý build. Dnes (16. 11. večer) vychází 4 487 MiB peak, ale to je **starý build před restartem**, ne výsledek experimentu.

| Výsledek | Co to znamená | Další krok |
|---|---|---|
| plateau **< 1,5 GB** | byly to glibc arény (64 vláken), ne leak | 🔀 přejít na `tikv-jemallocator`, `MALLOC_ARENA_MAX` zahodit |
| plateau **1,5–3 GB** | částečný efekt | 🔀 nechat, měřit dalších 7 dní |
| plateau **> 3,5 GB** | fragmentace to není | 🤖 heap profil (`heaptrack` / jemalloc `prof`) |
| **OOM nebo restart** | `MemoryMax` chybí | 🔀 okamžitě `MemoryMax=5,5G` (viz §4) |

Zároveň zkontrolovat, že delší persist interval neublížil payoutům:

```bash
ssh edge 'curl -s http://127.0.0.1:8080/metrics | grep -E "^zion_pool_payouts_unconfirmed "'
#   očekáváno: desítky, ne tisíce; nejstarší payout nesmí být starší než pár hodin
```

### 📅 18. 11. (st, T+48 h) — potvrzení A1 (a klidně i dřív, když se chcete podívat)

**Tohle je jediné místo, kde se dá změřit, že smazání cronu něco přineslo.** Pokud ano, je to zároveň odpověď na dlouho otevřenou „G8 `chain_live` RCA".

```bash
# 1) latence čtení bloku po minutách — :18–:20 musí splynout s průměrem
#    POZOR: 48h okno musí být CELÉ po změně (ta proběhla 16. 11. ~14:02).
#    Když to pustíš dřív než 18. 11. odpoledne, uvidíš ještě stará data
#    a bude to vypadat, že se nic nezměnilo.
ssh edge 'curl -sG http://127.0.0.1:9090/api/v1/query_range \
  --data-urlencode "query=max(zion_node_rpc_block_read_latency_seconds)" \
  --data-urlencode "start=$(date -u -d "-48 hours" +%FT%TZ)" \
  --data-urlencode "end=$(date -u +%FT%TZ)" --data-urlencode step=60' \
| python3 -c "
import sys,json,collections,statistics,datetime
d=json.load(sys.stdin)['data']['result'][0]['values']
b=collections.defaultdict(list)
for ts,v in d:
    b[datetime.datetime.fromtimestamp(float(ts), datetime.timezone.utc).minute].append(float(v))
print('minuta  max    avg    n')
for m in (17,18,19,20,21):
    print(f'{m:>4}  {max(b[m]):.2f}  {statistics.mean(b[m]):.3f}  {len(b[m])}')
"
```

**Naměřeno 16. 11. (okno ještě obsahuje starý stav, proto ta čísla):**

| minuta | max | avg |
|---|---:|---:|
| :17 | 0,23 s | 0,061 s |
| **:18** | **5,06 s** | **0,575 s** | ← tady je vidět starý `drop_caches` |
| :19 | 0,73 s | 0,146 s |
| :20 | 0,78 s | 0,082 s |
| :21 | 0,91 s | 0,080 s |

Referenční čísla ze starého 48h okna (před změnou): :18 max 5,06 s / avg 0,648 s, :19 2,51 s / 0,610 s, :20 2,08 s / 0,254 s, ostatní ~1,4 s / 0,12–0,16 s. Takže :18 musí spadnout k ~0,1 s, aby to byl efekt.

```bash
# 2) restarty primary nodu — v :17 už nesmí být ani jeden
ssh zion-edge2 'journalctl --since "7 days ago" | grep "RESTART: zion-v31-node"'
```

| Výsledek | Verdikt |
|---|---|
| max v :18–:20 ≈ max v ostatních minutách a 0 restartů v :17 | **kauzalita potvrzena**, doporučení bylo správné |
| max v :18–:20 pořád 3–5× vyšší | `drop_caches` nebyl příčina → hledat dál (fstrim.timer, LUKS, disk) |
| restarty v :17 zmizely, latence ne | watchdog 3-strike to maskuje — dobré pro G8, ale příčina zůstává |

Výsledek zapsat do `3.3.0/docs/reports/` jako krátký dodatek k REPORT_2026-11-16_SERVISNI_OKNO_A.md.

### 📅 23. 11. (po, T+7 dní) — ticho ve třech věcech

```bash
# a) fd tunelu: žádný růst, žádné "open failed"
ssh edge 'journalctl -u zion-chain-tunnel -u zion-chain-tunnel-pool --since "7 days ago" | grep -c "open failed"'
#   očekáváno: 0   (15. 11. jich bylo 55 000+)
ssh edge 'curl -sG http://127.0.0.1:9090/api/v1/query \
  --data-urlencode "query=max_over_time(zion_sshd_tunnel_fds[7d])"'

# b) žádný restart required služeb
ssh zion-edge2 'journalctl --since "7 days ago" | grep -cE "RESTART: (zion-v31-node|zion-v31-pool)"'

# c) G8 běh #8 — uptime a incidenty
ssh edge 'python3 -c "import json;d=json.load(open(\"/opt/zion/data/g8_run.json\"));print(len(d.get(\"incidents\",[])),\"incidentu, gate\",d.get(\"gate_status\"))"'
```

### 📅 ~29. 11. (±1 den) — kotva 144 000

Postup v `3.3.0/docs/ops/PREMINE_144K_CHECKLIST.md`. Tři body, které se nesmí podcenit:

- v den unlocku **žádný restart required služeb** a žádný deploy,
- 3 admin klíče fyzicky k dispozici (**👤**, jediná věc, kterou agent neověří),
- když 144k padne do G8 incidentu → unlock **odložit na další blok**.

Přepočítat termín podle živé výšky: `(144000 − výška) × 60,6 s`.

### 📅 16. 12. 01:55 UTC — konec G8 běhu #8

- `gate_status` → `passed`/`failed`, Stable sign-off (**👤**).
- Teprve pak má smysl mluvit o rebootu do jádra a o flipech.

### 📅 po 16. 12. — reboot do jádra 6.8.0-149

Postup v `3.3.0/docs/ops/REBOOT.md` (pořadí EDGE1 → EDGE2, pre-flight, fallback na 6.8.0-147). Dnes jsou oba boxy na 6.8.0-147 a `needrestart` hlásí „Pending kernel upgrade" — bez rebootu nejsou záplaty jádra nasazené.

---

## 2. Rozhodovací body (👤)

| # | Otázka | Deadline | Moje doporučení |
|---|---|---|---|
| 1 | **Feature freeze v 3.2** (D-026) | teď | ano — jinak se každá nová funkce musí dělat dvakrát (§4.9 doporučení) |
| 2 | PPLNS okno menší (`--pplns-window-size 500000000`) | až po 24h měření paměti | nejdřív vědět, jestli paměť dělají arény; okno mění payouty |
| 3 | `MemoryMax` pro pool (dnes `infinity`, `MemoryHigh=6G`) | s rozhodnutím o paměti | `MemoryMax=5,5G` — ať případné OOM zabije pool, ne followera nebo `zion-lumi` |
| 4 | Rotace trustee walletu (mnemonic prošel chatem) | do konce listopadu | ano |
| 5 | Druhá offsite záloha + **zkušební obnova** | před Stable sign-off | ano — obnova nikdy neproběhla (kontinuita 0/15) |
| 6 | Podpisové certy Apple/Windows (F9f) | před externími minery | rozhodnout náklad |

---

## 3. Otevřené technické nálezy (bez data)

| # | Nález | Závažnost | Co s tím |
|---|---|---|---|
| 1 | **PRL upstream padá ~2,8×/h** (`pearl-eu2.luckypool.io`, `connection closed by peer`). Před i po restartu poolu stejné → není regrese | nízká (mining leg jede, payout leg `QTC_PAYOUT_ENABLED=0`) | alerty `ZionPoolLegDisconnected`/`JobStale` to zachytí; řešit až bude PRL leg ekonomicky zajímavý |
| 2 | `pearl_stratum_end_to_end` **deterministicky padá** (448/1) | nízká | opravit test nebo označit `#[ignore]` s vysvětlením — červený test v sadě se přestane číst |
| 3 | **D-023:** shadow sonda G8 na `:9106` pořád není přepnutá na živou evidenci | — | záměrně až po 16. 12. (evidence se během okna nemění) |
| 4 | Kdo držel 15. 11. >1 000 kanálů tunelu | nízká | hypotéza (pool přes sdílený tunel); recidivu zachytí `ZionSshTunnelFdGrowth`, důkaz už ne |
| 5 | **Kotva 144k padá doprostřed běhu #8** | střední | checklist hotový, hlídat den unlocku |
| 6 | Self-mining: 100 % bloků těží vlastní miner | střední (decentralizace) | 👤 rozhodnutí, viz doporučení §4.10 |

---

## 4. Rychlý zdravotní snapshot (kdykoli)

```bash
# EDGE1
ssh edge 'curl -s http://127.0.0.1:8080/health; echo
curl -s http://127.0.0.1:8080/metrics | grep -E "^zion_pool_(active_sessions|payouts_unconfirmed) "
systemctl list-units --state=failed --no-legend --no-pager | wc -l'

# EDGE2
ssh zion-edge2 'curl -s -H "content-type: application/json" \
  -d "{\"jsonrpc\":\"2.0\",\"id\":1,\"method\":\"getChainInfo\",\"params\":[]}" \
  http://127.0.0.1:9445 | head -c 200; echo
for p in $(pgrep -f "sshd: chaintunnel$"); do grep "open files" /proc/$p/limits; done
systemctl list-units --state=failed --no-legend --no-pager | wc -l'

# G8 + alerty
ssh edge 'python3 -c "import json;d=json.load(open(\"/opt/zion/data/g8_run.json\"));print(len(d.get(\"incidents\",[])),\"incidentu\")"
curl -s http://127.0.0.1:9090/api/v1/alerts | python3 -c "import sys,json;print(len(json.load(sys.stdin)[\"data\"][\"alerts\"]),\"alertu\")"'
```

---

## 5. Rollbacky (kde co je)

| Co | Kde | Jak vrátit |
|---|---|---|
| Pool `ed24cef65` | EDGE1 `/root/zion-pool.bak-ed24cef65-20261116` (sha `0c8d3e1c…`) | `/root/rollback-pool-20261116.sh` |
| Pool drop-in (knob + arena) | `/etc/systemd/system/zion-v31-pool.service.d/zzz-pplns-arena.conf` | smazat + `daemon-reload` + restart |
| Watchdog EDGE2 | `/opt/zion/scripts/watchdog.sh.bak-nodestrikes-20261116` | `cp` zpět |
| Watchdog EDGE1 | `/opt/zion/scripts/watchdog.sh.bak-nodestrikes-20261116` | `cp` zpět |
| cron `free`/`fstrim` | `/root/cron-hourly.bak-2026-11-16/` (oba boxy) | `cp` zpět do `/etc/cron.hourly/` |
| sshd fd limit | `/etc/systemd/system/ssh.{service,socket}.d/limitnofile.conf`, `/etc/security/limits.d/zion-ssh-nofile.conf` | smazat + `daemon-reload` (+ restart ssh) |
| Alerty fd | `/etc/prometheus/rules/zion-ssh-tunnel.rules.yml` + `prometheus.yml` | `prometheus.yml.bak-sshtunnel-20261116` |
| `needrestart` override | `/etc/needrestart/conf.d/zion.conf` | smazat |
| 4 doenabledované služby | `/etc/systemd/system/multi-user.target.wants/` | `systemctl disable <unit>` |

---

## 6. Jedno pravidlo nad celým plánem

Když se výsledek měření rozchází s tímhle plánem, **platí měření**. Plán je odhad; kód, on-chain data a sonda jsou pravda (hierarchie v `3.3.0/AGENTS.md` §2). A když je cokoli nejasné u peněz, klíčů nebo L1 — zastavit a zeptat se.
