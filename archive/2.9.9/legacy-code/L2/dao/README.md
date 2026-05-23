# 🏛️ L2 — DAO Governance

> **Crate:** `zion-dao`  
> **Vrstva:** L2 — Governance  
> **Stack:** Rust · Tokio · SQLite · ed25519-dalek  
> **Status:** 🟡 Skeleton (~1 500 LOC)

---

## Co to je?

On-chain governance pro ZION ekosystém. Token-weighted hlasování: **1 ZION = 1 hlas**. Spravuje treasury (4B ZION), humanitární fond a komunitní rozhodování.

```
┌──────────────────────────────────────┐
│          DAO GOVERNANCE              │
│                                      │
│  Proposal → Voting → Timelock → Exec│
│  (1M min)   (7 dní)  (48h)         │
│                                      │
│  Treasury: 4,000,000,000 ZION        │
│  Multi-sig: 5-of-7                   │
│  Quorum: 10% circulating supply      │
│                                      │
│  🌍 Humanitarian Fund (7 kategorií)  │
│  💧🍞🏠🌍🏥📚🚨                     │
└──────────────────────────────────────┘
         │
         ▼ (READ ONLY)
┌──────────────────────────────────────┐
│  L1 BLOCKCHAIN                       │
│  TX memo: "DAO:vote:<proposal_id>"   │
│  RPC: balance check pro voting weight│
└──────────────────────────────────────┘
```

---

## Klíčové parametry

| Parametr | Hodnota |
|----------|---------|
| Treasury | 4,000,000,000 ZION (genesis premine) |
| Min. pro návrh | 1,000,000 ZION |
| Quorum | 10% cirkulující supply |
| Hlasovací období | 7 dní |
| Timelock | 48 hodin po schválení |
| Multi-sig | 5-of-7 pro treasury operace |

---

## Moduly

| Modul | Popis |
|-------|-------|
| **proposal** | Vytváření a správa návrhů (ProposalType, ProposalStatus) |
| **voting** | Hlasovací engine (1 ZION = 1 vote, For/Against/Abstain) |
| **treasury** | Treasury management — multi-sig 5/7, spend proposals |
| **timelock** | 48h delay před exekucí schválených návrhů |
| **quorum** | Kontrola 10% účasti |
| **executor** | On-chain exekuce po timelocku |
| **humanitarian** | 7 kategorií humanitárního fondu |
| **config** | DaoConfig (TOML loading) |

---

## Humanitární kategorie

| # | Kategorie | Emoji |
|---|-----------|-------|
| 1 | Čistá voda | 💧 |
| 2 | Jídlo | 🍞 |
| 3 | Bydlení | 🏠 |
| 4 | Životní prostředí | 🌍 |
| 5 | Zdravotnictví | 🏥 |
| 6 | Vzdělávání | 📚 |
| 7 | Krizová pomoc | 🚨 |

---

## Rychlý start

```bash
# Build
cargo build -p zion-dao

# Testy
cargo test -p zion-dao
```

---

## ⚠️ Layer Boundary

DAO je **L2 crate** — **NIKDY nemodifikuje L1 stav přímo**.

Komunikace s L1:
- **TX memo:** `DAO:vote:<proposal_id>` (uživatel pošle TX z wallet)
- **RPC query:** kontrola balance pro voting weight
- **Block events:** monitoring governance transakcí

---

## Struktura

```
dao/
├── Cargo.toml
└── src/
    ├── lib.rs             # Module exports + architektura doc
    ├── error.rs           # DaoError types
    ├── types.rs           # VoteChoice, shared types
    ├── config.rs          # DaoConfig
    ├── proposal.rs        # Proposal engine
    ├── voting.rs          # VotingEngine (token-weighted)
    ├── treasury.rs        # Treasury + multi-sig
    ├── timelock.rs        # 48h execution delay
    ├── quorum.rs          # 10% quorum check
    ├── executor.rs        # On-chain proposal executor
    └── humanitarian.rs    # Humanitarian fund (7 categories)
```

---

## Souvislosti

- **Revenue model** → `../docs/REVENUE_MODEL.md` (50/25/25 split)
- **Bridge** → `../bridge/` (L2 DeFi counterpart)
- **OASIS** → `../oasis/` (premine řízené DAO governance)
