# ZION V3 — externí bezpečnostní audit (šablona rozsahu)

**Účel:** podklad pro RFP / SOW u dodavatele (Trail of Bits, Halborn, OtterSec, …).
Interní audit (`2026-04-V3_INTERNAL_AUDIT.md` + completion doc) **není** náhrada.

---

## 1. Výchozí artefakty

- Release tag / commit hash k revizi (deterministický `V3/Cargo.lock`).
- Architektura: `StatusV3.md`, `V3/README.md`, `AGENTS.md`.
- Seznam známých nálezů po interním auditu + jejich stav (`2026-04-V3_AUDIT_COMPLETION.md`).

---

## 2. Rust L1 (`zion-core`, cosmic-harmony, pool, miner)

| Oblast | Otázky |
|--------|--------|
| Validace bloků / peer sync | `validate_peer_block`, `peer_block_validation`, reorg limity |
| Mempool + RPC submit | conservation of value, duplicity, admission gates |
| Hard fork háky | `TX_HASH_V2_ACTIVATION_HEIGHT`, `BODY_ROOT_V2_ACTIVATION_HEIGHT`, konzistence dispatcherů |
| Bridge unlock na L1 | multisig threshold vs relayer před PR #22/#27 |

---

## 3. Bridge L2 (`zion-bridge`)

- Fail-closed proof building (kvorum, žádné synthetic placeholders).
- Konfigurace validátorů vs L1 enforcement.
- Replay / nonce / DB persistence edge cases.

---

## 4. Native FFI / miner GPU

- Bezpečnostní kontrakty `unsafe` hranic (PR #28 jako výchozí bod).
- Thread safety globálních cache v upstream C knihovnách při paralelním mineru.

---

## 5. L3 / Warp (volitelný rozšířený scope)

- Per-adapter práce s klíči (BTC, Tron, Stellar, …) — §15.7 interního auditu záměrně deferred.

---

## 6. Explicitně mimo základní scope (uvést v SOW)

- APP&WEB (Electron / RN / marketing web).
- Živá síťová bezpečnost (DDoS, eclipse) bez laboratorní reprodukce.
- Formální cryptanalýza Ekam Deeksha v2.

---

## 7. Deliverables od dodavatele

- Závěrečná zpráva (nález → závažnost → reprodukce → doporučení).
- Retest fixes po remediation okně.
