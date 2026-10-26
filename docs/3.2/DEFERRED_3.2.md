# DEFERRED_3.2.md — feature freeze seznam (DRAFT 2026-10-26)

> **Stav:** NÁVRH — vstupuje v platnost při RC freeze (9.B1). Dokud je draft, položky se mohou přesouvat mezi kategoriemi jen rozhodnutím operátora.
>
> **Účel:** jediný seznam všeho, co je ve 3.2 vědomě odložené — aby „Stable" neznamenal „všechno hotovo", ale „všechno označené". Freeze = nic nového do 3.2.x nepřidáváme mimo tento dokument a opravy defektů.

## A) Odloženo do v3.3 Nirvana (má track v `NIRVANA-V3.3-MAP.md`)

| Položka | Proč odloženo | Cílový track |
|---|---|---|
| Aktivace node reward distribution | premine sloty 6–8 time-lock až height 144 000 (~27.–28. 11.); rozhodnutí operátora | N1/N2 |
| CHv4.2 (fork height `u64::MAX`) | jen governance-triggered; bez potřeby před stable | N1 |
| Program nezávislých operátorů nodů (charta M7) | vyžaduje stabilní release + incentivizaci | N7 |
| QTU native payouty | `treasury_free=0`, 918 stalled payoutů — pre-existing deficit, funding/policy na operátorovi | N2 |
| Persistentní share-dedup okno (A4.1) | in-memory dedup funkční; DB persist přidá latenci — po soak | N2 / pool beta.2 |
| HA stratum / standby pool na druhém hostu | single-pool topology je pro beta akceptovaná | N2 / W-vlny |
| Adapter parity — `warp_message_hash` anchor | jen EVM adapter binduje msg hash on-chain; ostatní chainy (TON/SUI/Solana/Stellar/Tron/Cardano/Cosmos/Aptos/NEAR) nemají contract-level dedup — vyžaduje dest-program upgrade | N1 |
| TON `query_id=1` hardcoded, seqno `unwrap_or(0)` | non-blocking; contract-level | N1 |
| QTU/PRL attestation dokazuje jen ZION-key ownership | adresy claimed neověřitelné — must-fix před payout-gated flows, ne před stable | N1 |
| Fleet OS / `zion-rig-agent` control plane :8099 | nový workstream mimo 3.2 scope | N2 |
| L2 „Stable" scope — výběr podmnožiny chainů | pending rozhodnutí operátora | N1 |

## B) Explicitní NON-DoD (mimo v3.2 i v3.3 commitment — horizon)

Podle `NIRVANA-V3.3-PLAN.md` §Explicitní NON-DoD:

- UE5.7 / Nanite / Lumen / pixel streaming (případný spike = `docs/4.0/UE5-SPIKE.md`)
- Autonomní on-chain agenti bez human-approval gate
- ZK Dharma proofs (Dharma zůstává keyword→policy engine, žádná kryptografie)
- Plná 12-chain WARP produkce
- Kvantový/warp engine hardware
- Stratum v2 (v1/v3/TLS schéma zůstává)

## C) Pozastavené safety holdy — aktivace až po gates

| Hold | Stav | Aktivační podmínka |
|---|---|---|
| `WARP_BTC_SWAP_ENABLED=0` | vypnuto | G9 audit + rozhodnutí operátora (BTC pilot) |
| `PRL_PAYOUT_DRY_RUN=1` | dry-run | rozhodnutí operátora + attestation fix (A) |
| `WARP_API_KEY` unset → mutating routes disabled | vypnuto | po G9 |
| `WARP_L1_RELEASE_KEYS` absent → inbound `AwaitingFinality` hold | aktivní | po G9 |
| QTC payouts | deferred, treasury 0 | funding/politika — operátor |

## D) Otevřené technické položky (carried into RC — nesmí blokovat Stable, ale musí být vypsané)

| ID | Položka | Ref |
|---|---|---|
| D-1 | P0-3: rotace PRL RPC credentialu + per-service env subsety (`/etc/zion/edge-environment.sh` sdílí nesouvisející secrets) | plan §8, P0 |
| D-2 | Pool sidecar I/O, deferred queue/outbox, daily-volume atomicita — source problémy z audit re-check | `AUDIT_RECHECK_2026-10-25` korekce |
| D-3 | `protocol_version` on-chain hlásí `3.1.0-alpha` vs node `3.2.0` | verifikace 26. 10. |
| D-4 | npm audit: kritické advisories v 5 web apps + mobile | verifikace 26. 10. |
| D-5 | `cargo audit` nenainstalován; clippy ~110 warnings; 25 fmt-drfit souborů | verifikace 26. 10. |
| D-6 | Provenance: žádný embedded git sha v binárkách; EDGE2 source tree není git checkout; EDGE working tree ≠ HEAD | `REPORTS/PROVENANCE-2026-10-26.md` |
| D-7 | Pool sticky-confirmed fix (record_block CASE) — v repu, **deploy pending** | `REPORTS/REPORT_2026-10-26_POOL_ORPHAN_RCA.md` |
| D-8 | Stale-block rate 15–21 % `previous hash mismatch` — interní same-height racy (0 externích ztrát), residuální tuning | tentýž report |
| D-9 | Public repo sync předefinovat — tracked `public/` přesunut do `archive/PUBLIC/` (workflow G4/E7 neplatný) | plan 8.B7 |
| D-10 | DR restore drill neproveden; `HARD_RESET_PLAYBOOK.md` neaktualizován na dvouboxovou topologii | plan 8.B11 |
| D-11 | CI workflows vše `.disabled` — chybí `release-gate` skript | plan 8.B8 |
| D-12 | `auth.` certifikát renewal owner — expirace 25. 11. | plan 8.B6 |
| D-13 | EDGE load ~12/4 jádra — CPU mining vs stabilita followerů (rozhodnutí) | plan 8.B5 |
| D-14 | SMOS rig 518837 offline | fleet status |
| D-15 | Alert sink firing test + 40d retence doložit | plan 8.B9 |

## E) Gates držící Stable (mimo tento freeze — registry G*)

- **G8** — 30d continuous run ≥99.9 % (run #5 `g8-20261025T215746Z`, konec ~24. 11.)
- **G9** — externí audit — **posunut rozhodnutím operátora 2026-10-26** (Stable bez data; package pinned na RC commit připraven)
- **B-EXIT-3** provenance = release commit (8.S2)
- **9.S1–S3** tag/release/announcement

---

*Změny tohoto dokumentu po RC freeze jen commit s prefixem `freeze:` a referencem na rozhodnutí operátora.*
