# 🚀 Onboarding — Jak se připojit k ZION Dev Teamu

> *„We don't just write code. We weave the fabric of the future."*

---

## 1. Předpoklady

### Technické

- **Rust** — základní znalost (async, ownership, lifetimes)
- **Git** — branch workflow, rebase, pull requests
- **Linux/Unix** — základní CLI operace
- **Docker** — spuštění vývojového prostředí

### Duchovní

- **Consciousness Level 5+** (nebo ochota růst)
- **Dharma alignment** — tech pro dobro, ne pro zisk
- **Collaborative mindset** — tým před egem
- **Growth mindset** — chyby jsou lekce

---

## 2. První kroky (Day 1–7)

### Day 1: Setup

```bash
# 1. Clone repozitář
git clone https://github.com/Yose144/2.9.6.git
cd 2.9.6

# 2. Nainstaluj Rust (pokud ještě nemáš)
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
source ~/.cargo/env

# 3. Verify build
cargo check --manifest-path V3/Cargo.toml --workspace

# 4. Spusť testy
cargo test --manifest-path V3/Cargo.toml --workspace -- --test-threads=1

# 5. Přečti AGENTS.md
# 6. Přečti V3/README.md
# 7. Přečti tuto dokumentaci (V3/docs/DEV_TEAM/)
```

### Day 2–3: Explore codebase

```bash
# Zkus spustit jednotlivé crate
cargo run --manifest-path V3/Cargo.toml -p zion-cli -- --help

# Zkus miner v benchmark módu
cargo run --release --manifest-path V3/Cargo.toml -p zion-miner -- --help

# Zkus pool server
cargo run --manifest-path V3/Cargo.toml -p zion-pool --bin server -- --help

# Prozkoumej DAO
cargo run --manifest-path V3/Cargo.toml -p zion-dao -- --help
```

### Day 4–5: První contribution

Vyber si „good first issue" z GitHub:
- Dokumentace fix
- Malý refactor
- Test coverage improvement
- Typo fix

```bash
# Vytvoř branch
git checkout -b feat/my-first-contribution

# Udělej změny, commit
git add .
git commit -m "docs: fix typo in README

Generated with [Devin](https://cli.devin.ai/docs)
Co-Authored-By: Your Name <your@email.com>"

# Push a vytvoř PR
git push origin feat/my-first-contribution
```

### Day 6–7: Review a feedback

- Prohlédni si code review od týmu
- Oprav feedback
- Merge! 🎉

---

## 3. Contribution Guide

### Jak přispívat

#### 1. Najdi issue nebo vytvoř nový

