# ZION v3 — Open-Source Publication: Industry Research & Recommendations

**Datum:** 2026-07-09
**Účel:** Jak profesionálně a bezpečně zveřejnit ZION v3 source code, s maximální profesionalitou a bezpečností

---

## 1. Jak to dělají major blockchain projekty

### 1.1 Co publikují vs. co drží private

| Projekt | Co je public | Co je private | Poznámka |
|---------|-------------|---------------|----------|
| **Bitcoin Core** | Vše — consensus, P2P, RPC, wallet, CLI | Nic (žádné private klíče v kódu) | Genesis block je hardcoded s public adresou, ale coinbase output je unspendable |
| **Ethereum (go-ethereum)** | Vše — consensus, EVM, RPC, CLI | Nic | Genesis alloc obsahuje pouze **veřejné adresy + balances**, nikdy private keys |
| **Solana** | Vše — validator client, runtime, SDK | Nic (genesis_utils.rs generuje **random** keypair pro test, ne mainnet) | Solana-labs/solana je nyní archived → přesunuto do anza-xyz/agave |
| **Cardano** | Vše — node (Haskell), consensus | Nic | input-output-hk organizace, modular Rust node (acropolis) |
| **Polkadot** | Vše — SDK (Substrate + FRAME + Cumulus) | Nic | paritytech/polkadot-sdk monorepo |
| **Aptos** | Vše — node, consensus, CLI | Nic | aptos-labs/aptos-core, klíče generuje uživatel přes CLI |
| **Cosmos (Tendermint)** | Vše — consensus, IBC, SDK | Nic | tendermint/tendermint |

**Klíčový poznatek:** Všechny major projekty publikují **kompletní consensus kód** včetně genesis konfigurace. **Nikdy** neobsahuje private keys — genesis obsahuje jen **veřejné adresy + alokace**.

### 1.2 Repo struktura

| Projekt | Struktura | License |
|---------|-----------|---------|
| Bitcoin | 1 monorepo `bitcoin/bitcoin` | MIT |
| Ethereum | 1 monorepo `ethereum/go-ethereum` + separate repos (consensus-specs, tests) | LGPL-3.0 |
| Solana | 1 monorepo (archived) → split do `anza-xyz/agave` + `solana-program/*` | Apache-2.0 |
| Cardano | `input-output-hk/cardano-node` + separate repos | Apache-2.0 |
| Polkadot | 1 mega-monorepo `paritytech/polkadot-sdk` | Apache-2.0 / GPL-3.0 |
| Aptos | 1 monorepo `aptos-labs/aptos-core` | Apache-2.0 |

**Pattern:** Většina používá **jeden monorepo** pro node + consensus. SDK a programy jsou často v separate repos.

### 1.3 Genesis key management v open-source projektech

**Bitcoin:**
```cpp
// chainparams.cpp — genesis output script je PUBLIC key
const CScript genesisOutputScript = CScript() << "04678afdb0fe5548271967f1a67130b7105cd6a828e03909a67962e0ea1f61deb649f6bc3f4cef38c4f35504e51ec112de5c384df7ba0b8d578a4c702b6bf11d5f" << OP_CHECKSIG;
```
Genesis coinbase reward (50 BTC) je **unspendable** — output script existuje, ale klíč k němu neexistuje (nebo byl zničen).

**Ethereum:**
- Genesis `alloc` obsahuje `{ "address": "0x...", "balance": "..." }` — jen veřejné adresy
- Pre-sale klíče byly generovány uživateli, ne v kódu
- Genesis block je generovatelný pomocí open-source skriptu (`mk_genesis_block.py`)

**Solana:**
```rust
// genesis_utils.rs — generuje RANDOM keypair pro test
pub fn create_genesis_config(mint_lamports: u64) -> GenesisConfigInfo {
    create_genesis_config_with_leader(
        mint_lamports,
        &solana_sdk::pubkey::new_rand(), // validator_pubkey
        0,                               // validator_stake_lamports
    )
}
```
Mainnet genesis config je distribuován jako **binární soubor** (ne source code) — obsahuje veřejné klíče.

