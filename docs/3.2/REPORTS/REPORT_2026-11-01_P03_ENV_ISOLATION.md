# REPORT — P0-3 credential isolation: per-service env subsety (2026-11-01)

> **Zadání 👤:** „izolaci udělej, **rotaci klíčů zatím ne**."
> **Výsledek:** oba boxy mají secrety rozdělené do `/etc/zion/env/<service>.env` (0640 root:zion),
> sdílený `edge-environment.sh` už **neobsahuje ani jeden secret-ish název** a každá služba vidí
> **0 cizích** credentialů (ověřeno z `/proc/<pid>/environ`). **Žádný klíč nebyl rotován** —
> hodnoty jsou 1:1 kopie.

## 1. Co bylo špatně

`/etc/zion/edge-environment.sh` (176–184 proměnných, mode **0644** = world-readable) četlo
**12 služeb** na obou boxech. Každá viděla payout klíč poolu, `WARP_MNEMONIC`, `ZION_WALLET_MNEMONIC`,
DAO klíč, auxpow hesla… Únik jedné služby (RCE/SSRF) = únik celé peněženky.

Naměřeno před zásahem (`/proc/<pid>/environ`): `zion-v31-dao`, `node`, `free-world`, `issobella`
i `multichain` měly v prostředí **27 cizích secretů**.

## 2. Mapování secret → služba (z kódu, ne odhad)

| Služba | Secrety (13/11/2/1) |
|---|---|
| `zion-v31-pool` (EDGE) | `ZION_POOL_API_KEY`, `ZION_POOL_API_ADMIN_KEY`, `ZION_POOL_WALLET_KEY`, `ZION_POOL_TLS_KEY`, `ZION_POOL_ZIS_SERVICE_KEY`, `QTC_NATIVE_TOKEN_FILE`, `ZION_POOL_AUXPOW_PASSWORD_{EVR,KRX,MEWC,PHX,RTM,ZCL,ZEC}` |
| `zion-v31-multichain` (EDGE2) | `WARP_MNEMONIC`, `WARP_EVM_RELAY_KEY`, `WARP_VALIDATOR_KEYS`, `WARP_BTC_RELAY_KEY`, `WARP_BTC_SWAP_OFFER_KEY`, `WARP_BTC_SWAP_ZION_SECRET`, `ZION_WALLET_MNEMONIC`, `ZION_HTLC_PREIMAGE_KEY`, `PRL_PAYOUT_ADMIN_KEY`, `PRL_RPC_PASS`, `QTC_PAYOUT_ADMIN_KEY` |
| `zion-v31-dao`, `issobella` | `ZION_DAO_API_KEY` |
| `zion-v31-free-world` | `FREE_WORLD_API_KEY`, `ZION_DAO_API_KEY` |
| `zion-v31-node`, `node2`, `node3` | `ZION_BRIDGE_VALIDATOR_PUBKEYS` (veřejné klíče, ne secret) |
| `zion-edge-python-dashboard` (EDGE) | `ZION_POOL_API_KEY`, `ZION_POOL_API_ADMIN_KEY` (volá pool API) |
| **nepoužívá žádný kód** → `legacy-unused.env` (0600 root, **nenačítá se**) | `ZION_SWAP_BEARER_TOKEN`, `ZION_SWAP_ESCROW_KEY`, `ZION_POOL_PAYOUT_SK_HEX` |

Zdroj mapování: `env::var("…")`, clap `#[arg(env = "…")]`, dynamické
`ZION_POOL_AUXPOW_PASSWORD_<TICKER>` (`auxpow_runtime.rs:86`), `PREIMAGE_KEY_ENV` (`htlc.rs:1081`).

## 3. Co je nasazené

Skript `infra/scripts/gen-per-service-env.sh` (režimy `--check|--apply|--strip|--verify`), spuštěný
na obou boxech:

1. `--apply` → `/etc/zion/env/<service>.env` (0640 `root:zion`) + drop-in
   `/etc/systemd/system/<unit>.service.d/10-p03-env-isolation.conf` s
   `EnvironmentFile=-/etc/zion/env/<service>.env` (načte se **po** sdíleném → override).
