# REPORT 2026-11-04 — Explorer: 502 při zadání peněženky → komplexní oprava

> **Zadání 👤:** „hustne mame problem, po zadani wallet do exploreru 502 – zion1s6m2044…6cu2x5.zion1s6m2044…6cu2x5 – oprav explorer komplexne"
> **Nasazeno:** `app.zionterranova.com` (EDGE2), deploy `20261104T124420Z` (3 dávky: `121724Z`, `123046Z`, `124420Z`)
> **Stav:** ověřeno živě (API měřené, headless prohlížeč, 0 JS chyb, 0 nových 5xx v nginx)

## 1. Co se skutečně stalo (měřené, ne odhad)

Uživatel vložil do hledání **zkrácenou** adresu s výpustkou
(`zion1s6m2044…6cu2x5.zion1s6m2044…6cu2x5`). Řetězec nebyl ani výška bloku, ani
hash, ani adresa → `ProSearchBar.detectType()` vrátil `unknown` a **poslal ho na
`/explorer/block?id=…`**. Zároveň v tu chvíli běžel deploy webu (12:23:16), takže
nginx vracel `502` (`connect() failed (111: Connection refused)` na `127.0.0.1:3000`)
— to je ta stránka, kterou 👤 viděl.

Ale pod tím byla **druhá, horší chyba**, kterou jsme naměřili:

| Volání | Před | Po |
|---|---|---|
| `GET /api/blockchain/address?address=<pool wallet>` | **27,9 s**, balance **0 ZION** | **0,7–1,3 s**, balance **292 442 103 ZION** |
| `GET /api/blockchain/balance?address=<…>` | **26,7 s**, `total: 0` | **0,33 s** |
| `GET /api/blockchain/charts?type=blocktime&range=all` | **> 97 s** (timeout) | **0,49 s** |
| `GET /api/blockchain/charts?type=difficulty&range=7d` | **9,1 s** | **0,46–1,0 s** |
| `GET /api/blockchain/search?q=<wallet>` | **25,2 s** | **0,6 s** |

### Root cause #1 — `getUtxos` bez `limit`

`ZionRpcClient.getWalletSnapshot()` / `getAddressBalance()` volaly
`getUtxos { address }` **bez `limit`**. Nativní uzel v tom případě vrací **celou
UTXO sadu**:

```
getUtxos(address)            → 27 223 473 B, 14,4 s   (130 000 UTXO)
getUtxos(address, limit: 0)  → 199 B, 0,19 s          (total_count/total_amount)
getUtxos(address, limit: 200)→ 42 110 B, 0,16 s
```

Explorer měl `RPC_TIMEOUT_MS = 8000`, takže tato volání **vždy vypršela**, chyba
byla `.catch(() => null)` → a route pak hlásila `balance: 0`. Z 27MB odpovědi
se navíc pro stránku použilo jen 200 UTXO. Týkalo se to i `/api/pool/stats`,
`/api/blockchain/richlist` (smyčka přes stovky adres), `/api/wallet`,
`/api/miners` a `/api/cli`.

### Root cause #2 — grafy stahovaly každý blok

`lib/block-history.ts` nejdřív načetl **všechny** bloky v rozsahu
(`getBlockHeaders` = 1 RPC na blok) a *potom* zahodil 99 % (sampling).
`range=all` = ~43 000 TCP spojení → desítky sekund → timeout/502.

### Root cause #3 — nevalidované vstupy končily jako 5xx

- `/api/blockchain/block?id=<cokoli>` → RPC chyba → **503** (a klient to zkoušel znovu).
- `/api/blockchain/tx?hash=<cokoli>` → **503**.
- `/api/blockchain/address?addr=zion1…` (s výpustkou) → RPC s nesmyslem → 503/0.
- hledání bez shody → `/explorer/block?id=<výpustka>` → matoucí „Blok nenalezen".

### Root cause #4 — pomalé sekundární větve

`getMinerInfo()` měl timeouty 15 s (3× pool HTTP) + 8 s chain payout scan
(120 bloků) a běžel v `Promise.all` stránky adresy. Sekundární panel tak držel
celou stránku.

## 2. Co je opravené

