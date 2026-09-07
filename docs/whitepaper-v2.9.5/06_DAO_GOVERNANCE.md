# 🏛️ Kapitola 6: DAO Governance

> *"Decentralizace není jen technologie. Je to filozofie moci."*

---

## 6.1 Co je ZION DAO?

ZION DAO (Decentralized Autonomous Organization) je **on-chain governance systém**, který umožňuje komunitě rozhodovat o budoucnosti projektu.

```
ZION DAO Princip:
┌─────────────────────────────────────────────────────────────┐
│                                                             │
│  Tradiční projekt:    CEO → Board → Team → Community        │
│                                                             │
│  ZION DAO:            Community → Proposals → Votes → Code  │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### Klíčové vlastnosti

| Vlastnost | Popis |
|-----------|-------|
| **On-chain voting** | 1 ZION = 1 hlas |
| **Transparentnost** | Všechny hlasy on-chain |
| **Time-locked execution** | 48h delay pro bezpečnost |
| **Multi-sig treasury** | 5-of-7 pro výdaje |
| **IPFS storage** | Proposals uloženy decentralizovaně |

---

## 6.2 Governance Model

### Voting Power

```python
# Jednoduchý model: 1 ZION = 1 hlas
voting_power = wallet_balance_zion

# Příklad:
# Alice má 10,000 ZION → 10,000 hlasů
# Bob má 1,000 ZION → 1,000 hlasů
```

### Typy hlasování

```python
class VoteType(Enum):
    AGAINST = 0   # Proti
    FOR = 1       # Pro
    ABSTAIN = 2   # Zdržel se
```

### Quorum (minimální účast)

Pro platnost hlasování je potřeba **quorum** = minimální počet hlasů.

```
Quorum Requirements:
═══════════════════════════════════════════════════════════════

Standard Proposals:
├── Quorum: 4% of circulating supply
├── Passing threshold: >50% FOR votes
└── Voting period: 7 days

Constitutional Changes:
├── Quorum: 10% of circulating supply
├── Passing threshold: >67% FOR votes
└── Voting period: 14 days

Emergency Proposals:
├── Quorum: 2% of circulating supply
├── Passing threshold: >75% FOR votes
└── Voting period: 3 days
```

---

## 6.3 Proposal Lifecycle

### Stavy návrhu

```python
class ProposalState(Enum):
    PENDING = 0    # Čeká na start
    ACTIVE = 1     # Aktivní hlasování
    CANCELED = 2   # Zrušeno
    DEFEATED = 3   # Zamítnuto
    SUCCEEDED = 4  # Schváleno
    QUEUED = 5     # V timelock frontě
    EXECUTED = 6   # Vykonáno
```

### Flow diagram

```
Proposal Lifecycle:
═══════════════════════════════════════════════════════════════

[CREATE] ──→ [PENDING] ──→ [ACTIVE] ──→ [SUCCEEDED] ──→ [QUEUED] ──→ [EXECUTED]
                │              │
                │              └──→ [DEFEATED] (nedosaženo quorum/většiny)
                │
                └──→ [CANCELED] (staženo navrhovatelem)

Timelock: 48 hodin mezi QUEUED a EXECUTED
          (čas pro odhalení problémů)
```

---

## 6.4 Treasury Management

### DAO Treasury (4B ZION)

Z genesis premine je **4,000,000,000 ZION** alokováno do DAO Treasury.

### Budget Categories

```
DAO Treasury Allocation (4B ZION):
┌─────────────────────────────────────────────────────────────┐
│                                                             │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ Reserved: 2,150,000,000 ZION (53.75%)                   │ │
│ │ └── Pro budoucí rozhodnutí komunity                     │ │
│ └─────────────────────────────────────────────────────────┘ │
│                                                             │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ Infrastructure: 600,000,000 ZION (15%)                  │ │
│ │ └── Servery, RPC nodes, block explorers                 │ │
│ └─────────────────────────────────────────────────────────┘ │
│                                                             │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ Developer Grants: 500,000,000 ZION (12.5%)              │ │
│ │ └── Odměny pro open-source vývojáře                     │ │
│ └─────────────────────────────────────────────────────────┘ │
│                                                             │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ Marketing: 350,000,000 ZION (8.75%)                     │ │
│ │ └── Awareness, vzdělávání, eventy                       │ │
│ └─────────────────────────────────────────────────────────┘ │
│                                                             │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ Research: 200,000,000 ZION (5%)                         │ │
│ │ └── R&D, security audity, akademická spolupráce         │ │
│ └─────────────────────────────────────────────────────────┘ │
│                                                             │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ Emergency: 200,000,000 ZION (5%)                        │ │
│ │ └── Bug bounty, krizové situace                         │ │
│ └─────────────────────────────────────────────────────────┘ │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### Multi-Sig Ochrana

Treasury výdaje vyžadují **5-of-7 multi-sig** schválení:

