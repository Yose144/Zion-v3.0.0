# ZION 3.0.4 Security Patch — Report

**Datum:** 2026-07-09
**Autor:** Devin agent
**Status:** FÁZE 1–4 + 6 HOTOVO · FÁZE 5 PENDING (air-gapped key rotace — owner akce)

---

## Shrnutí

Security patch 3.0.4 je kompletní kromě Fáze 5 (air-gapped key rotace), která vyžaduje fyzickou přítomnost ownera na air-gapped stroji. Všechny ostatní fáze — dependency hardening, F4.7 max-tx cap, deploy, aktivace, git history scrub, residual advisories, finální audit — jsou hotové.

---

## Fáze 1 — Dependency + code hardening ✅ (2026-07-07)

| Advisory | Crate | Akce | Stav |
|----------|-------|------|------|
| RUSTSEC-2026-0185 | quinn-proto ≥0.11.15 | Upgrade | ✅ |
| RUSTSEC-2026-0204 | crossbeam-epoch ≥0.9.20 | Upgrade | ✅ |
| RUSTSEC-2026-0190 | anyhow | Upgrade | ✅ |
| — | rand 0.8.6 / 0.9.4 | Upgrade | ✅ |
| — | indicatif 0.18, ratatui 0.30, lru 0.18 | Upgrade | ✅ |
| RUSTSEC-2025-0141 | bincode 1.x | **Odstraněno** (heed serde-bincode feature vypnuta) | ✅ |
| RUSTSEC-2024-0436 | paste (via metal) | **macOS-only** (target-gated, 0 Linux exposure) | ✅ |

Code hardening:
- Node: mainnet guard proti `ZION_SEED_PEERS=none|empty`
- Pool: OASIS hook bez externího `curl` (interní HTTP, localhost-only, timeouty)
- Bridge: SQL whitelist `l1_locks | evm_burns` v `count_by_status`
- HTTP timeouty: issobella/free-world dao_client, cli free_world/issobella
- Miner: přímá `bincode` závislost odstraněna

---

## Fáze 2 — F4.7 Max TX Amount Cap ✅ (2026-07-07)

- **Cap:** `emission::TOTAL_SUPPLY` (144 mld ZION) — NE 100M (nekoliduje s premine)
- **Výjimky:** `from == "genesis"`, `from == "coinbase"`
- **Height-gate:** `ZION_MAX_TX_AMOUNT_HEIGHT` (default `u64::MAX` = vypnuto)
- **Obě cesty:** RPC `insert_transaction` + P2P `validate_peer_block` (parita)
- **Testy:** 4 unit testy PASS

---

## Fáze 3 — Push + rebuild + binary swap ✅

- Server `62.171.141.136` na commit `690b6dfe`
- F4.7 + F5 v binárkách (ověřeno přes `strings`)
- 7/7 služby active

---

## Fáze 4 — F4.7 aktivace + smoke test ✅

- **Aktivace:** 2026-07-07 23:16, `ZION_MAX_TX_AMOUNT_HEIGHT=1`
- **Smoke test:** 2026-07-08, height 81

| Test | Částka | Očekáváno | Výsledek |
|------|--------|-----------|----------|
| 1 | 144B ZION + 1 flower (> TOTAL_SUPPLY) | F4.7 reject | ✅ `exceeds max allowed amount` |
| 2 | 1000 ZION (≤ TOTAL_SUPPLY) | Pass F4.7, hit F5 | ✅ `insufficient balance` |

---

## Fáze 5 — Air-gapped key rotace ⏳ PENDING

Vyžaduje owner na air-gapped stroji. Pořadí od nejnižšího rizika:

| Krok | Co | Riziko |
|------|-----|--------|
| 5.1 | Pool payout SK | Low |
| 5.2 | EVM deploy keys | Medium |
| 5.3 | Bridge validator keys (5/5) | Medium |
| 5.4 | Premine + canonical wallets | HIGH (consensus!) |

---

## Fáze 6 — Historie + síť + finální audit ✅

### 6.1 Git history scrub ✅ (2026-07-08)
- `git filter-repo --replace-text`
- 87 secret occurrences odstraněno (SSH klíče + 5 pool SKs)
- Force push to origin
- Backup: `/tmp/zion-git-backup-before-scrub` (1.2G)

### 6.2 Tailscale ACL ✅ (2026-07-07)
- Tailscale odstraněn jako attack surface
- Single-server topologie: SSH + nginx SSL + UFW (22/80/443)

### 6.3 Residual advisories ✅ (2026-07-08)
- `bincode 1.x` — kompletně odstraněn z dependency stromu
- `metal`/`paste` — macOS-only target-gated, 0 Linux runtime exposure
- `cargo audit` čistý (1 ignored: paste macOS-only)

### 6.4 Finální security check ✅ (2026-07-08)
- `security-audit.sh` — čistý (0 advisories kromě 1 ignored)
- `cargo test --workspace` — zelené (470+ testů PASS, 0 failed, 2 ignored slow PoW)
- `SECURITY_DISCLOSURE_2026-07.md` — updatováno o ZION-2026-006 (F4.7)
- `vulnerabilities.json` — ZION-2026-006 přidán

---

## Server stav (2026-07-09)

| Metrika | Hodnota |
|---------|---------|
| Server | `62.171.141.136` |
| Genesis hash | `4f75a0dfe6dde3b167287d445aa1ade56577b0e9166c641ed288b4c20a79bd6e` |
| Chain height | 218 |
| Accepted blocks | 219 |
| Mempool TX | 1 |
| Služby | 7/7 active (node, pool, bridge, dao, warp, dashboard, nginx) |
| F4.7 | Aktivní od height 1 |
| F5 | Aktivní od genesis (height 0) |
| Web | Maintenance mode (zionterranova.com) |

---

## Zranitelnosti katalogizované

| UID | Název | Severity | Status |
|-----|-------|----------|--------|
| ZION-2026-001 | Forged Account TX via P2P (F1) | HIGH | ✅ Fixed |
| ZION-2026-002 | Account Balance Bypass (F5) | CRITICAL | ✅ Fixed |
| ZION-2026-003 | TeamViewer Server Compromise | CRITICAL | ✅ Hard reset |
| ZION-2026-004 | Server Misconfiguration (C1-C8) | HIGH | ✅ New server |
| ZION-2026-005 | EVM Admin Key Compromise | HIGH | ⏳ Pending redeploy |
| ZION-2026-006 | Max TX Amount Cap (F4.7) | LOW | ✅ Fixed + smoke test |

---

## Co zbývá (owner akce)

1. **Fáze 5 — Air-gapped key rotace** (pool SK → EVM → bridge validators → premine/canonical)
2. **Re-clone repo** na všech strojích (git history byla přepsána)
3. **Externí audit genesis** před public launch
4. **ZION-2026-005** — EVM kontrakty redeploy s novými klíči + multisig

---

*Report vygenerován 2026-07-09. Detaily v `SECURITY_PATCH_3.0.4_PLAN.md`, `SECURITY_TODO_2026-07-03.md`, `docs/security/SECURITY_DISCLOSURE_2026-07.md`.*
