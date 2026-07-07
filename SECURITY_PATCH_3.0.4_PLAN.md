# ZION 3.0.4 — MAX SECURITY PATCH PLAN (kanonický postup)

**Vytvořeno:** 2026-07-07
**Status:** FÁZE 1–3 HOTOVO (kód nasazen na serveru) · FÁZE 4 STAGED (F4.7 připraven, vypnutý) · FÁZE 5–6 PENDING (ops + air-gapped)
**Navazuje na:** `SECURITY_TODO_2026-07-03.md`, `SECURITY_RECOVERY_PLAN_2026-07-03.md`, `SecurityFirst.md`, `HARDRESETOFFICIAL.md`
**Pravidlo:** Tento dokument je jediný zdroj pravdy pro pořadí kroků security patche 3.0.4. Každý krok se odškrtává zde.

---

## 📡 Skutečný stav serveru `62.171.141.136` (ověřeno 2026-07-07 přes `ssh zion-new`)

| Fakt | Hodnota |
|------|---------|
| Git HEAD | `690b6dfe` (F4.7 commit) — **5 commitů za origin** (canonicalize + dashboard) |
| Binárky | postavené z `690b6dfe` → **F4.7 kód JE v binárce** (`max_tx_amount_activation_height`, seed guard ověřeny přes `strings`) |
| F5 balance check | ✅ **AKTIVNÍ od genesis** (`ZION_BALANCE_CHECK_HEIGHT=0`) |
| F4.7 max-tx cap | ⏸️ **PŘIPRAVENÝ, VYPNUTÝ** (`# export ZION_MAX_TX_AMOUNT_HEIGHT=1440` — zakomentováno v `edge-environment.sh`) |
| Seed peers | `ZION_SEED_PEERS="127.0.0.1:8333"` (single-node → hardcoded default irelevantní) |
| Chain | **height 0** (fresh genesis, premine 16.78B), migration height 1 |
| Mineři | žádní (pool 8444 bez připojení), web v **maintenance mode** → **pre-launch** |
| Služby | 7/7 active (node, pool, bridge, dao, warp, dashboard, nginx) |

**Závěr:** Deploy (Fáze 3) je fakticky hotový. Zbývá jen **aktivovat F4.7** (odkomentovat env + restart) a rozhodnout aktivační výšku pro fresh chain.

---

## Přehled fází

| Fáze | Obsah | Stav | Kdo |
|------|-------|------|-----|
| 1 | Dependency + code hardening (advisories, guardy, timeouty) | ✅ HOTOVO 2026-07-07 | agent |
| 2 | F4.7 Max TX amount cap — implementace (code-ready) | ✅ HOTOVO 2026-07-07 | agent |
| 3 | Push + rebuild + binary swap na nový server | ✅ HOTOVO (server na `690b6dfe`, F4.7 binárky, F5 aktivní) | owner + agent |
| 4 | F4.7 aktivace (odkomentovat env + restart) | ⏸️ STAGED — env připraven, chybí flip | owner |
| 5 | Air-gapped key rotace (F4.1–F4.5) | ⏳ PENDING | owner (air-gapped) |
| 6 | Git history scrub + Tailscale ACL + finální audit | ⏳ PENDING | owner |

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

- [ ] Aktivační height zvolen: `H_F47 = 1` (doporučeno pro fresh chain)

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

- [ ] Env odkomentován + hodnota nastavena na zion-node
- [ ] Log potvrzuje aktivační height
- [ ] Po dosažení H_F47: smoke test — TX s absurdní částkou (> TOTAL_SUPPLY) odmítnuta, běžná TX projde

### 4.3 Dokumentace aktivace

- [ ] Zapsat H_F47 + commit hash do `SECURITY_TODO_2026-07-03.md` a `AGENTS.md` (sekce security hardening)

---

## FÁZE 5 — Air-gapped key rotace (F4.1–F4.5) ⏳

> **Pouze owner, air-gapped stroj.** Agent nesmí generovat ani číst privátní klíče. Pořadí od nejmenšího rizika.

