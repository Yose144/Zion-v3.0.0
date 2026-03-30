# Report — CH v3 native miners + external pools (ETC/RVN)

Datum: 2026-01-18

## Cíl
- Spustit **Cosmic Harmony v3** na *native* cestě (Rust FFI + GPU), ne fallback.
- Potvrdit, že pool má **viditelnou komunikaci** s externími pooly (ETC/RVN): connect/auth/submit + odpovědi v logu.

## Stav (co je hotové)
- `src/miner/cosmic_harmony_native.py`
  - Podpora env override `ZION_CHV3_LIB_PATH` (priorita před autodetekcí).
  - Rozšířené search paths pro artefakt z `2.9.5/target/release/`.
  - Lepší error hlášky při load fail.

- `src/pool/ch3_hash_submitter.py`
  - Přidané explicitní structlog eventy:
    - `ch3_external_pool_connected`
    - `ch3_external_pool_authorized` / `ch3_external_pool_authorize_failed`
    - `ch3_external_pool_subscribe_failed`
    - `ch3_external_pool_submit_accepted` / `ch3_external_pool_submit_rejected`
  - ETC submit shape upraven pro ethash/etchash-like očekávání (5 params):
    - `[user, job_id, nonce0x, result0x, mix0x]`
    - `mix0x` je zatím stejné jako `result0x` (není to plná ethash solution).

- `zion_native_miner_v2_9.py`
  - Přidáno `--processes` (škálování pro `--algorithm cosmic_harmony` přes procesy; 1 thread/proces) + lepší hint pro CHv3 lib.

## Ověření / jak spustit CHv3 native na mineru
1) Sestavení knihovny (macOS/Linux):
- `./2.9.5/scripts/build_chv3_lib.sh`
  - Skript vypíše absolutní cestu k `libzion_cosmic_harmony_v3.*`

2) Benchmark (rychlá validace, že jede native path):
- `ZION_CHV3_LIB_PATH=/ABS/PATH/libzion_cosmic_harmony_v3.dylib python zion_native_miner_v2_9.py --algorithm cosmic_harmony_v3 --benchmark --duration 2 --threads 2`

3) Reálný mining:
- `ZION_CHV3_LIB_PATH=/ABS/PATH/libzion_cosmic_harmony_v3.dylib python zion_native_miner_v2_9.py --algorithm cosmic_harmony_v3 --pool <HOST:PORT> --wallet <ZION_ADDR> --worker chv3-01 --gpu`

## Ověření ETC/RVN příjmu (pool logs)
Po restartu poolu hledej eventy:
- `ch3_external_pool_connected`
- `ch3_external_pool_authorized`
- `ch3_external_pool_submit_rejected` (u dummy share typicky `Low difficulty` / `Stale share`)

Poznámka k ETC: ETC pool striktně očekává ethash/etchash-style submit. Tady zatím pouze **prokazujeme protokolovou kompatibilitu a logovatelnou odpověď** (už to nepadá na `Invalid params`), ale bez plné ethash solution budou “accepted shares” nepravděpodobné.

## Restart runbook (docker-compose)
- Restart pool service:
  - `docker-compose -f docker/compose/docker-compose-v2.9-production.yml restart pool`
- Sledování logů:
  - `docker-compose -f docker/compose/docker-compose-v2.9-production.yml logs -f --tail=200 pool | grep -E "ch3_external_pool_(connected|authorized|submit_)"`

Pokud běží pod systemd (místo compose), ekvivalent je:
- `systemctl restart zion-pool` a `journalctl -u zion-pool -f | grep ch3_external_`