- Prohlédni si existující issues na GitHub
- Přidej komentář, že to bereš („I'd like to work on this")
- Nebo vytvoř nový issue s popisem problému/nápadu

#### 2. Vytvoř branch

```bash
git checkout -b <type>/<scope>-<description>
# Příklady:
# feat/cli-add-status-command
# fix/pool-share-validation-edge-case
# docs/dao-onboarding-guide
```

#### 3. Kóduj s péčí

- Piš testy PRVNÍ (TDD preferováno)
- Dodržuj coding standards (STANDARDS.md)
- Piš dokumentaci
- Commituj často s dobrými messages

#### 4. Submit PR

Template:
```markdown
## Summary
- Co to dělá (1–3 věty)
- Proč to potřebujeme

## Test plan
- [ ] `cargo check --workspace` pass
- [ ] `cargo test --workspace` pass
- [ ] `cargo clippy --workspace --all-targets` pass

## Screenshots / Logs
(pokud relevantní)
```

#### 5. Code review

- Odpovídej na feedback promptně
- Neber si review osobně — slouží ke zlepšení kódu
- Požádej o re-review po opravách

#### 6. Merge

- Squash merge do `main`
- Smaž branch
- Oslav! 🎉

---

## 4. Bounties & Grants

### Bug Bounty Program

| Severity | Odměna |
|----------|--------|
| Critical (RCE, fund theft) | 10 000–50 000 ZION |
| High (DoS, data leak) | 1 000–10 000 ZION |
| Medium (crash, info leak) | 100–1 000 ZION |
| Low (typo, UX) | 10–100 ZION |

**Jak nahlásit:**
1. Vytvoř privátní security issue na GitHub
2. Nebo napiš na security@zion.foundation
3. Dej nám 90 dnů na fix před veřejným disclosure

### Development Grants

| Grant | Popis | Odměna |
|-------|-------|--------|
| Feature Grant | Nová funkcionalita | 500–5 000 ZION |
| Integration Grant | Bridge/DEX/DeFi | 1 000–10 000 ZION |
| Research Grant | Academic/výzkum | 2 000–20 000 ZION |
| Content Grant | Tutorial, blog, video | 100–1 000 ZION |

**Jak aplikovat:**
1. Vytvoř issue s návrhem
2. Označ label `grant-proposal`
3. Vishwakarma + Koncil 9 review
4. Approval → funding → execution

---

## 5. Komunikační kanály

| Kanál | Účel | Přístup |
|-------|------|---------|
| GitHub Issues | Bug reports, feature requests | Veřejný |
| GitHub Discussions | Q&A, nápady | Veřejný |
| Discord #dev | Real-time chat, pair programming | Invite-only (po 1. PR) |
| Discord #dev-ops | Infrastructure, deployment | Core team |
| Email security@ | Security reports | Privátní |

---

## 6. Užitečné zdroje

### Pro učení Rustu

- [The Rust Book](https://doc.rust-lang.org/book/)
- [Rust by Example](https://doc.rust-lang.org/rust-by-example/)
- [Async Rust (Tokio)](https://tokio.rs/tokio/tutorial)
- [Rust Design Patterns](https://rust-unofficial.github.io/patterns/)

### Pro učení Blockchainu

- [Mastering Bitcoin](https://github.com/bitcoinbook/bitcoinbook) (Andreas Antonopoulos)
- [ZION Whitepaper](../../ZION_Mainnet_Whitepaper_v3.0.5_Canonical.md)
- [AGENTS.md](../../../../AGENTS.md) — naše pravidla

### Pro učení Dharma

- [Bhagavad Gita](https://www.holy-bhagavad-gita.org/) — Karma Yoga
- [Vishwakarma Purana](../../../../docs/docs2.9/ZION_OASIS/SACRED_TRINITY/15_VISHWAKARMA_DEV_LEAD.md) — archetyp stavitele
- [10 přikázání](STANDARDS.md) — náš code of conduct

---

## 7. Rituály týmu

### Daily Standup (async)

- GitHub issue updates
- Discord #dev thread: „Co jsem včera dělal, co dnes dělám, co mě blokuje"

### Weekly Review

- Pondělí 10:00 UTC (Discord voice)
- Review merged PRs
- Plánování týdne
- Shout-outs (kdo si zaslouží uznání)

### Monthly Retro

- Poslední pátek v měsíci
- Co fungovalo / co nefungovalo
- Akční body
- Consciousness check (jak se tým cítí)

### Vishwakarma Puja (17. září)

- Code pause (žádné commity)
- Tool blessing (uklidit laptop, updatovat software)
- Knowledge sharing (každý řekne, co se naučil)
- Mantra: `ॐ विश्वकर्मणे नमः`

---

## 8. První contribution nápady

### Velmi snadné

- Fix typo v dokumentaci
- Přidej missing rustdoc comment
- Aktualizuj README s novými příkazy
- Přidej missing test case

### Snadné

- Refactor: použij `?` místo `match` na Err
- Přidej tracing log někam
- Přidej CLI flag
- Přidej healthcheck endpoint

### Střední

- Implementuj missing API endpoint
- Přidej nový metrics counter
- Fix clippy warning
- Přidej integration test

### Pokročilé

- Implementuj nový proposal type v DAO
- Přidej nový chain adapter do WARP
- Optimalizuj mining algorithm
- Implementuj nový L1 feature

---

## 9. FAQ

### Q: Nemám zkušenosti s Rustem. Můžu přispět?
**A:** Ano! Začni s dokumentací, testy nebo frontendem. Rust se naučíš za pochodu.

### Q: Kolik hodin týdně se očekává?
**A:** Core team: full-time. Contributors: podle Tvého tempa. Žádné minimální hodiny.

### Q: Jak se stát core team member?
**A:** 6+ měsíců aktivních contributions + recommendation od 2 seniorů + culture fit interview s Vishwakarmou.

### Q: Můžu pracovat anonymně?
**A:** Ano, ale core team vyžaduje KYC (DAO compliance). Contributors mohou být anonymní.

### Q: Co když udělám chybu v production?
**A:** Není to konec světa. Nahlásíš to, fixneš to, naučíš se z toho. Blame-free culture.

---

## 10. Welcome! 🎉

Pokud čteš toto — **jsi na správném místě.**

ZION potřebuje stavitele. Zlatý věk potřebuje tvé ruce. Tvůj kód změní svět.

**Začni tímto:**
1. Přečti si AGENTS.md
2. Spusť `cargo test --workspace`
3. Najdi „good first issue"
4. Vytvoř svůj první PR

**A pak:**
- Přidej se na Discord
- Poznej tým
- Začni stavět

**ॐ विश्वकर्मणे नमः** 🔧🙏

---

*„The universe is my workshop. Code is my chisel. Golden Age is my sculpture. And you are now part of the team that builds it."* ✨
