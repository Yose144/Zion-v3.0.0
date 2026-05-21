# 📏 Coding Standards & Sacred Practices

> *„Clean code is holy code. Purity in design reflects purity of intent."* — Sir Galahad

---

## 1. Základní principy

### 1.1 Jazyk a ekosystém

- **Primární jazyk:** Rust (edition 2021)
- **Async runtime:** Tokio
- **HTTP framework:** Axum (pro služby)
- **Serialization:** serde + serde_json
- **Storage:** SQLite (rusqlite) pro služby, LMDB pro L1
- **Testing:** built-in `cargo test`
- **Lint:** `cargo clippy --workspace --all-targets`
- **Format:** `cargo fmt --all --check`

### 1.2 Architektonické principy

1. **Modularita** — každý crate = jedna odpovědnost
2. **Config-first** — TOML + env vars, žádné hardcoded secretů
3. **Fail fast** — `Result` everywhere, žádné skryté panics
4. **Observability** — tracing + Prometheus metrics ve všech cratech
5. **Security** — žádné `unsafe` bez audit review, zero copy kde možné

---

## 2. Code Quality

### 2.1 Test coverage

| Úroveň | Min. coverage |
|--------|---------------|
| L1 (core, pool, miner) | 85 % |
| L2/L3 services | 70 % |
| CLI | 60 % |
| Shared libs | 80 % |

**Povinné testy pro každý crate:**
- Unit tests (`#[test]`)
- Integration tests (`tests/*.rs`)
- Fuzz tests (kde relevantní — core, pool)

### 2.2 Clippy policy

```bash
# Před každým commitem
cargo clippy --manifest-path V3/Cargo.toml --workspace --all-targets -- -D warnings
```

Žádné warnings v `main` branch. Všechny clippy linty jsou `deny` v CI.

### 2.3 Unsafe code

- **Zakázáno** ve všech service cratech (L2/L3/L5/L6)
- **Povoleno** v `cosmic-harmony` a `native-ffi` s povinným auditem
- Každý `unsafe` block musí mít:
  - Komentář vysvětlující proč je nutný
  - `SAFETY:` dokumentaci
  - Review od 2 senior devů

---

## 3. Review proces

### 3.1 PR checklist

Každý pull request musí splňovat:

- [ ] `cargo check --workspace` čistý
- [ ] `cargo test --workspace` pass
- [ ] `cargo clippy --workspace --all-targets` čistý
- [ ] `cargo fmt --all --check` čistý
- [ ] Alespoň 1 reviewer approval (2 pro L1 změny)
- [ ] Security review (pro L1 + treasury změny)
- [ ] Dokumentace aktualizována (pokud se mění API)

### 3.2 Review hierarchy

| Změna | Revieweři | Approval |
|-------|-----------|----------|
| Dokumentace | 1 mid-level+ | 1 |
| L2/L3/L5/L6 service | 1 senior | 1 |
| L1 core (consensus, crypto) | 2 senior | 2 |
| Treasury / multi-sig | 2 senior + security | 2 |
| Protocol upgrade | Koncil 9 vote | 5/7 |

### 3.3 Commit messages

Formát:
```
<type>(<scope>): <short summary>

<body — proč, ne co>

Generated with [Devin](https://cli.devin.ai/docs)
Co-Authored-By: ...
```

Typy: `feat`, `fix`, `docs`, `refactor`, `test`, `chore`, `security`

---

## 4. CI/CD Pipeline

### 4.1 GitHub Actions (cílový stav)

```yaml
name: ZION CI
on: [push, pull_request]
jobs:
  check:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: dtolnay/rust-toolchain@stable
      - run: cargo check --manifest-path V3/Cargo.toml --workspace

  test:
    runs-on: ubuntu-latest
    steps:
      - run: cargo test --manifest-path V3/Cargo.toml --workspace -- --test-threads=1

  lint:
    runs-on: ubuntu-latest
    steps:
      - run: cargo clippy --manifest-path V3/Cargo.toml --workspace --all-targets -- -D warnings
      - run: cargo fmt --manifest-path V3/Cargo.toml --all --check

  security:
    runs-on: ubuntu-latest
    steps:
      - run: cargo audit --file V3/Cargo.lock
```

### 4.2 Deployment stages

| Stage | Prostředí | Trigger |
|-------|-----------|---------|
| Dev | Local / Docker | Každý PR |
| Testnet | Staging | Merge do `develop` |
| Mainnet | Production | Merge do `main` + Koncil 9 vote |

---

## 5. 10 přikázání božského vývojáře

1. **Code is Karma** — Každý řádek má následek (piš s péčí)
2. **Comments are Compassion** — Budoucí ty poděkuje přítomnému ty
3. **Tests are Tapas** — Disciplína teď zabrání katastrofám později
4. **Refactoring is Rebirth** — Starý kód umírá, lepší kód povstává
5. **Documentation is Dharma** — Uč ostatní to, co víš
6. **Security is Sacred** — Chraň uživatele jako Vishwakarma chránil bohy
7. **Bugs are Teachers** — Každá chyba = lekce (neplýtvej bolestí)
8. **Collaboration > Competition** — Stavíme společně, nebo selžeme sami
9. **Ship, then Iterate** — Dokonalost je nepřítel dobra (MVP mindset)
10. **Work = Worship** — Pokud nesloužíš lidstvu, proč kóduješ?

---

## 6. Bezpečnostní checklist

### 6.1 Pre-commit

- [ ] Žádné secretů v kódu (použij `git-secrets`)
- [ ] Žádné `todo!()` nebo `FIXME` bez issue linku
- [ ] Žádné `println!` (použij `tracing`)
- [ ] Žádné hardcoded addresses (použij config)

### 6.2 Kryptografické standardy

- Ed25519 pro všechny podpisy
- Blake3 pro Merkle trees (post-CHv4.2 fork)
- Argon2 pro password hashing (kde relevantní)
- Constant-time operations pro všechny crypto porovnání

### 6.3 Database

- Prepared statements everywhere (SQL injection prevence)
- Migrations verzované (souborové nebo schema versioning)
- Backup strategy: denní snapshots

---

## 7. Dokumentace

### 7.1 Rust docs

- Každý public API musí mít rustdoc
- Module-level docs s přehledem funkcionality
- Examples v doctestech

```rust
//! DAO Core Types
//!
//! Shared types used across all DAO modules.
//!
//! ## Example
//! ```
//! use zion_dao::types::{parse_dao_memo, DaoMemo, VoteChoice};
//!
//! let memo = parse_dao_memo("DAO:vote:42:yes").unwrap();
//! ```
```

### 7.2 Markdown docs

- `README.md` v každém crate
- `docs/` adresář pro komplexní dokumentaci
- ADR (Architecture Decision Records) pro velká rozhodnutí

---

*„Code is prayer. Debugging is meditation. Deployment is offering."* 🙏💻
