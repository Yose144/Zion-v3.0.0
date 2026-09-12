# 🔒 FÁZE 1: Spec Freeze — Technická Specifikace

**Priorita:** P0 (Blocker pro MainNet)  
**Trvání:** 2 týdny  
**Owner:** Core Lead + Legal

---

## 🎯 Cíl

Uzamknout všechny parametry, které se po MainNet launch NIKDY NESMÍ změnit. Toto je "constitutional freeze" — jakmile je podepsáno, není cesty zpět.

---

## 📋 Co se zmrazuje

### 1. Chain Identity
```toml
chain_id = "zion-mainnet-1"
network_magic = 0x5A494F4E  # "ZION" in hex
genesis_timestamp = 1740000000  # TBD: Unix timestamp UTC
```

### 2. Total Supply
```rust
pub const TOTAL_SUPPLY: u64 = 144_000_000_000_000_000;  // 144B ZION (8 decimals)
pub const DECIMALS: u8 = 8;
```

### 3. Premine Distribution
```rust
pub const PREMINE_TOTAL: u64 = 16_780_000_000_000_000;  // 16.78B ZION

// Distribution (IMMUTABLE) — 14 outputs, canonical v V31 `v3_compat.rs` PREMINE_OUTPUTS:
// 4.95B - OASIS + Golden Egg reward pool (sloty 1–3 × 1.65B)
// 3.3B  - L5 Free World Projects (sloty 4–5 × 1.65B, repurposed z OASIS)
// 2.5B  - L6 Issobella — Orbital Station & Quantum Research Fund (slot 6, time-lock 144 000)
// 1.5B  - DAO Treasury (sloty 7–8: Grants 1B + Bootstrap 0.5B, time-lock 144 000)
// 2.59B - Infrastructure (Core Dev 1B + Network Infra 1B + Genesis Projects 0.59B)
// 1.44B - Humanitarian — Children Future Fund
// 0.4B  - Bridge Seed Fund
// 0.1B  - Bridge Vault UTXO (keyless)
```

### 4. Block Reward
```rust
pub const BASE_BLOCK_REWARD_ATOMIC: u64 = 5_479_450_000;  // ~5,479.45 ZION

// NO HALVING - Consciousness bonus instead
// Bonus pool: 4.95B ZION distributed over consciousness levels (3 OASIS slots; Slots 4 & 5 repurposed to L5 Free World Projects)
```

### 5. DAA Parameters
```rust
pub const TARGET_BLOCK_TIME_SECS: u64 = 60;
pub const DAA_WINDOW_SIZE: u64 = 60;
pub const MAX_DIFFICULTY_ADJUSTMENT: f64 = 4.0;
```

### 6. Algorithm
```rust
// MainNet v1: Cosmic Harmony only
// Future: Algorithm rotation may be added via hard fork
pub fn get_algorithm_for_height(height: u64) -> Algorithm {
    Algorithm::CosmicHarmony  // Frozen for MainNet launch
}
```

---

## 📋 Task Breakdown

### Task 1.1: Genesis Address Generation

**Čas:** 4h  
**Security:** CRITICAL — Offline ceremony required

**Process:**
```bash
# 1. Air-gapped machine (no network)
# 2. Boot from clean USB
# 3. Generate addresses

# Script: scripts/genesis_address_ceremony.py
for wallet_name in ["sacred_treasury", "quantum_shield", "consciousness_pool", 
                     "humanitarian_fund", "team_locked", "emergency_reserve", "bounty"]:
    seed = generate_secure_entropy(256)
    mnemonic = entropy_to_mnemonic(seed)
    keypair = derive_keypair(mnemonic, path="m/44'/9999'/0'/0/0")
    address = keypair_to_bech32_address(keypair, prefix="zion")
    
    # Store offline:
    # - Mnemonic on paper (multiple copies)
    # - Public key + address to genesis.json

# 4. Destroy machine / wipe securely
```

**Output:** 14 unique bech32 addresses

### Task 1.2: Genesis Block Definition

**Čas:** 4h

