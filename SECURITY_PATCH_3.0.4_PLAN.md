# ZION 3.0.4 — MAX SECURITY PATCH PLAN (kanonický postup)

**Vytvořeno:** 2026-07-07
**Status:** FÁZE 1–4 + 6 HOTOVO · FÁZE 5 AUDITOVÁNO (key rotace proběhla, flash backup OK, EVM/escrow placeholdery na serveru — aplikovat při cross-chain operacích) · EDGE REBUILD 2026-07-09 (binárky z `754fe4a0`, bincode fix)
**Navazuje na:** `SECURITY_TODO_2026-07-03.md`, `SECURITY_RECOVERY_PLAN_2026-07-03.md`, `SecurityFirst.md`, `HARDRESETOFFICIAL.md`
**Pravidlo:** Tento dokument je jediný zdroj pravdy pro pořadí kroků security patche 3.0.4. Každý krok se odškrtává zde.

---

## 📡 Skutečný stav serveru `62.171.141.136` (ověřeno 2026-07-09 přes `ssh zion-new`)

| Fakt | Hodnota |
|------|---------|
| Git HEAD | `754fe4a0` (re-clone 2026-07-09, sync s origin) |
| Binárky | **rebuild 2026-07-09** z `754fe4a0` (5 binárek: node, pool, bridge, dao, warp) — bincode fix, F4.7, všechny security commity |
| F5 balance check | ✅ **AKTIVNÍ od genesis** (`ZION_BALANCE_CHECK_HEIGHT=0`) |
| F4.7 max-tx cap | ✅ **AKTIVNÍ od height 1** (`ZION_MAX_TX_AMOUNT_HEIGHT=1`, log potvrzen v nové binárce) |
| Seed peers | `ZION_SEED_PEERS="127.0.0.1:8333"` |
| Chain | **height 270+** (3-node P2P mesh, pool aktivně minuje) |
| Mineři | `vega-smos` připojen, shares Accepted |
| Služby | **11/11 active** (node, node2, pool, bridge, dao, warp, oasis, free-world, issobella, dashboard, nginx) |
| Topologie | 3-node mesh: Edge Node 1 (primary) + Edge Node 2 (follower) + Local backup node |
| Pool payout SK | ✅ aplikován (`f7d59cb3...`, pubkey ověřen) |
| EVM validator SKs | ⏳ placeholdery (v encrypted archivu na flash disku) |
| Escrow SK | ⏳ placeholder (v encrypted archivu na flash disku) |

---

## Přehled fází

| Fáze | Obsah | Stav | Kdo |
|------|-------|------|-----|
| 1 | Dependency + code hardening (advisories, guardy, timeouty) | ✅ HOTOVO 2026-07-07 | agent |
| 2 | F4.7 Max TX amount cap — implementace (code-ready) | ✅ HOTOVO 2026-07-07 | agent |
| 3 | Push + rebuild + binary swap na nový server | ✅ HOTOVO (server na `690b6dfe`, F4.7 binárky, F5 aktivní) | owner + agent |
| 4 | F4.7 aktivace (odkomentovat env + restart) + smoke test | ✅ HOTOVO (aktivní od height 1, smoke test PASS 2026-07-08) | agent |
| 5 | Air-gapped key rotace (F4.1–F4.5) | ✅ AUDITOVÁNO 2026-07-09 (klíče vygenerovány, flash backup OK, pool payout aplikován, EVM/escrow placeholdery) | owner (air-gapped) |
| 6 | Git history scrub + Tailscale ACL + finální audit | ✅ HOTOVO (6.1 scrub, 6.2 Tailscale removed, 6.3 bincode+paste, 6.4 audit+test+disclosure) | owner + agent |

---

## FÁZE 1 — Dependency + code hardening ✅ (2026-07-07)

Vše implementováno, otestováno, zdokumentováno v `SECURITY_TODO_2026-07-03.md` §Audit Delta.

