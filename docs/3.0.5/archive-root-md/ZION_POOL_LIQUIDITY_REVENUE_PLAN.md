# ZION Pool Revenue for Liquidity — Možnosti a roadmap

> **Datum:** 2026-07-11  
> **Status:** DRAFT — čeká na výběr cesty  
> **Scope:** Všechny praktické způsoby, jak ZION pool může generovat BTC/altcoin revenue pro pozdější vkládání do likvidity  
> **Likvidita:** řeší provozovatel samostatně — tento dokument se soustředí na **sběr revenue** a jeho směřování na project-controlled peněženku  
> **Default BTC payout wallet:** `bc1q9c06f4wpf638xp2280j07qgdrpz0sdms7peqkh`

---

## 1. Cíl a princip

Hlavní cíl je, aby **ZION pool přestal být pouze „zabezpečovací“ službou** a začal generovat reálné výdělky z miningu. Tyto výdělky se pak použijí pro ZION likviditu (provozovatel si řeší konverzi a vklad do poolu sám).

Aktuální stav:
- Pool běží na `62.171.141.136:8444` a těží ZION (`deeksha_lite_v1`).
- `AuXpow` crate (`AuXpow/src/auxpow_scheduler.rs`) je už integrovaný do pool serveru, ale ve výchozím stavu **disabled** (`ZION_AUXPOW_ENABLED=0`).
- `RevenueScheduler` a `revenue_proxy.rs` existují, ale nejsou aktivně využívány pro běžné minery.
- Žádný automatický převod BTC → ZION/wZION do likvidity není implementovaný.

Defaultní BTC peněženka pro všechny externí payouty je nastavena na `bc1q9c06f4wpf638xp2280j07qgdrpz0sdms7peqkh` (project-controlled adresa v `AuXpow/src/types.rs`).

---

## 2. Přehled všech možností

| # | Možnost | Zdroj revenue | Kdo těží | Čas do spuštění | Potřebuje consensus fork? | Potřebuje souhlas minerů? |
|---|---------|---------------|----------|-----------------|---------------------------|---------------------------|
| **A** | **Pool-side AuXpow (Phase 1)** | Externí pooly vyplácejí BTC | Pool server sám | Okamžitě (dny) | Ne | Ne |
| **B1** | **Revenue session group — opt-in** | Externí pooly vyplácejí BTC | Minery, kteří se připojí na proxy | 2–4 týdny | Ne | Ano (opt-in) |
| **B2** | **Revenue session group — mandatory split** | Externí pooly vyplácejí BTC | Všichni mineři (část jejich hashrate) | 4–8 týdnů | Ne | Implicitně (musí dostat bonus) |
| **C** | **True AuxPoW merge mining** | Parent chain block rewards (DCR/ALPH) | Stejný hash platí pro ZION i parent | 3–6 měsíců | Ano | Ne |
| **D** | **DePIN / bandwidth nodes** | Bandwidth/storage/compute rewards | Servery (ZION infra) | Okamžitě (týdny) | Ne | Ne |
| **E** | **Hashrate marketplace** | Externí pooly vyplácejí BTC | Zakoupený/rentovaný hashrate | Okamžitě | Ne | Ne |

---

## 3. Možnost A — Pool-side AuXpow (Phase 1)

Pool server sám těží nejziskovější externí coin a payouty jdou na project BTC wallet.

### Co už existuje
- `AuXpow` crate: `AuxPowScheduler` vybírá coin, připojí se na externí pool, odesílá share (`AuXpow/src/auxpow_scheduler.rs`).
- Podporované coiny: DCR, ALPH, KAS, ERG, RVN, ETC, EVR, MEWC, FLUX, CLORE, XMR (`AuXpow/src/types.rs`).
- Statistiky jsou dostupné v `/stats` API pod klíčem `auxpow` (`docs/3.0.5/AUXPOW_INTEGRATION_REPORT_2026-07-11.md`).

### Jak aktivovat
Editovat `/etc/zion/edge-environment.sh` na Edge serveru:

