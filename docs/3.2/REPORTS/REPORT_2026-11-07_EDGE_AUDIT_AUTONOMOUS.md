# EDGE1 / EDGE2 a další autonomní práce — 2026-11-07

> **Výsledek:** hlavní služby fungují, monitoring ale není úplný. Další priorita: ochrana objednávek, slepá místa monitoringu a průkaznost deployů/release artefaktů.
> **Měření:** přibližně 00:43–00:48 CET (2026-11-06 23:43–23:48 UTC). Snapshot, nikoli dlouhodobý soak nebo bezpečnostní certifikace.
> **Režim:** čtení produkce přes SSH/HTTPS, SQL `mode=ro` + `query_only`, revize kódu a lokální verifier fixture. **Žádný restart, deploy, DNS změna, nákup, výplata, změna klíčů či reset G8.** V repu pouze dokumentační změny.

## 1. Živý stav

| Oblast | Ověřeno |
|---|---|
| EDGE1 | 4 vCPU, load ~2; disk **85/145 GB (59 %)**; dostupná RAM **2 189 MiB**, použitý swap **1 021 MiB** |
| EDGE2 | 6 vCPU, load ~1,7; disk **113/193 GB (59 %)**; dostupná RAM **5 651 MiB**, použitý swap **2 256 MiB** |
| Systemd | Žádná failed `zion-*` služba. EDGE1 bez failed units; EDGE2 má failed **`systemd-networkd-wait-online.service`**, exit 1 z 6. 11. — síť nyní funguje, boot-time příčina nedošetřena |
| Chain | Primary **112 792**, followeři **112 791** v souběžných sondách; RPC 42–116 ms. Tři běžící node binárky mají stejný SHA-256 `08d7348d71a8c4e653436f3126c05447e2f3280f70397a45041d073a91f409a2` |
| Pool | `d786449b0-g8fix`; `/health` i `/stats` **200 ~1 ms**, snapshot age 0 s; **6 515 accepted / 0 rejected** od startu, dvě sessions |
| Paměť poolu | RSS **2 978 608 KiB**, cgroup ~**3,09 GiB**. Sledovat trend; **memory leak neprokázán** |
| Pool DB | Schema **v13**; **1 405 confirmed bloků za 24 h**, v tomto výběru žádný jiný status |
| ZION payout ledger | **57 aktivních unconfirmed / 69 674,359608 ZION**; vedle toho **738 superseded** a **256 956 confirmed**. Superseded není aktivní dluh; unconfirmed není automaticky nevyplacený nárok |
| Holdy | V běžícím **warpd na EDGE2**: `QTC_PAYOUT_ENABLED=0`, `PRL_PAYOUT_DRY_RUN=1`, `WARP_BTC_SWAP_ENABLED=0`. Staré flagy jiných procesů nejsou důkazem aktivního QTC sweeperu |
| DR standby | Daemon záměrně inactive; PPLNS/ledger sync ~**17 s** starý, DB sync ~**32 min** při hodinovém timeru; kopie DB `quick_check=ok`, v13, height 112 766 |
| Backupy | EDGE backup, EDGE2 PG backup a standby syncy mají poslední `Result=success`. **Plný restore ani šifrovaná off-site kopie tím prokázány nejsou** |

### Veřejné povrchy

- HTTPS 200: apex/www, app + health, market + DB health + lampion, oasis, pool, rpc, auth health, freeworld, nirvana + oba health endpointy, api health, dex health + swap pools, grafana health.
- Dashboard **401** = očekávaný Basic Auth; Kingdom **503** = známá maintenance. Explorer redirectuje na funkční `app./explorer`.
- `newearth.cz/` i `/V2/` aktuálně vracejí **301 na stejnou cestu na `zionterranova.com`**; cíle odpovídají 200. To nedokazuje servírování původního archivovaného webu `/V2/`.
- OASIS API: **202 avatarů / 714 questů**. Nirvana **repo / app / net = proto 32**, `proto_match=true`; žádný současný protocol mismatch.
- `api.` a `dex.` stále vstupují přes EDGE1; migrace na EDGE2 zůstává operátorská DNS/TLS změna. Hiran health ukazuje živý CPU fallback, primární mini/coder upstreamy offline; generace ani její kvalita se netestovala.
- Kontrolované certifikáty platí: auth do **24. 1. 2027**, app do **27. 12. 2026**, market do **29. 12. 2026**; certbot timer běží. Renewal dry-run se nespouštěl.
- `nginx -t` projde na obou boxech, ale hlásí **`protocol options redefined`**. `.bak` soubory v `sites-enabled` nenalezeny; listener warnings nejsou dřívější duplicity `server_name`.

## 2. G8: run #7, nikoli termín 28. listopadu

Příčina změny má [report z 6. 11.](REPORT_2026-11-06_G8_POOLFIX_RUN7.md): nasazena path-aware admission pool API, kontrola stáří snapshotů a freshest-tip výběr v probe. Hotovou opravu nezadávat znovu.

