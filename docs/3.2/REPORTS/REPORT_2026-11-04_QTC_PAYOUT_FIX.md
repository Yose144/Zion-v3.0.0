# QTC payout leg — oprava drainu (401 po rotaci klíčů) + treasury funding path

**Datum:** 2026-11-04 · **Rozsah:** EDGE1 (pool), EDGE2 (warpd, quantus node),
ledger `warp_multichain.db`, `payout-destination` · **Stav:** drain opraven a
ověřen; treasury 0 QTC → funding předán 👤 (rozhodnutí).

## 1. Příčina výpadku

Rotace service klíčů 2. 11. vyměnila `ZION_POOL_API_ADMIN_KEY` na poolu, ale
**nepropsala ho warpd konzumentům** — `QTC_PAYOUT_ADMIN_KEY` a
`PRL_PAYOUT_ADMIN_KEY` v `/etc/zion/env/zion-v31-multichain.env` zůstaly na
staré hodnotě (`a8ed92…`, 48 B vs nová 64 B). Každý
`POST /admin/external-payouts` od té chvíle vracel `{"ok":false,"unauthorized"}`
→ `qtc/prl payout sweep error: internal error: pool drain not ok` každých 60 s
**od 2. 11. 00:24 (7 336×)**, fronta `chain=quantus` narostla na **12 667**.

## 2. Opravy nasazené dnes

| Krok | Detail |
|---|---|
| Klíč | aktuální `ZION_POOL_API_ADMIN_KEY` (EDGE1 pool env) propsán do `QTC_PAYOUT_ADMIN_KEY` + `PRL_PAYOUT_ADMIN_KEY` (EDGE2 `zion-v31-multichain.env`, záloha `.bak-…`); `zion-v31-multichain` restartován |
| Drain ověřen | pool-side pending **12 667 → 3**; 12 705 záznamů ledgerováno v `warp_multichain.db` (`ext_payout_records`, status `queued`) |
| Rewards destination | `/opt/quantus/payout-destination.txt` byl `qzjoHwaJ…` (auxpow wallet — **jiný účet než treasury**) → přepsáno na treasury `qzpQmoFkNxJK2YVwnssLVmpGvYgyJGU2ztcMPHR8GkMj8EnsF` (keyring `(0,0)`, keccak `m/44'/189'/0'/0/0`‖seed) |
| Timer | nový `zion-qtc-collect-rewards.{service,timer}` — denní 04:10, `Persistent` (dříve jen ruční skript, nikdy nespouštěný); end-to-end ověřen (ZK obvody postaveny, 0 pending rewards) |

## 3. Související zjištění (ZION payout backlog)

„899 903 ZION unconfirmed" byla **nafouklá metrika**: 708/774 řádků má
`superseded_tx_id='voided:stuck'` — už voidnuté a přeplacené evidence.
Reálně pending **66 řádků / ~103k ZION**; 36 řádků z 28.–31. 10. jsou mrtvé
broadcasty (`getTransaction → null`) — `payout_resurrect` je voidne+requeue
automaticky po 7denním stáří (28. 10. skupina eligible dnes ~17:00 UTC).
Potvrzování běží (`payout_confirmed` v logu). Kód: metrika `confirmed=0`
počítá i voidnuté řádky → nadhodnocuje ~783k ZION (jen reportovací nit).

## 4. Co zůstává na 👤

- **Treasury `qzpQmoF…` = 0 QTC** — reálně. Fronta ~12 705 payoutů potřebuje
  ~**171 QTC** (+ fee ~0.8–1.0e9 planks/tx). Wormhole rewards jsou 0 (nativní
  QTC leg ~153 MH/s). Fundnout lze jen externě na adresu treasury.
- **23 362 `stalled`** ledger řádků (přerušené restarty) — po fundingu přes
  `POST /v1/admin/ext-payouts/resolve` (`resubmit`/`dismiss`). Většina jsou
  `.dest-zion` self-payments → `dismiss` vyčistí šum.
- Ledger ukazuje **0 úspěšných submitů za celou historii** — leg nikdy
  nedoběhl end-to-end; po doplnění treasury půjde o první funded mainnet
  submit (otevřený bod `QUANTUS-INTEGRATION-PLAN.md` §F4).

## 5. Repo změny

- `infra/scripts/rotate-service-keys.sh` — propagace `QTC_/PRL_PAYOUT_ADMIN_KEY`
  + `zion-v31-multichain` v restart sekvenci (jinak se incident zopakuje při
  příští rotaci).
- `infra/tools/quantus/` — verzovaný `collect-rewards.sh` + systemd unit/timer.

## 6. Ověření

- `journalctl -u zion-v31-multichain`: `qtc_sweeper drained payouts count=…`
  (žádné `pool drain not ok` po restartu)
- `GET /admin/external-payouts?chain=quantus` (admin klíč): `pending: 3`
- `quantus balance qzpQmoF…` = 0 (očekávané, čeká na funding)
- `zion-quantus-node`: synced #348306+, 40 peerů, validátor autoring bloky
