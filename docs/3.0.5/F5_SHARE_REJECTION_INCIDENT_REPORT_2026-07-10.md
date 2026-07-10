# F5 Share Rejection Incident Report

> **Datum:** 2026-07-10
> **Server:** `62.171.141.136` (ssh `zion-new`)
> **Protokol:** `zion-v3-node/3.0.5`
> **Aktuální height:** 1337+ (rostoucí)
> **Commit opravy:** `ea08c774c`
> **Soubor:** `V3/L1/core/src/lib.rs`

---

## 1. Shrnutí

Po nasazení 3.0.5 "All Green" byl zaznamenán vysoký podíl zamítnutých share v mining poolu:

- **27 rejected / 69 accepted = 39.1% rejection rate**
- **Status:** `UpstreamRejected`
- **Miner:** `vega-smos`
- **Projev:** každých ~2 sekund `BLOCK_FOUND` se stejným nonce/hash na height 1336, node pokaždé odmítl `submit_candidate`
- **Root cause:** dvě chyby v F5 balance-check logice

---

## 2. Diagnóza

### 2.1 Symptomy z logů

```
Jul 10 10:57:19 vmi3425821 zion-pool-server[1417969]: BLOCK_FOUND miner=vega-smos height=1336 nonce=21000070292 hash=0000ff46...
Jul 10 10:57:19 vmi3425821 zion-pool-server[1417969]: share_status=UpstreamRejected
Jul 10 10:57:19 vmi3425821 zion-pool-server[1417969]: wire_result={"type":"result","accepted":false,"status":"UpstreamRejected"}
```

Node nepostupoval za height 1335. Pool pořád dostával `template_id=1336`.

### 2.2 Reálná chybová hláška z node

Po ručním odeslání `submit_candidate`:

```
reason="locally mined block failed validation: peer block TX from zion1e4489793c5x2r0a0a4d8z7r4u5d6k0s4k3ht5m2 has insufficient balance: 9602119259 < 432555440257 (amount 432555440256 + fee 1)"
```

### 2.3 Dvě nalezené chyby

#### Chyba A — dvojí počítání mempool debits v `validate_peer_block`

`account_balance_for()` prochází accepted blocks **a odečítá všechny mempool debits**, včetně TX, která se právě validuje. Protože při validaci bloku jsou jeho TX stále ještě v mempoolu (odstraní se až v `accept_block_record`), vzniká dvojí odečet:

```
effective_balance = confirmed_balance - (amount + fee) - other_debits
kontrola:          effective_balance >= (amount + fee)
=>                 confirmed_balance - other_debits >= 2 * (amount + fee)
```

Tím pádem byl blok zamítnut i když odesílatel měl dostatek confirmed balance na zaplacení jedné TX.

#### Chyba B — `build_template` nefiltruje neschopné (insolventní) mempool TX

`select_template_transactions()` jen setřídila mempool podle fee a vzala top N. Nekontrolovala zda odesílatel má dostatek confirmed balance. Pokud tedy v mempoolu byla insolventní TX, šablonka ji obsahovala a každý nalezený blok byl odsouzen k zamítnutí.

---

## 3. Oprava

Commit: `ea08c774c` — *fix: filter insolvent mempool TXs from block template (F5 share rejection fix)*

Soubor: `V3/L1/core/src/lib.rs`

### 3.1 Nová metoda `confirmed_balance_for()`

Počítá confirmed balance pouze z `accepted_blocks`, bez odečtu mempool debits.

```rust
fn confirmed_balance_for(&self, address: &str) -> u128 { ... }
```

### 3.2 `validate_peer_block` používá `confirmed_balance_for()`

Místo `account_balance_for()`. Intra-block debits a credits ošetřuje stávající smyčka přes `block.transactions.iter().take(index)`.

### 3.3 Nová filtrační funkce `filter_balance_sufficient()`

Volá se v `build_template()` až po `select_template_transactions()`:

- Spočítá confirmed balance z accepted blocks
- Zpracuje TX ve fee-order a sleduje running balance per sender
- Vyhodí TX, která by neprošla F5 kontrolou
- Aktivní pouze když je F5 aktivní (`next_height >= balance_check_height`)
- Preskočí coinbase a genesis TX

### 3.4 Testy

Přidány 2 regression testy:

- `template_excludes_insolvent_tx_when_balance_check_active`
- `template_includes_insolvent_tx_when_balance_check_inactive`

**Výsledek testů:** 558 passed, 0 failed.

---

## 4. Deploy

| Krok | Stav |
|------|------|
| Build `zion-core` release | ✅ |
| Build `node` binary | ✅ |
| SCP `/usr/local/bin/zion-node` na Edge | ✅ |
| Restart `zion-node.service` | ✅ |
| Restart `zion-node2.service` (sdílí binárku) | ✅ |
| Backup node (lokální) — použije nový `V3/target/release/node` při příštím startu | ✅ |

---

## 5. Výsledky po opravě

### 5.1 Share acceptance

```
routing_snapshot submits=50 accepted=50 rejected=0 stale=0 accept_rate=100.00%
```

### 5.2 Chain advance

Před: height 1335 (zaseklý)  
Po: height 1337+ a roste. Bloky 1336 a 1337 nalezeny a přijaty, payouty odeslány.

```
payout_submitted height=1336 miners=1 deferred=0 tx_id=a53ed2a3...
payout_submitted height=1337 miners=1 deferred=0 tx_id=a0e65326...
```

---

## 6. Lekce

1. **Pool rejection `UpstreamRejected` + node hlásí "locally mined block failed validation" → podezření na consensus/validaci bloku, ne na špatnou sablónku.**
2. **Mempool debits se nesmí odečítat při validaci bloku, pokud ten blok obsahuje právě tyto mempool TX.** Intra-block debits se řeší separátně.
3. **Template builder musí predikovat, co projde konsenzem.** Jinak miner zbytečně hledá bloky, které budou odmítnuty.
4. **Chybová hláška z `submit_candidate` je klíčová.** Bez ručního reprodukce bychom nezjistili, že jde o F5 balance chybu.

---

## 7. Související soubory

- `V3/L1/core/src/lib.rs` — hlavní oprava
- `V3/L1/core/src/bin/node.rs` — `ZION_BALANCE_CHECK_HEIGHT` runtime override
- `V3/L1/core/src/validation.rs` — timestamp / merkle root validace
- `V3/L1/pool/src/bin/server.rs` — pool share routing + `map_node_rejection()`

---

**Status: RESOLVED ✅**