- [x] `quinn-proto` ≥ 0.11.15 (RUSTSEC-2026-0185, remote DoS)
- [x] `crossbeam-epoch` ≥ 0.9.20 (RUSTSEC-2026-0204)
- [x] `anyhow`, `rand` 0.8.6/0.9.4, `indicatif` 0.18, `ratatui` 0.30, `lru` 0.18, `metal` 0.33
- [x] Node: mainnet guard proti `ZION_SEED_PEERS=none|empty` (fail-fast) + testy
- [x] Pool: OASIS hook bez externího `curl` — interní HTTP POST, localhost-only default, timeouty + testy
- [x] Bridge: SQL whitelist `l1_locks | evm_burns` v `count_by_status`
- [x] HTTP timeouty: issobella/free-world dao_client, cli free_world/issobella
- [x] Miner: přímá `bincode` závislost odstraněna
- [x] Audit gate: `V3/scripts/security-audit.sh` (2 zbylé advisories = transitive: bincode přes heed-types, paste přes metal)
- [x] Redakce token patternu v `V3/docs/audits/2026-04-V3_AUDIT_COMPLETION.md`

**Validace:** `cargo check --workspace` OK · pool/node/bridge testy OK · `V3/scripts/security-audit.sh` čistý.

---

## FÁZE 2 — F4.7 Max TX Amount Cap ✅ (code-ready, 2026-07-07)

### Design (schváleno ownerem 2026-07-07)

- **Cap = `emission::TOTAL_SUPPLY` (144 mld ZION), NE 100M.** Původní návrh 100M by kolidoval s premine (DAO treasury 2,5 mld, OASIS 1,65 mld) a budoucími legitimními platbami.
- **Výjimky:** `from == "genesis"`, `from == "coinbase"`.
- **Height-gate:** default `u64::MAX` (vypnuto). Genesis (height 0) je pod jakoukoli aktivační výškou = dvojitá ochrana.
- **Obě cesty:** RPC `insert_transaction` i P2P `validate_peer_block` (parita — P2P nesmí být slabší).

### Implementované soubory

| Soubor | Změna |
|--------|-------|
| `V3/L1/cosmic-harmony/src/deeksha.rs` | `set_max_tx_amount_height` / `max_tx_amount_activation_height` / `max_tx_amount_active` (mirror F5) |
| `V3/L1/cosmic-harmony/src/lib.rs` | export nových funkcí |
| `V3/L1/core/src/lib.rs` | pole `max_tx_amount_height`, `max_tx_amount_active_at`, setter, validace v obou cestách, 4 testy |
| `V3/L1/core/src/bin/node.rs` | env var `ZION_MAX_TX_AMOUNT_HEIGHT` |

### Testy (vše PASS)

- [x] `f4_7_rejects_tx_above_total_supply` — nad cap padne
- [x] `f4_7_allows_premine_sized_tx` — 2,5 mld ZION projde
- [x] `f4_7_boundary_exactly_total_supply_passes_cap` — hranice projde (strict `>`)
- [x] `f4_7_disabled_by_default` — zpětná kompatibilita
- [x] F5 regrese — 38 testů OK

---

## FÁZE 3 — Push + nový server rebuild + binary swap ⏳

> Provádí owner s asistencí agenta. Nový server = `ssh zion-new` (`62.171.141.136`, key `~/.ssh/zion-new-server`). Starý Edge (77.42.71.94) je DECOMMISSIONED.

### 3.1 Push do GitHubu

```bash
export PATH=/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin   # git-lfs
git add -A
git commit -m "security(3.0.4): dependency hardening + F4.7 max-tx-amount cap (code-ready)"
git push origin main
```

- [x] Commit + push proveden (commit `690b6dfe`, 2026-07-07)
- [ ] CI (pokud běží) zelená

### 3.2 Nový server pull + rebuild

> **Topologie 3.0.4:** starý Edge (77.42.71.94) je DECOMMISSIONED. Kanonický je **nový server `62.171.141.136`** — single-node, fresh chain (genesis height 0, migration height 1). Rust 1.96.1 je na serveru.

```bash
ssh zion-new                       # key ~/.ssh/zion-new-server
cd /root/zion/2.9.6 && git pull origin main
source ~/.cargo/env
cargo build --release --manifest-path V3/Cargo.toml -p zion-core --bin node
cargo build --release --manifest-path V3/Cargo.toml -p zion-pool --bin server
```

- [ ] Build OK na novém serveru
- [ ] `cargo test --manifest-path V3/Cargo.toml -p zion-core --lib f4_7` OK

### 3.3 Binary swap (single-node: node → pool)