### 5.1 Pool payout SK (F4.2) — nejnižší riziko
- [ ] Nový keypair na air-gapped stroji
- [ ] Update `edge-environment.sh` (chmod 600), restart poolu
- [ ] Verify `derive_address(SK) == ZION_POOL_WALLET`

### 5.2 EVM deploy keys (F4.4)
- [ ] Nové EVM klíče, transfer ownership kontraktů na multisig
- [ ] Hardhat `.env` mimo repo, chmod 600

### 5.3 Bridge validator keys (F4.3)
- [ ] Rotace 5/5 validator keys per `V3/docs/BRIDGE_MULTISIG.md`
- [ ] Update validator SK v `/root/zion/edge-environment.sh` (`ZION_BRIDGE_VALIDATOR_SK_1..5`) na novém serveru

### 5.4 Premine + canonical wallets (F4.1 + F4.5) — NEJVYŠŠÍ riziko (consensus!)
> Per `docs/3.0.4/GENESIS_HARD_RESET_CANONICAL.md`. **Label-derived adresy mají veřejné klíče — nikdy pro treasury.**
> Pozn.: hard reset 2026-07-06 už proběhl (genesis `4f75a0df...`), takže tato fáze je jen pro případnou další rotaci, ne pro iniciální reset.
- [ ] Nové BIP-39 mnemonics pro každý slot (air-gapped)
- [ ] Mnemonics na flash disk (offline záloha ×2)
- [ ] `genesis.rs` update + rebuild + redeploy na novém serveru
- [ ] Ověřit genesis hash

---

## FÁZE 6 — Historie + síť + finální audit ⏳

### 6.1 BFG/filter-repo git history scrub (F4.6)
> **Destruktivní — vyžaduje plný backup + koordinaci všech collaborators.**
- [ ] Backup repa (bundle + mirror clone)
- [ ] `git filter-repo --invert-paths --path PREMINE_WALLETS_BACKUP.json` (+ další leaked paths per `V3/scripts/git-filter-repo-leaked-paths-v2.sh`)
- [ ] Force push po dohodě, všichni re-clone

### 6.2 Tailscale ACL (F2.3) — ✅ VYŘEŠENO JINAK (2026-07-07)
> Tailscale byl při hard resetu na nový server **odstraněn jako attack surface** (commit `87d939c1`). Single-server topologie nepotřebuje VPN — přístup je jen přes SSH klíče + nginx SSL + Basic Auth + UFW (22/80/443). F2.3 tím odpadá.
- [x] Tailscale odstraněn z nového serveru
- [x] Dashboard/monitoring bez Tailscale závislosti

### 6.3 Zbylé advisories (dlouhodobé)
- [ ] Serializační roadmapa: náhrada `bincode 1.x` (transitive přes `heed-types`) — plánovaná migrace storage vrstvy, samostatný PR
- [ ] Sledovat `metal` ekosystém (transitive `paste`)

### 6.4 Finální bezpečnostní kontrola
- [ ] `V3/scripts/security-audit.sh` čistý
- [ ] `cargo test --workspace -- --test-threads=1` zelené
- [ ] Externí audit genesis konfigurace (před public launch)
- [ ] Update `docs/security/SECURITY_DISCLOSURE_2026-07.md` o F4.7 remediaci

---

## Invarianty (nikdy neporušit)

1. **L1 consensus změny** jen s explicitním approval ownera (F4.7 schváleno 2026-07-07).
2. **Genesis hash** `4f75a0dfe6dde3b167287d445aa1ade56577b0e9166c641ed288b4c20a79bd6e` se nesmí změnit mimo řízený hard reset.
3. **Fee split 89/5/5/1** je ústavní.
4. **BRIDGE_VAULT_SEED** = `"ZION Bridge Vault V3 Mainnet v2 2026-07-06-HARD-RESET"` — neměnit.
5. Privátní klíče **nikdy** v repu, chatu ani logu — jen air-gapped + flash disk.
6. Binary swap vždy: backup → follower → primary → pool; rollback binárka vždy po ruce.