```json
// config/genesis.json — canonical 14-output premine (V31 v3_compat.rs PREMINE_OUTPUTS)
{
  "chain_id": "zion-mainnet-1",
  "genesis_time": "2026-XX-XXTXX:XX:XXZ",
  "consensus_params": {
    "block_time_secs": 60,
    "max_block_size": 2097152,
    "max_tx_size": 262144
  },
  "app_state": {
    "balances": [
      {
        "address": "zion1oasis1...",
        "amount": "1650000000000000000",
        "name": "OASIS Golden Egg 1",
        "locked_until": null
      },
      {
        "address": "zion1oasis2...",
        "amount": "1650000000000000000",
        "name": "OASIS Golden Egg 2",
        "locked_until": null
      },
      {
        "address": "zion1oasis3...",
        "amount": "1650000000000000000",
        "name": "OASIS Golden Egg 3",
        "locked_until": null
      },
      {
        "address": "zion1l5free1...",
        "amount": "1650000000000000000",
        "name": "L5 Free World 1",
        "locked_until": null
      },
      {
        "address": "zion1l5free2...",
        "amount": "1650000000000000000",
        "name": "L5 Free World 2",
        "locked_until": null
      },
      {
        "address": "zion1l6issobella...",
        "amount": "2500000000000000000",
        "name": "L6 Issobella",
        "locked_until": "block 144000"
      },
      {
        "address": "zion1daogrants...",
        "amount": "1000000000000000000",
        "name": "DAO Grants",
        "locked_until": "block 144000"
      },
      {
        "address": "zion1daobootstrap...",
        "amount": "500000000000000000",
        "name": "DAO Bootstrap",
        "locked_until": "block 144000"
      },
      {
        "address": "zion1coredev...",
        "amount": "1000000000000000000",
        "name": "Core Dev Fund",
        "locked_until": null
      },
      {
        "address": "zion1netinfra...",
        "amount": "1000000000000000000",
        "name": "Network Infrastructure",
        "locked_until": null
      },
      {
        "address": "zion1genesisprojects...",
        "amount": "590000000000000000",
        "name": "Genesis Projects Steward",
        "locked_until": null
      },
      {
        "address": "zion1childrenfuture...",
        "amount": "1440000000000000000",
        "name": "Humanitarian — Children Future Fund",
        "locked_until": null
      },
      {
        "address": "zion1bridgeseed...",
        "amount": "400000000000000000",
        "name": "Bridge Seed Fund",
        "locked_until": null
      },
      {
        "address": "zion1bridgevault...",
        "amount": "100000000000000000",
        "name": "Bridge Vault UTXO",
        "locked_until": null
      }
    ]
  },
  "initial_height": 0,
  "hash": null
}
```

### Task 1.3: Constitution Finalization

**Čas:** 4h

Finalizovat `docs/mainnet/MAINNET_CONSTITUTION.md`:

1. Review všech parametrů
2. Legal review disclaimers
3. Hash genesis.json a přidat
4. Sign-off od core team

### Task 1.4: Emission Calculator

**Čas:** 4h

```python
#!/usr/bin/env python3
"""
scripts/emission_calculator.py

Calculate ZION emission over time.
"""

# Constants (IMMUTABLE)
TOTAL_SUPPLY = 144_000_000_000  # 144B ZION
PREMINE = 16_780_000_000       # 16.78B ZION
MINEABLE = TOTAL_SUPPLY - PREMINE  # ~127.7B ZION
BASE_REWARD = 5_479.45          # ZION per block
BLOCK_TIME = 60                 # seconds
BLOCKS_PER_DAY = 86400 // BLOCK_TIME  # 1440 blocks
BLOCKS_PER_YEAR = BLOCKS_PER_DAY * 365  # 525,600 blocks

def emission_schedule():
    """Calculate yearly emission."""
    daily_emission = BASE_REWARD * BLOCKS_PER_DAY  # ~7.89M/day
    yearly_emission = BASE_REWARD * BLOCKS_PER_YEAR  # ~2.88B/year
    
    years_to_mine = MINEABLE / yearly_emission  # ~44 years
    
    return {
        "daily_base_emission": daily_emission,
        "yearly_base_emission": yearly_emission,
        "years_to_full_emission": years_to_mine,
        "note": "Consciousness bonuses add ~15-20% during early years"
    }

def time_to_supply_percent(target_percent):
    """Calculate time to reach X% of total supply mined."""
    target_mined = (target_percent / 100) * MINEABLE
    blocks_needed = target_mined / BASE_REWARD
    days = blocks_needed / BLOCKS_PER_DAY
    years = days / 365
    return {"percent": target_percent, "days": days, "years": years}

if __name__ == "__main__":
    import json
    
    schedule = emission_schedule()
    milestones = [
        time_to_supply_percent(10),
        time_to_supply_percent(25),
        time_to_supply_percent(50),
        time_to_supply_percent(75),
        time_to_supply_percent(90),
    ]
    
    print(json.dumps({
        "schedule": schedule,
        "milestones": milestones
    }, indent=2))
```