| Evidence | Stav |
|---|---|
| Run #6 `g8-20261029T234617Z` | Archivovaný **stopped / evidence_incomplete / stopped_before_window_end**; 12 incidentů, 1 560 s downtime. Není PASS, archiv není smazán |
| Run #7 `g8-20261106T145125Z` | Start **6. 11. 14:51:25 UTC**, cíl **6. 12. 14:51:25 UTC** |
| Snapshot #7 | **531/531 good i covered, 100 % uptime/coverage, 0 incidentů, pending** — prvních ~9 hodin, nikoli hotová 30denní brána |
| Shoda | Stejný run ve state souboru a veřejném `/api/g8`; automatický update čerstvý |

Pravidla zůstávají 99,9 %, žádný incident ≥900 s a missing samples = downtime. Aktivní run neměnit/resetovat kvůli kosmetice. **Mainnet 3.2.0 Beta**, G9 a lidský sign-off dál blokují Stable. Premine unlock je samostatná výšková podmínka, neposouvá se spolu s kalendářem G8.

## 3. Ověřená slepá místa monitoringu

### M1 — EDGE1 host metriky chybí

- Prometheus cíle **`node` / `localhost:9100`** a **`node_exporter` / `127.0.0.1:9100`** jsou down. `avg_over_time(up[24h])` obou = **0**.
- EDGE1 nemá listener :9100; `prometheus-node-exporter.service` je **enabled, ale inactive/dead**, exit timestamp 31. 10. 10:49 CET. Příčina zastavení neurčena.
- Systémové RAM/PSI metriky přicházejí pouze z EDGE2. **Žádný firing alert neznamená zdravý EDGE1** — jeho měření chybí.
- Připravit opravu service/configu a host-specific down/missing alert, vyřešit zdvojení scrape cíle. Produkční spuštění/reload až po schválení; pool/nody kvůli tomu nerestartovat.

### M2 — payout freshness alert nevidí za queued řádek

Živá reprodukce z EDGE2: `GET :8080/public/v1/payouts?limit=1` → 200, `ok:true`, první řádek **`ts:null`**.

1. [`api.rs`](../../../V31/L1/pool/src/api.rs), `/public/v1/payouts` předsazuje in-memory queued položky před DB řádky a potom aplikuje limit.
2. `queued_payout_json()` má záměrně `ts:null`; neexistující čas se nesmí vymyslet.
3. [`zion-writepath-probe.py`](../../../V31/deploy/monitoring/zion-writepath-probe.py), ř. 107–115 čte jen první položku.
4. Živě **`zion_pool_payouts_api_ok=0`**, **`zion_pool_last_payout_age_seconds` chybí**. Nasazený `ZionPoolPayoutStale` kontroluje pouze `age > 3600`; prázdná série ho nespustí. Samostatný payout API/missing alert v načtených pravidlech nenalezen.

**Dopad:** confirmed ZION výplaty dál existují, v omezeném journal vzorku jsou nové `payout_confirmed`. Rozbitý je dohled, nikoli tímto měřením prokázaný payout engine.

Oprava musí měřit **čas posledního skutečně zapsaného payoutu** odděleně od queued feedu a alertovat invalidní/chybějící měření. Testovat `queued(ts=null) + DB(ts=number)`, jen queued, empty a API failure. Zvětšení limitu není záruka, když ho vyplní fronta; **null nenahrazovat aktuálním časem ani zelenou nulou**. Bez zásahu do výplat či konsenzu.

## 4. Doporučená autonomní fronta

**🤖 = lokální implementace + testy/review, ne automatický produkční deploy.** Pořadí nahrazuje mechanické pokračování starých nezaškrtnutých seznamů.

