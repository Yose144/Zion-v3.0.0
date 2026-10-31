# Audit sprint — batch 2 (2026-10-31): 13 položek uzavřeno

Index report pro druhou půlku sprintu — detaily v jednotlivých reportech.

## Kód + fixy

| Item | Výsledek | Ref |
|---|---|---|
| 1.B1 GPU KAT | PASS, 0 correctness residuálů — KAT varint bug + σ[3] kernel fix + `check_vram_fits` | `REPORTS/REPORT_2026-10-31_1B1_GPU_KAT_PARITY.md` |
| 1.S4/3.S3 | `e2e_send_receive_full_node_path` PASS 234 s; HTLC refund 45/45 | `V31/L1/core/src/node.rs` test |
| 5.B4 IA-17 | `/api/network` leak `127.0.0.1` → `sanitizePublicHost`; **deployed** | `src/app/api/network/route.ts` |
| 8.B10 dashboard | seq→`ThreadPoolExecutor(8)` = **3.19 s**; **deployed EDGE** | `ZION_OS/dashboard/v31.py` |
| 5.S3 AI label | „pomocník/helper" + disclaimer; `mutations_enabled=false` live | `HiranFloatingChat.tsx` |

## Rozhodnutí + design

| Item | Výsledek |
|---|---|
| 4.B9 DAO QV | DECIDED — binding stake-weighted (sybil √N argument); advisory QV = `consent.rs` |
| 6.B5 DAO disburs. | Design `derive_treasury_op` most (`DAO_DISBURSEMENT_TX_FLOW_DESIGN.md`) |

## Ops verifikace

| Item | Výsledek |
|---|---|
| 6.B2 scanner-lag | Live end-to-end ✅ (probe→metric→alert rule; lag=6) |
| 6.S2 public copy | PASS — `total_disbursed=0`, všechny povrchy DAO-gate qualifier |
| 8.B6 certifikáty | Single owner per cert — EDGE 8 confů `.disabled`; dry-run 8/8 ✅ |
| 8.B9 alert sink | Firing test PASS + retence 40d + live G8ChainStale |
| 8.B11 HARD_RESET | Playbook přepsán na dvouboxovou topologii |
| 8.B2 post-mortem | `POSTMORTEM_2026-10-21_RSYNC_UNDER_SERVICE.md` + runbook pravidlo |

## Ops poznámky

- Fail2ban self-DOS: batchovat SSH na EDGE:2222 / whitelist ops IP.
- EDGE fallback certy EDGE2-domén vyprší s poslední kopií (~27.12.+) — fallback je legacy.