> **Před swapem: manuální backup!** Single-node topologie = žádný follower-kanárek, proto backup + rollback binárka jsou povinné.

```bash
# Backup dat + binárek
cp -a /data/zion/state /data/zion/state.bak-$(date +%Y%m%d-%H%M)
cp /usr/local/bin/zion-node /usr/local/bin/zion-node.old
cp /usr/local/bin/zion-pool-server /usr/local/bin/zion-pool-server.old

# Swap node
systemctl stop zion-node
cp V3/target/release/node /usr/local/bin/zion-node
systemctl start zion-node
journalctl -u zion-node -n 40 --no-pager   # ověřit start, genesis hash, žádné erory

# Pool (stejná verze — protokol není zpětně kompatibilní!)
systemctl stop zion-pool
cp V3/target/release/server /usr/local/bin/zion-pool-server
systemctl start zion-pool
```

- [ ] node swap OK — genesis hash `4f75a0df...`, height roste
- [ ] pool restart OK, minery se připojují, `SHARE_ACCEPTED` v logu
- [ ] `curl http://127.0.0.1:8443/jsonrpc -d '{"jsonrpc":"2.0","method":"getSupplyInfo","id":1}'` odpovídá
- [ ] `systemctl is-active zion-node zion-pool zion-bridge zion-dao zion-warp zion-dashboard nginx` — vše active

**Rollback:** `systemctl stop zion-node` → `mv /usr/local/bin/zion-node.old /usr/local/bin/zion-node` → `start`. Chain state se nemění (F4.7 je vypnuté).

---

## FÁZE 4 — F4.7 aktivace (odkomentovat env + restart) ⏸️ STAGED

> **Stav 2026-07-07:** Env var je už na serveru připraven, jen **zakomentovaný** v `/root/zion/edge-environment.sh`:
> `# export ZION_MAX_TX_AMOUNT_HEIGHT=1440`. F5 (`ZION_BALANCE_CHECK_HEIGHT=0`) je aktivní od genesis. Stejný mechanismus. Single-node → jeden systemd unit.

### 4.1 Volba aktivační výšky (fresh chain)

- Chain je na **height 0** (genesis, žádní mineři, web v maintenance). Není potřeba ~24h buffer jako u běžícího mainnetu.
- **Doporučení:** na fresh chainu aktivovat od **height 1** (`ZION_MAX_TX_AMOUNT_HEIGHT=1`) — genesis (height 0) je chráněný explicitním `from=="genesis"` guardem, takže cap platí od prvního mineného bloku. Konzistentní s F5 (aktivní od 0).
- Alternativa: ponechat `1440` (staré nastavení pro mainnet-continuation) — funguje taky, jen cap naběhne později.
- Podmínka scale: aktivace **> migrační height (=1)** — pro `=1` je cap aktivní od height 1, migrace je na height 1, obojí v 1e6 scale. ✓

- [x] Aktivační height zvolen: `H_F47 = 1` (fresh chain, aktivováno 2026-07-07 23:16)

### 4.2 Aktivace na novém serveru

```bash
ssh zion-new
# Odkomentovat + nastavit hodnotu v env file:
sed -i 's/^# export ZION_MAX_TX_AMOUNT_HEIGHT=.*/export ZION_MAX_TX_AMOUNT_HEIGHT=1/' /root/zion/edge-environment.sh
grep ZION_MAX_TX_AMOUNT_HEIGHT /root/zion/edge-environment.sh   # ověřit
systemctl restart zion-node
journalctl -u zion-node --no-pager -n 20 | grep max_tx_amount
# očekávaný log: "max_tx_amount_activation_height=1 (runtime override for F4.7 hard fork)"
```

> Pozn.: `edge-environment.sh` je EnvironmentFile pro systemd unit (ne systemd drop-in). Restart node stačí, `daemon-reload` není nutný pokud se nemění `.service` soubor.

- [x] Env odkomentován + hodnota nastavena na zion-node (bare formát `ZION_MAX_TX_AMOUNT_HEIGHT=1`, backup `edge-environment.sh.bak-f47-*`)
- [x] Log potvrzuje aktivační height (`max_tx_amount_activation_height=1`, genesis hash `4f75a0df...` nezměněn, 7/7 služeb active)
- [x] Smoke test proveden 2026-07-08 (height 81): TX > TOTAL_SUPPLY (144B+1 flowers) odmítnuta F4.7 (`exceeds max allowed amount`), běžná TX (1000 ZION) prošla F4.7 → odmítnuta F5 (`insufficient balance`). F4.7 cap funguje korektně.

