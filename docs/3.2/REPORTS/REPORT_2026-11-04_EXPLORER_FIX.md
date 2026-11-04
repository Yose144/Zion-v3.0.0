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