| Priorita / úkol | Evidence / soubory | Důkaz dokončení a hranice |
|---|---|---|
| **P1 · PII při opakovaném orderId** | [`orders/route.ts`](../../../apps/MarketPlace/src/app/api/shop/orders/route.ts), ř. 120–135: známé orderId vrací skoro celý existující záznam, vynechává jen seed/secret key; vlastník se neověřuje | Lokální fixture jiného zákazníka nesmí dostat PII. Minimální response DTO + bezpečné retry oprávnění. **Nezkoušet cizí reálné objednávky**; zatím code-review nález, ne produkční exploit |
| **P1 · EDGE1 monitoring** | M1, konfigurace Promethea / node-exporter service | Jednoznačné host labels, down/missing test, rollout bez restartu required G8 služeb až po schválení |
| **P1 · Payout monitoring** | M2, probe + `zion_writepath.rules.yml` + veřejný read contract | Regrese null/queued/empty/stale/failure + `promtool` testy. Read-only observability, payout logika a QTC hold beze změny |
| **P1 · Atomická rezervace skladu** | Order handler ř. 138–173: stock check před transakcí; ř. 259–264: nepodmíněný decrement. Duplicitní produkty nejsou před kontrolou sečteny | Souběžný nákup posledního kusu, duplicitní položky, rollback, retry. **Produkční nákup ani souběžný test neproběhl**; riziko z revize kódu |
| **P1 · Release provenance / verifier** | [`build-release-artifacts.sh`](../../../scripts/ops/build-release-artifacts.sh), ř. 94–148, 199–229: jiné `--from-commit` jen vypíše NOTE, build čte aktuální strom. **Reprodukce:** prázdný `SHA256SUMS` → exit 0, `PASS (0 artifacts verified)` | Skutečně pinned izolovaný zdroj nebo odmítnutí SHA ≠ HEAD; negativní test prázdného/neúplného manifestu a chybějících binárek. Žádný release tag/publish ani dlouhý produkční build |
| **P2 · Proto preflight z artefaktu** | [`deploy-nirvana.sh`](../../../apps/nirvana/deploy/deploy-nirvana.sh), ř. 33–45: kontrola je před výběrem `--artifact-dir`, čte pracovní zdroj | Mock zdroj/artefakt/server s různými verzemi, blokace před uploadem. Současná produkce proto 32 je správně |
| **P2 · Archive content root** | [`archive/docs route`](../../../apps/website-v2.9/src/app/api/archive/docs/[...path]/route.ts), ř. 17–21, a audit route: top-level kopie má přednost před standalone; známá past z app AGENTS 6. 11. | Fixture rozdílných kopií; jednotné resolution reader/audit/download, zachovaný 403 gate. **Nic nemaž na serveru**; aktuální drift se znovu neměřil |
| **P2 · G8 state fail-loud** | [`g8_evidence.py`](../../../scripts/ops/g8_evidence.py), `read_state`/`cmd_update`; report 6. 11.: root-owned 0600 state a tiché update | Permission/corruption test v temp dir, nonzero exit, stale-evidence alarm. Aktivní run #7 nedotknout |
| **P2 · Lumi hlediště** | [`lumi.ts`](../../../apps/nirvana-net/src/lumi.ts), snapshot pro id mimo flyers; app AGENTS popisuje stejnou dřívější chybu flotily | Divák dostává snapshot, nezabírá sedlo, neovládá letce; lokální transport test. Níže než bezpečnost/monitoring |

**První dávka:** PII objednávek + oba monitoringové kontrakty, oddělené review/testy. Rezervace skladu jako samostatná checkout změna. Release verifier a artefaktový preflight lze dělat nezávisle na překladech.

Potom: 24h trend RSS/PSI poolu (ne preventivní restart), repo sjednocení nginx `listen` options s `nginx -t`, došetření boot timeoutu `networkd-wait-online` (ne pouhé `reset-failed`) a redakční EN pass jedné neobsazené knihy. Kulturní/právní review zůstává lidské.

## 5. Nedělat znovu / operátorské hranice

- **Next 14 → 16 hotovo:** šest kontrolovaných app manifestů má Next `^16.4.3`, React `19.2.0`; živý website/market standalone i Nirvana mají Next **16.4.3**. Staré top-level `node_modules` EDGE2 (web 16.2.9 / market 14.2.35) nejsou běžící standalone. **Nejde o nový vulnerability audit závislostí.**
- G8 admission/freshest-tip oprava je nasazená. Fencing, rotace/env izolace a dokončené CS/EN překlady nejsou nové úkoly jen proto, že je starší plán má otevřené; regresi je nutné nově doložit.
- Paralelní sessions právě mění marketplace **e-maily/produkty** a website **G8/monitoring/dashboard/wallet/i18n**. Jejich soubory/staged změny nebyly editovány, resetovány ani commitovány. Nepouštět souběžný build do jejich `.next`.
- **QTC payouts OFF, PRL dry-run, BTC swap OFF.** Bez rozhodnutí žádný re-enable, funding, resend, resurrect ani dismiss ledgeru.
- DNS/TLS migrace api/dex, G9 audit, skutečný DR promote/drill, release publikace/sign-off a právní posouzení produktu/IP jsou operátorské. Žádné změny L1 konsenzu, genesis, emise či peněženek.

## 6. Evidence a omezení

- Lokální sondy: `.artifacts/probe/edge-audit-20261107.json`, `.artifacts/probe/edge-public-20261107.json` (ignorované neveřejné artefakty).
- Další přímé sondy: Prometheus query/targets/rules, state archiv #6, readonly pool DB / standby `quick_check`, allowlist ne-secret runtime flagů, `openssl x509` pouze veřejné certifikáty.
- Lokální release fixture: `bash scripts/ops/build-release-artifacts.sh --verify <empty-manifest-dir>` → exit 0, falešné PASS. Uklidil se jen vlastní lokální temp adresář.
- Neběžel full Rust/Next build, skutečný telefon/VR, autentizovaný archivní audit, kompletní security scan ani nákup/payout E2E. `/api/archive/audit` bez admin tokenu má očekávané **401**.
- První plošný 24h pool journal timeoutoval po 25 s; další analýza omezena na posledních 1 200–1 500 řádků. Tyto vzorky **nejsou celodenní statistika**. Slovo `timeout` v logu samo o sobě není důkaz chyby.
- Produkční změny **žádné**, commit/push se neprováděl. Dokumentační diff ověřit `git diff --check`.