### 4.3 Dokumentace aktivace

- [x] Aktivace zapsána do `SECURITY_PATCH_3.0.4_PLAN.md` + `SECURITY_TODO_2026-07-03.md` (2026-07-07)

---

## FÁZE 5 — Air-gapped key rotace (F4.1–F4.5) ✅ AUDITOVÁNO 2026-07-09

> **Pouze owner, air-gapped stroj.** Agent nesmí generovat ani číst privátní klíče. Pořadí od nejmenšího rizika.
>
> **Audit 2026-07-09:** Hard reset s rotací proběhl 2026-07-06. Všechny adresy ověřeny proti flash disku a genesis.rs. Pool payout SK aplikován na serveru a ověřen (pubkey derivace sedí). EVM validator a escrow SKs jsou v encrypted archivu na flash disku, na serveru placeholdery — aplikovat při cross-chain operacích.

### 5.1 Pool payout SK (F4.2) — ✅ APLIKOVÁNO
- [x] Nový keypair vygenerován na air-gapped stroji (2026-07-06)
- [x] SK aplikován v `/root/zion/edge-environment.sh` (`ZION_POOL_PAYOUT_SK_HEX=f7d59cb3...`)
- [x] Verify `derive_address(SK) == ZION_POOL_WALLET` — ✅ pubkey `8895b507...` sedí s flash diskem
- [x] Pool aktivně minuje (height 270+, miner `vega-smos` Accepted)

### 5.2 EVM deploy keys (F4.4) — ⏳ V ARCHIVU (aplikovat při DeFi operacích)
- [x] Nové EVM klíče vygenerovány (3 admin EVM adresy na flash disku)
- [ ] Hardhat `.env` mimo repo, chmod 600 — aplikovat při dalším contract deploy

### 5.3 Bridge validator keys (F4.3) — ⏳ V ARCHIVU (aplikovat při cross-chain)
- [x] 5 EVM validator adres vygenerováno a v bridge config (`bridge-mainnet.toml`)
- [x] Adresy ověřeny proti flash disku — ✅ všech 5 sedí
- [ ] Update validator SK v `/root/zion/edge-environment.sh` (`ZION_BRIDGE_VALIDATOR_SK_1..5`) — aktuálně placeholdery `<REPLACE_EVM_VALIDATOR_SK_*>`
- [ ] Bridge scanner běží (EVM watchers active) ale nemůže mint/unlock bez SKs

### 5.4 Premine + canonical wallets (F4.1 + F4.5) — ✅ HOTOVO (hard reset 2026-07-06)
> Per `docs/3.0.4/GENESIS_HARD_RESET_CANONICAL.md`. **Label-derived adresy mají veřejné klíče — nikdy pro treasury.**
> Hard reset 2026-07-06 proběhl — genesis `4f75a0df...`, všechny 14 premine + 5 canonical + bridge vault + escrow adresy vygenerovány.
- [x] Nové BIP-39 mnemonics pro každý slot (air-gapped, 2026-07-06)
- [x] Mnemonics na flash disk (`/run/media/zionserver/ESD-USB/ZionKeys/zion-keys-2026-07-06/`)
- [x] Encrypted archive: `zion-keys-2026-07-06-encrypted.tar.gz.aes` (AES-256-CBC, passphrase v `passphrase.txt`)
- [x] `PUBLIC_ADDRESSES.txt` — všechny adresy (14 premine + 5 canonical + 3 admin + 7 DAO guardians + 5 EVM validators + escrow + bridge vault)
- [x] `genesis.rs` update — všechny adresy ověřeny proti flash disku ✅
- [x] Genesis hash ověřen: `4f75a0dfe6dde3b167287d445aa1ade56577b0e9166c641ed288b4c20a79bd6e` ✅

### 5.5 Atomic swap escrow (F4.x) — ⏳ V ARCHIVU (aplikovat při swap operacích)
- [x] Escrow adresa vygenerována: `zion192r2p7u427l63545z88538q5t8x0c670k6un3d6`
- [ ] SK aplikován na serveru — aktuálně placeholder `<REPLACE_ESCROW_SK>`
- [ ] Atomic swap služba neběží (není v systemd) — aplikovat při spuštění swap functionality

