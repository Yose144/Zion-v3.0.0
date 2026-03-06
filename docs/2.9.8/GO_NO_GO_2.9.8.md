# ZION 2.9.8 — Go/No-Go Checklist

> Datum: 2026-03-06  
> Scope: uzavření algoritmu 2.9.8 (Deeksha canonical path) + release readiness gate  
> Zdroj pravdy: `docs/2.9.8/INDEX.md`, `L1/pool/tests/chv4_e2e.rs`, aktuální validační běhy

---

## Rozhodnutí (aktuální)

- **Aktuální verdict:** **NO-GO**
- **Důvod:** Kódový scope 2.9.8 je validovaný, ale produkční infra gate není ještě uzavřená (Helsinki pool recover + live acceptance/block growth potvrzení).

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
| Produkční mining acceptance | Live accepted shares na Helsinki/USA/Asia rostou | ⏳ PENDING | nutné potvrdit po stabilizaci Helsinki pool služby |
| Produkční block growth | Výška řetězce stabilně roste po upgradu | ⏳ PENDING | nutné potvrdit po obnově Helsinki orchestrace |

---

## Co je uzavřeno

1. **Code-level blocker odstraněn:** zastaralé CHv4 E2E předpoklady byly převedeny na 2.9.8 Deeksha semantiku.  
2. **Regression guard je zelený:** pool E2E i Deeksha testy jsou PASS.  
3. **Dokumentační vstupní bod existuje:** tento checklist je součástí 2.9.8 indexu.

---

## Co zbývá pro GO

1. Opravit/obnovit Helsinki pool službu (stratum + API endpointy).  
2. Potvrdit live metriky: accepted shares trend, hashrate trend, block height growth.  
3. Po 24h stabilním běhu přepnout verdict na **GO** a doplnit sign-off.

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