**Aptos:**
- `aptos genesis generate-keys` — uživatel generuje klíče sám
- Genesis config obsahuje jen **public-keys.yaml**, nikdy `private-keys.yaml`

**Pattern:** Genesis v source kódu obsahuje **jen veřejné adresy/klíče**. Private klíče jsou vždy generovány mimo repo.

---

## 2. Známé hacky/exploity z open-sourcingu

### 2.1 Kelp DAO ($116M, 2026)
- **Root cause:** 1-of-1 DVN verification (single point of failure)
- **Není z open-sourcingu** — chyba v konfiguraci, ne v publikovaném kódu

### 2.2 Foom Club ($1.6M, 2026)
- **Root cause:** Groth16 trusted setup s `delta == gamma == G2 Generator` (trivial parameters)
- **Lze detekovat z published source** — verifier kód byl standardní, ale VK parametry byly broken
- **Lekce:** Pokud publikujete ZK/cryptographic parametry, zajistěte že jsou správně generované

### 2.3 THORChain ($7.4M, 2026)
- **Root cause:** Unsigned ObservedTx wrapper — bifrost attestation flaw
- **Není z open-sourcingu** — chyba v runtime logice

### 2.4 TrustedVolumes ($5.87M, 2026)
- **Root cause:** Zero access control na `registerAllowedOrderSigner`
- **Lze detekovat z published source** — ale byl to delegatecall proxy s unverified bytecode
- **Lekce:** Publikujte VŠECHEN contract source code + verify na Etherscan

### 2.5 Obecné poznatky
- **Automated bots skenují GitHub pro leaked secrets** — median time push → exploit attempt je **pod 1 hodinu**
- **Smart contract exploits** většinou nejsou z open-sourcingu, ale z:
  1. Logických chyb v kódu (lze najít auditorem)
  2. Špatné konfigurace (threshold, access control)
  3. Unverified bytecode (skrytá implementace)

**ZION-relevantní lekce:** Náš F1 exploit (forged P2P signatures) a F5 (unlimited inflation) byly **logické chyby**, ne secret leaks. Publikování source kódu by je **neodhalilo útočníkům** — byly už fixnuty. Naopak, publikování **pomáhá** komunitě najít chyby dříve.

---

## 3. Aktuální stav Zion-TerraNova GitHub org

### 3.1 Existující repos (4 veřejné)

| Repo | Jazyk | Popis | Status |
|------|-------|-------|--------|
| `Zion-TestNet2.8.5` | Python | Starý testnet v2.8.5 | 1 star |
| `2.9-QuantumLeap` | Python | Verze 2.9 | Public |
| `2.9.5-NativeAwakening` | Shell | Verze 2.9.5 | Public |
| `v3-Mainnet` | — | **Prázdné** — jen LICENSE (MIT) | 0 stars, 1 commit |

### 3.2 Problémy se současným stavem

1. **`v3-Mainnet` je prázdné** — jen MIT license, žádný kód, žádný README
2. **Staré repos (2.8.5, 2.9, 2.9.5)** jsou Python — zastaralé, nepředstavují aktuální v3
3. **Žádný SECURITY.md** v org ani v repos
4. **Žádný CONTRIBUTING.md**
5. **Žádné organization-level docs**
6. **Staré repos mohou obsahovat secrets** — Python kód z 2.8.5/2.9 éry

### 3.3 Doporučení pro staré repos

- **Zvážit archivaci** `Zion-TestNet2.8.5`, `2.9-QuantumLeap`, `2.9.5-NativeAwakening`
- Nebo alespoň **secret scan** těchto repos (gitleaks/trufflehog)
- Přidat README s upozorněním: "Legacy code — current version at v3-Mainnet"

---

## 4. Doporučení pro ZION v3 publikaci

### 4.1 Co publikovat (Consensus Core Only — per user decision)

