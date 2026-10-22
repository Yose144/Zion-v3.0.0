# 07 — Technická integrace: Zlatý dům ↔ zion-dao

> Jak se dokumenty v této sbírce překládají do existujícího kódu.
> Rozlišujeme **✅ existuje** / **🔧 konfigurace** / **📋 nová práce**.

**Stav:** návrh v1 · 2026-09-21 · žádné změny kódu zatím nebyly provedeny

---

## 1. Mapa na `V31/L2/dao` (zion-dao, `127.0.0.1:8456`)

### 1.1 Typy návrhů — skutečný enum `ProposalType` (`proposal.rs`)

| Zákon / dokument | ProposalType | Quórum (kód) | Period | Consent? | Vrstva |
|---|---|---|---|---|---|
| Zákon 2 — treasury tiers | `Treasury { recipient, amount, purpose }` | 15 % | 7 d | ne | L2 |
| Zákon 2 — granty | `Grant { recipient, amount, milestones, duration_days }` | 10 % | 7 d | ne | L2 |
| Zákon 2 — desátek / humanitární | `Humanitarian { category, amount, region, description }` | 10 % | 7 d | ne | L2 |
| Zákon 3 — 4 brány | `Admission { candidate_id, gate_scores_hash, sponsoring_guardians, community }` | **60 %** | 7 d | ✅ `uses_consent()` | **L5** |
| Zákon 3 — Bodhisattva slib | `Bodhisattva { candidate_id, ceremony_*, vow_text_hash, physical_symbol }` | **60 %** | 7 d | ✅ | **L5** |
| Zákon 4 — vyloučení | `Expulsion { accused_id, offense_category, investigation_hash, defense_hash, tier }` | **75 %** | 7 d | ✅ | **L5** |
| Ústava §15 — cross-layer | `CrossLayer { target_layers, inner_proposal_id, description }` | 15 % | 7 d | ne | cílová vrstva |
| 03 §4 — volby komor | `ParliamentaryElection { title, parties, seats }` | 15 % | 7 d | ne | L2 |
| novely, parametry | `Parameter { parameter_name, current, proposed }` | 10 % | 7 d | ne | L2 |
| nouzové stavy | `Emergency { action, justification }` | 20 % | **3 d** | ne | L2 |

**Klíčový fakt z kódu:** `uses_consent()` je `true` právě pro `Admission`, `Bodhisattva`, `Expulsion` — a všechny tři mají `governing_layer() == 5`. **Sociokracie je v kódu doslova vrstva L5.** Zlatý dům je její sídlo.

### 1.2 Consent engine (`consent.rs`)

- `Attestation`: `Witness` / `Object` / `Abstain` — mapuje kroky 5–7 consent procesu (námitka / svědek / zdržení).
- `reason_hash` (SHA-256) na objections — odpovídá Zákonu 6 (hash-only pro citlivé důvody).
- `quadratic_weight` + `check_quadratic_consent` — kvadratický consent pro `Expulsion`.
- **Plánované chování:** ≥30 % objections nebo deadline → auto-escalace na token vote (04 §9).

### 1.3 Timelock (`timelock.rs`)

- `TIMELOCK_SECS` default + `new_with_hours(proposal_id, hours)` — konfigurovatelné hodiny.
- Mapování: standard 48 h · L5 governance 7 d · L6-linked 30 d (policy, ne kód — kód umí libovolné hodiny).

### 1.4 Cross-layer veto (`cross_layer.rs`)

- `LayerConsent::{Pending, Consented, Vetoed, Waived}`; `layer_veto(layer, reason_hash)` **blokuje exekuci** — v současném kódu je veto **absolutní**.
- ⚠️ **Rozpor s ústavou:** Ústava §15 definuje override 66 % supermajoritou — kód zatím override **nemá**. Policy dokumentuje cílový stav; implementace override je 📋 backlog, nebo se ústava upraví na „veto je absolutní do mediace". **Rozhodnout před Fází 1.**

### 1.5 Co-Admin registry (`co_admin.rs`)

- `CoAdminRole::{Treasury, Bridge, ...}` — `Treasury` má `layer() == 2`, `Bridge` taky 2.
- Mapování orgánů: Strážci pokladny → `CoAdminRole::Treasury`; komory/kruhy → nové role 📋 (např. `L5Community`, `L5Guardian` — existují v archive multi-layer frameworku, do kódu je nutné doplnit, pokud se má role odlišovat on-chain).
- **Overlap matrix** (max 2 přilehlé vrstvy) je policy v Ústavě §11 — v kódu není vynucená 📋.

### 1.6 Treasury (`treasury.rs`, `api.rs`)