### Flash disk backup obsah (`/run/media/zionserver/ESD-USB/ZionKeys/zion-keys-2026-07-06/`)
- `PUBLIC_ADDRESSES.txt` — 5883 bytes, všechny veřejné adresy (no mnemonics, no SKs)
- `passphrase.txt` — 45 bytes, base64-encoded passphrase pro encrypted archive
- `zion-keys-2026-07-06-encrypted.tar.gz.aes` — 10064 bytes, AES-256-CBC encrypted (Salted__ header)
- `zion-keys-2026-07-06-encrypted.tar.gz.aes.bak` — 9664 bytes, backup kopie

---

## FÁZE 6 — Historie + síť + finální audit ⏳

### 6.1 BFG/filter-repo git history scrub (F4.6) — ✅ DONE 2026-07-08
> **Destruktivní — vyžaduje plný backup + koordinaci všech collaborators.**
- [x] Backup repa (`/tmp/zion-git-backup-before-scrub`, 1.2G)
- [x] `git filter-repo --replace-text` — odstraněno 87 occurrences (SSH keys + 5 pool SKs) z celé historie
- [x] Force push to origin, origin remote re-added manually
- [ ] Všichni collaborators re-clone (ruční akce ownera)

### 6.2 Tailscale ACL (F2.3) — ✅ VYŘEŠENO JINAK (2026-07-07)
> Tailscale byl při hard resetu na nový server **odstraněn jako attack surface** (commit `87d939c1`). Single-server topologie nepotřebuje VPN — přístup je jen přes SSH klíče + nginx SSL + Basic Auth + UFW (22/80/443). F2.3 tím odpadá.
- [x] Tailscale odstraněn z nového serveru
- [x] Dashboard/monitoring bez Tailscale závislosti

### 6.3 Zbylé advisories (dlouhodobé) — ✅ DONE 2026-07-08
- [x] `bincode 1.x` **odstraněn** z dependency stromu — heed `serde-bincode` feature vypnuta (`default-features = false, features = ["serde", "serde-json"]`), `bincode = "1"` odstraněn z workspace deps. Storage vrstva používá jen `Bytes`/`Str` typy (ne bincode serializaci).
- [x] `metal`/`paste` — metal přesunut na macOS-only target (`[target.'cfg(target_os = "macos")'.dependencies]`), paste se nepullne na Linuxu/Windows. Cargo.lock je cross-platform (entry zůstává), ale runtime exposure = 0 na produkčním Linux serveru.
- [x] `cargo audit` čistý (1 ignored: RUSTSEC-2024-0436 paste — macOS-only, bez runtime expozice)

### 6.4 Finální bezpečnostní kontrola — ✅ DONE 2026-07-08
- [x] `V3/scripts/security-audit.sh` čistý (0 advisories kromě 1 ignored paste macOS-only)
- [x] `cargo test --workspace -- --test-threads=1` zelené (vše PASS, 2 ignored slow PoW)
- [x] Update `docs/security/SECURITY_DISCLOSURE_2026-07.md` o F4.7 remediaci (ZION-2026-006 přidán do katalogu + timeline + remediation status)
- [x] Update `docs/security/vulnerabilities.json` o ZION-2026-006
- [ ] Externí audit genesis konfigurace (před public launch — owner akce)

---

## Invarianty (nikdy neporušit)

1. **L1 consensus změny** jen s explicitním approval ownera (F4.7 schváleno 2026-07-07).
2. **Genesis hash** `4f75a0dfe6dde3b167287d445aa1ade56577b0e9166c641ed288b4c20a79bd6e` se nesmí změnit mimo řízený hard reset.
3. **Fee split 89/5/5/1** je ústavní.
4. **BRIDGE_VAULT_SEED** = `"ZION Bridge Vault V3 Mainnet v2 2026-07-06-HARD-RESET"` — neměnit.
5. Privátní klíče **nikdy** v repu, chatu ani logu — jen air-gapped + flash disk.
6. Binary swap vždy: backup → follower → primary → pool; rollback binárka vždy po ruce.
