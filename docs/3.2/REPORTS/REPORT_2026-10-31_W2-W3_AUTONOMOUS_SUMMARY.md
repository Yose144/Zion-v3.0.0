# REPORT 2026-10-31 — W2–W3 autonomní příprava (kompletní souhrn)

> **Okno:** 2026-10-31  
> **Stav:** W2 příprava + W3.1/W3.2 hotovo, zbytek čeká na 👤

## W2 — Pool HA / DR
| ID | Stav | Commit/Evidence |
|---|---|---|
| **W2.1** | ✅ | Audit `pool-ha-watchdog.sh` — alert-only, žádná auto-promoce, dedup, cooldown. `REPORT_2026-10-31_W2.1-W2.2_POOL_HA_FENCING.md` |
| **W2.2** | ✅ | Fencing analýza — riziko dvojí výplaty, povinné guardraily před `armed`, důraz na „stop primary first“. |
| **W2.3** | ✅ | Runbook hotový jako `docs/3.2/ops/DR-BRINGUP-RUNBOOK.md` (změna názvu z návrhu) |
| **W2.4** | ✅ | RTO/RPO tabulka + promotion/fencing sekce v DR runbooku. `PPLNS+ledger ≤60s`, `pool-store.db ≤60min`. `fdb095e09` |
| **W2.4b** | ✅ | Paritní gate + B1/B2/B3/G5 uzavřeny dříve — `PASS (0 fail, 5 warn)`. `0bb706737` |
| **W2.5** | ✅ | Návrh přidat `pool_standby` do G8 `evidence_policy.required_services` (mimo aktivní run #6). `cc204cafa` |
| **W2.6** | ⏸️ **NA 👤** | `log-only` → `armed` po odsouhlasení fencing + min 1 týden bez falešného promote |

## W3 — Bezpečnost a peníze
| ID | Stav | Commit/Evidence |
|---|---|---|
| **W3.1** | ✅ | P0-3 credential isolation — mapa sdíleného env + návrh per-service subsetů (read-only, bez rotace). `57b954d92` |
| **W3.2** | ✅ | Public-scan označen jako **REQUIRED GATE** (fail-closed). `20cd0c6c4` |
| **W3.3** | 👤 | SMTP/Resend — emaily nechodí |
| **W3.4** | 👤 | Dofinancovat pool wallet (loyalty) |
| **W3.5** | 👤 | QTC treasury (~1751 stalled, roste) |
| **W3.6** | 👤 | Gas pro non-Base rotaci klíčů |
| **W3.7** | 👤 | Držet `WARP_BTC_SWAP_ENABLED=0` do uzavření G9 |

## Blokující externí
- **DNS** `api.` / `dex.` → `207.180.217.100` (blokuje HTTPS/certbot)
- **G8 run #6** cíl `2026-11-28 23:46Z` — čekáme na `gate_status=pass`
- **Premine 144k** 27.–28. 11. (checklist hotový)

## Shrnutí
Všechna **autonomně proveditelná** příprava W2/W3 je hotová. Zbývají pouze rozhodnutí/akce operátora 👤.
