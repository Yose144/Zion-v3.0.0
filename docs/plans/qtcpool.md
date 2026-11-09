# QTC Payout Leg — stav, provedená práce a co zbývá dodělat

**Stav (2026-11-04): payout leg je KOMPLETNĚ VYPNUTÝ — pre-launch stav.**
Rozhodnutí operátora: „v tech qtc, tam je chyba to uplne zrus! protoze to
jeste nemame otevrene, kompletni workflow quantusu jeste na nasem nativnim
poolu neprobehl".

QTC payouty z nativního L1 poolu na Quantus chain **nikdy nedoběhly
end-to-end** (0 úspěšných submitů v historii ledgeru). Infrastruktura je
připravená, opravená a čeká na řízený launch.

---

## 1. Jak má workflow fungovat

```
miner (worker bound na quantus: qtc:/qz… adresa, *.dest-zion, *.-qtu)
  │  ZION blok nalezen → PayoutEntry{payout_chain:"quantus"}
  ▼
zion-pool (EDGE1)  pending_payouts (in-memory) + coin_revenue_outbox (durable)
  │  POST /admin/external-payouts?chain=quantus  (X-Admin-Key)
  ▼
warpd / zion-v31-multichain (EDGE2)  qtc_payout sweeper, interval 60 s
  │  zapisuje do ext_payout_records (warp_multichain.db)
  ▼
quantus chain  — submit z treasury qzpQmoF… → SS58 adresa minera
```

Treasury se plní z wormhole rewards přes
`zion-qtc-collect-rewards.timer` (denně 04:10, `infra/tools/quantus/`).

## 2. Klíčové hodnoty

| Položka | Hodnota / místo |
|---|---|
| Treasury (payout účet) | `qzpQmoFkNxJK2YVwnssLVmpGvYgyJGU2ztcMPHR8GkMj8EnsF` — keyring `(0,0)` = keccak `m/44'/189'/0'/0/0`‖seed, signer z `WARP_MNEMONIC` |
| Wormhole rewards adresa | `qzk8Rna…` (inner hash `0x1d5c…`) — nativní QTC těžba nodu |
| Destination soubor | `/opt/quantus/payout-destination.txt` (EDGE2) — opraveno z `qzjoHwaJ…` (auxpow wallet, **chyba**) na treasury |
| Sweeper switch | `QTC_PAYOUT_ENABLED` v `/etc/zion/edge-environment.sh` (EDGE2) — **aktuálně `0`** |
| Admin auth | `QTC_PAYOUT_ADMIN_KEY` + `PRL_PAYOUT_ADMIN_KEY` v `/etc/zion/env/zion-v31-multichain.env` = kopie `ZION_POOL_API_ADMIN_KEY` (EDGE1 pool env) — rotuje `infra/scripts/rotate-service-keys.sh` |
| Drain endpoint | `QTC_PAYOUT_POOL_API=http://127.0.0.1:8080` (tunel → EDGE1 pool API `:8080`) |
| Multichain ledger | `/data/zion/warp_multichain.db` — tabulka `ext_payout_records` |
| Pool store | `/opt/zion/data/v31/pool-store.db` — `coin_revenue_outbox`, `payouts` (jen `coin='zion'`; quantus položky jsou pouze in-memory) |
| Pool-side emission | `pool.rs` `worker_payout_target` → `parse_quantus_payout` (`qtc:`/`qz…`/`quantus:` wallet, `.dest-zion`/`-qtu` worker suffix) |
| Parametry | `QTC_PLANKS_PER_FLOWER=1.2386`, `QTC_PAYOUT_MIN_PLANKS=0`, `QTC_PAYOUT_MAX_FEE_PLANKS=2000000000` |

## 3. Provedená práce (2026-11-04)

### Diagnóza a oprava drainu
- **Příčina výpadku:** rotace klíčů 2. 11. vyměnila `ZION_POOL_API_ADMIN_KEY`
  (64 hex) na poolu, ale `QTC_/PRL_PAYOUT_ADMIN_KEY` v multichain env
  zůstaly staré (48 hex) → každý drain = 401 → `pool drain not ok` každých
  60 s od 2. 11. 00:24 (7 336×), fronta narostla na **12 667**.
- **Oprava:** aktuální klíč propsán do obou proměnných (bez tisku hodnoty,
  záloha env), restart `zion-v31-multichain` → drain chodil, pool-side
  pending **12 667 → 3**, ledger 12 705 `queued`.
