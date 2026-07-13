# ZION AuxPoW – XMR/RandomX E2E test: zpráva z provádění

> Stav: **pool-side připraveno a nasazeno** (2026-07-13)
> Produktivní pool `62.171.141.136:8444` se úspěšně připojil k `gulf.moneroocean.stream:10001`, autorizoval se a přijímá externí RandomX joby. Čeká se na připojení SMOS rigu s RandomX-capable custom minerem a potvrzení prvního share.

---

## 1. Co bylo cílem

Dokončit end-to-end test XMR (RandomX) AuxPoW na MoneroOcean poolu tak, aby:
- pool stahoval XMR joby z `gulf.moneroocean.stream:10001`,
- rozesílal tyto joby minerům jako `randomx` algoritmus,
- miner řešil skutečný RandomX hashe (CPU-only),
- a pool odesílal nalezené shary zpět do MoneroOcean.

Předchozí stav: XMR byl deklarován v `ExternalCoin`, ale chyběla implementace Monero/RandomX Stratum parseru a submit formátu.

---

## 2. Nalezené mezery před zahájením

### 2.1 Chybějící parser pro RandomX `mining.notify`

- MoneroOcean používá xmrig-kompatibilní Stratum v1:
  `mining.notify params = [job_id, seed_hash, next_seed_hash, blob, height, target, clean_jobs]`
- Generic parser v `auxpow_client.rs` by interpretoval `prevhash` jako `header_hex`, což není validní RandomX blob.
- Neexistoval kód pro extrakci `blob`, `seed_hash`, `height` a `target`.

### 2.2 Špatný formát `mining.submit`

- Fallback submit používal 64-bit nonce s `0x` prefixem: `[worker, job_id, "0x{:016x}"]`.
- Monero vyžaduje 32-bit nonce jako 8 hex znaků bez prefixu: `[worker, job_id, "{:08x}"]`.

### 2.3 Špatný target comparison

- RandomX pooly posílají 8-byte little-endian target (16 hex znaků).
- Full 256-bit big-endian `meets_target` by odmítal validní shary.
- xmrig provádí partial comparison prvních 8 bajtů hashle.

### 2.4 Špatné autorizační heslo pro XMR

- Autorizace používala `c=BTC` pro všechny non-DCR Stratum mince.
- XMR nepodporuje BTC payout (`supports_btc_payout()` vrací `false`); MoneroOcean vyžaduje XMR wallet a heslo jako `x` nebo `x,d=4`.

---

## 3. Provedené opravy v kódu

### 3.1 `AuXpow/src/external_hashers.rs`

- Přidána funkce `parse_randomx_target_hex(hex: &str) -> Option<[u8; 32]>`:
  - Dekóduje 16 hex znaků jako 8-byte LE target.
  - Uloží jich do prvních 8 bajtů 32-byte pole.
- Přidána funkce `meets_randomx_target(hash, target) -> bool`:
  - Porovnává prvních 8 bajtů hashle (LE u64) s targetem.
  - Odpovídá chování xmrig.

### 3.2 `AuXpow/src/auxpow_client.rs`

- Přidán XMR-specifický parser `parse_notify_params` pro RandomX Stratum:
  - Hledá blob jako nejdelší hex string, seed_hash jako 64-char hex, height jako `u64`, target jako 16-char hex.
  - Uloží dekódovaný blob do `ExternalJob.header_bytes`.
  - Uloží `seed_hash`, `block_number` (height) a target.
- Přidán XMR-specifický `submit_share` formát:
  - `mining.submit params = [worker, job_id, "{:08x}"]` s lower 32 bitů nonce.
- Opraveno autorizační heslo:
  - Pro CPU mince (XMR) a DCR se používá `"x,d=4"`.
  - Pro mince s BTC payout se používá `"c=BTC"`.
  - Jinak `"x"`.
- Přidán unit test `xmr_randomx_notify_and_submit` s mock MoneroOcean serverem.

### 3.3 `AuXpow/src/share_forwarder.rs`

- Pro `ExternalCoin::XMR` se používá `meets_randomx_target` místo full BE/LE comparison.

### 3.4 Produkční konfigurace na VPS `62.171.141.136`

Aktualizován `/etc/zion/edge-environment.sh`:
- `ZION_POOL_AUXPOW_COIN=XMR`
- `ZION_POOL_AUXPOW_WALLET=45zTKY3zei7ACSWrQAXeU7AsTwccCfN52Kt7odqWq9icYfB9zGTmfmd5fi28oFsktNHiguc2oHizZhfvhVqauXf6Q4CcUED`
- `ZION_POOL_AUXPOW_WORKER_NAME=zion-pool`
- `ZION_POOL_AUXPOW_SPLIT_ZION=4`
- `ZION_POOL_AUXPOW_SPLIT_EXTERNAL=1`
- `ZION_STREAM_KAWPOW_PCT=0`
- `ZION_STREAM_RANDOMX_PCT=25`
- `ZION_AUXPOW_WALLET` také nastaveno na stejnou XMR adresu.

---

## 4. Testy a build

- `cargo test -p zion-auxpow --lib`: **85/85 passed**
  - Nové testy: `parse_randomx_target_hex_le`, `parse_randomx_target_hex_rejects_wrong_length`, `xmr_randomx_notify_and_submit`.
- `cargo test -p zion-pool --lib`: **73/73 passed**
- `cargo test -p zion-pool --bin server`: **38/38 passed**
- `cargo build --release -p zion-pool`: úspěšně

---

## 5. Produkční nasazení

- Binární soubor `/usr/local/bin/zion-pool-server` nahrazen novým buildem.
- Restartována služba `zion-pool.service`.
- Log potvrzuje:
  - `auxpow: subscribed to XMR`
  - `auxpow: authorizing worker=<XMR>.zion-pool password=x,d=4 on XMR`
  - `auxpow: authorized as <XMR>.zion-pool on XMR`
  - `auxpow: XMR set_target=...`
  - `auxpow_bridge: queued job_id=... coin=XMR algo=randomx`

---

## 6. Zbývající kroky

### 6.1 SMOS rig – RandomX custom miner

- Aktuální rig byl nastaven pro RVN/KawPow. Pro RandomX je potřeba:
  - Připravit custom miner zip s xmrig nebo jiným RandomX-capable minerem.
  - Konfigurovat ho pro ZION pool `62.171.171.136:8444` (port 8444).
  - Miner musí rozumět ZION pool protokolu a pro `algorithm=randomx` počítat RandomX hash nad přijatým blobem (poslední 4 bajty = nonce).

### 6.2 Ověření prvního share

- Po připojení rigu sledovat logy:
  - `issued_external_job miner=... coin=XMR algorithm=randomx`
  - `auxpow_share_accepted miner=... job=... coin=XMR`
- Na MoneroOcean dashboardu by se měly objevit accepted shary pro worker `zion-pool`.

### 6.3 Profit switching / multi-coin

- Po úspěšném XMR E2E lze přidat RandomX lane do revenue scheduleru společně s KawPow atd.
- Scheduler stále používá blake3 fallback pro RandomX mining simulaci – pro B2B proxy to nevadí, ale pro true profit-switch simulaci je potřeba integrace reálného RandomX VM.

---

## 7. Související commity

- TBD — commit nasleduje po finalizaci tohoto reportu.