```bash
ZION_AUXPOW_ENABLED=1
ZION_AUXPOW_WALLET=bc1q9c06f4wpf638xp2280j07qgdrpz0sdms7peqkh
ZION_AUXPOW_WORKER_NAME=zion-pool
ZION_AUXPOW_ALLOCATION=0.25
ZION_AUXPOW_REGION=eu
ZION_AUXPOW_CHECK_INTERVAL=300
ZION_AUXPOW_HYSTERESIS_PCT=15
ZION_AUXPOW_CB_THRESHOLD=5
ZION_AUXPOW_CB_RESET_SECS=300
```

Restart:
```bash
sudo systemctl daemon-reload
sudo systemctl restart zion-pool.service
journalctl -u zion-pool.service -f | grep auxpow
```

### Výhody
- Žádné změny v mineru.
- Funguje okamžitě.
- Pool získává reálné BTC payouty.

### Nevýhody / omezení
- Pool server má omezený výkon (CPU, žádné GPU na Edge serveru).
- Revenue je omezený na to, co server sám vytěží.
- Statické profit estimate (`fallback_estimates()`) nejsou ideální — je třeba přidat live CoinGecko/WhatToMine API.

### Tip pro maximální revenue
- Na serveru bez GPU bude pravděpodobně nejlepší **XMR (RandomX na MoneroOcean)**, protože je CPU-friendly.
- Pokud přidáte GPU server, KAS/ETC/RVN budou výnosnější.

---

## 4. Možnost B1 — Revenue session group (opt-in)

Minery, kteří chtějí, se připojí do skupiny `revenue` nebo `liquidity` a jejich hashrate jde na externí pool.

### Jak to funguje
- Worker name obsahuje hint: `g=liquidity` nebo `g=revenue` (`V3/docs/REVENUE_SYSTEM.md` §3.1).
- Pool pošle minerovi `ProxyRedirect` (`V3/L1/pool/src/lib.rs:99`) s adresou revenue proxy.
- Miner se připojí na lokální `revenue-proxy` binárku, která přeposílá share na externí pool a nahrazuje wallet za project BTC address (`V3/L1/pool/src/bin/revenue-proxy.rs`).

### Spuštění revenue-proxy
```bash
export ZION_PROXY_COINS=KAS,ETC,RVN
export ZION_PROXY_WALLET=bc1q9c06f4wpf638xp2280j07qgdrpz0sdms7peqkh
export ZION_PROXY_WORKER=zion-pool
export ZION_PROXY_BASE_PORT=9000
export ZION_PROXY_REGION=eu
./target/release/revenue-proxy
```

Proxy poslouchá na:
- `:9000` → KAS
- `:9001` → ETC
- `:9002` → RVN

### Pool env
```bash
ZION_REVENUE_MULTISTREAM=true
ZION_REVENUE_PROXY_ADDR=127.0.0.1:9000
ZION_REVENUE_PROXY_COIN=KAS
ZION_USER_DEFAULT_GROUP=zion
ZION_BACKEND_WORKER_HINTS=liquidity,revenue
```

### Motivace pro minery (opt-in)
- Bonus ve ZION z liquidity fund.
- Například: miner s `g=liquidity` dostane +5 % váhu v PPLNS okně.
- Nebo: pool mu vyplácí část externí revenue v ZION denně.

### Výhody
- Mineři si sami zvolí, jestdy chtějí podpořit likviditu.
- Žádný fork.
- Využije se veškerý dostupný hashrate komunity.

### Nevýhody
- Mineři musí změnit worker name nebo se připojit na jiný port.
- Bez bonusu se nikdo nepřipojí.

---

## 5. Možnost B2 — Mandatory revenue split (všichni mineři)

Pool automaticky přesměruje část hashrate všech minerů na externí mining a zbytek na ZION.

### Jak to funguje
- `RevenueScheduler` má vážený round-robin (`V3/L1/pool/src/bin/server.rs:2076`).
- Aktuální default: 50 % ZION, 25 % Blake3External, 25 % NCL.
- Každý submit se routuje do „lane“ podle session group.
- Pro mandatory split by se `Auto` group přiřazovala i běžným minerům a směřovala do externího proxy.

### Potřebné změny
1. Upravit `resolve_session_group` tak, aby `Auto` byla default i pro běžné minery (nejen backend).
2. Zajistit, že ZION share se stále počítají do PPLNS — jinak mineři přijdou o odměny.
3. Přidat `liquidity_bonus` do PPLNS váhy.
4. Revenue z externího miningu se převádí na ZION a vyplácí jako extra reward.

