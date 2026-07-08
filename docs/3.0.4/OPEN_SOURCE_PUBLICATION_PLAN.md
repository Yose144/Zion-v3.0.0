# ZION V3 — Open Source Publication Plan

> **Verze:** 1.0 — 2026-07-06  
> **Status:** PLAN — k exekuci po dokonceni hard reset (faze 6-7)  
> **Souvisi:** [`SECURITY_DISCLOSURE_2026-07.md`](../security/SECURITY_DISCLOSURE_2026-07.md) §8

---

## 1. Cil

Zverejnit ZION V3 zdrojovy kod jako open-source na GitHubu. Duvodem je:
- Transparentnost po security incidentu
- Reprodukovatelnost genesis hashe
- Umoznit externi audit
- Komunita a budouci contributors

---

## 2. Co zverejnit — FINALNI ROZHODNUTI

### Varianta: FRESH PUBLIC REPO (doporuceno)

Misto cisteni git historie stavajiciho repa je **bezpecnejsi** vytvorit novy cersty repo ze
soucasneho stavu. Duvodem je ze v git historii je prilis mnoho secrets (wallet.json, ZION_KEYS,
pool payout SK v shell scriptech, .env soubory) a BFG scrub nikdy neni 100% zaruceny.

```
Stary repo (Yose144/2.9.6) → PRIVATE (archiv, nikdy se nezverejni)
Novy repo (Yose144/zion-v3)  → PUBLIC (fresh commit, cista historie)
```

---

## 3. Struktura verejneho repa

```
zion-v3/                         # PUBLIC REPO
├── V3/
│   ├── L1/
│   │   ├── core/               # Consensus, genesis, RPC, P2P, validation
│   │   ├── cosmic-harmony/     # PoW algorithms (Ekam Deeksha, Cosmic Harmony v2)
│   │   ├── miner/             # CPU + GPU mining client
│   │   ├── pool/              # PPLNS mining pool
│   │   └── native-ffi/        # Optional C/OpenCL acceleration
│   ├── L2/
│   │   ├── bridge/            # L1 ↔ EVM bridge relay
│   │   ├── dao/               # Governance daemon
│   │   ├── atomic-swap/       # Cross-chain HTLC swaps
│   │   ├── contracts/hardhat/ # Solidity contracts (wZION, ZIONBridge, Governance, etc.)
│   │   └── swap-aggregator/   # DEX aggregator adapter
│   ├── L3/
│   │   ├── warp/             # 12-chain universal bridge (BCS, CBOR, TL-B)
│   │   ├── ncl/              # Neural Compute Layer
│   │   └── ai-native/        # AI agent framework
│   ├── L4/
│   │   └── oasis/            # Metaverse integration (UE5)
│   ├── L5/
│   │   ├── free-world/       # Community platform
│   │   └── docs/             # Governance protocols
│   ├── L6/
│   │   └── issobella/        # Space / satellite research
│   ├── cli/                   # Unified operator CLI
│   ├── sdk/                   # Rust SDK (wallet, RPC client)
│   ├── config/                # Configuration templates
│   ├── docker/                # Docker compose + Dockerfiles
│   ├── hardware/              # Ledger HW wallet app
│   ├── scripts/               # Ops scripts (deploy, stress-test)
│   ├── docs/                  # V3-specific documentation
│   ├── Cargo.toml             # Workspace manifest
│   ├── Cargo.lock             # Reproducible builds
│   └── .gitignore
├── docs/
│   ├── security/              # Vulnerability disclosures
│   ├── 3.0.4/                 # Genesis reset runbook
│   └── architecture/          # System design docs (NEW — selekce z existujicich)
├── SECURITY.md                # Responsible disclosure policy
├── LICENSE                    # MIT + Apache 2.0 dual license
├── README.md                  # Public-facing README (NEW)
├── CONTRIBUTING.md            # Contribution guidelines (NEW)
├── CHANGELOG.md               # Version history (NEW — selekce)
└── .github/
    └── SECURITY.md            # GitHub security policy
```

---

## 4. Co VYLOUCIT z verejneho repa

### 4.1 Celé adresáře — NIKDY nezveřejnit

