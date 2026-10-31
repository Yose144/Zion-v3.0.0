# P0-3 — Shared environment audit & per-service subset plan

**Datum:** 2026-10-31 · **Status:** 🤖 příprava (audit + návrh); rotace a flip = 👤
**Souvisí:** `AGENTS.md` (P0-3 otevřené), `NIRVANA-V3.3-KRALOVSTVI-SRDCE-PLAN.md` §2 (rozpor #?), `docs/3.2/AUDIT-TRIAGE.md`

## 1. Nález

`/etc/zion/edge-environment.sh` je **jeden sdílený soubor** (mode `0644`,
world-readable!) načítaný **~15 aktivními službami** na EDGE2 (node, pool,
multichain, miner, dao, bridge, atomic-swap, oasis, free-world, issobella,
ncl, dashboard, edge-agent, debug-pool). Každá služba tak vidí **všechny**
proměnné všech ostatních — včetně `ZION_POOL_PAYOUT_SK_HEX`,
`WARP_MNEMONIC`, `WARP_EVM_RELAY_KEY`, DB credentials, API klíčů.

**Důsledky:**
- Únik jedné služby (RCE/SSRF) = únik všech klíčů.
- Soubor je world-readable (0644) — lokální uživatel (např. `zion`,
  `www-data`) může přečíst všechny secrety.
- Blast radius rotace = celý node (restart všech služeb).

`zion-pool-l1-primary.env` (mode `0600`) je samostatný a čte ho jen pool —
to je správný vzor, který chybí pro ostatní.

## 2. Inventář (jména proměnných, žádné hodnoty)

- Celkem **186 proměnných** v `edge-environment.sh`.
- Secret-ish (klíče, hesla, mnemoniky, tokeny, admin keys): **24**:
  `FREE_WORLD_API_KEY`, `PRL_PAYOUT_ADMIN_KEY`, `PRL_RPC_PASS`,
  `QTC_NATIVE_TOKEN_FILE`, `QTC_PAYOUT_ADMIN_KEY`, `WARP_BTC_RELAY_KEY`,
  `WARP_BTC_SWAP_OFFER_KEY`, `WARP_BTC_SWAP_ZION_SECRET`,
  `WARP_EVM_RELAY_KEY`, `WARP_MNEMONIC`, `WARP_VALIDATOR_KEYS`,
  `ZION_BRIDGE_VALIDATOR_PUBKEYS`, `ZION_DAO_API_KEY`,
  `ZION_HTLC_PREIMAGE_KEY`, `ZION_POOL_API_ADMIN_KEY`,
  `ZION_POOL_API_KEY`, `ZION_POOL_AUXPOW_PASSWORD_*` (7×),
  `ZION_POOL_PAYOUT_SK_HEX`, `ZION_POOL_TLS_KEY`, `ZION_POOL_WALLET_KEY`,
  `ZION_POOL_ZIS_SERVICE_KEY`, `ZION_SWAP_BEARER_TOKEN`,
  `ZION_SWAP_ESCROW_KEY`, `ZION_WALLET_MNEMONIC`.

## 3. Navrhované per-service subsety (jen jména, bez hodnot)

| Služba | Potřebné secrety | Sdílené non-secret (porty, URL) |
|---|---|---|
| `zion-v31-node` | (žádné soukromé klíče — node je stateless) | L1 RPC URL, seed peers, human/issobella addr |
| `zion-v31-pool` | `ZION_POOL_PAYOUT_SK_HEX`, `ZION_POOL_WALLET_KEY`, `ZION_POOL_API_KEY/ADMIN_KEY`, `ZION_POOL_ZIS_SERVICE_KEY`, auxpow passwords, TLS key | L1 RPC URL, payout address, coin config |
| `zion-v31-multichain` | `WARP_MNEMONIC`, `WARP_EVM_RELAY_KEY`, `WARP_VALIDATOR_KEYS`, `WARP_BTC_RELAY_KEY`, `ZION_SWAP_ESCROW_KEY`, `ZION_HTLC_PREIMAGE_KEY`, `ZION_WALLET_MNEMONIC` | L1 RPC URL, vault address, chain config |
| `zion-v31-dao` | `ZION_DAO_API_KEY` | node RPC, guardian config |
| `zion-v31-miner` | (žádné) | pool addr, wallet, worker |
| `zion-v31-oasis` / `free-world` / `issobella` / `ncl` | příslušné API klíče | DB path, L1 RPC, port |
| `zion-zis` | JWT private key (vlastní env) | DB URL |
| `zion-marketplace` / `website` | (vlastní `.env` v app tree) | — |

## 4. Kroky (🤖 příprava hotová, 👤 akce)

1. **👤 Rotace klíčů** — všechny 24 secretů rotovat (nové hodnoty), staré
   považovat za kompromitované (soubor byl 0644). Nové hodnoty uložit do
   per-service env souborů (mode `0600`, owner = service user).
2. **🤖 Vytvořit `/etc/zion/env.d/<service>.env`** pro každou službu se
   subsetem z §3 (jen jména + placeholder hodnoty). Skript
   `scripts/ops/gen-per-service-env.sh` (TODO).
3. **🤖 Upravit systemd unit `EnvironmentFile=`** per service → nový soubor;
   ponechat `edge-environment.sh` jako legacy fallback pro dev.
4. **👤 Restart všech služeb** v okně (G8: mimo incident window), ověřit
   `/health` všech.
5. **🤖 Po ověření:** `chmod 600 /etc/zion/edge-environment.sh` (nebo
   smazat) a auditovat, že žádná služba ho už nečte.
6. **🤖 Aktualizovat `docs/3.2/StatusV3.md`** topologii (per-service env).

## 5. Poznámka k G8

Rotace klíčů vyžaduje restart všech služeb na EDGE2 — během G8 okna
(29. 10.–28. 11.) to znamená krátký výpadek. Doporučeno: provést v
okně údržby (např. 02:00 UTC), kdy je traffic nízký, a zaznamenat
jako G8 incident (pod 900 s thresholdem = nekritický). Nebo počkat do
po-G8 (po 28. 11.) — 👤 rozhodnutí.
