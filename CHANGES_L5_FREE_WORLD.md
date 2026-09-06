# ZION L5 Free World Projects — Změna premine alokace

**Datum:** 2026-09-06
**Autor:** Yosef Hubálek (rozhodnutí) + Devin (implementace)
**Stav:** Připraveno k commit a nasazení

---

## Co se změnilo

OASIS premine alokace byla redukována z **5 slotů (8,25B ZION)** na **3 sloty (4,95B ZION)**.

Uvolněné **2 sloty (3,3B ZION)** byly přepsány na **L5 Free World Projects** — humanitární vrstvu.

### Genesis hash se NEzměnil

Změna se dotkla pouze metadat (`purpose` a `category`) ve `v3_compat.rs`. Adresy a částky zůstaly stejné, takže:
- Genesis hash: **nezměněn** (`96109423298542a836edc10b9ba5ff9b29a1970418db543c2ee5cd952fe35bdb`)
- V3 compat hash: **nezměněn** (`4cf7560f9140deb9376fa6567e76eacaa8bd1b733ca3c91b00830a08f332ef71`)
- Konsenzus: **nezměněn**
- Chain historie: **nezměněna** (31 873+ bloků)
- Premine total: **16 780 000 000 ZION** (nezměněn)

---

## L5 Free World Projects — rozdělení (3,3B ZION)

| Projekt | Částka (ZION) |
|---------|---------------|
| Projekt Genesis Garden | 500 000 000 |
| Project Dharma Temple | 500 000 000 |
| Projekt Te Piko Ora | 500 000 000 |
| Project Bohemia | 500 000 000 |
| Project Bodhi Lanka | 500 000 000 |
| L5 rezervní fond | 800 000 000 |
| **Celkem** | **3 300 000 000** |

> **Správci:** Jména správců jednotlivých L5 projektů jsou důvěrné. Budou zveřejněna po dosažení bodu globální expanze (~0,20 USD/ZION). Do té doby jsou informace o správcích uloženy pouze v `docs/private/` (gitignored).

---

## OASIS pool po změně

| Slot | Účel | Částka (ZION) |
|------|------|--------------:|
| 1 | Mining Rewards | 1 650 000 000 |
| 2 | Challenge Rewards | 1 650 000 000 |
| 3 | Guild & Territory | 1 650 000 000 |
| **Celkem OASIS** | | **4 950 000 000** |

Sloty 4 (Level-Up Bonuses) a 5 (Reserve) byly přepsány na L5 Free World Projects.

---

## Zasažené soubory

### Kód (V31)
- `V31/L1/core/src/v3_compat.rs` — Slot 4 + 5: `purpose` a `category` → `l5_free_world`
- `V31/L4/oasis/src/rewards.rs` — OASIS pool 3 sloty (4,95B), `LevelUpBonuses` odstraněn
- `V31/L4/oasis/src/config.rs` — `reward_pool_total` = 4,95B
- `V31/L4/oasis/src/lib.rs` — premine 4,95B, 3 sloty
- `V31/L4/oasis/src/main.rs` — startup log 4,95B
- `V31/L4/oasis/data/prize_tiers.json` — note aktualizována

### Dokumentace (docs/)
- `docs/ROADMAP.md` — premine tabulky, OASIS 4,95B + L5 3,3B
- `docs/MAINNET_ROADMAP_2026.md` — premine tabulky
- `docs/PREMINE_ADDRESSES_PUBLIC.txt` — Slot 4/5 labely → L5
- `docs/3.2/HARD_RESET_PLAYBOOK.md` — aktualizováno
- `docs/GENESIS_REGENERATION_RUNBOOK.md` — aktualizováno
- `docs/WP-Mainet/*.md` — 17 whitepaper a marketing souborů aktualizováno (CZ + EN)

### Root
- `AGENTS.md` — OASIS 4,95B reference

### Web (APP&WEB/website-v2.9/)
- `src/lib/explorer/known-addresses.ts` — Slot 4/5 labely → L5
- `src/app/l4-oasis/page.tsx`, `src/app/roadmap/page.tsx`
- `src/components/MissionControlDashboard.tsx`, `src/components/NewsFeed.tsx`
- `src/app/terranova/TerraNovaBookClient.tsx` — OASIS ×5 → ×3, L5 ×2
- `public/docs/*.md` — whitepapery, token-disclosure, FAQ, genesis, onboard knihy

### Dashboard (ZION_OS/)
- `dashboard/app.py` — OASIS 4,95B, Slot 4/5 → L5 Free World Projects
- `dashboard/dashboard.html` — OASIS 4,95B + L5 3,3B
- `dashboard/dashboard.js` — `l5_free_world` kategorie přidána

### Desktop agent
- `APP&WEB/desktop-agent/renderer.js` — Slot 4/5 → L5 Free World Projects

### Private (docs/private/ — gitignored)
- `ZION_SUCCESSION_AND_IP_TRANSFER_PLAN.md` — darovací listina + plná moc s L5 projekty a správci
- `ZION_HANDOVER_CHECKLIST.md` — kontrolní seznam s L5 rozdělením
- `ZION_SUCCESSION_DECLARATION.pdf` — regenerováno
- `generate_succession_pdf.py` — aktualizováno

---

## Co se NEMĚNILO

- Genesis hash (adresy a částky všech 14 slotů beze změny)
- Konsenzus a protocol rules
- Chain historie (31 873+ bloků)
- Premine total (16,78B ZION)
- "Golden Egg" game mechanic (herní feature, ne premine slot)
- Archive soubory (`archive/`, `public/V3/`, `docs/3.0.3/`, `docs/3.0.5/`, `docs/docs2.9/`)

---

## Testy

Všechny testy prošly:
- `v3_genesis_hash_matches_mainnet` — OK (hash nezměněn)
- `genesis_premine_sums_to_16_78_billion_zion` — OK (16,78B)
- 5 OASIS reward testů — OK
- 3 OASIS config testy — OK
- `npm run build` (website) — 0 errors, 118 stránek

---

## Nasazení

Po git push je potřeba nasadit na Edge:
1. Rebuild `zion-oasis` binárky (`cargo build --release -p zion-oasis`)
2. Rebuild `zion-node` binárky (`cargo build --release -p zion-node`) — obsahuje `v3_compat.rs`
3. Restart `zion-v31-oasis` service
4. Restart `zion-v31-node` service (node1/2/3)
5. Rebuild website (`npm run build`) a nasadit
6. Rebuild dashboard — nasadit `app.py`, `dashboard.html`, `dashboard.js`
7. Rebuild desktop-agent

> **Pozor:** `docs/private/` je gitignored — tyto soubory se nenahrají do gitu. Obsahují jména správců a další důvěrné informace.
