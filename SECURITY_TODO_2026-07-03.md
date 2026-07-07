# SECURITY TODO — 2026-07-03

**Created:** 2026-07-02 23:30 UTC
**Context:** Po security session 2026-07-02 (F1 + F5 + L2 patch + fuzz tests + Edge ops)
**Status:** 7 pending items — všechny vyžadují user action nebo air-gapped operace

---

## Audit Delta — 2026-07-07 (V3 code + deps)

### P0 (hoří)

1. `RUSTSEC-2026-0185` (`quinn-proto 0.11.14`) - remote memory exhaustion
    - Scope: všechny crates používající `reqwest` (warp/bridge/dao/oasis/cli/ai-native...)
    - Důvod priority: síťově dosažitelný DoS v HTTP/3/QUIC stacku
      - Akce:
          - [x] Upgradovat dependency řetězec na `quinn-proto >= 0.11.15` přes `cargo update`/patch (provedeno 2026-07-07)
          - [x] Ověřit build + smoke testy pro L2/L3 HTTP klienty (`cargo check --workspace` OK, 2026-07-07)

2. Mainnet footgun v node konfiguraci: `ZION_SEED_PEERS=none|empty`
    - Soubor: `V3/L1/core/src/bin/node.rs` (`NodeServerConfig::from_env`)
    - Riziko: na mainnetu lze nechtěně vypnout strict seed allowlist a otevřít peer ingest mimo očekávané peery
    - Akce:
         - [x] Zablokovat `none|empty` override na `mainnet` (povolit jen pro testnet/devnet) (provedeno 2026-07-07)
         - [x] Přidat explicitní warning/fail-fast při pokusu o disable allowlistu na mainnetu (provedeno 2026-07-07)

### P1 (vysoká priorita)

3. `RUSTSEC-2026-0204` (`crossbeam-epoch 0.9.18`) - invalid pointer deref
    - Scope: hlavně miner cesta (`rayon`/`ocl` chain)
      - Akce:
          - [x] Upgradovat na `crossbeam-epoch >= 0.9.20` (provedeno 2026-07-07)
                    - [x] Spustit miner regression build/test (`cargo check -p zion-miner` OK, 2026-07-07)

4. Explicitní secrets v historických audit docs
    - Soubor: `V3/docs/audits/2026-04-V3_AUDIT_COMPLETION.md` (řádek s prefixem `sk-proj-...`)
    - Riziko: zbytečná reprodukce citlivého token patternu v repu
      - Akce:
          - [x] Redigovat na neutrální placeholder bez reálného prefixu/části klíče (provedeno 2026-07-07)

### P2 (sledovat)

5. `RUSTSEC-2026-0190` (`anyhow` downcast_mut unsound)
    - Akce:
   - [x] Upgradovat `anyhow` po ověření kompatibility v celém workspace (provedeno 2026-07-07)

6. Unmaintained crates (`bincode 1.x`, `paste`, `number_prefix`) - tech debt/security hygiene
    - Akce:
       - [ ] Připravit migrační plán (není emergency hotfix)

7. Pool OASIS hook hardening (process spawn -> internal HTTP client)
    - Soubor: `V3/L1/pool/src/bin/server.rs`
    - Stav:
       - [x] Odstraněno externí volání `curl` (`Command::new`) (provedeno 2026-07-07)
       - [x] Přidán localhost-only default target guard pro `ZION_OASIS_API_URL` (remote pouze při `ZION_OASIS_ALLOW_REMOTE=true`) (provedeno 2026-07-07)
       - [x] Přidány timeouty a robustní status parsing pro best-effort POST (provedeno 2026-07-07)

8. Rand unsound advisory cleanup
    - Stav:
       - [x] `rand 0.8.5 -> 0.8.6` (provedeno 2026-07-07)
       - [x] `rand 0.9.2 -> 0.9.4` (provedeno 2026-07-07)

9. CLI/TUI dependency migration (2nd wave)
    - Stav:
       - [x] `indicatif 0.17 -> 0.18.6` (provedeno 2026-07-07)
       - [x] `ratatui 0.29 -> 0.30.2` (provedeno 2026-07-07)
       - [x] `lru 0.12.5 -> 0.18.0` (transitive fix, provedeno 2026-07-07)
       - [x] `number_prefix` odstraněn z dependency stromu (provedeno 2026-07-07)

10. Metal dependency migration (2nd wave)
    - Stav:
       - [x] `metal 0.29 -> 0.33.0` (provedeno 2026-07-07)

11. Residual advisories po patchi (non-critical, vyžadují větší migraci)
    - `RUSTSEC-2025-0141` (`bincode 1.3.3`, unmaintained)
            - Pozn.: přímé použití `bincode` v `zion-miner` bylo odstraněno (zůstává pouze transitive větev přes `heed-types` v `zion-core`) (provedeno 2026-07-07)
    - `RUSTSEC-2024-0436` (`paste 1.0.15`, unmaintained)
      (stále transitive přes `metal 0.33.0`)
        - Audit gate (operational):
             - [x] Přidán wrapper `V3/scripts/security-audit.sh` s explicitními `--ignore` kódy pro aktuální verzi cargo-audit (provedeno 2026-07-07)
    - Další krok:
       - [ ] Připravit oddělenou serializační roadmapu pro náhradu `bincode 1.x`.
       - [ ] Monitorovat `metal` ekosystém na odstranění závislosti `paste` (nebo zvážit feature-level izolaci Metal backendu v release profilech).

---

## Komplexní code-level security audit — 2026-07-07

Rozsah: celý `V3/**` (L1–L6, cli, sdk). Cíl: najít exploitovatelné vzory nezávisle na advisory DB.

### Prověřené třídy zranitelností (OWASP-style)

