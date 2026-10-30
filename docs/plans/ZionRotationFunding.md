# ZION V2 Canonization — Funding Guide (multichain rotace)

**Co se děje:** Klíče z `V31_PREMINE_V2_KEYS_2026-08-06.json` (poslední genesis hard reset
6. 8.) jsou kanonické pro celý ekosystém. L1, DAO, escrow, Base kontrakty i WARP relay
už běží na V2. Zbývají **non-Base EVM chainy** — tam rotaci blokuje jen gas.

## Adresy (přesné, verify checksum před odesláním!)

| Kdo | Adresa |
|---|---|
| **V2 validator_1** (nový kanonický EVM admin + WARP relay) | `0x13D06bEfcd28A06616C3CE2C6C7F5cdE5f02BB2b` |
| **Old deployer** (starý klíč — potřebuje gas jen pro dokončení rotace, pak definitivně odchází) | `0xdde17506BC2D2dCE1d594bD1D85B0BAbb389D186` |

## Kam poslat — funding tabulka

| Chain | Poslat na | Částka | Co se pak spustí |
|---|---|---|---|
| **Polygon (137)** | v1 `0x13D06bEf…` | **0.3 POL** | v1 dokončí sám (má už DEF_ADMIN): addValidator v5, threshold→3, remove 5 starých, revoke starého |
| **BSC (56)** | old `0xdde17…` | **0.005 BNB** | celá rotace executorem old vč. self-revoke |
| **Arbitrum (42161)** | old `0xdde17…` | **0.001 ETH** | stejně |
| **Optimism (10)** | old `0xdde17…` | **0.002 ETH** (L1 fee) | stejně |
| **Avalanche (43114)** | old `0xdde17…` | **0.05 AVAX** | stejně |
| **Base (8453)** | v1 `0x13D06bEf…` | **0.005 ETH** (dobytí) | provozní gas pro WARP relay + admin cally (teď 0.00008) |
| **Robinhood (4663)** | old `0xdde17…` | **0.005 ETH** | odblokuje odložený `DeployRobinhood.s.sol` (wZION+bridge deploy, čeká od 20. 9.) |

> Částky = odhad ~15 tx × gas s rezervou ~3×. Nepoužité zůstane na adrese (v1 = provozní
> rezerva; old = po revokách mrtvý klíč, drobné tam zůstanou — je to OK).

## Stav rotace (2026-10-27)

| Vrstva | Stav |
|---|---|
| L1 premine/admin/canonical | ✅ V2 |
| DAO guardians 5z7 | ✅ V2 live |
| L1 bridge allowlist + escrow | ✅ V2 |
| Base — 9 kontraktů admin | ✅ V2 validator_1 |
| Base — bridge validators | ✅ 3-of-5 V2 |
| Base — starý klíč | ✅ 0 rolí |
| WARP relay + validators | ✅ V2 (warpd restart čistý) |
| **Polygon** | 🟡 grants + 4/5 validatorů (threshold 5 nedotčen — SAFE) |
| **BSC / Arb / OP / AVAX** | 🔴 čeká na funding |

## Co udělám po připsání

1. `rotate_poly.mjs` (EDGE2, `MarketPlace/`) — idempotentní, doběhne per chain.
2. Verifikace on-chain: threshold=3, 5× V2 validators, old = 0 rolí.
3. Update reportu + AGENTS.md.

**Bezpečnostní poznámky:**
- Posílej **jen na adresy výše** — v1 adresa je stejná na všech EVM chainech.
- Starý klíč (`0xdde17…`) má po dokončení **0 rolí všude** — jeho gas je mrtvý náklad,
  proto na něj posílej jen minimum potřebné pro jeho poslední self-revoke tx.
- Citlivý detail: `docs/3.2/REPORTS/REPORT_2026-10-27_EVM_KEY_CANONIZATION.md`.