### Doporučené rozložení (příklad)
| Skupina | Podíl | Co se děje |
|---------|-------|-----------|
| ZION | 70 % | Klasické ZION mining, PPLNS odměny |
| Liquidity | 20 % | Externí mining, revenue jde na BTC wallet |
| NCL | 10 % | AI inference tasky (až budou ready) |

### Výhody
- Maximální využití hashrate.
- Žádný fork.

### Nevýhody
- Složité ekonomické modelování — mineři musí dostat dostatečný bonus, jinak utečou.
- Vyšší administrativní zátěž.

---

## 6. Možnost C — True AuxPoW merge mining

Stejný hash platí pro ZION i pro parent chain (DCR / ALPH). Mineři těží ZION, ale náhodně nalezený hash může splnit i cíl DCR/ALPH.

### Kdy se to vyplatí
- Když chceme **velkou bezpečnost** zdarma (DCR ASIC hashrate).
- Když chceme **přímé parent-chain rewards** (DCR/ALPH block reward jde do treasury).

### Co už existuje
- `AUXPOW_TRUE_MERGE_MINING_PLAN.md` popisuje dual-algo fork s DCR-primary + ALPH-secondary.
- `AuXpow` crate má externí hashe Blake3/kHeavyHash (`AuXpow/src/external_hashers.rs`).

### Potřebné změny
1. Height-gated fork: `AUXPOW_FORK_HEIGHT`.
2. ZION block header umožní vložit parent chain hash (coinbase / `ExtraData`).
3. Pool server bude posílat parent chain jobs minerům.
4. Miner bude počítat hash, který se ověří proti oběma cílům.
5. Payout parent chain reward na project wallet.

### Časová náročnost
- 3–6 měsíců práce.
- Vyžaduje konsensus změnu a upgrade všech nodů + minerů.

### Výhody
- Nejvyšší efektivita hashrate (jeden hash, dvě sítě).
- Přímé příjmy z parent chain block reward.

### Nevýhody
- Největší technická složitost.
- Vyžaduje hard fork a koordinaci sítě.

---

## 7. Možnost D — DePIN / bandwidth / compute nodes

Není přímo „mining revenue z minerů“, ale využívá existující ZION infrastrukturu k pasivnímu příjmu.

### Historické plány
- `docs/REVENUE_PLAN.md` a `docs/ARCHIVE/NODE_REVENUE_STRATEGY.md` popisují:
  - **Mysterium** — VPN exit node ($5–30/měsíc/server).
  - **Grass** — bandwidth sharing ($5–20/měsíc).
  - **NKN** — P2P relay ($1–5/měsíc).
  - **Storj** — storage node ($3–15/měsíc).
  - **Flux Cumulus** — node s malým stake ($15–40/měsíc).

### Jak spustit (Mysterium příklad)
```bash
docker run -d \
  --name zion-mysterium \
  --restart unless-stopped \
  --cap-add NET_ADMIN \
  -p 4449:4449 \
  -p 41920-41925:41920-41925/udp \
  -v /opt/mysterium/data:/var/lib/mysterium-node \
  mysteriumnetwork/myst:latest \
  service --agreed-terms-and-conditions
```

### Výhody
- Nulový kapitál (většina).
- Nepřetěžuje pool server.
- Diverzifikuje příjmy.

### Nevýhody
- Malé částky.
- Vyžaduje monitoring a údržbu.

---

## 8. Možnost E — Hashrate marketplace

Zakoupit nebo pronajmout externí hashrate pro mining výnosných coinů.

### Varianty
1. **NiceHash** — koupit hashrate pro konkrétní algoritmus, payout do vlastního BTC walletu.
2. **MiningRigRentals** — pronájem rigů na hodiny/dny.
3. **Zakoupení vlastního ASIC/GPU** — např. DCR ASIC pro DCR mining.

### Kdy to dává smysl
- Když chceme **rychle nasimulovat** velký hashrate.
- Když máme kapitál a chceme okamžitý BTC příjem.