```
v3-Mainnet/
├── README.md                    # Profesionální landing page
├── LICENSE                      # MIT (už existuje)
├── SECURITY.md                  # Responsible disclosure policy
├── CONTRIBUTING.md              # Jak přispívat
├── CODE_OF_CONDUCT.md           # Community standards
├── CHANGELOG.md                 # Version history
├── Cargo.toml                   # Workspace root
├── V3/
│   ├── Cargo.toml
│   ├── L1/                      # Consensus core (Rust)
│   │   ├── core/                # Blockchain, validation, RPC
│   │   ├── pool/                # Mining pool
│   │   └── miner/               # Miner
│   ├── L2/                      # DeFi + bridge
│   │   ├── contracts/           # Solidity (hardhat + foundry)
│   │   ├── bridge/              # Bridge relay
│   │   ├── dao/                 # DAO governance
│   │   └── atomic-swap/         # Atomic swap
│   ├── L4/                      # Oasis (gaming)
│   ├── L5/                      # Community
│   └── docs/                    # Architecture docs
├── docs/                        # Public docs
│   ├── architecture/
│   ├── SECURITY_DISCLOSURE_2026-07.md  # Already public
│   └── vulnerabilities.json
└── .github/
    └── workflows/
        └── security-scan.yml    # Gitleaks + TruffleHog CI
```

### 4.2 Co NEpublikovat

| Item | Důvod |
|------|-------|
| `V3/L3/warp/` | Competitive advantage (user decision) |
| `scripts/_rig_*.py` | SimpleMining API token (46 souborů) |
| `scripts/vega_autopilot.py` | SimpleMining API token |
| `scripts/tmp_smos_*.py` | SimpleMining API token |
| `scripts/backup-node.env` | Production IP + wallet addresses |
| `archive/` | Legacy code s DB password |
| `HARDRESETOFFICIAL.md` | Internal server topology |
| `SECURITY_TODO_2026-07-03.md` | Internal security status |
| `SECURITY_PATCH_3.0.4_PLAN.md` | Internal patch plan |
| `StatusV3.md` | Internal operational status |
| `dns.md` | DNS zone file (reveals topology) |
| `AGENTS.md` | Internal AI agent instructions (contains server IPs, SSH info) |
| `PoC-lab/` | Research prototype (not production) |
| `HiranV2.*/` | AI model training (not blockchain) |
| `APP&WEB/` | Website/mobile app (separate repos) |

### 4.3 Genesis key handling

**Kritické pravidlo:** `genesis.rs` smí obsahovat **jen veřejné adresy**, nikdy private keys.

Aktuální stav ZION `genesis.rs`:
- Obsahuje hardcoded kanonické wallet adresy (public) ✅
- Neobsahuje private keys ✅
- **ALE:** F4.5 issue — adresy jsou hardcoded, ne label-derived (bezpečnostní riziko pro treasury)

**Doporučení:**
1. Publikovat `genesis.rs` s veřejnými adresami (jako Bitcoin/Ethereum)
2. **Před publikací** dokončit F4.5 air-gapped key rotation (nové adresy)
3. Po rotaci aktualizovat `genesis.rs` s novými veřejnými adresami
4. Private keys zůstávají na flash drive + Desktop (nikdy v repo)

### 4.4 SECURITY.md (povinné)

```markdown
# Security Policy

## Reporting a Vulnerability

**DO NOT open a public GitHub issue.**

To report a security vulnerability in ZION v3:
1. Email: security@zionterranova.com (PGP key: [fingerprint])
2. Or use GitHub Security Advisories: github.com/Zion-TerraNova/v3-Mainnet/security/advisories

## Response Timeline
- Acknowledgment: within 48 hours
- Initial assessment: within 7 days
- Fix + disclosure: coordinated with reporter

## Scope
- L1 consensus code (V3/L1/)
- L2 smart contracts (V3/L2/contracts/)
- Bridge relay (V3/L2/bridge/)

## Out of Scope
- Third-party services (SimpleMining, etc.)
- Frontend/web (separate repos)
- WARP (not published)

## Known Vulnerabilities
See: docs/security/SECURITY_DISCLOSURE_2026-07.md
All disclosed vulnerabilities (F1-F5, C1-C8) have been remediated.
```

### 4.5 CI/CD Security (povinné)

```yaml
# .github/workflows/security-scan.yml
name: Security Scan
on: [pull_request, push]

jobs:
  gitleaks:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with: { fetch-depth: 0 }
      - uses: gitleaks/gitleaks-action@v2
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}

  cargo-audit:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: cargo install cargo-audit
      - run: cargo audit

  slither:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: pip install slither-analyzer
      - run: slither V3/L2/contracts/
```