```
Treasury Multi-Sig:
═══════════════════════════════════════════════════════════════

7 Signers (klíčoví držitelé):
├── 2× Core Team members
├── 2× Community representatives
├── 2× Technical advisors
├── 1× Legal/Compliance advisor

Požadavek: 5 z 7 musí schválit
Timelock: 48h po dosažení 5 podpisů
```

---

## 6.5 Developer Grants Program

### Struktura grantů

```python
@dataclass
class Grant:
    id: int
    recipient: str           # Adresa vývojáře
    category: str            # Budget kategorie
    total_amount: int        # Celková částka
    released: int            # Již vyplaceno
    project_hash: str        # IPFS hash projektu
    milestones: List[Milestone]
    active: bool
```

### Milestone-based Payments

Granty jsou vypláceny **po milestones**, ne jednorázově:

```
Developer Grant Example:
═══════════════════════════════════════════════════════════════

Project: ZION Mobile Wallet
Total: 5,000,000 ZION

Milestone 1 (25%): Desktop Wallet MVP
├── Amount: 1,250,000 ZION
├── Deliverable: Funkční desktop wallet
└── Status: ✅ Completed

Milestone 2 (25%): Mobile Integration
├── Amount: 1,250,000 ZION
├── Deliverable: iOS + Android app
└── Status: ⏳ In Progress

Milestone 3 (25%): Hardware Wallet Support
├── Amount: 1,250,000 ZION
├── Deliverable: Ledger/Trezor integrace
└── Status: 📅 Planned

Milestone 4 (25%): Final Testing
├── Amount: 1,250,000 ZION
├── Deliverable: Security audit + deployment
└── Status: 📅 Planned
```

---

## 6.6 Governance Phases

### Postupná decentralizace

ZION DAO se zavádí ve **třech fázích**:

```
DAO Evolution:
═══════════════════════════════════════════════════════════════

Phase 1 (2025-2026): "Foundation DAO"
├── Snapshot voting (off-chain signaling)
├── Multi-sig treasury control
├── Core team retains emergency powers
└── Status: ✅ ACTIVE

Phase 2 (2026-2027): "Hybrid DAO"
├── On-chain proposal lifecycle
├── Smart contract execution
├── Reduced core team powers
└── Status: 📅 PLANNED (MainNet)

Phase 3 (2027+): "Full DAO"
├── Complete on-chain governance
├── No central authority
├── Community-elected council
├── Quadratic voting experiments
└── Status: 🔮 VISION
```

### Proč postupně?

1. **Security:** Okamžitá full decentralizace je riziková
2. **Learning:** Komunita se učí governance postupně
3. **Iteration:** Možnost opravit chyby před finalizací
4. **Trust:** Budování důvěry mezi týmem a komunitou

---

## 6.7 Vytvoření návrhu

### Krok za krokem

```python
# 1. Připrav návrh
from dao.governance_v2 import ZIONGovernance, VoteType

gov = ZIONGovernance(db_path="dao_governance.db")

# 2. Vytvoř proposal
proposal_id = gov.create_proposal(
    proposer="ZION_YOUR_ADDRESS",
    title="Zvýšit block reward na 60 ZION",
    description="""
    ## Motivace
    Současný reward 50 ZION je příliš nízký pro udržení hashrate.
    
    ## Návrh
    Zvýšit BASE_BLOCK_REWARD z 50 na 60 ZION.
    
    ## Dopad
    +20% emise, ale vyšší security budget.
    """,
    targets=["0xBlockchainContract"],
    values=[0],
    calldatas=["0x..."]  # Encoded function call
)

print(f"Proposal #{proposal_id} created!")
```

### Požadavky na navrhovatele

| Požadavek | Hodnota | Důvod |
|-----------|---------|-------|
| **Min. balance** | 100,000 ZION | Anti-spam |
| **Holding period** | 7 dní | Skin in the game |
| **Max. active proposals** | 3 | Fokus komunity |

---

## 6.8 Hlasování

### Jak hlasovat

```python
# Hlasuj PRO
gov.cast_vote(
    proposal_id=1,
    voter="ZION_YOUR_ADDRESS",
    vote_type=VoteType.FOR
)

# Hlasuj PROTI
gov.cast_vote(
    proposal_id=1,
    voter="ZION_YOUR_ADDRESS",
    vote_type=VoteType.AGAINST
)

# Zdrž se
gov.cast_vote(
    proposal_id=1,
    voter="ZION_YOUR_ADDRESS",
    vote_type=VoteType.ABSTAIN
)
```

### Delegace hlasů

Pokud nechceš hlasovat sám, můžeš **delegovat** své hlasy:

```python
# Deleguj hlasy na experta
gov.delegate(
    delegator="ZION_YOUR_ADDRESS",
    delegatee="ZION_EXPERT_ADDRESS"
)

# Expert hlasuje za tebe
# Můžeš kdykoliv zrušit delegaci
```

---

## 6.9 Treasury Spending

### Vytvoření spending proposal