### `src/lib/zion-rpc.ts`
- `getWalletSnapshot(address, { utxoLimit = 200 })` — **vždy** posílá `limit`,
  čte `total_count` / `total_amount` (autoritativní zůstatek i počet UTXO),
  vrací `utxos_truncated` / `utxos_failed`.
- `getAddressBalance()` — `limit: 0` (jen totals, ~2 ms) s fallbackem na
  `getBalance` pro starší nody.
- Když selžou **obě** větve, funkce **vyhodí** — žádná fiktivní nula.
- Cache adres (10 s, max 256 položek) + `getMinerInfo` cache 30 s a
  **single-flight** (burst stránek nespustí 120blokový scan N-krát).
- Timeouty miner voleb 15 s → 4 s, chain payout budget 8 s → 5 s.
- `toAtomicNumber()` — RPC posílá částky jako string (u64).

### `src/lib/block-history.ts`
- Sampling **před** stahováním: místo 43 000 volání jen ~200 vzorkovaných výšek
  (`step`), concurrency 25, seřazení podle výšky.

### API routes
- `address`: validace adresy (výpustka/mezera/znaky → **400** s human hintem),
  rozpočet na každou větev (`withTimeout`), enrichment transakcí s concurrency
  10 a 5s budgetem, `partial` flag, 503 `node_unavailable` **jen** když
  neodpovídá nic (dřív se vracela nula).
- `balance`: validace + `partial` + 503 při nedostupném uzlu.
- `search`: rozpozná zkrácenou adresu (`code: truncated_address` + hint),
  validuje adresy, používá totals-only čtení, hint i pro „nic nenalezeno",
  čistě hex řetězce už nezkouší jako adresu.
- `block`: `height`/`hash` validace (jinak **400** `invalid_block_id`),
  RPC chyba → **404** `block_not_found` (ne 503).
- `tx` + `transactions?hash=`: 64 hex validace (**400** `invalid_tx_hash`).

### Frontend
- `ProSearchBar`: `unknown` už **nikdy** neposílá na `/explorer/block` — jde na
  `/explorer/search`, kde je vysvětlení; zkrácená adresa má vlastní popisek.
- `AddressDetailClient`: rozlišuje 400 / 5xx / timeout („uzel neodpovídá,
  zkus znovu" vs „adresa neexistuje"), 20s timeout, `partial` banner,
  UTXO hlavička ukazuje **celkový zůstatek** (ne součet 200 zobrazených) a
  „z 130 176".
- `SearchResultsClient`: zobrazuje `hint` z API.
- `BlockDetailClient` / `TxDetailClient`: vstup se ověří **před** requestem
  (žádné 503 v konzoli), 404 hlášeny jako „neexistuje v této síti".

## 3. Ověření (živě, po deployi `20261104T124420Z`)

```
address?address=<whale>        200  0,76 s   balance 292 442 103 ZION, UTXO 130 176 (200 zobrazeno)
address?addr=<truncated>       400  0,23 s   invalid_address + hint
balance?address=<whale>        200  0,33 s
search?q=<wallet>              200  0,60 s
search?q=<truncated paste>     200  0,21 s   truncated_address + hint
block?id=<garbage>             400  0,33 s
block?height=109200            200  0,35 s
tx?hash=<garbage>              400  0,17 s
charts difficulty 30d          200  0,96 s
charts blocktime all           200  0,49 s
wallet/pool stats/richlist/miners/transactions?address=  200  0,3–1,5 s
```

Headless Chromium (`puppeteer`, systémový Chrome):
- `/explorer/address?addr=<whale>` — zůstatek i „UTXO seznam (200) z 130 176",
  **0 chyb v konzoli**, žádný error state.
- `/explorer/search?q=<zkrácená adresa>` — české vysvětlení.
- `/explorer/block?id=<výpustka>`, `/explorer/tx?hash=notahash` — hlášky bez
  konzolových chyb (dřív 503).
- `/explorer`, `/explorer/charts`, `/explorer/consensus` — 200.

Server: `zion-website` active, `NRestarts=0`, `MemoryCurrent` 122 MB,
v nginx access logu **žádné 5xx** po deployi.