### Rizika
- Náklady mohou převýšit výnos.
- Podvodné marketplace.
- Daňová/administrativní zátěž.

---

## 9. Srovnání všech možností

| Kritérium | A | B1 | B2 | C | D | E |
|-----------|---|---|----|---|---|---|
| **Okamžité spuštění** | ✅ | ⚠️ | ⚠️ | ❌ | ✅ | ✅ |
| **Nízké náklady** | ✅ | ✅ | ✅ | ❌ | ✅ | ❌ |
| **Velký revenue potenciál** | ⚠️ | ✅ | ✅ | ✅ | ⚠️ | ✅ |
| **Využije hashrate minerů** | ❌ | ✅ | ✅ | ✅ | ❌ | ⚠️ |
| **Žádný fork** | ✅ | ✅ | ✅ | ❌ | ✅ | ✅ |
| **Bezpečnostní přínos** | ❌ | ❌ | ❌ | ✅ | ❌ | ❌ |
| **Technická jednoduchost** | ✅ | ✅ | ⚠️ | ❌ | ✅ | ✅ |

Legenda: ✅ ano / ⚠️ částečně / ❌ ne.

---

## 10. Doporučená roadmap

> **Provozovatel si řeší konverzi BTC → ZION/wZION → likvidita sám.** Tento roadmap se zaměřuje na sběr revenue.

### Fáze 0 — Příprava (1 týden)
- ✅ Potvrdit defaultní BTC wallet `bc1q9c06f4wpf638xp2280j07qgdrpz0sdms7peqkh`.
- Otevřít účet na vhodném externím poolu (2miners / MoneroOcean / ZPool).
- Připravit monitoring payoutů (2miners dashboard, MoneroOcean stats).
- Ověřit Hetzner ToS — dedikovaný server AX/EX mining povoluje.

### Fáze 1 — Pool-side AuXpow (okamžitě)
- Povolit `ZION_AUXPOW_ENABLED=1` na Edge serveru.
- Allocation začít na `0.10` (10 %) a postupně zvyšovat.
- Sledovat `/stats/auxpow` a share acceptance rate.
- První revenue: XMR (CPU) nebo KAS (pokud přidáme GPU).

### Fáze 2 — Opt-in revenue proxy (2–4 týdny)
- Spustit `revenue-proxy` binárku pro KAS/ETC/RVN.
- Nabídnout minerům bonus za `g=liquidity` worker name.
- Připravit Liquidity Bonus PPLNS váhy.

### Fáze 3 — Mandatory split (4–8 týdnů, volitelně)
- Pokud je dostatek hashrate a mineři bonusy akceptují, přejít na automatické rozložení.
- 70 % ZION / 20 % liquidity / 10 % NCL.

### Fáze 4 — True AuxPoW fork (dlouhodobě)
- Implementovat dual-algo merge mining podle `AUXPOW_TRUE_MERGE_MINING_PLAN.md`.
- Přejít na DCR-primary + ALPH-secondary.

### Paralelně — DePIN nodes
- Spustit Mysterium + Grass na Edge serveru (mimo pool porty).
- Vyhodnotit Flux Cumulus z existujících příjmů.

---

## 11. Konfigurace a env proměnné

### AuXpow (Možnost A)
| Proměnná | Default | Popis |
|----------|---------|-------|
| `ZION_AUXPOW_ENABLED` | `0` | Hlavní vypínač |
| `ZION_AUXPOW_WALLET` | `bc1q9c06f4wpf638xp2280j07qgdrpz0sdms7peqkh` | BTC payout wallet |
| `ZION_AUXPOW_ALLOCATION` | `0.25` | Podíl pool compute (0.0–1.0) |
| `ZION_AUXPOW_COIN` | auto | Vynucený coin (např. `kas`) |
| `ZION_AUXPOW_REGION` | `eu` | Region pro výběr poolu |
| `ZION_AUXPOW_HYSTERESIS_PCT` | `15` | Prah přepínání coinů |
| `ZION_AUXPOW_CB_THRESHOLD` | `5` | Počet failů pro circuit breaker |

