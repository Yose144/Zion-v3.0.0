# ZION v2.9.8 — Unified Roadmap (Single Track)

> Datum: 2026-03-06  
> Status: ACTIVE  
> Cíl: jet pouze v rámci 2.9.8 jako jediné realizační větve (spec + implementace + go/no-go).

---

## Single Source of Truth

Aktivní práce pro release běží pouze v těchto dokumentech:

1. `docs/2.9.8/INDEX.md` — vstupní rozcestník
2. `docs/2.9.8/COSMIC_HARMONY_DEEKSHA_SPEC.md` — canonical consensus spec
3. `docs/2.9.8/ROADMAP_2.9.8.md` — execution roadmap (tento dokument)
4. `docs/2.9.8/GO_NO_GO_2.9.8.md` — release gate a verdict

Dokumenty z 2.9.7 jsou pro historický kontext, ne pro aktivní plánování 2.9.8.

---

## Fáze a stav

| Fáze | Oblast | Stav | Exit kritérium |
|---|---|---|---|
| P0 | Consensus canonicalizace (Deeksha) | ✅ DONE | `with_height(0)` = Deeksha, stabilní testy |
| P1 | Pool/miner/agent sjednocení toku | ✅ DONE | E2E semantika aligned, syntax/build check PASS |
| P2 | Revenue kontinuita | ✅ DONE | CHv3 revenue model kompatibilní bez regresí |
| P2b | Native GPU ABI sjednocení | ✅ DONE | Metal/OpenCL/CUDA wrappers sdílí Deeksha-native symboly + fallback aliasy |
| P3 | Produkční infra gate | ⏳ IN PROGRESS | Helsinki recover + live acceptance/hashrate/block growth |
| P4 | Release gate | ⏳ PENDING | GO/NO-GO checklist plně uzavřen |

---

## Aktuální evidence (2026-03-06)

- `cargo test -p zion-pool --test chv4_e2e` → **11/11 PASS**
- `cargo test -p zion-cosmic-harmony-v3 deeksha::tests::` → **9/9 PASS**
- `node --check APP&WEB/desktop-agent/src/main.js` → **PASS**
- Desktop canonical GPU entrypoint: `resources/mining/cosmic_harmony_deeksha_gpu.py` (fallback na legacy `cosmic_harmony_v42_gpu.py`)

Kódový scope je zelený, zbývá produkční infrastruktura.

---

## Nejbližší kroky (jen 2.9.8)

1. Stabilizovat Helsinki pool služby (stratum + API).
2. Potvrdit live metrics trend: accepted shares, hashrate, chain height.
3. Po 24h stabilním běhu přepnout `GO_NO_GO_2.9.8.md` z NO-GO na GO.
4. Uzavřít sign-off tabulku v 2.9.8 dokumentaci.

---

## Pravidlo změn

Od této chvíle:

- nové release rozhodnutí zapisovat jen do `docs/2.9.8/*`,
- 2.9.7 soubory už pouze odkazují na 2.9.8,
- bez paralelních roadmap mimo 2.9.8.