**Expected Output:**
```json
{
  "schedule": {
    "daily_base_emission": 7890408,
    "yearly_base_emission": 2879998920,
    "years_to_full_emission": 44.3,
    "note": "Consciousness bonuses add ~15-20% during early years"
  },
  "milestones": [
    {"percent": 10, "years": 4.43},
    {"percent": 25, "years": 11.08},
    {"percent": 50, "years": 22.15},
    {"percent": 75, "years": 33.23},
    {"percent": 90, "years": 39.87}
  ]
}
```

### Task 1.5: DAA Verification

**Čas:** 4h

Ověřit že DAA funguje správně:

```rust
// tests/consensus_verification.rs
#[test]
fn test_daa_parameters_frozen() {
    assert_eq!(TARGET_BLOCK_TIME_SECS, 60);
    assert_eq!(DAA_WINDOW_SIZE, 60);
    assert_eq!(MAX_DIFFICULTY_ADJUSTMENT, 4.0);
}

#[test]
fn test_difficulty_adjustment_bounds() {
    // Test that difficulty never changes more than 4x
    let old_diff = 1000000;
    let block_times = vec![30; 60];  // All blocks in 30s (too fast)
    let new_diff = calculate_next_difficulty(old_diff, &block_times);
    assert!(new_diff <= old_diff * 4);  // Max 4x increase
}

#[test]
fn test_difficulty_adjustment_stability() {
    // Test that perfect 60s blocks = no change
    let old_diff = 1000000;
    let block_times = vec![60; 60];  // Perfect timing
    let new_diff = calculate_next_difficulty(old_diff, &block_times);
    assert_eq!(new_diff, old_diff);
}
```

### Task 1.6: Algorithm Decision

**Čas:** 2h

Dokumentovat rozhodnutí:

```markdown
## Algorithm Policy — MainNet v1

### Decision
- MainNet launches with **Cosmic Harmony v3 ONLY**
- No algorithm rotation in v1
- Rotation may be added via coordinated hard fork

### Rationale
1. Simplicity — one algorithm reduces attack surface
2. Testing — CH3 is most tested
3. Miner stability — consistent requirements

### Future Consideration
- Algorithm rotation could be added in v2.x
- Would require:
  - 6-month notice period
  - Miner software update
  - Consensus on rotation schedule
```

---

## 🔐 Security Considerations

### Genesis Ceremony Security
1. **Air-gapped** machine only
2. **Multiple witnesses** for ceremony
3. **Paper backups** in **multiple locations**
4. **Hardware destruction** after ceremony
5. **Cryptographic proof** of address generation

### Key Storage
- DAO Treasury (sloty 7–8): Multi-sig (5-of-7 guardians)
- L6 Issobella (slot 6): Time-lock do bloku 144 000
- Premine admin: 3-of-3 admin multisig

---

## 🧪 Testing Checklist

- [ ] Genesis addresses are valid bech32
- [ ] Sum of premine balances = PREMINE_TOTAL
- [ ] Emission calculator matches expected values
- [ ] DAA tests all pass
- [ ] Constitution document is hash-locked
- [ ] Legal review completed

---

## 📦 Deliverables

| Soubor | Popis |
|--------|-------|
| `config/genesis.json` | Finální genesis definice |
| `docs/mainnet/MAINNET_CONSTITUTION.md` | Aktualizovaný s hash |
| `scripts/emission_calculator.py` | Emission kalkulátor |
| `tests/consensus_verification.rs` | DAA testy |
| `docs/mainnet/ALGORITHM_POLICY.md` | Rozhodnutí o algoritmech |

---

## ⏱️ Time Estimate

| Task | Čas |
|------|-----|
| Genesis Addresses | 4h |
| Genesis Block | 4h |
| Constitution | 4h |
| Emission Calculator | 4h |
| DAA Verification | 4h |
| Algorithm Decision | 2h |
| Review & Sign-off | 4h |
| **Total** | **26h (~2 týdny part-time)** |

---

## ✅ Exit Criteria

1. `genesis.json` vytvořen a hash publikován
2. Všechny adresy jsou reálné bech32 (ne placeholders)
3. Constitution sign-off od všech stakeholders
4. Emission model ověřen kalkulátorem
5. DAA testy 100% passing

---

## 🔗 Dependencies

- Fáze 0 kompletní (porty unifikovány)
- Wallet keygen funkční (pro adresy)

---

## ⚠️ Warnings

**TATO FÁZE JE NEVRATNÁ**

Po MainNet launch nelze změnit:
- Chain ID
- Total supply
- Premine adresy a částky
- Base block reward
- DAA parametry

Každá změna by vyžadovala hard fork a ztrátu důvěry komunity.

---

*Dokument aktualizován: 2026-02-03*
