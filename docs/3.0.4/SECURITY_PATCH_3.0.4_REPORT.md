# ZION 3.0.4 Security Patch — Report

**Datum:** 2026-07-09
**Autor:** Devin agent
**Status:** FÁZE 1–6 HOTOVO · FÁZE 5 AUDITOVÁNO (key rotace proběhla 2026-07-06, flash backup OK, EVM/escrow placeholdery na serveru) · EDGE REBUILD 2026-07-09

---

## Shrnutí

Security patch 3.0.4 je kompletní. Fáze 5 (air-gapped key rotace) proběhla při hard resetu 2026-07-06 — všechny klíče vygenerovány, na flash disku, genesis.rs odpovídá. Pool payout SK aplikován na serveru a ověřen. EVM validator a escrow SKs jsou v encrypted archivu na flash disku, na serveru placeholdery (aplikovat při cross-chain operacích). Edge binárky rebuildnuty 2026-07-09 z nejnovějšího kódu (`754fe4a0`, bincode fix).

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

- Server `62.171.141.136` — git re-clone 2026-07-09 na `754fe4a0`
- **Edge rebuild 2026-07-09:** Rust toolchain nainstalován, 5 binárek rebuildnuty z `754fe4a0` (node, pool, bridge, dao, warp)
- F4.7 + F5 v binárkách (log potvrzen: `max_tx_amount_activation_height=1`, `balance_check_activation_height=0`)
- 11/11 služeb active (node, node2, pool, bridge, dao, warp, oasis, free-world, issobella, dashboard, nginx)
- Staré binárky zálohovány: `/root/zion/binaries-backup-2026-07-07/`

---

## Fáze 4 — F4.7 aktivace + smoke test ✅

- **Aktivace:** 2026-07-07 23:16, `ZION_MAX_TX_AMOUNT_HEIGHT=1`
- **Smoke test:** 2026-07-08, height 81

| Test | Částka | Očekáváno | Výsledek |
|------|--------|-----------|----------|
| 1 | 144B ZION + 1 flower (> TOTAL_SUPPLY) | F4.7 reject | ✅ `exceeds max allowed amount` |
| 2 | 1000 ZION (≤ TOTAL_SUPPLY) | Pass F4.7, hit F5 | ✅ `insufficient balance` |

---

## Fáze 5 — Air-gapped key rotace ✅ AUDITOVÁNO (2026-07-09)

Hard reset s rotací proběhl 2026-07-06. Audit 2026-07-09 ověřil:

| Krok | Co | Stav | Detail |
|------|-----|------|--------|
| 5.1 | Pool payout SK | ✅ Aplikován | SK na serveru, pubkey derivace ověřena (`8895b507...` = flash disk) |
| 5.2 | EVM deploy keys | ⏳ V archivu | 3 admin EVM adresy na flash disku, aplikovat při contract deploy |
| 5.3 | Bridge validator keys (5/5) | ⏳ V archivu | 5 adres v bridge config + flash disk, SKs placeholdery na serveru |
| 5.4 | Premine + canonical wallets | ✅ Hotovo | 14 premine + 5 canonical v genesis.rs, ověřeno proti flash disku |
| 5.5 | Atomic swap escrow | ⏳ V archivu | Adresa na flash disku, SK placeholder na serveru |

**Flash disk backup:** `/run/media/zionserver/ESD-USB/ZionKeys/zion-keys-2026-07-06/`
- `PUBLIC_ADDRESSES.txt` — všechny veřejné adresy (no SKs)
- `zion-keys-2026-07-06-encrypted.tar.gz.aes` — AES-256-CBC encrypted archive (SKs + mnemonics)
- `passphrase.txt` — passphrase pro encrypted archive
- `.bak` — backup kopie encrypted archivu

**Genesis hash:** `4f75a0dfe6dde3b167287d445aa1ade56577b0e9166c641ed288b4c20a79bd6e` ✅ (ověřeno v běžícím nodu)

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
| Server | `62.171.141.136` (Edge) + `zionserver-144` (Local backup) |
| Genesis hash | `4f75a0dfe6dde3b167287d445aa1ade56577b0e9166c641ed288b4c20a79bd6e` |
| Chain height | 270+ (3-node P2P mesh, all synced) |
| Topologie | Edge Node 1 (primary, mining) + Edge Node 2 (follower) + Local backup |
| Služby Edge | 11/11 active (node, node2, pool, bridge, dao, warp, oasis, free-world, issobella, dashboard, nginx) |
| Služby Local | 4 active (backup-node, dashboard, stack, ssh-tunnel) |
| F4.7 | Aktivní od height 1 (`ZION_MAX_TX_AMOUNT_HEIGHT=1`) |
| F5 | Aktivní od genesis (`ZION_BALANCE_CHECK_HEIGHT=0`) |
| Pool | Aktivně minuje (miner `vega-smos`, shares Accepted) |
| Edge git | `754fe4a0` (re-clone 2026-07-09) |
| Edge binárky | Rebuild 2026-07-09 z `754fe4a0` (bincode fix, all security patches) |
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

## Co zbývá (při cross-chain / DeFi operacích)

**Audit 2026-07-09 — pending items po hard resetu:**

1. **EVM validator SKs** — aplikovat z encrypted archivu na server (`ZION_BRIDGE_VALIDATOR_SK_1..5`) při spuštění cross-chain bridge operací
2. **Escrow SK** — aplikovat z encrypted archivu na server (`ZION_SWAP_ESCROW_KEY`) při spuštění atomic swap
3. **EVM contract redeploy** — ZION-2026-005: nové kontrakty s novými admin klíči + multisig
4. **Externí audit genesis** před public launch
5. **Re-clone repo** na všech strojích (git history byla přepsána filter-repo)
6. **AppArmor profil** pro zion-node — chybí na novém serveru (nice-to-have)
7. **systemd `User=zion`** — test na jedné službě (nice-to-have)

**✅ Vyřešeno při auditu (2026-07-09):**
- WARP bind `0.0.0.0:9333` → `127.0.0.1:8453` (security fix)
- DB file permissions 644 → 600 (security fix)
- Memory leak fix (block retention + handle draining + bounded channels + MALLOC_ARENA_MAX=1)
- Memory monitoring cron job (5 min, auto-restart > 800MB)
- RPC verbose logging gated behind `ZION_RPC_DEBUG=1`

---

*Report vygenerován 2026-07-09, audit aktualizován 2026-07-09. Detaily v `SECURITY_PATCH_3.0.4_PLAN.md`, `SECURITY_TODO_2026-07-03.md`, `docs/security/SECURITY_DISCLOSURE_2026-07.md`.*
