# ZION 3.0.5 — Dokumentace verze

> **Verze:** 3.0.5
> **Datum:** 2026-07-09
> **Status:** ✅ COMPLETE — exekuováno 2026-07-09, 11/11 služeb aktivních
> **Cíl:** **All Green** — dostat všechny komponenty (L1 + L2 + L3 + web + docs + verzování) do provozuschopného, ověřeného stavu
> **Server:** `62.171.141.136` (`ssh zion-new`), genesis `4f75a0dfe6dde3b167287d445aa1ade56577b0e9166c641ed288b4c20a79bd6e`
> **Chain height (audit):** 1194+

## Co 3.0.5 je

3.0.5 **není nová funkce**. Je **operationalizace + validace + verzování** všeho, co 3.0.4 implementovalo v kódu ale nenasadilo do provozu. Původní §3.8 fázový plán (watchery + SDK/CLI) je v kódu hotový — 3.0.5 dostává tento kód do živého, ověřeného provozu.

## Související dokumenty

- [`ZION_3.0.5_ALL_GREEN_RUNBOOK.md`](./ZION_3.0.5_ALL_GREEN_RUNBOOK.md) — **kanonický postup** (všechny fáze do zeleného stavu)
- [`3.0.4.md`](../../3.0.4.md) — předchozí verze (TX unification, DeFi, WARP)
- [`docs/3.0.4/GENESIS_HARD_RESET_CANONICAL.md`](../3.0.4/GENESIS_HARD_RESET_CANONICAL.md) — hard reset postup
- [`AGENTS.md`](../../AGENTS.md) §"L1 Protocol Security Protocol" — pravidla L1 editace

## Fáze (přehled)

| Fáze | Co | Riziko | Blokér |
|------|-----|--------|--------|
| **F1** | Verzování — bump `NODE_PROTOCOL_VERSION` 3.0.3 → 3.0.5 | Nízké | — |
| **F2** | Docs reconcile — opravit commit hash, aktivační výšku, §3.8 | Žádné | — |
| **F3** | Operationalizace L2 watcherů — start bridge + dao, build + deploy warp + atomic-swap | Střední | — |
| **F4** | Web repair — restart zion-web-next, fix Docker RPC networking | Nízké | — |
| **F5** | Watchdog — enable + start zion-watchdog | Nízké | — |
| **F6** | E2E memo testy (DEPLOY-5/6/7) — account TX s BRIDGE:/DAO:/SWAP: memo | Střední | ⏳ F4.5 funded adresa s SK |
| **F7** | All Green verify — kompletní checklist | — | — |
