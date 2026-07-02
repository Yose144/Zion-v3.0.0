# SECURITY TODO — 2026-07-03

**Created:** 2026-07-02 23:30 UTC
**Context:** Po security session 2026-07-02 (F1 + F5 + L2 patch + fuzz tests + Edge ops)
**Status:** 7 pending items — všechny vyžadují user action nebo air-gapped operace

---

## Hotové (2026-07-02)

- [x] F1 fix deployed (commit `9341344d`)
- [x] F5 fix deployed na node1 + node2 (commit `69d12c7`, `fe8d449`, height 22394)
- [x] F5 fuzz tests (commit `a5472ec6`, 5 testů, vše PASS)
- [x] L2 security patch deployed (commit `a8b3821e`, MD5 shoda ověřena)
- [x] RPC audit log v node binárce
- [x] Node binary swap (22:55 UTC, fmt/clippy cleanup, F5 aktivní, height 22539)
- [x] ALL Edge services na 127.0.0.1
- [x] Env var names fix v service files (BRIDGE_METRICS_HOST, DAO_API_HOST)
- [x] Pool service konsolidace (duplikát stopped)
- [x] Atomic swap restart
- [x] Edge git cleanup (.bak files)
- [x] Dashboard health probes fix (commit `46106f38`)
- [x] cargo fmt + clippy (commit `48bf387f`, 0 warnings)
- [x] UFW, AppArmor, SSH hardening, file permissions, monitoring cron jobs
- [x] Private keys scrubbed z git repu
- [x] Escrow key rotation (inflační 100,002 ZION spáleno)

---

## Pending — USER ACTION potřeba

### 1. Tailscale ACL (F2.3)
**Co:** Aplikovat tag-based ACL přes Tailscale admin console
**Jak:**
1. Jít na https://login.tailscale.com/admin/machines
2. Otagovat zařízení:
   - `mainnetedge` (100.76.16.108) → `tag:edge-server`
   - `jose--macbook-pro` (100.100.46.39) → `tag:workstation`
   - `zionserver` (100.86.102.5) → `tag:mining-server`
   - `zionserver-144` (100.74.34.40) → `tag:legacy`
3. Jít na https://login.tailscale.com/admin/acls
4. Vložit ACL JSON z `SecurityFirst.md` §F2.3
5. Ověřit: `tailscale ping` z MacBooku na 100.76.16.108:22 (OK) a :8443 (deny)
**Doc:** `SecurityFirst.md` §F2.3

### 2. Key Rotation — Premine (F4.1)
**Co:** Rotovat premine privátní klíče na air-gapped machine
**Jak:** Per `GENESIS_REGENERATION_RUNBOOK.md`
- Air-gapped machine (no internet)
- Nové BIP-39 mnemonics pro každý premine slot
- Derivovat Ed25519 keypair z mnemonics
- Uložit mnemonics na flash disk `F:\ZION_V3_MAINNET_WALLETS.txt`
- Nové adresy → update `genesis.rs` PREMINE_OUTPUTS
- Rebuild + redeploy všech nodů
**Risk:** HIGH — consensus change, vyžaduje koordinaci

### 3. Key Rotation — Pool Payout SK (F4.2)
**Co:** Rotace pool payout signing key
**Jak:**
- Vygenerovat nový SK na air-gapped machine
- Update `edge-environment.sh` (chmod 600)
- Restart pool
- Verify `derive_address(SK) == ZION_POOL_WALLET`
**Doc:** `SecurityFirst.md` §F4.2

### 4. Key Rotation — Bridge Validator Keys (F4.3)
**Co:** Rotace 3/5 bridge validator keys (2/5 pending provisioning)
**Jak:** Per `V3/docs/BRIDGE_MULTISIG.md`
**Doc:** `SecurityFirst.md` §F4.3

### 5. Key Rotation — EVM Deploy Keys (F4.4)
**Co:** Rotace hardhat .env PRIVATE_KEYs
**Jak:**
- Vygenerovat nové EVM klíče na air-gapped machine
- Transfer contract ownership na multisig
- Update hardhat .env (chmod 600, mimo repo)
**Doc:** `SecurityFirst.md` §F4.4

### 6. genesis.rs Canonical Wallets Fix (F4.5)
**Co:** Opravit hardcoded `MAINNET_CANONICAL_*_WALLET` adresy v `genesis.rs`
**WARNING:** Label-derived adresy (`canonical_address_for_label()`) mají VEŘEJNÉ klíče — kdokoliv s přístupem k repu může utratit funds. Pokus o label-derived fix byl revertnut jako security downgrade.
**Správný postup:**
1. Air-gapped machine
2. Nové BIP-39 mnemonics pro každou roli (Issobella, Pool Fee, Default Miner, Pool Payout)
3. Derivovat Ed25519 keypair z mnemonics
4. Získat adresy
5. Aktualizovat `genesis.rs` s novými adresami
6. Uložit mnemonics na flash disk `F:\`
7. Rebuild + redeploy
**Current stav:**
| Label | Current constant | Derived from label (PUBLIC — nepoužívat!) |
|---|---|---|
| ISSOBELLA | `zion140n8a8...` | `zion158v5m6...` |
| POOL_FEE | `zion196m4n8...` | `zion1r7x5a4...` |
| DEFAULT_MINER | `zion1w523a7...` | `zion1q2z378...` |
| POOL_PAYOUT | `zion16825y2...` | `zion194e840...` |
**Doc:** `CRITICAL_3.0.4_SECURITY_FINDINGS.md` Finding 2, `GENESIS_REGENERATION_RUNBOOK.md`

### 7. BFG Git History Scrub (F4.6)
**Co:** Odstranit `PREMINE_WALLETS_BACKUP.json` z git history
**Jak:**
```bash
# BACKUP FIRST!
git filter-repo --invert-paths --path PREMINE_WALLETS_BACKUP.json
# Force push (koordinovat se všemi collaborators)
git push origin --force --all
git push origin --force --tags
```
**Kdy:** Před public launch/fork
**Risk:** HIGH — history rewrite, vyžaduje koordinaci

### 8. Max TX Amount Cap (F4.7) — L1 consensus
**Co:** Přidat max 100M ZION cap na TX amount (defense-in-depth i s F5 fix)
**Proč:** I když F5 fix rejectuje TX z empty address, max cap omezuje damage pokud útočník najde jiný bypass
**Jak:** L1 consensus change v `lib.rs` — `if transaction.amount_zion > 100_000_000 * 1_000_000 { reject }`
**Needs:** Spec + audit + explicit approval per AGENTS.md

---

## Edge server status (2026-07-02 23:00 UTC)

- **Chain height:** 22539
- **F5 active:** Yes (height 22394, obě nody)
- **L2 patch:** Deployed (MD5 verified)
- **Services:** 13/13 active, 0 failed
- **Bind:** ALL on 127.0.0.1 (P2P 8333/8334 + pool 8444 na 0.0.0.0, UFW blokuje)
- **Monitoring:** 3 cron jobs (forged TX, balance, peer alerts)
- **RPC audit log:** Active (v node binárce)

---

*This document tracks remaining security work. Update as items are completed.*