## 4. Meze a co zůstává

- **502 z 12:23 byl deploy** (restart `zion-website`, connection refused) —
  krátký výpadek při nasazení je vlastnost restartu, ne chyba exploreru.
  Pokud má být nulový, chce to dvě instance za nginx upstream (samostatné téma).
- `total_received` / `total_sent` jsou **součty za okno** posledních 50 tx
  (`totals_scope: window`) — celoživotní součty by znamenaly full-chain scan.
- UTXO seznam je stránka **200** (dřív se serializovalo 130 000); příznak
  `utxos_truncated` to říká i v UI.
- `getUtxos` **bez `limit`** zůstává v RPC uzlu povolené (může ho chtít CLI).
  Pravidlo pro každou novou stránku: **z request path nikdy `getUtxos` bez
  `limit`** — použij `getAddressBalance()` nebo `getWalletSnapshot()`.
- Zůstává `chain_height` u adresy jen orientační (z `getBalance`, jinak 0).

---

# Část 2 — Komplexní optimalizace celého exploreru (2026-11-04, večer)

> **Zadání 👤:** „a nesel by cely system optimalizovat pro rychlost? explorer kompletne doladit tzm. vsechny jeho soucasti, at uz to je ready? all"
> **Nasazeno:** `app.zionterranova.com` na EDGE2, deploye `20261104T135247Z`, `20261104T150119Z`, `20261104T154214Z` + změna `nginx.conf` (gzip) na EDGE2 (reload 15:36).

## 1. Měření „odkud" — past s vlastní sítí

Externí měření z operátorského Macu během odpoledne kolísalo (adresa 0,5 s → 5 s → 60 s,
jednou i `http=000`), což vypadalo jako regrese. **Nebyla.** Ze serveru
(`http://127.0.0.1:3000`, tedy to, co nginx proxuje) byly stejné endpointy stabilně
**10–130 ms**. Z Macu byl i statický `favicon.png` (pár KB) 4,3 s → **degradovaná
cesta mezi klientem a EDGE2**, ne aplikace. Proto jsou níže uvedená čísla měřená
**na serveru**; uživatelská latence = tato čísla + RTT klienta.

## 2. Co bylo optimalizováno

### a) Server: jedna SWR cache pro všechny drahé endpointy
`src/lib/server-cache.ts` (`createSwrCache`) — fresh okno, pak **serve-stale +
refresh na pozadí**, single-flight na klíč, LRU strop, při chybě drží poslední
známou hodnotu. Nasaženo na:

| Endpoint | fresh / stale | Poznámka |
|---|---|---|
| `charts` (typ×rozsah) | 60 s / 15 min | ~200 vzorkovaných bloků |
| `blocks` (stránka) | 5 s / 60 s | N bloků na stránku |
| `stats` | 5 s / 120 s | 6 paralelních RPC + supply |
| `consensus` | 10 s / 2 min | s `?chart=true` i historie |
| `emission` | 30 s / 5 min | `resolveSupplySnapshot` |
| `richlist` | 60 s / 10 min | sken stovek adres |
| `miners` | 60 s / 10 min | balance per miner |
| `peers` | 10 s / 2 min | |
| `mempool` | 3 s / 20 s | poll 5 s z UI |
| `transactions` (recent) | 5 s / 60 s | walk-back přes bloky |

Každá odpověď nese `X-Explorer-Cache: fresh|stale-<s>` a `Cache-Control` z
`cacheControl()`.

### b) Historické grafy: vzorkovat před stahováním (dřív část 1) + delší cache
`block-history` cache 15 s → **45 s**; všech 6 typů grafů sdílí jednu historii.

### c) Klient: cache + deduplikace GETů
`src/lib/api.ts` — read-only `/blockchain/*` GETy se cachují **10 s** a souběžné
identické requesty sdílí jedno spojení (`getInflight`). Ostatní routy (auth,
wallet, shop, admin) se **nikdy** necachují. Navíc `Cache-Control: max-age` na
odpovědích → **browser cache**: reload stránky adresy je z cache
(`transferSize = 0`, 2 ms místo 1,6 s).