- Endpointy: `GET /api/dao/treasury` (live UTXO součet přes `treasury_addresses`), `POST /treasury/submit|sign|execute` — guardian multisig **5-of-7** (DAO treasury = premine sloty 7+8, 1.5B ZION).
- ⚠️ **Pozor:** DAO treasury (sloty 7+8) ≠ L5 fond (sloty 4+5, 3.3B ZION). Bohemia 500M je **dokumentační alokace** v rámci L5 — dedikovaný Bohemia project record/wallet zatím neexistuje 📋.
- Spending tiers Zákona 2 jsou **policy nad API** — kód zná `Treasury` návrh + multisig, tier limity vynutíme procedurou (minuty + signers checklist), ne smart contractem.

## 2. Mapa na `V31/L5/free-world` (`127.0.0.1:8095`)

| Dokument | Současnost | Krok |
|---|---|---|
| Zákon 2 §6 — Bohemia fond | tabulka `projects` je generická; Bohemia není seeded | 📋 `POST /api/v1/projects` záznam `bohemia` + cap 500M |
| Desátek | žádný auto-forward | 📋 dokumentovaná procedura; auto-forward je ops skript, ne chain pravidlo |
| Zákon 5 — Hiran | `hiran_bridge.rs` advisory, `FREE_WORLD_HIRAN_ENABLED=false` default | 🔧 zapnout env + doplnit `[HIRAN]` tag do minut |
| Grants → DAO | `dao_client.rs` submit-to-dao | ✅ existuje |
| Read-only princip | `l1_scanner.rs` skenuje coinbase → `fund_balance` | ✅ existuje — Free World nikdy nesignuje tx |

## 3. Mapa na L3 Hiran (`V31/L3/ai-native`, `hiran-v2.2`)

| Dokument | Integrace | Stav |
|---|---|---|
| Zákon 5 §1 — View-Cutter | endpoint „analyzuj proposal" před hlasovacím oknem | 📋 nový endpoint / nebo Free World `/ai/analyze-grant` pattern |
| Dharma validátor | 5-test gate nad AI output | 📋 prompt+procedura (teď) → modul (později) |
| AI Native Vow registry | `Admission`-analogie s `ai_native` flag | 📋 nový flag / dedikovaný typ |
| Lokální inference | `HIRAN_ENDPOINT=http://localhost:8002` | 🔧 konfigurace |

## 4. Identita a hlasování (ZIS)

- Governance mutace (vote/create) přijímají `zion_session` cookie → DAO resolvuje přes ZIS `/api/auth/me` → **váha hlasu = L1 balance ve snapshot bloku**.
- `X-DAO-Key` zůstává pro operátory.
- **Důsledek pro sociokracii:** token-weight hlasování je „votes for money". **Lidská rozhodnutí** (Admission/Bodhisattva/Expulsion) jdou přes `ConsentEngine` attestations — identity tam je `candidate_id`/`voter` string; soulbound reputace je 📋 (zatím string ID, ne NFT/SBT).

## 5. Bohemia bootstrap — konkrétní kroky (když Fáze 1 začne)

```
1. Seed project:     POST /api/v1/projects  { id:"bohemia", name:"Golden Republic Bohemia",
                     cap_zion: 500_000_000, status:"prep" }
2. Registry:         zaregistrovat 5 treasury signers do CoAdmin registry (role: Treasury)
3. První návrh:      ParliamentaryElection pro složení komor (parties = kandidátní listy kruhů)
4. Ratifikace:       Admission/Bodhisattva návrhy pro zakládající strážce (60% consent)
5. Konfigurace:      DAO timelock hours = 48; consent thresholds 60/75; FREE_WORLD_HIRAN_ENABLED=true
6. Archiv:           hash všech 7 dokumentů této sbírky → on-chain jako Parameter/Bohemia namespace
```

## 6. Backlog — co je 📋 nová práce (ne teď)

1. `ProposalType::Bohemia` namespace nebo `community="bohemia"` konvence — dnes stačí `community` pole v `Admission`.
2. Cross-layer veto override (66 %) — rozhodnout: kód vs. ústava.
3. Bohemia project cap enforcement (500M) — teď jen dokumentace.
4. Soulbound Guardian identity — teď `candidate_id` string.
5. `[HIRAN]` tag → audit trail v minutách.
6. D'Hondt allocation je v `proposal.rs` jako `allocate_seats_dhondt` (+ `allocate_seats` na návrhu, exekuce v `executor.rs`) — ✅ existuje, jen použít.
7. Overlap matrix enforcement — policy → kód.

## 7. Co se NEMĚNÍ

- L1 konsensus, genesis hash, premine sloty — **žádná změna**. Zlatá republika je governance nad protokolem, ne fork.
- `v3_compat.rs` — neměnné.
- Free World = read-only — **žádný signing key do L5 služby**, nikdy.

---

*„Kód je zákon, který se vykonává. Ústava je zákon, který si kruh vybere. Zlatý dům drží obě strany."*
