# ZION L6 Issobella — Změna premine alokace (slot 6)

**Datum:** 2026-09-12
**Autor:** Yosef Hubálek (rozhodnutí) + Devin (implementace)
**Stav:** Commitnuto a nasazeno na Edge

---

DAO Treasury premine alokace byla redukována ze **3 slotů (4,0B ZION)** na **2 sloty (1,5B ZION)**.

Uvolněný **slot 6 (2,5B ZION)** byl přepsán na **L6 Issobella — Orbital Station & Quantum Research Fund**.

### Genesis hash se NEzměnil

Změna se dotkla pouze metadat (`purpose` a `category`) ve `v3_compat.rs`. Adresa i částka zůstaly stejné, takže:
- Genesis hash: **nezměněn** (`96109423298542a836edc10b9ba5ff9b29a1970418db543c2ee5cd952fe35bdb`)
- V3 compat hash: **nezměněn** (`4cf7560f9140deb9376fa6567e76eacaa8bd1b733ca3c91b00830a08f332ef71`)
- Konsenzus: **nezměněn**
- Premine total: **16 780 000 000 ZION** (nezměněn, 14 výstupů)
- Time-lock: **blok 144 000** (zachován z DAO Treasury)

---

## Kanonická premine distribuce (16,78B / 14 výstupů)

| Slot | Kategorie | Částka (ZION) | Lock |
|------|-----------|---------------|------|
| 1–3 | OASIS + Golden Egg | 4 950 000 000 | — |
| 4–5 | L5 Free World Projects | 3 300 000 000 | — |
| 6 | **L6 Issobella — Orbital Station & Quantum Research Fund** | **2 500 000 000** | blok 144 000 |
| 7–8 | DAO Treasury (Grants + Bootstrap) | 1 500 000 000 | blok 144 000 |
| 9–10 | Core Dev + Infrastructure | 2 000 000 000 | — |
| 11 | Genesis Projects | 590 000 000 | — |
| 12 | Bridge Seed Fund | 400 000 000 | — |
| 13 | Humanitarian / Children Future Fund | 1 440 000 000 | — |
| 14 | Bridge Vault UTXO | 100 000 000 | — |
| | **Celkem** | **16 780 000 000** | |

L6 adresa: `zion1f5h5k6t8q3t3d8c5y667z6p2x8t3y3p8c7633g5` (kategorie `l6_issobella`).

---

## Co bylo aktualizováno

- **V31 core:** `v3_compat.rs` (slot 6 → `l6_issobella` + nový purpose), `fee.rs` (`DAO_ADDRESS` → slot 7 adresa), `v3_state.rs` test (DAO balance 1B)
- **V31 DAO:** `types.rs` (`DAO_TREASURY_TOTAL` 1.5B + assert), `config.rs` (2 treasury adresy), `main.rs` (fallback 1.5B), `treasury.rs` (doc)
- **Web:** `known-addresses.ts` (kategorie `l6_issobella`), `dao-api.ts` fallbacky, `dao-tree`, `roadmap`, `MissionControlDashboard` (L6 karta), `/l6-issobella` (premine karta + lock badge 144 000), `TerraNovaBookClient` + `generatedEditions` + `terranova-editions.json`, faq cs/en, architecture overview/README
- **Dashboard:** `app.py` (L6 purpose), `dashboard.html`/`dashboard.js`/`dashboard.min.js` (defaulty 1.5B, `l6_issobella` v catColors/catIcons), `scripts/dashboard_v2.html` (kanonická 8-řádková tabulka)
- **Mobile/Desktop:** `DAOService.js`, `DAOScreen.js`, `blockchain.js` (8 kategorií), `wallets.ts` (PREMINE_LABELS), desktop-agent `index.html`
- **Docs:** root + `public/` + `PUBLIC/` mirrory — whitepapery (v2.9.5/v2.9.7/v3.x, CZ+EN), roadmapy, token-disclosure, legal, TerraNova knihy, `docs/private/` handover, PREMINE_ADDRESSES_PUBLIC.txt, genesis.md, AGENTS.md
- **Lock-height copy:** sjednoceno na blok 144 000 tam, kde se dříve psalo o DAO cliff 525 600
- **Derivace emise:** `127 720 000 000 / 23 652 000 = 5 400,067` označena jako původní derivace z éry premine 16,28B; kanonická verifikace `127,22B + 16,78B = 144B`

### Zamrzlé archivy (beze změn — historické záznamy)

`archive/`, `V3/`, `public/V3/`, `PUBLIC/V3/` kód (docs nesou † superseded poznámky), `docs/docs2.9/`, `docs/3.0.5/`, `docs/3.1/REPORTS/`, datované audit/incident reporty, historické blog posty (IntroPage manifesto).

## Verifikace

- `cargo test -p zion-core` 316/316 + `zion-dao` 76 pass (vč. `genesis_premine_sums_to_16_78_billion`, `v3_genesis_hash_matches_mainnet`)
- `next build` (website-v2.9) OK lokálně i na Edge
- Edge: `zion-website` + `zion-edge-python-dashboard` restartovány; `/l6-issobella`, `/l5-free-world`, `/genesis`, `/roadmap`, `/terranova` → 200

Commit: `e99540281`