### d) Warm-up po startu (`src/instrumentation.ts` → `lib/explorer-warmup.ts`)
Po každém deployi byly cache studené — první návštěvník zaplatil 2–5 s. Nově se
3 s po startu a pak každých 45 s (cool sada 5 min) zahřejí:
`stats`, `blocks?limit=20`, `transactions?limit=20`, 6× `charts 24h`,
`emission`, `consensus`, `richlist`, `miners`, `peers`, `mempool`.
Vypnout lze `ZION_EXPLORER_WARMUP=0`.

### e) gzip v nginx na EDGE2 — největší reálná úspora (do té doby nefungoval!)
`nginx.conf` měl `gzip on;` a **`gzip_types` zakomentované** → komprimoval se jen
`text/html`; JSON API šlo po drátě neskomprimované. Zapnuto `gzip_types` (json, js,
css, svg, manifest, wasm, woff2) + `gzip_vary`, `gzip_proxied any`,
`gzip_comp_level 5`, `gzip_min_length 256` (záloha `/etc/nginx/backups/nginx.conf.bak-gzip-*`).

| Odpověď | Před | Po |
|---|---|---|
| `address` (whale) | 42,5 KB | **7,3 KB** |
| `transactions?limit=100` | 256 KB | **23,8 KB** |
| `stats` | 1,5 KB | 0,65 KB |

### f) Menší úpravy
- `transactions` (walk-back přes bloky) stahuje bloky v **paralelních oknech po 8**
  místo jednoho round-tripu na blok.
- `getRecentV3Transactions` zachovává pořadí newest-first, jen v dávkách.
- UTXO stránka adresy 200 → **100** (menší payload i DOM; `utxos_truncated` to hlásí).
- `getMinerInfo`: timeouty poolu 4 s → 2,5 s, chain-scan 120 → **60 bloků** a
  budget 5 s → 3 s; cache 30 s + single-flight.
- Balance cache adres 10 s → **30 s** (totals-only čtení je ~0,1 s, ale u 130k
  UTXO adresy to je zbytečné opakovat pro search/richlist).
- `block`/`tx` odpovědi: `max-age` 30/60 s (neměnné záznamy), SWR 300/600 s.
- `consensus`/`charts` validují `type` (400 místo tichého fallbacku).

## 3. Výsledek (měřeno na serveru, `127.0.0.1:3000`, teplé cache)

```
stats                      0,033 s     blocks?limit=20            0,018 s
blocks?limit=50            0,184 s     block?height/hash          0,05-0,08 s
transactions?limit=20      0,192 s     transactions?limit=100     1,659 s  (cold key)
transactions?address=…     0,986 s     tx?hash=…                  0,414 s
address?address=<whale>    1,141 s     balance?address=…          0,022 s
search?q=<wallet>          0,430 s     mempool                    0,023 s
peers                      0,014 s     richlist                   0,022 s
miners                     0,009 s     emission                   0,028 s
consensus                  0,027 s     bridge/status              0,008 s
charts 1h/6h/24h/7d/30d/all  0,012-0,046 s
```

Před optimalizací (stejné měřítko, studené cache po startu): `charts` 1,7–9 s,
`stats` 0,4–0,9 s, `address` 2,6 s, `emission` 1,2 s. Po nasazení warm-upu je
i „první návštěvník po deployi" obsloužen z cache.

## 4. Meze

- Cache je **per-proces** (restart = studená, řeší warm-up). Při víc instancích
  za nginx by se cache nevyužívala optimálně — pak by měl přijít sdílený store
  (Redis/„stale on disk“). Dnes jedna instance.
- `transactions?limit=100` a `address` zůstávají ~1–1,7 s při studené cache —
  je to cena walk-backu po blockchainu, ne HTTP vrstvy.
- Zrychlení je vidět hlavně na **přenosu** (gzip) a na opakovaných návštěvách;
  první načtení stránky stále čeká na RPC uzel (ten běží na 67 % CPU).
- SSE (`/api/blockchain/sse`) zůstává 1 poll/klient/interval; se stovkami
  klientů by chtěl sdílený snapshot (dnes se `getInfo` cachuje 3 s).
