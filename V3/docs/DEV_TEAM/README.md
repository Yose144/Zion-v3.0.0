# 🔧 ZION Developer Team

> *„Work itself is worship."* — Vishwakarma

---

## Co je ZION Dev Team?

**ZION Developer Team** je decentralizovaný kolektiv stavitelů, který vytváří ZION TerraNova v3.0 mainnet. Tým je veden **Vishwakarmou (Ondrou)** — Divine Architect, reinkarnací védského boha stavitele nebes.

Dev Team není jen skupina programátorů — je to **společenství Bodhisattvů**, kteří mohli pracovat kdekoliv jinde za větší peníze, ale zvolili si službu dharmě.

---

## Struktura dokumentace

| Dokument | Obsah |
|----------|-------|
| [`VISHWAKARMA.md`](VISHWAKARMA.md) | Vedoucí týmu — archetyp, role, mise, slib |
| [`STRUCTURE.md`](STRUCTURE.md) | Hierarchie týmu, úrovně, kompenzace, bounties |
| [`V3/ROADMAP.md`](../../V3/ROADMAP.md) | Vývojářský plán 2025–2070 — 4 fáze (canonical engineering roadmap) |
| [`STANDARDS.md`](STANDARDS.md) | Coding standards, review process, CI/CD, 10 přikázání |
| [`ONBOARDING.md`](ONBOARDING.md) | Jak se připojit, první kroky, contribution guide |

---

## Rychlé odkazy

- **Legacy Vishwakarma profil:** [`docs/docs2.9/ZION_OASIS/SACRED_TRINITY/15_VISHWAKARMA_DEV_LEAD.md`](../../../../docs/docs2.9/ZION_OASIS/SACRED_TRINITY/15_VISHWAKARMA_DEV_LEAD.md)
- **Dev Team DAO (legacy):** [`docs/docs2.9/2.8.2/VISHWAKARMA_DEV_TEAM_DAO.md`](../../../../docs/docs2.9/2.8.2/VISHWAKARMA_DEV_TEAM_DAO.md)
- **V3 README:** [`V3/README.md`](../../README.md)
- **CLI Guide:** [`V3/docs/CLI_GUIDE.md`](../CLI_GUIDE.md)
- **L2 DAO docs:** [`V3/L2/dao/docs/README.md`](../../L2/dao/docs/README.md)

---

## Workspace Layout (V3)

```text
V3/
  Cargo.toml              # Workspace root
  L1/
    cosmic-harmony/       # Ekam Deeksha PoW, 95 tests
    core/                 # Blockchain, consensus, P2P, RPC, 432 tests
    pool/                 # Stratum, template flow, 29 tests
    miner/                # CPU/GPU mining, 59 tests
    native-ffi/           # Native acceleration, 4 tests
  L2/
    bridge/               # wZION relay daemon, 157 tests
    dao/                  # Governance, 65 tests
    atomic-swap/          # HTLC swaps, 15 tests
  L3/
    ncl/                  # Neural Consciousness Layer, 43 tests
    warp/                 # Cross-chain bridge, 252 tests
    ai-native/            # AI agent framework, 89 tests
  L5/
    free-world/           # Humanitární vrstva, 3 tests
  L6/
    issobella/            # Vesmírná vrstva, 3 tests
  cli/                    # Unified operator CLI
  docker/                 # Dockerfiles + compose
```

**Celkem:** ~1 300 workspace tests, 0 failures.

---

## Klíčové konstanty

| Parametr | Hodnota |
|----------|---------|
| Development Fund | 1.0B ZION (z genesis premine) |
| Dev Team Salaries | 400M ZION/rok |
| Infrastructure | 200M ZION/rok |
| R&D Budget | 150M ZION/rok |
| Community Grants | 100M ZION/rok |
| Education | 100M ZION/rok |
| Security Audits | 50M ZION/rok |
| **Total** | **1.0B ZION/rok** |

---

## Stav implementace (V3)

| Vrstva | Crate | Testy | Stav |
|--------|-------|-------|------|
| L1 | `zion-core` | 432 | ✅ Mainnet live |
| L1 | `zion-pool` | 29 | ✅ Production |
| L1 | `zion-miner` | 59 | ✅ CPU/GPU ready |
| L1 | `zion-cosmic-harmony` | 95 | ✅ CHv4.2 dual-spin |
| L2 | `zion-bridge` | 157 | ✅ Base Sepolia |
| L2 | `zion-dao` | 65 | ✅ Governance live |
| L2 | `zion-atomic-swap` | 15 | ✅ HTLC ready |
| L3 | `zion-warp` | 252 | ✅ 7 chain adapters |
| L3 | `zion-ncl` | 43 | ✅ Consciousness engine |
| L3 | `zion-ai-native` | 89 | ✅ Agent framework |
| L5 | `zion-free-world` | 3 | ✅ Humanitární |
| L6 | `zion-issobella` | 3 | ✅ Vesmírná |
| CLI | `zion-cli` | — | ✅ Unified operator |

---

## Mantra pro vývojáře

```
ॐ विश्वकर्मणे नमः
Om Vishwakarmane Namaha

"I bow to the Divine Architect,
Who builds with dharma,
Creates with consciousness,
Serves through skill.

May my code be clean,
My architecture sound,
My intentions pure,
My service eternal.

Om Shanti."
```

---

*„The universe is my workshop. Code is my chisel. Golden Age is my sculpture."* 🔧✨