```python
# Navrhni výdaj z treasury
proposal_id = gov.create_spending_proposal(
    category="Infrastructure",
    recipient="ZION_SERVER_PROVIDER",
    amount=10_000_000,  # 10M ZION
    reason="Upgrade RPC nodes pro MainNet",
    milestone_hash="QmMilestoneDetails..."
)
```

### Multi-sig schválení

```python
# Každý signer schválí
gov.approve_spending_proposal(proposal_id, "Signer1")
gov.approve_spending_proposal(proposal_id, "Signer2")
gov.approve_spending_proposal(proposal_id, "Signer3")
gov.approve_spending_proposal(proposal_id, "Signer4")
gov.approve_spending_proposal(proposal_id, "Signer5")  # 5th = auto-execute

# Po 48h timelock → automatická exekuce
```

---

## 6.10 Bezpečnostní mechanismy

### Emergency Powers (Phase 1-2)

V raných fázích má core team **emergency powers**:

```
Emergency Powers:
═══════════════════════════════════════════════════════════════

Scope:
├── Pause malicious proposals
├── Fix critical bugs
├── Respond to security incidents
└── NOT: Change economic parameters unilaterally

Conditions:
├── Requires 5-of-7 multi-sig
├── Must be disclosed within 24h
├── Community can veto within 7 days
└── All actions logged on-chain

Sunset: Phase 3 (2027+) - removed completely
```

### Guardian Role

```python
# Guardian může zrušit škodlivý proposal
if proposal.is_malicious():
    guardian.cancel_proposal(proposal_id)
    # Musí vysvětlit důvod on-chain
    guardian.log_reason("Security vulnerability in proposed code")
```

---

## 6.11 Governance Statistics

### Aktuální stav (TestNet)

```
DAO Stats (as of January 2026):
═══════════════════════════════════════════════════════════════

Total Proposals:        12
├── Executed:           5
├── Active:             2
├── Defeated:           3
└── Canceled:           2

Total Votes Cast:       847
Unique Voters:          156
Average Turnout:        23.4%

Treasury Balance:       4,000,000,000 ZION
├── Spent:              0 ZION (TestNet)
└── Committed:          0 ZION

Active Grants:          3
├── Total Awarded:      15,000,000 ZION
└── Released:           3,750,000 ZION
```

---

## 6.12 Co může DAO měnit?

### Měnitelné parametry

| Parametr | Rozsah | Quorum |
|----------|--------|--------|
| Block reward | ±20% | 10% |
| Pool fee | 0-5% | 4% |
| Humanitarian tithe | 5-15% | 10% |
| Quorum requirements | ±2% | 10% |
| Treasury allocation | Kategorie | 4% |

### Neměnitelné parametry

```
IMMUTABLE (nelze změnit):
═══════════════════════════════════════════════════════════════

❌ Total Supply (144B ZION)
❌ Genesis allocation (16.78B)
❌ Block time (60s)
❌ Mining algorithm (Cosmic Harmony)
❌ Consensus mechanism (PoW)
```

---

## 6.13 Budoucí experimenty

### Quadratic Voting (Phase 3)

```
Tradiční: 1 ZION = 1 vote
Quadratic: √(ZION) = votes

Příklad:
├── Alice (10,000 ZION) = √10,000 = 100 votes
├── Bob (1,000 ZION) = √1,000 = 31.6 votes
└── Carol (100 ZION) = √100 = 10 votes

Efekt: Snižuje vliv velryb, zvyšuje vliv malých držitelů
```

### Consciousness-Weighted Voting

```
Votes = ZION × consciousness_multiplier

Příklad (L5 miner s 1,000 ZION):
├── Standard: 1,000 votes
└── Consciousness-weighted: 1,000 × 5.0 = 5,000 votes

Efekt: Odměňuje aktivní účast v síti
```

---

## 6.14 Shrnutí

```
ZION DAO GOVERNANCE:
═══════════════════════════════════════════════════════════════

✅ ON-CHAIN VOTING       - 1 ZION = 1 hlas
✅ TRANSPARENT           - Vše veřejné, auditovatelné
✅ TIME-LOCKED           - 48h delay pro bezpečnost
✅ MULTI-SIG TREASURY    - 5-of-7 pro výdaje
✅ MILESTONE GRANTS      - Platby po deliverables
✅ GRADUAL DECENTRALIZATION - 3 fáze

═══════════════════════════════════════════════════════════════
```

### Kód reference

```
dao/
├── governance_v2.py          # 970 LOC - Core governance logic
├── humanitarian_dao.py       # Humanitarian fund governance
├── contracts/
│   ├── ZIONGovernance.sol   # 465 LOC - On-chain voting
│   └── ZIONTreasury.sol     # 577 LOC - Multi-sig treasury
└── proposals/               # Historical proposals
```

---

**Pokračování:** [Kapitola 7 — Humanitarian Tithe](07_HUMANITARIAN_TITHE.md)

---

*"Power to the people. Code is law. Community is king."*  
**— ZION DAO Manifesto**
