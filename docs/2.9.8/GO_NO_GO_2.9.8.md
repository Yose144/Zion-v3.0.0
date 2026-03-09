# ZION 2.9.8 — Go/No-Go Checklist

> Datum: 2026-03-06 (aktualizace 2026-03-09, 2026-03-09T15:10Z)  
> Scope: uzavření algoritmu 2.9.8 (Deeksha canonical path) + release readiness gate  
> Zdroj pravdy: `docs/2.9.8/INDEX.md`, `L1/pool/tests/chv4_e2e.rs`, aktuální validační běhy

---

## Rozhodnutí (aktuální)

- **Aktuální verdict:** **NO-GO → 24h PENDING (2026-03-09)**
- **Důvod:** Chain recovery provedena 2026-03-09 — LMDB data inconsistency opravena (wipe + fresh genesis). Bloky rostou, shares přijímány. Čeká se na 24h stabilní běh.

---

## Checklist

| Oblast | Kritérium | Stav | Důkaz |
|---|---|---|---|
| Canonical dispatch | `cosmic_harmony_with_height` používá Deeksha od výšky 0 | ✅ PASS | `CHV_DEEKSHA_FORK_HEIGHT = 0`, dispatch testy v `deeksha.rs` |
| Pool E2E semantika | E2E testy odpovídají Deeksha-first modelu | ✅ PASS | `cargo test -p zion-pool --test chv4_e2e` → **11/11 PASS** |
| Deeksha unit testy | Determinismus, avalanche, dispatch parity, vektor | ✅ PASS | `cargo test -p zion-cosmic-harmony-v3 deeksha::tests::` → **9/9 PASS** |
| Desktop agent syntax | JS syntax validní | ✅ PASS | `node --check APP&WEB/desktop-agent/src/main.js` |
| Native backend ABI | Metal/OpenCL/CUDA wrappers používají Deeksha-native symboly s legacy fallbackem | ✅ PASS | `zion_deeksha_batch_mine` + fallback na `cosmic_harmony_v4_2_batch_mine` |
| Alias kompatibilita | `cosmic_harmony/chv4/deeksha` aliasy pro pool flow | ✅ PASS | parser + validator coverage v `L1/pool/tests/chv4_e2e.rs` |
| Produkční mining acceptance | Live accepted shares na Helsinki/USA/Asia rostou | ✅ PASS | 2026-03-09 10:44 UTC: shares ACCEPTED, algo=cosmic_harmony, job=h1-e673f633 |
| Produkční block growth | Výška řetězce stabilně roste po upgradu | ✅ PASS | 2026-03-09 10:44 UTC: height=4→5, difficulty=1052, BLOCK FOUND potvrzeno |
| LMDB chain recovery | Wipe + fresh genesis po data inconsistency | ✅ DONE | 2026-03-09: data.mdb wipe, restart, genesis e673f633 |
| Asia node recovery | Asia genesis hash mismatch opravena — rebuild + IBD sync | ✅ DONE | 2026-03-09T15:10Z: 195 bloků staženo, mesh Helsinki+USA+Asia plný |

---

## Co je uzavřeno

1. **Code-level blocker odstraněn:** zastaralé CHv4 E2E předpoklady byly převedeny na 2.9.8 Deeksha semantiku.  
2. **Regression guard je zelený:** pool E2E i Deeksha testy jsou PASS.  
3. **Dokumentační vstupní bod existuje:** tento checklist je součástí 2.9.8 indexu.

---

## Co zbývá pro GO

1. ~~Opravit/obnovit Helsinki pool službu~~ → ✅ DONE  
2. ~~Asia genesis hash mismatch~~ → ✅ DONE (rebuild + IBD)  
3. Potvrdit 24h metriky: accepted shares trend, hashrate trend, block height growth.  
4. Po 24h stabilním běhu (cíl: 2026-03-10 ~10:45 UTC) přepnout verdict na **GO** a doplnit sign-off.

---

## Sign-off tabulka

| Role | Jméno | Rozhodnutí | Datum | Podpis |
|---|---|---|---|---|
| Protocol Lead | TBD | NO-GO | 2026-03-06 | - |
| Pool/Miner Ops | TBD | NO-GO | 2026-03-06 | - |
| Release Owner | TBD | NO-GO | 2026-03-06 | - |

---

## Přepnutí na GO — podmínka

Přepnout na **GO** až když platí zároveň:

- `accepted_shares` roste na produkčním poolu,
- `network hash rate` není degradovaný,
- `chain height` roste bez stagnace,
- 24h bez kritických incidentů po recovery.
