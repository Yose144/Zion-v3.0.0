# ZION 3.0.4 — MAX SECURITY PATCH PLAN (kanonický postup)

**Vytvořeno:** 2026-07-07
**Status:** FÁZE 1–2 HOTOVO (code-ready) · FÁZE 3–6 PENDING (aktivace + ops)
**Navazuje na:** `SECURITY_TODO_2026-07-03.md`, `SECURITY_RECOVERY_PLAN_2026-07-03.md`, `SecurityFirst.md`, `HARDRESETOFFICIAL.md`
**Pravidlo:** Tento dokument je jediný zdroj pravdy pro pořadí kroků security patche 3.0.4. Každý krok se odškrtává zde.

---

## Přehled fází

| Fáze | Obsah | Stav | Kdo |
|------|-------|------|-----|
| 1 | Dependency + code hardening (advisories, guardy, timeouty) | ✅ HOTOVO 2026-07-07 | agent |
| 2 | F4.7 Max TX amount cap — implementace (code-ready) | ✅ HOTOVO 2026-07-07 | agent |
| 3 | Git push + Edge rebuild + binary swap | ⏳ PENDING | owner + agent |
| 4 | F4.7 aktivace na mainnetu (koordinovaný hard fork) | ⏳ PENDING | owner |
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

## FÁZE 3 — Push + Edge rebuild + binary swap ⏳

> Provádí owner s asistencí agenta. Edge = `ssh -i ~/.ssh/ssh-key-zion-edge root@77.42.71.94` (Tailscale fallback `100.76.16.108`).

### 3.1 Push do GitHubu

```bash
export PATH=/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin   # git-lfs
git add -A
git commit -m "security(3.0.4): dependency hardening + F4.7 max-tx-amount cap (code-ready)"
git push origin main
```

- [ ] Commit + push proveden
- [ ] CI (pokud běží) zelená

### 3.2 Edge pull + rebuild

```bash
ssh -i ~/.ssh/ssh-key-zion-edge root@77.42.71.94
cd /root/zion-2.9.6-main && git pull origin main
source ~/.cargo/env
cargo build --release --manifest-path V3/Cargo.toml -p zion-core --bin node
cargo build --release --manifest-path V3/Cargo.toml -p zion-pool --bin server
```

- [ ] Build OK na Edge
- [ ] `cargo test --manifest-path V3/Cargo.toml -p zion-core --lib f4_7` OK na Edge

### 3.3 Binary swap (pořadí: node2 → node1 → pool)

> **Před swapem: manuální backup!** Auto-backup je známý problém (height=0). Použít `/usr/local/bin/zion-edge-backup.sh` a ověřit MANIFEST.

```bash
# Backup
/usr/local/bin/zion-edge-backup.sh && ls -la /data/zion/backups/ | tail -3

# Swap node2 (follower — kanárek)
systemctl stop zion-edge-node2
cp V3/target/release/node /usr/local/bin/zion-node2   # dle skutečné cesty v unit filu
systemctl start zion-edge-node2
journalctl -u zion-edge-node2 -n 30 --no-pager   # ověřit sync, žádné erory

# Po 15 min bez problémů: swap node1 (primary)
systemctl stop zion-edge-node1 && cp ... && systemctl start zion-edge-node1

# Pool (kompatibilní protokol se stejnou verzí!)
systemctl restart zion-edge-pool
```

- [ ] node2 swap + 15 min sledování OK
- [ ] node1 swap + sync OK (height roste)
- [ ] pool restart OK, minery se připojují, `SHARE_ACCEPTED` v logu
- [ ] `curl http://127.0.0.1:8443/jsonrpc` → getSupplyInfo odpovídá

**Rollback:** starý binary zálohovaný jako `*-old`; `systemctl stop` → `mv` zpět → `start`. Chain state se nemění (F4.7 je vypnuté).

---

## FÁZE 4 — F4.7 aktivace na mainnetu (koordinovaný hard fork) ⏳

> Stejný proces jako F5 (`ZION_BALANCE_CHECK_HEIGHT=22394`).

### 4.1 Volba aktivační výšky

- Zjistit aktuální height: `curl -s http://127.0.0.1:8443/jsonrpc -d '{"jsonrpc":"2.0","method":"getHeight","id":1}'`
- Aktivace = aktuální height + **~1440 bloků (~24 h)** rezerva.
- Podmínka: aktivace **> migrační height 18 850** (všechny kontrolované částky v 1e6 scale). ✓ splněno automaticky (chain je nad 23 000).

- [ ] Aktivační height zvolen: `H_F47 = ______`

### 4.2 Nasazení env varu na OBOU nodech

```bash
# /etc/systemd/system/zion-edge-node1.service.d/f47.conf (a node2 obdobně)
[Service]
Environment=ZION_MAX_TX_AMOUNT_HEIGHT=<H_F47>

systemctl daemon-reload
systemctl restart zion-edge-node2   # nejdřív follower
# ověřit log: "max_tx_amount_activation_height=<H_F47> (runtime override for F4.7 hard fork)"
systemctl restart zion-edge-node1
```

- [ ] Drop-in na node1 + node2
- [ ] Log potvrzuje aktivační height na obou
- [ ] Po dosažení H_F47: smoke test — TX s absurdní částkou odmítnuta, běžná TX projde

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
- [ ] Update `bridge-validators.conf` drop-in na Edge

### 5.4 Premine + canonical wallets (F4.1 + F4.5) — NEJVYŠŠÍ riziko (consensus!)
> Per `docs/3.0.4/GENESIS_HARD_RESET_CANONICAL.md`. **Label-derived adresy mají veřejné klíče — nikdy pro treasury.**
- [ ] Nové BIP-39 mnemonics pro každý slot (air-gapped)
- [ ] Mnemonics na flash disk (offline záloha ×2)
- [ ] `genesis.rs` update + rebuild + koordinovaný redeploy všech nodů
- [ ] Ověřit genesis hash na obou nodech

---

## FÁZE 6 — Historie + síť + finální audit ⏳

### 6.1 BFG/filter-repo git history scrub (F4.6)
> **Destruktivní — vyžaduje plný backup + koordinaci všech collaborators.**
- [ ] Backup repa (bundle + mirror clone)
- [ ] `git filter-repo --invert-paths --path PREMINE_WALLETS_BACKUP.json` (+ další leaked paths per `V3/scripts/git-filter-repo-leaked-paths-v2.sh`)
- [ ] Force push po dohodě, všichni re-clone

### 6.2 Tailscale ACL (F2.3)
- [ ] Tag-based ACL per `SecurityFirst.md` §F2.3 (admin console)
- [ ] Verify: SSH povolen, RPC 8443 deny z workstation

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