### 4.6 Pre-publication checklist

| # | Item | Status | Priority |
|---|------|--------|----------|
| 1 | Secret scan (gitleaks + trufflehog) | ✅ Done (manual) | — |
| 2 | Remove SimpleMining API token | ⏳ Pending | HIGH |
| 3 | Remove PostgreSQL password | ⏳ Pending (exclude archive/) | MED |
| 4 | Scrub production IPs | ⏳ Pending | MED |
| 5 | F4.5 genesis key rotation | ⏳ Blocked (air-gapped) | HIGH |
| 6 | SECURITY.md | ⏳ Pending | HIGH |
| 7 | CONTRIBUTING.md | ⏳ Pending | MED |
| 8 | README.md (professional) | ⏳ Pending | HIGH |
| 9 | CI/CD security-scan.yml | ⏳ Pending | MED |
| 10 | Fresh git history (no scrub) | ⏳ Pending | HIGH |
| 11 | LICENSE (MIT — already exists) | ✅ Done | — |
| 12 | Audit old repos for secrets | ⏳ Pending | MED |

---

## 5. Konkrétní doporučení pro ZION

### 5.1 Ethereum-style approach (doporučeno)

1. **Publikovat consensus core** (L1 + L2 contracts) — jako Ethereum/Solana/Polkadot
2. **WARP excluded** — competitive advantage (user decision)
3. **Genesis.rs s public addresses only** — jako Bitcoin chainparams.cpp
4. **Fresh git history** — clean break, no scrubbing (user decision)
5. **MIT license** — už existuje v v3-Mainnet repo
6. **SECURITY.md + bug bounty** — professional responsible disclosure

### 5.2 Bezpečnostní pravidla

1. **Žádné private keys v repo** — už je to OK (secret scan potvrdil)
2. **Žádné production IPs** — nahradit za env vars / placeholders
3. **Žádné API tokens** — SimpleMining token musí pryč
4. **Genesis obsahuje jen public addresses** — už je to OK
5. **CI/CD secret scanning** — gitleaks + trufflehog na každý PR
6. **Audit reports public** — už máme SECURITY_DISCLOSURE_2026-07.md

### 5.3 Proč publikování JE bezpečné

1. **F1 + F5 už fixnuty** — publikování neodhalí nic nového útočníkům
2. **Genesis addresses jsou už public** — jsou v blockchainu (genesis block)
3. **Smart contracts už jsou verified** na Basescan (7/7)
4. **Security disclosures už jsou public** — ZION-2026-001 through 005
5. **Open-source = více očí** — komunita může najít chyby dříve
6. **Profesionální image** — transparentnost buduje důvěru

### 5.4 Proč publikování MŮŽE být rizikové (a jak to mitigovat)

| Riziko | Mitigace |
|--------|----------|
| Útočník najde novou chybu v kódu | CI/CD scanning + bug bounty + rychlé patchování |
| Leak secret z fresh history | Fresh repo = čistá historie, gitleaks scan před push |
| Staré repos obsahují secrets | Archivovat nebo smazat staré repos |
| WARP leak | V3/L3/warp/ excluded z public repo |
| Genesis key exposure | genesis.rs má jen public addresses |
| Server IP exposure | Scrub IPs, použít env vars |

---

## 6. Závěr

**ZION v3 je připraveno k publikaci** po dokončení těchto kroků:

1. ✅ Secret scan dokončen (2 real credentials nalezeny)
2. ⏳ Odstranit SimpleMining API token (46 souborů) — **před publikací**
3. ⏳ Vytvořit SECURITY.md, CONTRIBUTING.md, README.md
4. ⏳ Fresh repo s clean git history
5. ⏳ CI/CD security scanning (gitleaks + cargo-audit)
6. ⏳ F4.5 genesis key rotation (air-gapped — owner akce)

**Industry standard říká:** Publikovat consensus core s public addresses, držet private keys mimo repo, mít SECURITY.md + bug bounty. Všechny major projekty to tak dělají.
