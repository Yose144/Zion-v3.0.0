# ZION Web v2.9 → v3.0.3 Upgrade Guide

> **Datum:** 2026-06-27
> **Status:** ✅ DEPLOYED — Edge server běží na 3.0.3, web upgrade pending
> **Cíl:** Aktualizovat `APP&WEB/website-v2.9/` z 12-decimal (1e12) na 6-decimal (1e6) flowers per ZION

---

## 1. Co se změnilo v 3.0.3

| Constant | Old (v2.9 / pre-3.0.3) | New (v3.0.3) |
|----------|----------------------|--------------|
| `FLOWERS_PER_ZION` | `1_000_000_000_000` (1e12) | `1_000_000` (1e6) |
| Decimals | 12 | 6 |
| `FLOWERS_TO_WEI_FACTOR` | `1_000_000` (1e6) | `1_000_000_000_000` (1e12) |
| Bridge conversion | flowers × 1e6 = wei | flowers × 1e12 = wei |
| Block reward | `5_400_067_000_000_000` | `5_400_067_000` |
| `protocol_version` | `zion-v3-node/0.1` | `zion-v3-node/3.0.3` |
| `protocol_version_numeric` | (n/a) | `2` |
| RPC fields | `amount_atomic` | `amount_flowers` (canonical), `amount_atomic`/`amount_zion` (deprecated aliases) |

## 2. Soubory k aktualizaci v `APP&WEB/website-v2.9/`

### Kritické (constants a RPC)

| Soubor | Co změnit |
|--------|----------|
| `src/lib/constants.ts` | `FLOWERS_PER_ZION = 1_000_000`, block reward, comments |
| `src/lib/zion-rpc.ts` | `ATOMIC_PER_ZION = 1_000_000`, amount conversions |

### Amount display (`.tsx` soubory)

Všechny `(atomic / 1e12)` → `(atomic / 1e6)` pro **ZION amount display**.

**NEMĚNIT** (správné pro hashrate/bytes):
- `if (h >= 1e12) return ... TH/s` — hashrate display
- `if (bytes >= 1e12) return ... TB` — bytes display
- `if (n >= 1e12) return ... T` — generic large number formatting

### Seznam .tsx souborů s amount conversions

| Soubor | Řádky | Co |
|--------|-------|----|
| `src/components/pool/PoolBlocksClient.tsx` | 154, 518 | `atomic / 1e12` → `/ 1e6` |
| `src/components/pool/PoolBenchmarksClient.tsx` | 296 | `reward / 1e12` → `/ 1e6` |
| `src/components/pool/PoolMinersClient.tsx` | 307 | `reward / 1e12` → `/ 1e6` |
| `src/components/PoolDashboard.tsx` | 211, 281, 654 | `atomic / 1e12`, `reward / 1e12`, `pending_total_atomic / 1e12` |
| `src/components/explorer/ProExplorerStats.tsx` | 202 | `pool_pending_payouts_atomic / 1e12` |
| `src/components/MinerDashboard.tsx` | 116, 452 | `atomic / 1e12`, `b.reward / 1e12` |
| `src/app/network/page.tsx` | 655 | `last_block.reward / 1e12` |
| `src/app/swap/page.tsx` | 536, 612 | `amount_flowers / 1_000_000_000_000` → `/ 1_000_000` |
| `src/components/MissionControlDashboard.tsx` | 1334 | `utxo.amount / 1_000_000_000_000` → `/ 1_000_000` |
| `src/app/explorer/miners/MinersLeaderboardClient.tsx` | 108, 179 | `miner_supply / 1e12`, `m.balance / 1e12` |

## 3. Build a deploy

```bash
cd APP\&WEB/website-v2.9/
npm install
npm run build
# Deploy na Edge:
# scp -r .next/ root@100.76.16.108:/root/zion-2.9.6-main/APP\&WEB/website-v2.9/
# nebo přes Docker: docker compose -f docker-compose.yml up -d
```

## 4. Verifikace

Po deploy:
- Otevřít web, zkontrolovat že balance/payout/reward zobrazuje správné hodnoty
- Block reward = 5,400.067 ZION (ne 5,400,067,000,000)
- Miner balance = správné ZION hodnoty
- Pool PPLNS payouts = správné
- Swap page = amount_flowers / 1e6
- Explorer = block rewards v ZION

## 5. Rollback

```bash
cd APP\&WEB/website-v2.9/
git checkout <pre-3.0.3-commit> -- src/lib/constants.ts src/lib/zion-rpc.ts src/components/
npm run build
# Redeploy
```