| Cesta | Duvod |
|-------|-------|
| `APP&WEB/` | Website zdrojáky — zůstanou private |
| `ZION_OS/` | Dashboard s hardcoded hesly |
| `HiranV2.1/`, `HiranV2.2/` | AI model training data — IP |
| `archive/` | Legacy kód, historické secrets |
| `edge-deploy/` | Production environment configs |
| `L1/`, `L2/`, `L3/` (root) | Legacy pre-V3 kód |
| `ZionStart/` | Windows launch scripts s environment refs |
| `backups/` | Zálohy |
| `docs/3.0.0/`, `docs/3.0.1Genesis/` | Staré genesis docs s historickými adresami |
| `docs/2.9.*` | Stará dokumentace |

### 4.2 Konkrétní soubory — VYLOUČIT

| Soubor | Duvod |
|--------|-------|
| `scripts/setup-ubuntu-stack.sh` | Pool payout SK na řádku 206 |
| `AGENTS.md` | Operační instrukce s credentials, IP, SSH paths |
| `StatusV3.md` | Interní status s provozními detaily |
| `HARDRESETOFFICIAL.md` | Interní reset plán |
| `SecurityFirst.md` | Detailní server audit |
| `SECURITY_RECOVERY_PLAN_2026-07-03.md` | Incident response interní |
| `F5_SECURITY_INCIDENT_REPORT_2026-07-02.md` | Detailní exploit report (zůstane v docs/security/) |
| `SESSION_REPORT_*.md` | Interní session logy |
| `EdgePrimary.md` | Server access details |
| `MAINNET_LAUNCH_SEQUENCE.md` | Provozní checklist |
| Všechny `*.md` s Windows path `C:\Users\yosef\` | Privacy / OPSEC |
| `V3/docker/.env` | Obsahuje pool payout SK |
| `V3/SMOS_DEPLOY.md` | SSH credentials |
| `V3/AUDIT_REPORT_V3.md` | Interní audit |

### 4.3 V3/ soubory k ÚPRAVĚ před publikací

| Soubor | Co upravit |
|--------|-----------|
| `V3/L1/core/src/lib.rs:123` | ✅ Seed peer aktualizován na `62.171.141.136` (2026-07-07); před publikací → `seed1.zionterranova.com` nebo parametrizovat |
| `V3/L1/core/src/discovery.rs:44` | ✅ Bootstrap node aktualizován na `62.171.141.136` (2026-07-07); před publikací → DNS |
| `V3/README.md:277-278` | IP → DNS |
| `V3/L2/bridge/config/bridge-mainnet.toml:20` | Backup RPC URL → placeholder |
| `V3/cli/tests/topology_e2e.rs` | Hardcoded IP v testech → test constant |
| `V3/docker/DOCKER.md:54` | IP → DNS |

---

## 5. Co projde BEZE ZMĚN (bezpečné)

| Kategorie | Počet souborů | LOC (cca) | Status |
|-----------|--------------|-----------|--------|
| Rust source (L1-L6, cli, sdk) | ~315 | ~80K | SAFE |
| Solidity contracts | 7 | ~2K | SAFE |
| Cargo.toml / Cargo.lock | ~15 | - | SAFE |
| TypeScript deploy scripts | 9 | ~1K | SAFE |
| OpenCL/CUDA kernely | 6 | ~2K | SAFE |
| Config templates (TOML) | 11 | - | SAFE (po úpravě IP) |
| Docker compose + Dockerfiles | ~15 | - | SAFE |
| V3/docs/ markdown | ~25 | - | SAFE (vybrat) |
| Testy (Rust + TS) | ~30 | ~5K | SAFE |

**Celkem k publikaci: ~450 souborů, ~90K LOC**

---

## 6. Pre-publication checklist

### 6.1 Kritické (MUST DO)

- [ ] Hard genesis reset dokončen (fáze 6-7) — chain běží na novém serveru
- [ ] Pool payout SK v `scripts/setup-ubuntu-stack.sh` nahrazen placeholderem
- [ ] `V3/docker/.env` smazán nebo nahrazen za `.env.example`
- [ ] Dashboard hesla v `ZION_OS/dashboard/app.py` odstraněna
- [x] Hardcoded IP `77.42.71.94` (decommissioned Edge) v L1 core seed/discovery nahrazen novým serverem `62.171.141.136` (2026-07-07)
- [ ] Před publikací: `62.171.141.136` v V3/ nahrazeno DNS (`seed1.zionterranova.com`) nebo env var
- [ ] `V3/SMOS_DEPLOY.md` smazán (SSH hesla)
- [ ] Verify: `grep -rn "a3bc7452" .` vrátí 0 výsledků
- [ ] Verify: `grep -rn "x3nityOne\|8506204014" .` vrátí 0 výsledků
- [ ] Verify: `grep -rn "C:\\\\Users\\\\yosef" .` vrátí 0 výsledků

### 6.2 Důležité (SHOULD DO)

- [ ] Nový public-facing README.md (bez interních detailů)
- [ ] LICENSE soubor (MIT + Apache 2.0)
- [ ] CONTRIBUTING.md
- [ ] GitHub Actions CI (cargo test, cargo clippy, cargo fmt --check)
- [ ] `.github/SECURITY.md` symlink na root SECURITY.md
- [ ] Selekce V3/docs/ — jen relevantní architektura, ne provozní runbooky
- [ ] `docs/security/SECURITY_DISCLOSURE_2026-07.md` — zahrnout (transparentnost)
- [ ] `docs/security/vulnerabilities.json` — zahrnout (strojově čitelné)

### 6.3 Nice to have

- [ ] `docs/architecture/` — nová přehledová dokumentace pro external contributors
- [ ] Badgy v README (build status, test count, license)
- [ ] Pre-commit hook config (`.pre-commit-config.yaml`) — prevence secrets v commitech
- [ ] Dependabot / Renovate config pro Cargo dependencies
- [ ] `CHANGELOG.md` — selekce z interních changelogů

---

## 7. Postup vytvoření nového repa

```bash
# 1. Na čistém stroji (po hard reset)
cd /tmp
mkdir zion-v3-public && cd zion-v3-public
git init