2. `--strip` → ze sdíleného souboru odebráno **30 secretů**, zůstalo 154 (EDGE2) / 156 (EDGE)
   proměnných, mode `0644 → 0640 root:zion`. Zálohy:
   `/root/edge-environment.sh.bak-p03-strip-20261101T215528Z` (EDGE2),
   `…T215731Z` (EDGE) + `…bak-edge-p03-*`.
3. Restarty (aby procesy dostaly nové prostředí) + verifikace.

## 4. Ověření

| Služba | vlastní secrety | cizí secrety | health |
|---|---|---|---|
| `zion-v31-node` (EDGE2) | 1/1 | **0** | h=105 617, `3.2.0` |
| `zion-v31-multichain` | 11/11 | **0** | `/health` 200 |
| `zion-v31-dao` | 1/1 | **0** | `/api/dao/health` 200 |
| `zion-v31-free-world` | 2/2 | **0** | `/health` 200 |
| `zion-v31-issobella` | 1/1 | **0** | `/health` 200 |
| `zion-v31-pool` (EDGE) | 13/13 | **0** | `/health` ok, restart **5 s**, sessions se vrátily (2 accepted, 0 rejected) |
| `node2` / `node3` | 1/1 | **0** | 9446/9447 odpovídají, dohánějí tip |
| `edge-python-dashboard` | 2/2 | **0** | `/api/ops/*` OK |

- Sdílený env: `grep -E "KEY|SECRET|PASS|TOKEN|MNEMONIC|SK_HEX|PASSWORD|CREDENTIAL"` → **0 jmen**
  na obou boxech.
- **G8:** restarty byly časované mimo vzorkovací okno (:20–:34) → **0 nových incidentů**
  (7 jako před zásahem), všechny pody `probe_success=1`.

## 5. Bonus — dashboard přestal vypisovat hodnoty

`GET /api/pool/debug` parsoval `edge-environment.sh` a vracel **hodnoty** proměnných s
`POOL|MINER|PAYOUT|PPLNS|FEE|AUXPOW|STRATUM` v názvu — tedy i payout klíč. Po stripu tam secrety
nejsou, ale do kódu přidáno **maskování podle jména** (`***redacted***` pro
KEY/SECRET/PASS/TOKEN/MNEMONIC/SK_HEX/PASSWORD/CREDENTIAL), aby regrese nemohla nic vyzradit.
Ověřeno: 68 proměnných, 0 redacted (už tam žádný secret není), 0 leaků.

## 6. Rollback

```bash
# 1) vrátit sdílený env
cp -a /root/edge-environment.sh.bak-p03-strip-20261101T215528Z /etc/zion/edge-environment.sh   # EDGE2
# 2) smazat drop-iny a reload
rm -f /etc/systemd/system/*.service.d/10-p03-env-isolation.conf
systemctl daemon-reload && systemctl restart <služby>
```
`/etc/zion/env/` lze nechat, je neškodný. Nic se nerotovalo, takže rollback je čistě konfigurační.

## 7. Co zůstává otevřené

- **Rotace klíčů** — 👤 rozhodnutí „zatím ne". Do rotace je nutné počítat s tím, že soubor byl
  **world-readable 0644** a secrety jsou v zálohách `edge-environment.sh.bak-*` (a v `archive/`,
  `canonical-main`, `/root/web-backups`), takže hodnoty je třeba považovat za exponované.
- `ZION_WALLET_SK_HEX` / `ZION_BURN_SK_HEX` / `ZION_OLD_ESCROW_SK_HEX` čte jen CLI (`gen-keys`,
  burn nástroje), ne běžící služby — ve sdíleném env po stripu nejsou (ověřeno: 0 secret-ish jmen).
- ZIS a MarketPlace mají vlastní `.env` (mimo tento rozsah), `pool-standby` má vlastní
  `/etc/zion/pool-standby.env`.