- **Prevence (repo):** `infra/scripts/rotate-service-keys.sh` teď propaguje
  `QTC_/PRL_PAYOUT_ADMIN_KEY` + restartuje multichain — jinak se incident
  zopakuje při každé rotaci.

### Treasury path
- `collect-rewards` zametal wormhole rewards do `qzjoHwaJ…` (auxpow wallet)
  místo treasury `qzpQmoF…` → treasury se neměl nikdy čím naplnit
  (`treasury_free=0`, vše deferování).
- Opraven `payout-destination.txt`, přidán denní systemd timer
  (`zion-qtc-collect-rewards.{service,timer}`, dřív jen ruční skript).
- Ověřeno end-to-end: collect-rewards doběhl, quantus node synced
  (#348306+, ~40 peerů, validátor), wormhole pending rewards = 0
  (nativní QTC hashrate je drobný — treasury chce primárně externí funding).

### Kompletní vypnutí legu (finální stav)
- `QTC_PAYOUT_ENABLED=0` (env záloha `edge-environment.sh.bak-qtc-off-*`)
- Restart warpd → v logu žádný `qtc payout sweeper started` (PRL dry-run
  sweeper běží dál).
- `ext_payout_records`: všech **36 278** `queued`/`deferred`/`stalled`
  → `dismissed` + marker `| qtc-leg-disabled-2026-11-04` v `error`
  (záloha `warp_multichain.db.bak-qtc-off-*`).
- Pool-side: `coin_revenue_outbox` pending pro quantus = **0** (outbox
  plní jen `on_coin_revenue`; `qtu` není v
  `ZION_POOL_NATIVE_PAYOUT_COINS="prl"`); `payouts` tabulka drží jen
  `coin='zion'` — zbývající quantus položky jen in-memory (inertní, mizí
  restartem poolu).
- **Ponecháno zapnuté záměrně:** `ZION_POOL_AUXPOW_COIN=QTU` (auxpow
  **mining** ≠ payout — mineři dál vydělávají QTU přes upstream),
  `zion-qtc-collect-rewards.timer` (akumulace rewards do treasury).

### Vedlejší nález — ZION backlog není dluh
- Metrika „unconfirmed" počítá i `superseded_tx_id='voided:stuck'` řádky:
  708/774 nafouknutých; reálně ~66 řádků / ~103k ZION. `payout_resurrect`
  si mrtvé broadcasty vyřeší sám (7denní stáří, `ZION_PAYOUT_STUCK_AGE_SECS`).

## 4. Co zbývá dodělat (TODO před launch)

- [ ] **Fundnout treasury** `qzpQmoF…` — externí QTC zdroj (wormhole
      rewards nestačí; odhad fronty byl ~171 QTC, fronta je teď dismissed
      → nový odhad při re-launchu).
- [ ] **Re-enable:** `QTC_PAYOUT_ENABLED=1` + `systemctl restart
      zion-v31-multichain`. Fronta startuje čistá (vše dismissed).
- [ ] **První submit end-to-end ověřit** — nikdy v historii neproběhl:
      drain → ledger `submitted` → tx na quantus chainu → potvrzení
      na poolu. Bez toho žádné oznámení launchu.
- [ ] **Rozhodnout quantus-bound payout routing:** co s minery bound na
      `qtc:` adresy a interní `*.dest-zion` konsolidací, dokud je leg off
      (položky se jenom hromadí in-memory).
- [ ] **PRL leg** — `PRL_PAYOUT_ENABLED=1` ale `PRL_PAYOUT_DRY_RUN=1`;
      samostatné rozhodnutí o launch.
- [ ] **Kosmetika:** backlog metrika na dashboardu nechť nepočítá
      `voided:stuck` (viz §3).
- [ ] Případný resubmit legitimních položek po launch přes
      `POST /v1/admin/ext-payouts/resolve` — dismissed řádky lze při
      potřebě reklasifikovat z DB zálohy.

## 5. Zálohy a artefakty

- EDGE2: `/etc/zion/edge-environment.sh.bak-qtc-off-<ts>`,
  `/data/zion/warp_multichain.db.bak-qtc-off-<ts>`
- Repo: `infra/tools/quantus/` (collect-rewards + units),
  `infra/scripts/rotate-service-keys.sh` (fix),
  `docs/3.2/REPORTS/REPORT_2026-11-04_QTC_PAYOUT_FIX.md` (§7 = vypnutí)
- Commit: `df8bb7a02` (vypnutí + doku), `92f2213b3` (fix drainu/treasury)