# 2. Kopírovat POUZE schválené soubory z privátního repa
# (skript viz sekce 8)
./scripts/prepare-public-release.sh /path/to/private/2.9.6-main .

# 3. Verify — žádné secrets
grep -rn "a3bc7452\|x3nityOne\|8506204014\|POOL_PAYOUT_SK_HEX=[a-f0-9]" .
# Musí vrátit 0 výsledků

# 4. Verify — žádné Windows cesty
grep -rn "C:\\\\Users" .
# Musí vrátit 0 výsledků

# 5. Verify — builds
cd V3 && cargo build --release --workspace
cargo test --workspace
cargo clippy --workspace -- -D warnings

# 6. Commit
git add -A
git commit -m "Initial open-source release — ZION V3

Complete L1-L6 blockchain stack:
- L1: PoW consensus (Cosmic Harmony v2 + DeekshaLite), account+UTXO hybrid model
- L2: EVM bridge (6 chains), DAO governance, atomic swaps
- L3: WARP 12-chain universal bridge, AI-native compute, NCL
- L4: Oasis metaverse (UE5)
- L5: Free World community platform
- L6: Issobella space research

Security disclosure: docs/security/SECURITY_DISCLOSURE_2026-07.md
Genesis hash: 4f75a0dfe6dde3b167287d445aa1ade56577b0e9166c641ed288b4c20a79bd6e"

# 7. Push k novému public repu
git remote add origin git@github.com:Yose144/zion-v3.git
git push -u origin main
```

---

## 8. Automatizační skript (prepare-public-release.sh)

Bude vytvořen jako V3/scripts/prepare-public-release.sh:

```bash
#!/bin/bash
# Kopíruje schválené soubory z privátního repa do nového public release adresáře.
# Usage: ./prepare-public-release.sh <SOURCE_REPO> <DEST_DIR>

SOURCE="${1:?Usage: $0 <source_repo> <dest_dir>}"
DEST="${2:?Usage: $0 <source_repo> <dest_dir>}"

set -euo pipefail

# --- V3/ zdrojový kód ---
rsync -av --exclude='target/' --exclude='data/' --exclude='*.db' \
  --exclude='*.key' --exclude='.env' --exclude='SMOS_DEPLOY.md' \
  --exclude='AUDIT_REPORT_V3.md' --exclude='node_modules/' \
  "$SOURCE/V3/" "$DEST/V3/"

# --- Nahradit hardcoded IP za DNS ---
find "$DEST/V3" -name "*.rs" -o -name "*.toml" -o -name "*.md" -o -name "*.sh" | \
  xargs sed -i 's/77\.42\.71\.94/seed1.zionterranova.com/g'

# --- Smazat docker/.env (obsahuje pool SK) ---
rm -f "$DEST/V3/docker/.env"