### Revenue proxy (Možnosti B1/B2)
| Proměnná | Popis |
|----------|-------|
| `ZION_PROXY_COINS` | `KAS,ETC,RVN` |
| `ZION_PROXY_WALLET` | `bc1q9c06f4wpf638xp2280j07qgdrpz0sdms7peqkh` |
| `ZION_PROXY_BASE_PORT` | `9000` |
| `ZION_REVENUE_PROXY_ADDR` | Adresa proxy v poolu (`127.0.0.1:9000`) |
| `ZION_REVENUE_PROXY_COIN` | Default coin pro redirect (`KAS`) |

### Pool revenue routing
| Proměnná | Popis |
|----------|-------|
| `ZION_REVENUE_MULTISTREAM` | `true` pro zapnutí více lane |
| `ZION_STREAM_ZION_PCT` | 70 |
| `ZION_STREAM_BLAKE3_PCT` | 20 |
| `ZION_STREAM_NCL_PCT` | 10 |
| `ZION_USER_DEFAULT_GROUP` | `zion` |
| `ZION_BACKEND_WORKER_HINTS` | `liquidity,revenue` |

---

## 12. Bezpečnostní a provozní poznámky

1. **BTC wallet** — default je nastaven na project address. Nikdy nepoužívat starou adresu `bc1qvujra09wlsm35tmhc0v0fnxpsj0cuaq88hd8mw` z historických CH v3 dokumentů.
2. **Soukromé klíče** — nikdy je neukládat do repa. Payout wallet je pouze public address.
3. **Pool adresy** — 2miners často delistuje coiny (např. DCR, ALPH). Před aktivací ověřit DNS/connectivitu z Edge serveru.
4. **Live profit estimates** — `fallback_estimates()` jsou statické. Pro produkci přidat CoinGecko/WhatToMine API cache (60s TTL).
5. **PPLNS bonusy** — jakýkoli mandatory split musí být doprovázen ekonomicky výhodným bonusem, jinak mineři pool opustí.

---

## 13. Rizika a mitigace

| Riziko | Dopad | Mitigace |
|--------|-------|----------|
| Pool address přestane fungovat | Ztráta revenue | Circuit breaker + fallback pooly + monitoring |
| Hetzner ToS | Ban serveru | Pouze dedikované servery, CPU limity, žádný abuse |
| Mineři odejdou při mandatory splitu | Klesne hashrate | Nejprve opt-in s bonusem, až pak mandatory |
| Profit estimate je zastaralý | Těžíme neziskový coin | Live API + hysteresis |
| BTC wallet compromise | Ztráta všech payoutů | Cold wallet pro treasury, hot wallet jen pro pool payout |
| Daňová nejasnost | Problémy s úřady | Evidence revenue journal, konzultace účetního |

---

## 14. Související soubory

- `AuXpow/src/auxpow_scheduler.rs` — hlavní scheduler externího miningu
- `AuXpow/src/types.rs` — coiny, konfigurace, default BTC wallet
- `V3/L1/pool/src/revenue_proxy.rs` — Stratum proxy pro miner revenue
- `V3/L1/pool/src/bin/revenue-proxy.rs` — standalone proxy binárka
- `V3/L1/pool/src/bin/server.rs` — RevenueScheduler a session routing
- `V3/L1/cosmic-harmony/src/revenue.rs` — revenue accounting a payout helpers
- `docs/3.0.5/AUXPOW_INTEGRATION_REPORT_2026-07-11.md` — stav AuXpow integrace
- `AUXPOW_TRUE_MERGE_MINING_PLAN.md` — true merge-mining fork plán (nezahrnuje revenue)

---

## 15. Další kroky — potřebuji rozhodnutí

Vyber jednu nebo více cest a já připravím konkrétní runbook / kódové změny:

1. **Chceš začít Možností A (AuXpow pool-side) hned?** → Připravím aktivační runbook pro Edge server.
2. **Chceš Možnost B1/B2 (revenue z minerů)?** → Připravím změny v `RevenueScheduler` + bonusový PPLNS model.
3. **Chceš pokračovat Možností C (true AuxPoW)?** → Aktualizujeme `AUXPOW_TRUE_MERGE_MINING_PLAN.md` o revenue/liquidity kapitolu.
4. **Chceš DePIN / marketplace jako bonus?** → Připravím docker-compose a monitoring.
