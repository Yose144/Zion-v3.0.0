# ZION V3 — Official Hard Reset Plan

> **Verze:** 1.2 — 2026-07-07
> **Status:** EXECUTING — Fáze 0-8 DONE · Fáze 5 AUDITOVÁNO 2026-07-09 (key rotace proběhla, flash backup OK, pool payout SK aplikován, EVM/escrow placeholdery) · Security patch 3.0.4 FÁZE 1-6 HOTOVO (F4.7 aktivní, bincode odstraněn, audit čistý, edge rebuild 2026-07-09) · Fáze 9-10 pending (open-source publication, generační převod) · 3-node P2P mesh (Edge primary + follower + local backup, height 270+)
> **Kanonický postup:** [`docs/3.0.4/GENESIS_HARD_RESET_CANONICAL.md`](./docs/3.0.4/GENESIS_HARD_RESET_CANONICAL.md) — TENTO dokument je operační plán; kanonický runbook je v docs/3.0.4/.
> **Security disclosure:** [`docs/security/SECURITY_DISCLOSURE_2026-07.md`](./docs/security/SECURITY_DISCLOSURE_2026-07.md) — veřejný bulletin ve formátu Ethereum Foundation.
> **Kontext:** Post-security-incident (F1 + F5 + TeamViewer compromise). Attacker měl 47 min root na Edge, přístup ke zdrojákům, SSH klíčům, pool payout SK, escrow key, EVM deploy klíčům, DAO guardian mnemonics.
> **Cíl:** Kompletní hard reset ZION V3 mainnetu od Genesis #0 s novými klíči, novým serverem, bez kompromitovaného materiálu.
>
> ### Update 2026-07-07 — Nový Server Deployed
>
> **Nový server:** `62.171.141.136` (Ubuntu 24.04.4 LTS, 4× AMD EPYC, 7.8 GB RAM, 145 GB disk)
> **Nový genesis hash:** `4f75a0dfe6dde3b167287d445aa1ade56577b0e9166c641ed288b4c20a79bd6e` ✅
>
> **Deployované služby (všech 7 aktivních + enabled na boot):**
> - zion-node (P2P 8333, RPC 127.0.0.1:8443, WS 127.0.0.1:8445, metrics 127.0.0.1:9100)
> - zion-pool (Stratum 0.0.0.0:8444)
> - zion-bridge (metrics 127.0.0.1:9101)
> - zion-dao (API 127.0.0.1:8450)
> - zion-warp (0.0.0.0:9333)
> - zion-dashboard (127.0.0.1:8766, Basic Auth)
> - nginx (80/443, SSL Let's Encrypt, HTTP/2, reverse proxy)
>
> **Web:** `https://zionterranova.com` — plný Next.js 16.2.9 web (Docker `zion-web:nextjs`, 73+ routes)
> **Dashboard:** `https://dashboard.zionterranova.com` — ZION_OS Dashboard (Python3, Basic Auth)
>
> **Chain stav:** Height 0 (fresh genesis), premine 16.78B ZION, block reward 5400.067 ZION, fee split 89/5/5/1
>
> **OS hardening:** SSH klíče-only, UFW (22/80/443), fail2ban, Docker 29.6.1
> **Monitoring:** 3 cron jobs + systemd watchdog timer (2 min)
> **SSL:** Let's Encrypt (zionterranova.com, www.zionterranova.com, dashboard.zionterranova.com) — auto-renew
>
> **Starý Edge server (77.42.71.94):** DECOMMISSIONED
>
> **Pending (owner akce):**
> 1. Air-gapped klíče (pool SK, bridge validator SKs, DAO guardian SKs, escrow key) — `<REPLACE_*>` v `edge-environment.sh`
> 2. Minery — připojit k `62.171.141.136:8444`
> 3. DNS aplikace — `dns.md` zónový soubor v Webglobe admin console
> 4. F4.7 aktivace — `ZION_MAX_TX_AMOUNT_HEIGHT`
> 5. Key rotation F4.x — premine, pool, bridge, EVM (air-gapped)
> 6. Git history scrub — BFG pro staré commity s secrets

---

## TL;DR — Co se resetuje

| Vrstva | Komponenta | Akce |
|--------|-----------|------|
| L1 | Genesis block (14 premine + 5 canonical) | **REGENERATE** — nové adresy, nový hash |
| L1 | Bridge vault seed | **REGENERATE** — nový seed → nová vault adresa |
| L1 | Všechny node DBs (Edge N1, N2, local) | **WIPE** — start od height 0 |
| L2 Bridge | Validator EVM klíče (5×) | **REVOKE** + nové klíče (později) |
| L2 Bridge | Bridge relay config + SQLite DB | **UPDATE** + **WIPE** |
| L2 DAO | Treasury adresy (3×) + guardian multisig | **REGENERATE** — noví guardians |
| L2 DAO | DAO SQLite DB | **WIPE** |
| L2 Atomic Swap | Escrow key + EVM HTLC contract | **REGENERATE** + nový contract (později) |
| L2 Atomic Swap | Atomic swap SQLite DB | **WIPE** |
| L3 WARP | Vault adresa + SQLite DB | **UPDATE** + **WIPE** |
| EVM | wZION + ZIONBridge na 6 chainech | **REVOKE validators** (pokud možno), kontrakty abandon |
| Infra | Starý Edge server | **IZOLOVAT** — forenzní důkaz pro NCOZ |
| Infra | Nový server | **CREATE** — fresh OS, clean deploy |
| Infra | SSH klíče (všechny) | **ROTATE** — staré smazat, nové generovat |
| Docs | PREMINE_ADDRESSES_PUBLIC.txt, AGENTS.md, runbooky | **UPDATE** |

---

## Phase 0: Pre-flight (T0)

### 0.1 Bezpečnost stroje pro generování klíčů

- [ ] **Tailscale DOWN** na zionserver-144 (`sudo tailscale down`) — DONE
- [ ] Overit žádné suspicious procesy: `ps aux | grep -iE "teamviewer|anydesk|vnc|reverse|ncat"`
- [ ] Overit network connections: `ss -tunap | grep ESTAB`
- [ ] Overit žádné unknown cron jobs: `crontab -l; ls /etc/cron.d/`
- [ ] **POZNÁMKA:** Tento stroj NENÍ truly air-gapped. Je na Tailscale síti (nyní down). Riziko: pokud má útočník persistenci, klíče můžou být kompromitovány. Mitigace: klíče generujeme, pak ihned šifrujeme a ukládáme na offline media.

### 0.2 Backup aktuálního stavu

- [ ] Git tag: `git tag -a PRE_RESET_2026-07-03 -m "State before hard reset"`
- [ ] Backup genesis.rs: `cp V3/L1/core/src/genesis.rs V3/L1/core/src/genesis.rs.prereset`
- [ ] Backup crypto.rs: `cp V3/L1/core/src/crypto.rs V3/L1/core/src/crypto.rs.prereset`
- [ ] Backup všech L2/L3 configů: `tar czf /tmp/l2l3-configs-backup.tar.gz V3/L2/*/config/ V3/L3/*/config/`
- [ ] Zaznamenat aktuální genesis hash: `7543004c76b11416ef32e2f1f5a4c72f0178f841d4559bf476e29e15a9602728`

### 0.3 Edge server — forenzní záloha (POZDĚJI, až budeme mít přístup)

- [ ] SSH na starý Edge (až Tailscale bude up)
- [ ] Zálohovat: `/var/lib/zion/*.db`, `/root/zion-2.9.6-main/edge-environment.sh`, systemd unity, logy
- [ ] Uložit do `/root/zion-backups/forensic-2026-07-03/`
- [ ] **NEwipovat** — zachovat pro NCOZ police report

---

## Phase 1: Generování všech nových klíčů (T0+)

### 1.1 Premine wallets (14× Ed25519)

**Nástroj:** `V3/target/release/gen-premine-wallets` (již builděno)

```bash
mkdir -p /home/zionserver/zion-keys-2026-07-03
cd /home/zionserver/2.9.6-main
V3/target/release/gen-premine-wallets > /home/zionserver/zion-keys-2026-07-03/premine-wallets.json
```

**Výstup:** 14 objektů s `slot`, `address`, `public_key_hex`, `secret_key_hex`

**Slot mapping (zachovat stejné účely a částky):**

| Slot | Category | Purpose | Amount (ZION) |
|------|----------|---------|---------------|
| 1 | oasis_golden_egg | OASIS + Golden Egg (Slot 1) | 1,650,000,000 |
| 2 | oasis_golden_egg | OASIS + Golden Egg (Slot 2) | 1,650,000,000 |
| 3 | oasis_golden_egg | OASIS + Golden Egg (Slot 3) | 1,650,000,000 |
| 4 | oasis_golden_egg | OASIS + Golden Egg (Slot 4) | 1,650,000,000 |
| 5 | oasis_golden_egg | OASIS + Golden Egg (Slot 5) | 1,650,000,000 |
| 6 | dao_treasury | Community Governance (main) | 2,500,000,000 |
| 7 | dao_treasury | Grants & Bounties | 1,000,000,000 |
| 8 | dao_treasury | Ecosystem Bootstrap | 500,000,000 |
| 9 | infrastructure | Core Development Fund | 1,000,000,000 |
| 10 | infrastructure | Network Infrastructure — P2P Seed Nodes | 1,000,000,000 |
| 11 | infrastructure | Genesis Projects — Dharma Temple, Piko de Ora + DAO | 590,000,000 |
| 12 | humanitarian | Children Future Fund | 1,440,000,000 |
| 13 | bridge_seed | Bridge Seed Fund — EVM Bridge Liquidity | 400,000,000 |
| 14 | bridge_vault_utxo | Bridge Vault UTXO Seed | 100,000,000 |

**Total:** 16,780,000,000 ZION (neměnit)

### 1.2 Canonical subsidy wallets (5× Ed25519)

**Kritické rozhodnutí:** Aktuálně jsou canonical wallets v `genesis.rs` z **offline mnemonic seeds** (ne label-derived). To je bezpečnější. Pro reset generujeme **fresh OS-random keys** (ne label-derived, protože label-derived klíče jsou rekonstruovatelné z repo).

```bash
# 5× generate_keypair() — jeden pro každou roli
V3/target/release/gen-pool-payout-wallet > /home/zionserver/zion-keys-2026-07-03/pool-payout.json
# Pro humanitarian, issobella, pool-fee, default-miner — použijeme gen-keys.rs nebo upravíme
```

**5 canonical rolí:**

| Role | Konstanta v genesis.rs | SK storage |
|------|----------------------|------------|
| Humanitarian subsidy (5%) | `MAINNET_CANONICAL_HUMANITARIAN_SUBSIDY_WALLET` | offline |
| Issobella subsidy (5%) | `MAINNET_CANONICAL_ISSOBELLA_SUBSIDY_WALLET` | offline |
| Pool fee subsidy (1% burn) | `MAINNET_CANONICAL_POOL_FEE_SUBSIDY_WALLET` | offline (burn adresu, SK nepotřebuje) |
| Default miner (89% fallback) | `MAINNET_CANONICAL_DEFAULT_MINER_WALLET` | offline |
| Pool payout (PPLNS signer) | `MAINNET_CANONICAL_POOL_PAYOUT_WALLET` | Edge systemd env (šifrované) |

### 1.3 Bridge vault seed (keyless)

**Aktuálně:** `BRIDGE_VAULT_SEED = "ZION Bridge Vault V3 Mainnet v2 2026-07-06-HARD-RESET"` → `zion1j53677g5k83030x3s2z2z644e7h07792q0u02t7`

**Nový seed:** `"ZION Bridge Vault V3 Mainnet v2 2026-07-03-HARD-RESET"` → nová keyless adresa

**Update:** `V3/L1/core/src/crypto.rs` řádek 176

```rust
pub const BRIDGE_VAULT_SEED: &str = "ZION Bridge Vault V3 Mainnet v2 2026-07-03-HARD-RESET";
```

**Poznámka:** Bridge vault je keyless — žádný SK. UTXO se odemykají bridge konsenzem (validator signatures).

### 1.4 Pool payout signing key

**Nástroj:** `V3/target/release/gen-pool-payout-wallet`

```bash
V3/target/release/gen-pool-payout-wallet > /home/zionserver/zion-keys-2026-07-03/pool-payout.json
```

**SK hex** půjde do `ZION_POOL_PAYOUT_SK_HEX` env var na novém serveru.

### 1.5 EVM validator klíče (5× secp256k1)

**Použijeme `cast` (Foundry) nebo `openssl`:**

```bash
# 5 nových EVM keypairů
for i in 1 2 3 4 5; do
  KEY=$(openssl rand -hex 32)
  ADDR=$(cast wallet address "$KEY" 2>/dev/null || python3 -c "from eth_keys import keys; k=keys.PrivateKey(bytes.fromhex('$KEY')); print(k.public_key.to_checksum_address())")
  echo "validator-$i: $ADDR  SK=$KEY" >> /home/zionserver/zion-keys-2026-07-03/evm-validators.txt
done
```

**5 validator adres** půjde do:
- `V3/L2/bridge/config/bridge-mainnet.toml` → `validator_addresses`
- Nové `ZIONBridge.sol` constructor (až se bude deploy nový kontrakt)

### 1.6 DAO guardian klíče (7× Ed25519, 5-of-7 multisig)

```bash
# 7 nových guardian keypairů
for i in 1 2 3 4 5 6 7; do
  V3/target/release/gen-pool-payout-wallet | sed "s/pool_payout/guardian-$i/" >> /home/zionserver/zion-keys-2026-07-03/dao-guardians.json
done
```

**7 guardian adres** půjde do `dao-mainnet.toml` `[[guardians]]` sekce.

### 1.7 Atomic swap escrow key (1× Ed25519)

```bash
V3/target/release/gen-pool-payout-wallet | sed "s/pool_payout/escrow/" > /home/zionserver/zion-keys-2026-07-03/escrow.json
```

**SK hex** půjde do `ZION_SWAP_ESCROW_KEY` env var.

### 1.8 SSH klíče (nový server)

```bash
ssh-keygen -t ed25519 -f /home/zionserver/.ssh/zion-newserver-20260703 -C "zion-newserver-2026-07-03"
```

### 1.9 Šifrování a uložení klíčů

```bash
# AES-256-GCM šifrování
PASSPHRASE=$(openssl rand -base64 32)
echo "$PASSPHRASE" > /home/zionserver/zion-keys-2026-07-03/passphrase.txt
chmod 600 /home/zionserver/zion-keys-2026-07-03/passphrase.txt

tar czf - /home/zionserver/zion-keys-2026-07-03/ | \
  openssl enc -aes-256-gcm -salt -pbkdf2 -pass file:/home/zionserver/zion-keys-2026-07-03/passphrase.txt \
  -out /home/zionserver/zion-keys-2026-07-03-encrypted.tar.gz.aes

# Secure erase plaintext (po ověření že šifrovaná verze funguje)
shred -vfz -n 3 /home/zionserver/zion-keys-2026-07-03/*.json /home/zionserver/zion-keys-2026-07-03/*.txt
```

**Uložení:**
- Encrypted archive → USB flash disk (offline)
- Passphrase → paper backup (jiné fyzické místo)
- Metal plate → seed phrase pro pool payout (long-term cold storage)

---

## Phase 2: Update genesis.rs (T1)

### 2.1 Nové canonical labels (v2)

V `V3/L1/core/src/genesis.rs` aktualizovat 4 label konstanty:

```rust
pub const MAINNET_CANONICAL_ISSOBELLA_SUBSIDY_LABEL: &str =
    "ZION_V3_MAINNET_CANONICAL_ISSOBELLA_SUBSIDY_RECIPIENT_v2_2026-07-03-HARD-RESET";
pub const MAINNET_CANONICAL_POOL_FEE_SUBSIDY_LABEL: &str =
    "ZION_V3_MAINNET_CANONICAL_POOL_FEE_SUBSIDY_RECIPIENT_v2_2026-07-03-HARD-RESET";
pub const MAINNET_CANONICAL_DEFAULT_MINER_LABEL: &str =
    "ZION_V3_MAINNET_CANONICAL_DEFAULT_SOLO_MINER_COINBASE_v2_2026-07-03-HARD-RESET";
pub const MAINNET_CANONICAL_POOL_PAYOUT_LABEL: &str =
    "ZION_V3_MAINNET_CANONICAL_POOL_PPLNS_PAYOUT_SIGNER_v2_2026-07-03-HARD-RESET";
```

**ALE:** Canonical wallets v genesis.rs jsou z offline mnemonic seeds, NE label-derived. Takže label update je jen pro dokumentační účely. Skutečné adresy se nahradí za nové z Phase 1.2.

### 2.2 Nové canonical wallet adresy

```rust
pub const MAINNET_CANONICAL_HUMANITARIAN_SUBSIDY_WALLET: &str = "NEW_HUMANITARIAN_ADDR";
pub const MAINNET_CANONICAL_ISSOBELLA_SUBSIDY_WALLET: &str = "NEW_ISSOBELLA_ADDR";
pub const MAINNET_CANONICAL_POOL_FEE_SUBSIDY_WALLET: &str = "NEW_POOL_FEE_ADDR";
pub const MAINNET_CANONICAL_DEFAULT_MINER_WALLET: &str = "NEW_DEFAULT_MINER_ADDR";
pub const MAINNET_CANONICAL_POOL_PAYOUT_WALLET: &str = "NEW_POOL_PAYOUT_ADDR";
```

### 2.3 Nové premine adresy (14×)

Nahradit všech 14 `address` polí v `PREMINE_OUTPUTS` za nové z Phase 1.1. **Částky a kategorie zůstávají stejné.**

### 2.4 Nový bridge vault seed

V `V3/L1/core/src/crypto.rs`:

```rust
pub const BRIDGE_VAULT_SEED: &str = "ZION Bridge Vault V3 Mainnet v2 2026-07-03-HARD-RESET";
```

### 2.5 Rebuild + nový genesis hash

```bash
cargo build --release --manifest-path V3/Cargo.toml -p zion-core --bin get-genesis-hash
V3/target/release/get-genesis-hash
# → NEW_GENESIS_HASH: <zaznamenat>
```

### 2.6 Testy

```bash
cargo test --manifest-path V3/Cargo.toml -p zion-core genesis
# Očekáváno: premine_has_14_outputs, premine_totals_validate, premine_total_is_16_78b_zion PASS
```

---

## Phase 3: Update L2/L3 configs (T1)

### 3.1 Bridge config (`V3/L2/bridge/config/bridge-mainnet.toml`)

```toml
[l1]
bridge_address = "NEW_BRIDGE_VAULT_ADDR"  # z Phase 1.3

[validator]
validator_addresses = [
    "NEW_EVM_VALIDATOR_1",
    "NEW_EVM_VALIDATOR_2",
    "NEW_EVM_VALIDATOR_3",
    "NEW_EVM_VALIDATOR_4",
    "NEW_EVM_VALIDATOR_5",
]
```

### 3.2 DAO config (`V3/L2/dao/config/dao-mainnet.toml`)

```toml
treasury_addresses = [
    "NEW_PREMINE_SLOT_6",   # Community Governance — 2.5B
    "NEW_PREMINE_SLOT_7",   # Grants & Bounties — 1.0B
    "NEW_PREMINE_SLOT_8",   # Ecosystem Bootstrap — 0.5B
]

# Noví guardians (5-of-7)
[[guardians]]
name = "guardian-1"
address = "NEW_GUARDIAN_1"
public_key = "NEW_PK_1"
# ... 7×
```

### 3.3 Atomic swap config (`V3/L2/atomic-swap/config/swap-mainnet.toml`)

```toml
[l1]
# escrow_key_hex se nastavuje přes ZION_SWAP_ESCROW_KEY env var (nový z Phase 1.7)
```

**EVM HTLC contract:** Starý `0x3DE9Ad42716854083ab837706E3961d10B0e63Eb` bude abandon. Nový se deploy až bridge restartuje.

### 3.4 WARP config (`V3/L3/warp/config/warp-mainnet.toml`)

```toml
l1_vault_address = "NEW_BRIDGE_VAULT_ADDR"  # z Phase 1.3
```

### 3.5 Edge environment (`edge-deploy/config/edge-environment.sh`)

```bash
export ZION_MINER_ADDRESS="NEW_DEFAULT_MINER_ADDR"
export ZION_HUMANITARIAN_WALLET="NEW_HUMANITARIAN_ADDR"
export ZION_ISSOBELLA_WALLET="NEW_ISSOBELLA_ADDR"
export ZION_POOL_FEE_BURN_PCT=1
export ZION_POOL_PAYOUT_SK_HEX="NEW_POOL_PAYOUT_SK"
export ZION_SWAP_ESCROW_KEY="NEW_ESCROW_SK"
export ZION_NETWORK="Mainnet"
export ZION_SEED_PEERS="127.0.0.1:8333"
```

---

## Phase 4: EVM kontrakty — revoke validators (T1)

### 4.1 Situace

- **wZION** (`0x0c493763d107ab0ABb0aee1Ca3999292d8202bb6`) — deployováno na 6 chainech
- **ZIONBridge** — `0x72c8f0Dc...` (Base), `0xa5a09b2C...` (ostatních 5)
- **5 validator EVM adres** — kompromitované
- **Deployer/admin key** (`0xdde17506...`) — kompromitované
- **Žádní externí uživatelé** — jen bridge seed fund

### 4.2 Problém

Admin key je kompromitovaný. Útočník může:
- Re-add validators i když je revoke
- Pause/unpause kontrakty
- Mint wZION (pokud má validator role)

### 4.3 Akce

**Priorita 1: Revoke compromised validators** (pokud máme ještě admin key přístup)

```bash
# Pro každý z 6 chainů
cast send $BRIDGE_CONTRACT "removeValidator(address)" $COMPROMISED_VALIDATOR \
  --rpc-url $RPC_URL --private-key $ADMIN_KEY
```

**Priorita 2: Pause kontrakty** (pokud revoke nefunguje)

```bash
cast send $BRIDGE_CONTRACT "pause()" --rpc-url $RPC_URL --private-key $ADMIN_KEY
```

**Priorita 3: Abandon** — pokud admin key nefunguje (útočník ho změnil), kontrakty jsou orphaned. Nové kontrakty se deplo až bridge restartuje.

### 4.4 Pozdější: Nové EVM kontrakty

Až bridge bude restartovat (po L1 stabilizaci):
- Deploy nové wZION + ZIONBridge na 6 chainech
- Nové validator adresy (z Phase 1.5)
- Nový admin key (multisig, ne single key)
- Migrace bridge seed fund liquidity (400M ZION) na nový bridge vault

---

## Phase 5: Nový server (T2 — paralelně)

### 5.1 Vytvořit nový server

- Fresh OS (Ubuntu 24.04 LTS nebo Debian 12)
- Dedibox / Hetzner / OVH — cokoliv čerstvého
- **NEpoužívat** starý Edge server
- Root SSH only s novým klíčem (z Phase 1.8)

### 5.2 Hardening

```bash
# UFW — jen potřebné porty
ufw default deny incoming
ufw default allow outgoing
ufw allow 22/tcp        # SSH (později omezit na Tailscale only)
ufw allow 8333/tcp      # P2P
ufw allow 8443/tcp      # RPC (jen Tailscale)
ufw enable

# SSH — jen key auth, no root login (nebo root s Tailscale only)
sed -i 's/PermitRootLogin yes/PermitRootLogin prohibit-password/' /etc/ssh/sshd_config
sed -i 's/#PasswordAuthentication yes/PasswordAuthentication no/' /etc/ssh/sshd_config
systemctl restart sshd

# Fail2ban
apt install -y fail2ban
```

### 5.3 Tailscale

```bash
curl -fsSL https://tailscale.com/install.sh | sh
tailscale up --ssh
```

### 5.4 Deploy ZION stack

```bash
# Clone repo
git clone https://github.com/Yose144/Zion-v3.0.0.git /root/zion-2.9.6-main
cd /root/zion-2.9.6-main
git checkout main  # s novými klíči z Phase 2-3

# Build
source /root/.cargo/env
cd V3
cargo build --release --workspace

# Install systemd units
cd /root/zion-2.9.6-main/edge-deploy
./setup-edge.sh

# Set environment
cp edge-environment.sh /etc/zion/edge-environment.sh
# Edit with new keys from Phase 3.5
```

---

## Phase 6: Hard reset L1 (T3)

### 6.1 Stop ALL services (všude)

**Starý Edge (až budeme mít přístup):**
```bash
systemctl stop zion-edge-*
killall -9 zion-miner zion-node zion-pool-serve zion-bridge zion-dao zion-atomic-swap zion-warp-server
```

**Local:**
```bash
# Kill any local ZION processes
pkill -f "zion\|target/release/node\|target/release/server"
```

**Nový server:** (ještě nic neběží, OK)

### 6.2 Wipe ALL DBs

**Starý Edge:**
```bash
rm -f /var/lib/zion/*.db* /var/lib/zion/*.json
rm -f /root/zion-2.9.6-main/V3/data/*.db*
```

**Local:**
```bash
rm -f /home/zionserver/2.9.6-main/V3/data/*.db*
```

**Nový server:** (čistý, OK)

### 6.3 Build na novém serveru

```bash
cd /root/zion-2.9.6-main/V3
cargo build --release --workspace
```

### 6.4 Izolovaný start node1 (bez seed peers)

```bash
# Dočasně zakomentovat ZION_SEED_PEERS v systemd unit
systemctl start zion-edge-node1
sleep 5
journalctl -u zion-edge-node1 -n 30 --no-pager
```

### 6.5 Verifikace Genesis #0

```bash
curl -s -X POST -H 'Content-Type: application/json' \
  -d '{"jsonrpc":"2.0","method":"getChainInfo","params":{},"id":1}' \
  http://127.0.0.1:8443 | python3 -c "
import sys,json
r=json.load(sys.stdin)['result']
assert r['height']==0, 'FAIL: height != 0'
assert r['accepted_blocks']==1, 'FAIL: accepted != 1'
assert r['tip_hash']=='NEW_GENESIS_HASH', 'FAIL: wrong genesis hash'
print('Genesis #0 OK')
"
```

### 6.6 Obnovit seed peers + start node2

```bash
# Obnovit ZION_SEED_PEERS v systemd
systemctl daemon-reload
systemctl restart zion-edge-node1
sleep 3
systemctl start zion-edge-node2
```

### 6.7 Start pool + L2/L3

```bash
systemctl start zion-edge-pool
systemctl start zion-edge-bridge zion-edge-dao zion-edge-atomic-swap zion-edge-warp
systemctl start zion-edge-agent zion-edge-dashboard
```

---

## Phase 7: Verifikace (T3+)

### 7.1 Genesis hash
- [ ] `getChainInfo` → `tip_hash` == `NEW_GENESIS_HASH`
- [ ] `height` == 0, `accepted_blocks` == 1

### 7.2 Premine balances
- [ ] 14 adres má správné balances (16.78B ZION total)
- [ ] Bridge vault UTXO — 6 outputs, 100M ZION

### 7.3 Fee split (po prvním bloku)
- [ ] 89% miner / 5% humanitarian / 5% issobella / 1% burn

### 7.4 Pool
- [ ] Pool naslouchá na 8444
- [ ] Pool payout address == nová canonical

### 7.5 L2/L3 services
- [ ] Bridge — `bridge_address` == nová vault
- [ ] DAO — `treasury_addresses` == nové premine sloty 6,7,8
- [ ] Atomic swap — escrow key funkční
- [ ] WARP — `l1_vault_address` == nová vault

### 7.6 EVM
- [ ] Staré kontrakty — validators revoked (nebo paused, nebo abandoned)
- [ ] Žádné nové mint TX na starých kontraktech

### 7.7 Security
- [ ] Tailscale ACL — jen nový server
- [ ] SSH — jen nový klíč
- [ ] UFW — aktivní
- [ ] fail2ban — aktivní
- [ ] Žádné kompromitované klíče v systemd / env / config

---

## Phase 8: Dokumentace (T4)

### 8.1 Update souborů

- [ ] `PREMINE_ADDRESSES_PUBLIC.txt` — nové adresy
- [ ] `V3/docs/mainnet/PREMINE_AND_CANONICAL_WALLETS_PUBLIC.txt` — nové canonical
- [ ] `AGENTS.md` — nový genesis hash, nové adresy, reset note
- [ ] `V3/L1/core/src/genesis.rs` — komentáře s novými daty
- [ ] `V3/L2/bridge/config/bridge-mainnet.toml` — nové adresy
- [ ] `V3/L2/dao/config/dao-mainnet.toml` — nové adresy
- [ ] `V3/L3/warp/config/warp-mainnet.toml` — nová vault
- [ ] `edge-deploy/config/edge-environment.sh` — nové env vars
- [ ] `HARDRESETOFFICIAL.md` — status → COMPLETED

### 8.2 Git commit

```bash
git add -A
git commit -m "feat(hard-reset): complete genesis regeneration 2026-07-03

- 14 new premine addresses (OS-random Ed25519)
- 5 new canonical subsidy wallets (OS-random Ed25519)
- New bridge vault seed (keyless)
- 5 new EVM validator addresses
- 7 new DAO guardian addresses
- New atomic swap escrow key
- New pool payout signing key
- Old EVM contracts: validators revoked
- All node DBs wiped
- New genesis hash: <NEW_HASH>
- Old Edge server: isolated for forensic evidence

Generated with [Devin](https://cli.devin.ai/docs)

Co-Authored-By: Devin <158243242+devin-ai-integration[bot]@users.noreply.github.com>"
```

### 8.3 History scrub — ✅ DONE (2026-07-08)

Po resetu byl proveden scrub git historie pro:
- Staré premine adresy (i když kompromitované, nechceme je v historii)
- Staré canonical adresy
- Starý bridge vault seed
- Jakékoliv SK které se mohly dostat do commitů

```bash
# Použito git filter-repo (NE BFG — méně bezpečný)
pip install git-filter-repo
git filter-repo --replace-text expressions.txt
```

**Výsledek (2026-07-08):** 87 secret occurrences odstraněno (SSH klíče + 5 různých pool SKs) z celé git historie. Force push to origin. Backup v `/tmp/zion-git-backup-before-scrub` (1.2G). Všichni collaborators musí re-clone.

**Pozor:** Toto je destruktivní operace — vyžaduje explicitní approval.

---

## Rollback Plan

Pokud reset selže:

1. **Před resetem:** `git tag PRE_RESET_2026-07-03` (Phase 0.2)
2. **Restore:** `git checkout PRE_RESET_2026-07-03 -- V3/L1/core/src/genesis.rs V3/L1/core/src/crypto.rs`
3. **Rebuild + restart** se starým genesis (kompromitovaným, ale funkčním)
4. **Emergency:** Pokud nový server nefunguje, vrátit se na starý Edge (dočasně, dokud se nevyřeší)

---

## Risk Assessment

| Risk | Probability | Impact | Mitigace |
|------|-------------|--------|----------|
| Klíče kompromitovány během generování (Tailscale down ale stroj infikován) | Medium | Critical | Generovat rychle, ihned šifrovat, offline backup |
| EVM admin key už changed attackerem | High | Medium | Kontrakty abandon, deploy nové později |
| Nový server není ready | Medium | Low | Klíče a code changes nezávislé na serveru |
| Genesis hash mismatch mezi nody | Low | High | Izolovaný start node1, verify před sync |
| DAO treasury lock height (144,000) — nové sloty se neodemknou | Low | Medium | Lock height se zachovává, jen adresy se mění |
| Bridge vault UTXO — nová adresa, staré UTXO na starém chainu zmizí | Certain | Low | Starý chain se abandon, nový chain má nové UTXO v genesis |
| Forenzní důkazy na starém Edge zničeny | Low | High | Zálohovat před jakoukoliv akcí na Edge |

---

## Timeline (orientační)

| Fáze | Trvání | Závislost |
|------|--------|-----------|
| Phase 0: Pre-flight | 30 min | — |
| Phase 1: Generování klíčů | 1-2 h | Phase 0 |
| Phase 2: Update genesis.rs | 1 h | Phase 1 |
| Phase 3: Update L2/L3 configs | 30 min | Phase 1, 2 |
| Phase 4: EVM revoke | 30 min | EVM admin key |
| Phase 5: Nový server | paralelně | nezávislé |
| Phase 6: Hard reset L1 | 1-2 h | Phase 2, 3, 5 |
| Phase 7: Verifikace | 1 h | Phase 6 |
| Phase 8: Dokumentace | 30 min | Phase 7 |

**Celkem:** ~6-8 h (pokud nový server je ready paralelně)

---

## Open Questions (vyžaduje rozhodnutí)

1. **Canonical wallets — OS-random nebo label-derived?**
   - OS-random: bezpečnější, SK musí být offline
   - Label-derived: rekonstruovatelné z repo, vhodné pro burn adresy (pool fee)
   - **Doporučení:** OS-random pro humanitarian/issobella/default-miner/pool-payout. Label-derived OK pro pool-fee (burn, nepotřebuje SK).

2. **DAO guardian threshold — 5-of-7 nebo změnit?**
   - Aktuálně 5-of-7. Doporučuji zachovat.

3. **EVM HTLC contract (atomic swap) — redeploy nebo abandon?**
   - Atomic swap není kritický pro genesis reset. Může se redeploy později.

4. **Starý Edge — kdy wipe?**
   - Až NCOZ případ uzavře. Do té doby izolovaný (offline).

5. **Git history scrub — kdy?**
   - Po resetu, jako separátní úkol. Vyžaduje explicitní approval (destruktivní).

---

## Phase 9: Open-Source Transition (postupně, po hard resetu)

### 9.1 Rozhodnutí

**Zveřejnit:** Jen protokol (V3/L1-L3 + bridge kontrakty + whitepaper)
**Ponechat private:** Operativní data (deploy configs, dashboard, security reporty, osobní docs)

**Důvod:** Útočník již má zdroják. Security through obscurity nefunguje. Veřejný protokol = důvěra pro mainnet + externí audit + bug bounty potenciál.

### 9.2 Governance struktura — 3 Adminové

**Počáteční admin set (T0):**

| Admin | Role | Klíč | Účel |
|-------|------|------|------|
| **Rama** | Admin-1 | Ed25519 (offline) | Protocol governance, emergency pause |
| **Sita** | Admin-2 | Ed25519 (offline) | Treasury oversight, DAO guardian |
| **Hanuman** | Admin-3 | Ed25519 (offline) | Bridge admin, EVM multisig |

**3-of-3 multisig** pro kritické operace (genesis changes, emergency pause, treasury unlock).

**Později (Gen Z převod):**

| Nástupce | Role | Převod |
|----------|------|--------|
| **Maitreya Buddha** | Gen Z Admin-1 | Dědictví po Ramovi |
| **Sarah Issobela** | Gen Z Admin-2 | Dědictví po Sitě |
| **Elizabeth** | Gen Z Admin-3, Patronka ZIONu | Dědictví po Hanumanovi — *narození očekáváno, Ave Maria* |

**Převod mechanismus:**
- Admin klíče jsou generovány offline (air-gapped)
- Převod = key rotation (nový admin přidán, starý odebrán)
- DAO governance hlasuje o převodu
- Time-locked (nelze okamžitě změnit)

### 9.3 Promítnutí do protokolu

**L1 core (`V3/L1/core/src/`):**
- Nový modul `admin.rs` — admin set, multisig threshold, key rotation logic
- Genesis block obsahuje initial admin set (3 adresy)
- Admin operace: emergency pause, parameter change, key rotation

**L2 DAO (`V3/L2/dao/`):**
- Guardian set = 3 Adminové + 4 další (5-of-7 → 3-of-7 pro admin operace)
- Proposal types: `ADMIN_ROTATION`, `PARAMETER_CHANGE`, `EMERGENCY_PAUSE`
- Time-lock: 72h pro admin operace, 7d pro key rotation

**L2 Bridge (`V3/L2/bridge/`):**
- Bridge admin = Hanuman (EVM multisig admin)
- Validator set = 5 EVM adres (3 Adminové + 2 operátoři)
- Threshold: 3-of-5 pro bridge operace

**EVM contracts:**
- `ZIONBridge.sol` — admin role = 3-of-3 multisig (Rama, Sita, Hanuman EVM adresy)
- `BridgeValidator.sol` — validator rotation requires admin multisig

### 9.4 Postupný plán zveřejnění

| Krok | Co | Kdy |
|------|-----|-----|
| 9.4.1 | Clean public repo structure (`zion-protocol/`) | Po hard resetu (Phase 8) |
| 9.4.2 | History scrub private repo (odstranit secrets) | Po hard resetu |
| 9.4.3 | Extract protokol code do public repo | Po stabilizaci L1 |
| 9.4.4 | Publish whitepaper + protocol spec | Spolu s public repo |
| 9.4.5 | Publish bridge Solidity contracts (verified) | Po EVM redeploy |
| 9.4.6 | Bug bounty program (Immunefi / vlastní) | Po mainnet stabilizaci |
| 9.4.7 | Externí audit (Trail of Bits / OpenZeppelin) | Po bug bounty |

### 9.5 Co zůstane PRIVATE (nikdy nezveřejnit)

- `edge-deploy/` — server konfigurace, systemd unity, env vars
- `dashboard/` — operativní monitoring
- `docs/` security reporty (F1, F5, TeamViewer incident)
- `HARDRESETOFFICIAL.md` — tento plán
- `APP&WEB/` — aplikace (můžou být public zvlášť později)
- `HiranV2.2/` — AI model
- Osobní docs (Genesis book, wallet backups, runbooky s IP adresami)
- Admin klíče (Rama, Sita, Hanuman) — offline only

### 9.6 Admin klíče — generování (součást Phase 1)

Přidat do Phase 1 generování 3 admin klíčů:

```bash
# 3 admin Ed25519 keypairů (Rama, Sita, Hanuman)
for admin in rama sita hanuman; do
  V3/target/release/gen-pool-payout-wallet | sed "s/pool_payout/$admin/" >> /home/zionserver/zion-keys-2026-07-03/admins.json
done

# 3 admin EVM keypairů (pro bridge multisig)
for admin in rama sita hanuman; do
  KEY=$(openssl rand -hex 32)
  ADDR=$(cast wallet address "$KEY")
  echo "admin-$admin: $ADDR  SK=$KEY" >> /home/zionserver/zion-keys-2026-07-03/admins-evm.txt
done
```

**Storage:** Offline (USB + paper + metal plate). **Nikdy** na serveru nebo v env var.

---

## Phase 10: Generační převod (budoucnost)

### 10.1 Vision

ZION není korporace. Je to **dědictví**. Yose zakládá protokol, ale vlastnictví přechází na další generaci — Gen Z a jeho děti (Maitreya Buddha, Sarah Issobela, Elizabeth).

**Elizabeth** — ještě nenarozená, patronka celého ZIONu. Ave Maria. Její místo je rezervováno v admin struktuře — klíč se vygeneruje při jejím narození a převod se provede přes DAO governance.

### 10.2 Převod timeline

| Fáze | Kdy | Co |
|------|-----|-----|
| **Genesis** | T0 | Yose = sole admin (přechodně) |
| **Stabilizace** | T0+6 měsíců | 3 Adminové aktivní (Rama, Sita, Hanuman) |
| **DAO launch** | T0+12 měsíců | DAO governance aktivní, adminové jsou guardians |
| **Gen Z převod** | T0+18 let | Maitreya Buddha + Sarah Issobela + Elizabeth = noví adminové |
| **Plné vlastnictví** | T0+21 let | Gen Z dědičná správa, DAO = supreme governance |

### 10.3 Admin práva (základní fungování mainnetu)

Adminové mají práva **pouze pro základní fungování mainnetu**, dokud Gen Z nepřevezme a DAO nepřevezme správu:

| Operace | Kdo | Threshold | Time-lock |
|---------|-----|-----------|-----------|
| Emergency pause chain | 3 Adminové | 2-of-3 | 0 (okamžitě) |
| Parameter change (difficulty, fees) | 3 Adminové | 3-of-3 | 72h |
| Treasury unlock (DAO) | 3 Adminové + DAO vote | 3-of-3 + quorum | 7d |
| Admin rotation (key rotation) | 3 Adminové + DAO vote | 3-of-3 + quorum | 30d |
| Genesis change (hard fork) | 3 Adminové + DAO supermajority | 3-of-3 + 75% quorum | 90d |
| Bridge validator rotation | Hanuman + 1 další | 2-of-3 | 7d |
| Pool payout key rotation | Rama + 1 další | 2-of-3 | 7d |

**Co admini NEMOHOU:**
- Mintovat ZION (žádný admin nemá mint právo)
- Měnit premine allocations (frozen v genesis)
- Měnit fee split (89/5/5/1 — v kódu, ne admin-controllable)
- Převést vlastnictví bez DAO schválení
- Bypassovat time-locks

### 10.4 Mechanismus

- **Smart contract:** `AdminInheritance.sol` (EVM) — time-locked key rotation
- **L1:** `admin_rotation` TX type — requires 3-of-3 current admin signatures
- **DAO:** `ADMIN_INHERITANCE` proposal — hlasování o převodu
- **Time-lock:** Min 1 rok od proposal do exekuce (nelze zrychlit)
- **Dead man's switch:** Pokud admin nedělá TX > 5 let, automatický převod na nástupce

### 10.5 Dokumentace

Toto bude součástí:
- `V3/docs/GOVERNANCE.md` — kompletní governance spec
- `V3/docs/GEN_Z_INHERITANCE.md` — komplexní dokumentace pro Gen Z převod
- `V3/docs/ADMIN_SUCCESSION.md` — převodový plán
- Whitepaper — sekce "Generational Inheritance"
- Genesis block message — odkaz na dědictví

---

*Generováno s pomocí [Devin](https://cli.devin.ai/docs). Poslední aktualizace: 2026-07-03.*