# --- Security disclosure ---
mkdir -p "$DEST/docs/security"
cp "$SOURCE/docs/security/SECURITY_DISCLOSURE_2026-07.md" "$DEST/docs/security/"
cp "$SOURCE/docs/security/vulnerabilities.json" "$DEST/docs/security/"

# --- Genesis reset doc (transparency) ---
mkdir -p "$DEST/docs/3.0.4"
cp "$SOURCE/docs/3.0.4/GENESIS_HARD_RESET_CANONICAL.md" "$DEST/docs/3.0.4/"

# --- Root docs ---
cp "$SOURCE/SECURITY.md" "$DEST/"
# README, LICENSE, CONTRIBUTING — budou nové, nepřekopírovat staré

# --- Verify: no secrets ---
echo "=== Checking for leaked secrets ==="
LEAKS=$(grep -rn "a3bc7452\|x3nityOne\|8506204014\|C:\\\\Users\\\\yosef\|POOL_PAYOUT_SK_HEX=[a-f0-9]" "$DEST" 2>/dev/null || true)
if [ -n "$LEAKS" ]; then
  echo "ERROR: Secrets found in destination!"
  echo "$LEAKS"
  exit 1
fi
echo "OK — no secrets detected"
```

---

## 9. Srovnání s Ethereum Foundation přístupem

| Aspekt | Ethereum (go-ethereum) | ZION V3 |
|--------|----------------------|---------|
| Repo | github.com/ethereum/go-ethereum | github.com/Yose144/zion-v3 |
| Disclosure | `docs/vulnerabilities/vulnerabilities.json` | `docs/security/vulnerabilities.json` |
| Policy | Silent patches + 8-week disclosure | Full disclosure po fix deploy |
| Bug bounty | $250K max (EF funded) | Planned post-launch (DAO treasury) |
| History | In-place (same repo) | Fresh repo (clean break) |
| License | LGPL-3.0 | MIT + Apache 2.0 |
| CI | GitHub Actions | GitHub Actions (planned) |
| Audit | External (Trail of Bits, etc.) | Internal + planned external |

---

## 10. Co komunita uvidí — marketing message

### GitHub repo description:
> ZION V3 — Layer 1 blockchain with Proof-of-Work (Cosmic Harmony v2), 12-chain WARP bridge,
> humanitarian fee split (89/5/5/1), and AI-native compute layer. Built in Rust.

### Tagy:
`blockchain`, `cryptocurrency`, `proof-of-work`, `cross-chain`, `bridge`, `rust`, `defi`,
`layer1`, `layer2`, `evm`, `open-source`

### Key selling points pro první release:
1. **Complete L1-L6 stack v jednom repu** — unikátní (většina L1 je jen L1)
2. **12-chain WARP bridge** — Ethereum, Bitcoin, Solana, Cardano, Aptos, Sui, TON...
3. **Humanitarian model** — 5% každého bloku jde na charitu (konstituční)
4. **Full security disclosure** — transparentní přístup k incidentům
5. **Reproducible genesis** — `cargo build && ./get-genesis-hash` = published hash

---

## 11. Časový harmonogram

| Milník | Závisí na | Odhad |
|--------|-----------|-------|
| Hard reset dokončen (fáze 6-7) | Nový server + Tailscale | T+2 dny |
| Scrub + prepare-public-release.sh | Fáze 6-7 hotová | T+1 den |
| Nový README + LICENSE + CONTRIBUTING | - | T+0.5 dne |
| CI setup (GitHub Actions) | Public repo vytvořen | T+0.5 dne |
| **PUBLIC RELEASE** | Vše výše | **T+4 dny od teď** |
| Blog post na zionterranova.com | Web z maintenance mode | T+5 dnů |
| Bug bounty announce | DAO treasury funded | T+30 dnů |

---

## 12. Rizika a mitigace

| Riziko | Dopad | Mitigace |
|--------|-------|----------|
| Secret pronikne do public repa | Total compromise | Automatizační skript + manuální verify + pre-commit hook |
| Útočník najde novou zranitelnost v kódu | Exploit | F5 fuzz testy, code review, planned external audit |
| Fork s malicious changes | Reputation damage | Code signing, official releases only from verified tag |
| IP/identita leakne | OPSEC | Nahradit Windows cesty, personal info, SSH details |
| Někdo fork a "ukradne" projekt | Legal | MIT license = OK, brand/trademark zůstává |

---

*Dokument ke schválení majitelem projektu před exekucí.*
