# Premine 144k checklist (W1.7)

> **Window:** ~27.–28. 11. 2026 (aligns with G8 #6 end `2026-11-28 23:46Z`)  
> **Gate:** W1.7 — 3-of-3 admin unlock + DAO  
> **Owner:** 👤 (operator/treasury)  
> **Scope:** timelock slot releases around height ~144000

## Pre-checks
- [ ] **Height** — confirm current chain height approaching 144000 (track on explorer/rpc)
- [ ] **G8 status** — `gate_status=pending` acceptable but watch; avoid during G8 incident
- [ ] **Backups** — recent DB/config backups on hand (EDGE/EDGE2)
- [ ] **Keys** — 3-of-3 admin keys available (air-gapped), DAO access ready
- [ ] **Wallet funding** — gas for any required txs, treasury balances reviewed
- [ ] **Runbook** — have genesis/premine docs at hand, operator channel ready

## Execution
- [ ] **Verify timelock** — inspect premine unlock schedule for slots 6–8 around 144000
- [ ] **3-of-3 unlock** — perform admin unlock with all three signatures
- [ ] **DAO action** — execute required DAO step if applicable
- [ ] **Broadcast/confirm** — monitor tx inclusion across nodes

## Post-checks
- [ ] **Inclusion** — confirm unlock txs in blocks, no reorg risk
- [ ] **Balances** — verify expected addresses received funds
- [ ] **Supply/circulating** — sanity check `getSupplyInfo` / explorer
- [ ] **Logs/evidence** — capture tx hashes, block heights, operator log
- [ ] **Update docs** — note completion in `StatusV3.md` / plan

## Notes
- If anything looks ambiguous → **pause and verify**. Do not rush.
- Keep evidence (txids, heights, screenshots/logs).