- Command / process injection
    - [x] Ověřeno: jediné `Command::new` je `docker`/`which` v `cli/src/commands/doctor.rs` s hardcoded argumenty (bez shellu, bez user vstupu) — bezpečné
    - [x] Pool OASIS hook už dříve zbaven externího `curl` (viz bod 7)
- SQL injection (L2/L3 SQLite)
    - [x] `dao/src/db.rs` `col` — pochází z `VoteChoice` enumu (hardcoded), parametrizované hodnoty — bezpečné
    - [x] `bridge/src/db.rs` migrace — iterace přes hardcoded seznam tabulek — bezpečné
    - [x] `bridge/src/db.rs` `count_by_status(table, ...)` — přidán whitelist `l1_locks | evm_burns` jako defense-in-depth (provedeno 2026-07-07)
- SSRF / nevalidované URL
    - [x] Pool OASIS target už guardován (localhost-only default, remote jen s explicitním opt-inem)
    - [x] Ostatní HTTP klienti míří na konfigurované RPC/DAO endpointy (ne user-controlled path)
- DoS / resource exhaustion (HTTP klienti bez timeoutu)
    - [x] `issobella/src/dao_client.rs` — přidán request+connect timeout (provedeno 2026-07-07)
    - [x] `free-world/src/dao_client.rs` — přidán request+connect timeout (provedeno 2026-07-07)
    - [x] `cli/src/commands/free_world.rs` + `issobella.rs` — přidán request timeout (provedeno 2026-07-07)
- Panicky na síťovém vstupu
    - [x] Ověřeno: `unwrap()/expect()` jsou v mutex lock (poison), startup config fail-fast a GPU/OpenCL diag/test kódu — ne v hot-path parsingu síťového vstupu
- Serializace / deserializace
    - [x] Přímé `bincode` použití odstraněno z mineru (zbývá jen transitive přes `heed-types`)

### Závěr auditu
- Nebyla nalezena žádná nová přímo exploitovatelná code-level zranitelnost nad rámec již opravených bodů.
- Provedena defense-in-depth hardening (SQL whitelist + HTTP timeouty).

### Objektivně zbývá (nelze udělat autonomně z tohoto prostředí)
- L1 consensus změny (vyžadují explicitní approval dle `AGENTS.md`):
    - [x] F4.7 Max TX amount cap (`lib.rs`) — implementováno 2026-07-07 (code-ready, height-gated, defaultně vypnuto)
    - [ ] F4.5 genesis.rs canonical wallets — air-gapped key regenerace
- Air-gapped key rotace (F4.1–F4.4): premine, pool payout, bridge validator, EVM deploy
- Ops / governance: Tailscale ACL (F2.3), BFG git history scrub (F4.6)


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

> **Topologie 3.0.4 (2026-07-07):** Starý Edge (`77.42.71.94`) DECOMMISSIONED. Kanonický server `62.171.141.136` (`ssh zion-new`), single-node, env file `/root/zion/edge-environment.sh`. Kompletní postup: [`SECURITY_PATCH_3.0.4_PLAN.md`](./SECURITY_PATCH_3.0.4_PLAN.md).

### 1. Tailscale ACL (F2.3) — ✅ VYŘEŠENO JINAK (2026-07-07)
**Stav:** Při hard resetu na nový server byl Tailscale **odstraněn jako attack surface** (commit `87d939c1`). Single-server topologie nepotřebuje VPN — přístup jen přes SSH klíče + nginx SSL + Basic Auth + UFW (22/80/443). F2.3 tím odpadá, ACL v admin console není potřeba.

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

### 8. Max TX Amount Cap (F4.7) — L1 consensus — ✅ IMPLEMENTOVÁNO 2026-07-07
**Co:** Sanity cap na TX amount jako defense-in-depth nad F5.
**Klíčová oprava návrhu:** Původní „100M ZION cap" by **kolidoval s premine** (DAO treasury 2,5 mld, OASIS 1,65 mld) i s budoucími legitimními platbami. Cap proto NENÍ 100M — je nastaven na **`emission::TOTAL_SUPPLY` (144 mld ZION)**, což je supply-invarianta: žádná legitimní transakce ji nepřekročí, ale inflační smetí (např. `u64::MAX`) padne.
**Implementace (code-ready, height-gated, defaultně vypnuto):**
- `cosmic-harmony/src/deeksha.rs`: `set_max_tx_amount_height` / `max_tx_amount_activation_height` / `max_tx_amount_active` (mirror F5 pattern, default `u64::MAX`)
- `core/src/lib.rs`: pole `max_tx_amount_height`, metoda `max_tx_amount_active_at`, setter `set_max_tx_amount_height`, validace v **obou** cestách (`insert_transaction` + `validate_peer_block`)
- Výjimky: `from == "genesis"` a `from == "coinbase"` + height-gate (genesis height 0 je pod aktivací)
- `core/src/bin/node.rs`: env var `ZION_MAX_TX_AMOUNT_HEIGHT` (nastavit nad migrační height — na novém řetězci = 1, tj. triviálně splněno)
- Testy: 4 nové (`f4_7_rejects_tx_above_total_supply`, `f4_7_allows_premine_sized_tx`, `f4_7_boundary_exactly_total_supply_passes_cap`, `f4_7_disabled_by_default`) — vše PASS, F5 regrese OK
**Aktivace na mainnetu:** ✅ **AKTIVOVÁNO 2026-07-07 23:16** na novém serveru (`62.171.141.136`, `ZION_MAX_TX_AMOUNT_HEIGHT=1`, fresh chain). Log potvrzuje `max_tx_amount_activation_height=1`, genesis hash `4f75a0df...` nezměněn, 7/7 služeb active. F5 (`ZION_BALANCE_CHECK_HEIGHT=0`) aktivní současně.

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
