# Report: Fix potvrzování payoutů („Transaction not found“) — 2026‑01‑14

## Kontext
V poolu se objevoval stav, kdy payouty zůstávaly ve stavu `sent`, ale potvrzování opakovaně selhávalo hláškou **„Transaction not found“**. V logu se to projevovalo jako cyklus „Confirm payout failed (will retry)“ bez toho, aby se spustila existující logika pro timeout + unlock.

Cíl: zajistit, aby „not found“ nepadalo jako výjimka v RPC klientovi, ale bylo předáno dál jako výsledek, aby `payout_manager` mohl korektně provést timeout/unlock (nebo potvrzení, pokud se tx později objeví).

## Zjištění (root cause)
- Node RPC metoda `gettransaction` vrací „Transaction not found“ jako **`result.error`** (aplikační error uvnitř `result`), nikoli jako JSON‑RPC error.
- `src/pool/blockchain/rpc_client.py` původně jakýkoli `result.error` převáděl na výjimku.
- `src/pool/payout/payout_manager.py` má připravenou větev „tx missing → po timeoutu odemkni locked prostředky“, ale ta se spustí **jen když dostane dict s `error`**, ne když dostane výjimku.

Důsledek: payout manager viděl výjimku, logoval „will retry“, ale nikdy nedošel do části, která po timeoutu odemkne prostředky a označí payout jako `failed`.

## Implementovaná změna
### 1) RPC klient: umožnit lookup‑style metody bez vyhazování na `result.error`
Soubor: `src/pool/blockchain/rpc_client.py`

- Přidána metoda `call_allow_result_error()`:
  - zachová stejné chování jako `call()` pro HTTP chyby a JSON‑RPC `error`
  - **NEVYHAZUJE** výjimku na `result["error"]`
  - zachovává circuit breaker chování (open/half‑open) a přičítání failure pouze pro connection/system chyby

- `get_transaction()` upraveno na:
  - `return await self.call_allow_result_error("gettransaction", [tx_id])`

Očekávaný efekt:
- `payout_manager._confirm_sent_payouts()` dostane `{"error": "Transaction not found"}` jako běžný výsledek a může vykonat timeout/unlock logiku.

### 2) Testy
Soubor: `tests/test_rpc_client.py`

- Upraven existující test `test_get_transaction` (protože `get_transaction()` už nevolá `call()`, ale `call_allow_result_error()`).
- Přidán unit test `test_call_allow_result_error_allows_result_error`, který ověřuje, že `call_allow_result_error()` vrací dict s `{"error": ...}` bez vyhození výjimky.

## Provozní ověření na serveru (DE host)
- Ověřeno na reálném stuck payoutu (příklad):
  - `payout_id=129525`
  - `tx_id=tx_0_1767144911_bcbf35aa`
  - Node RPC: `gettransaction([tx_id])` → `result.error = "Transaction not found"`

Po nasazení fixu a restartu poolu:
- V logu se objevuje očekávaný stav:
  - `⚠️  Payout tx missing; unlocked after timeout: payout_id=129525 ... error=Transaction not found`
- Následně pool pokračuje standardně a vytváří nové payouty (nevisí to ve stavu `sent`).

## Dopady a rizika
- Změna je záměrně úzká: netýká se všech RPC callů, jen přidává alternativní cestu pro lookup‑style metody.
- JSON‑RPC `error` stále vyhazuje výjimku (správně), takže skutečné RPC chyby nezůstanou skryté.
- Riziko: pokud by některé jiné metody používaly `result.error` pro „hard“ chyby, je potřeba je nadále volat přes `call()` (ne přes `call_allow_result_error()`).

## Doporučené další kroky
1. **Policy pro staré `sent` payouty**: zvážit kratší timeout nebo okamžitý fail+unlock, pokud je payout extrémně starý (např. po restartu chainu nebo mempool eviction).
2. **Telemetrie**: přidat metriky/počítadla pro `payout_confirm_missing_tx` a počet failů/unlocků.
3. **Diagnostika tx lifecycle**: pro `sendtransaction` logovat/ukládat i případný on‑chain hash/receipt, pokud existuje odlišné ID vs hash.

## Shrnutí
Fix řeší primární problém: „Transaction not found“ už nezpůsobuje výjimku v RPC klientovi při `gettransaction`, takže payout manager může spustit existující timeout/unlock logiku. Ověřeno jednotkovým testem i v produkčním logu na DE hostu (payout odemčen a označen jako `failed`).
