# ZION 2.7.4 – Bezpečnostní Zpevnění (Security Hardening)

Tento dokument shrnuje implementované bezpečnostní vrstvy, motivaci, hrozby, konfiguraci a doporučené budoucí kroky pro síť ZION 2.7.4.

---
## 1. Cíle bezpečnostního hardeningu
- Zvýšit odolnost proti manipulaci s časem bloků (timestamp attacks)
- Minimalizovat rizika reorganizací ("reorg") a útoků na konsensus
- Omezit zneužitelnost RPC rozhraní (bruteforce / flooding / neautorizovaný přístup)
- Posílit ochranu proti spam / DoS na P2P vrstvě
- Zajistit auditovatelné metriky pro provozní dohled

---
## 2. Přehled implementovaných vrstev
| Vrstva | Stav | Popis |
|--------|------|-------|
| Median-Time-Past (MTP) | Hotovo | Bloky musí mít timestamp >= mediánu předchozích N (11) bloků a ne příliš v budoucnosti (+2h) |
| LWMA obtížnost | Hotovo | Adaptivní úprava obtížnosti těžby bez náhlých skoků |
| Kumulativní práce (cumulative work) | Hotovo | Sledování součtu 2^difficulty pro deterministické srovnání větví |
| Multi‑block reorg support | Hotovo | Bezpečné přepnutí na delší větev s vyšší prací (limit hloubky 50) |
| Journaling + rollback | Hotovo | Reverzibilní změny zůstatků při reorg / chybě |
| RPC autentizace | Hotovo | Token přes `X-ZION-AUTH` nebo `Authorization` (generovaný, nebo proměnná `ZION_RPC_TOKEN`) |
| RPC rate limiting | Hotovo | Per‑token/IP okno: X/min + burst ochrana (default 120/min; burst 20/5s) |
| Peer scoring & banning | Hotovo | Penalizace za invalid bloky, špatné timestampy, spam pingy, neznámé zprávy; ban při skóre ≥100 na 15 min |
| Metriky | Rozšířeno | `/metrics` zahrnuje: výšku, nabídku, mempool, peers, auth_failures, rate_limited, banned_peers, invalid_timestamps, reorg_events |
| Testy bezpečnosti | Hotovo | Testy pro: auth, rate limit (burst), timestamp invalidace |

---
## 3. Model hrozeb (stručně)
| Hrozba | Mitigace |
|--------|---------|
| Manipulace s časem bloků | MTP + future drift limit (2h) + metrika invalid_timestamps |
| Útok přes falešnou delší větev | Kumulativní práce + limit max_reorg_depth + journaling rollback |
| Flood / brute force RPC | Auth token + rate limiting (burst + minute) |
| Spam pingy / resource drain | Peer ping tracking + penalizace + ban |
| Malformed / neznámé zprávy | Penalizace + ban threshold |
| Tichý útok (pozvolné injektování bloků) | Průběžná kontrola hash předků a práce větve |

---
## 4. Konfigurace a ladění
### 4.1 RPC Server
Parametry při instanci `ZIONRPCServer`:
- `require_auth=True/False`
- `auth_token` (nebo env `ZION_RPC_TOKEN`)
- `rate_limit_per_minute` (default 120)
- `burst_limit` (default 20)
- `burst_window_seconds` (default 5)

### 4.2 Blockchain / Konsensus
- `mtp_window = 11`
- `max_future_drift = 7200` (sekund)
- `max_reorg_depth = 50`

### 4.3 P2P Bezpečnost
- `score_penalties` (v kódu `zion_p2p_network.py`):
  - invalid_block: 25
  - bad_timestamp: 15
  - malformed_message: 10
  - spam_ping: 5
  - unknown_message: 5
- `ban_threshold = 100`
- `ban_duration = 900` (15 min)
- Decay: −5 každých 60s (score ≥0)

---
## 5. Metriky (Prometheus formát)
Klíčové nové položky:
- `zion_rpc_auth_failures` – počet neúspěšných auth pokusů
- `zion_rpc_rate_limited` – počet odmítnutých požadavků kvůli limitu
- `zion_banned_peers` – aktuální počet banovaných peerů
- `zion_invalid_timestamps` – kumulace odmítnutých bloků kvůli času
- `zion_reorg_events` – počet provedených multi-block reorgů

---
## 6. Test Coverage (bezpečnost)
Soubor: `tests/test_security_features.py`
- Auth 401 → 200 (s tokenem)
- Burst limit → 429
- Invalid future timestamp → odmítnutí + increment metriky
(V budoucnu doplnit simulaci reorg a peer ban scénář přes mock / injektáž.)

---
## 7. Doporučení pro další fázi
1. Přidat kryptograficky podepsaný handshake mezi peery
2. Omezit /metrics volitelně také tokenem (produkční režim)
3. Persistentní ukládání peer skóre a ban-listu (zmírnění restart abusů)
4. Vylepšit difficulty (kombinace LWMA + guard proti náhlým skokům)
5. Přidat detekci zpožděných (stale) bloků a penalizaci za jejich šíření
6. Hardeni RPC: povolit jen whitelist metod v režimu "restricted"
7. Přidat integrity hash snapshot celé state (Merkle/Patricia) pro audit

---
## 8. Rychlý provozní checklist
- Nastavit `ZION_RPC_TOKEN` před spuštěním produkce
- Monitorovat: `zion_rpc_auth_failures`, `zion_rpc_rate_limited`, `zion_banned_peers`
- Nastavit alerting na skoky `invalid_timestamps` nebo neočekávaný růst `reorg_events`
- Pravidelně rotovat RPC token (restart serveru s novým tokenem)

---
## 9. Shrnutí
ZION 2.7.4 nyní obsahuje vícevrstvou obranu: časová validace (MTP), adaptivní obtížnost, řízení reorganizací pomocí kumulativní práce, ochranu RPC (auth + rate limit), reputační systém peerů a auditní metriky. Základ pro další kryptografické a síťové posílení je stabilně položen.

---
**Poslední aktualizace:** automaticky generováno během hardening fáze.
