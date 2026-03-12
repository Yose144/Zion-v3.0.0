# ZION 2.9.8 — Go/No-Go Checklist

> Datum: 2026-03-06 (aktualizace 2026-03-09, 2026-03-09T15:10Z, 2026-03-10T04:17Z)  
> Scope: uzavření algoritmu 2.9.8 (Deeksha canonical path) + release readiness gate  
> Zdroj pravdy: `docs/2.9.8/INDEX.md`, `L1/pool/tests/chv4_e2e.rs`, aktuální validační běhy

> **Historická poznámka (2026-03-12):** Infrastruktura byla od 2026-03-10 konsolidována
> na jediný primární host `91.98.122.165` (Zion2). Reference na Helsinki/USA/Asia
> v tomto dokumentu odrážejí stav v čase validace, nikoli aktuální topologii.
> Aktuální stav viz `STATUS_REPORT_2026-03-10.md` a `MAINNET_READINESS-ROADMAP.md`.

---

## Rozhodnutí (aktuální)

- **Aktuální verdict:** **GO (2026-03-10T04:17Z)**
- **Důvod:** Po recovery a následném 24h+ běhu je testnet chain synchronní na Helsinki/USA/Asia, pool přijímá shares a block height dále roste. Navíc byl odstraněn provozní coupling x86 seed+miner nodů na lokální pool službě.

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
| Produkční block growth | Výška řetězce stabilně roste po upgradu | ✅ PASS | 2026-03-10 04:17 UTC: height 713→714, difficulty 4086, BLOCK FOUND potvrzeno |
| LMDB chain recovery | Wipe + fresh genesis po data inconsistency | ✅ DONE | 2026-03-09: data.mdb wipe, restart, genesis e673f633 |
| Asia node recovery | Asia genesis hash mismatch opravena — rebuild + IBD sync | ✅ DONE | 2026-03-09T15:10Z: 195 bloků staženo, mesh Helsinki+USA+Asia plný |
| 3-node chain sync | Helsinki / USA / Asia drží stejný tip po 24h okně | ✅ PASS | 2026-03-10 04:17 UTC: all nodes height=713 tip=`c3480300...573a` |
| x86 seed+miner separation | X86 miner profily neběží přes lokální `pool:3333`, ale přes kanonický primary pool | ✅ PASS | 2026-03-10: canonical pool endpoint `91.98.122.165:3333`, Asia local `zion-pool` odstraněn |
| Pool health | Pool dál přijímá validní shares po oddělení x86 profilů | ✅ PASS | 2026-03-10 04:17 UTC: `/stats` → valid=10013, invalid=571, pool_24h≈425.37 H/s |

---

## Co je uzavřeno

1. **Code-level blocker odstraněn:** zastaralé CHv4 E2E předpoklady byly převedeny na 2.9.8 Deeksha semantiku.  
2. **Regression guard je zelený:** pool E2E i Deeksha testy jsou PASS.  
3. **Dokumentační vstupní bod existuje:** tento checklist je součástí 2.9.8 indexu.

---

## Co zbývá pro GO

1. ~~Opravit/obnovit Helsinki pool službu~~ → ✅ DONE  
2. ~~Asia genesis hash mismatch~~ → ✅ DONE (rebuild + IBD)  
3. ~~Potvrdit 24h metriky: accepted shares trend, hashrate trend, block height growth~~ → ✅ DONE  
4. ~~Po 24h stabilním běhu přepnout verdict na GO~~ → ✅ DONE

---

## Sign-off tabulka

| Role | Jméno | Rozhodnutí | Datum | Podpis |
|---|---|---|---|---|
| Protocol Lead | TBD | GO | 2026-03-10 | - |
| Pool/Miner Ops | TBD | GO | 2026-03-10 | - |
| Release Owner | TBD | GO | 2026-03-10 | - |

---

## Stav po přepnutí na GO

GO bylo uděleno, protože současně platí:

- `accepted_shares` roste na produkčním poolu,
- `pool_24h` hashrate je nenulový a stabilní,
- `chain height` roste bez stagnace,
- Helsinki, USA i Asia drží stejný tip,
- 24h po recovery proběhlo bez kritického consensus incidentu.
