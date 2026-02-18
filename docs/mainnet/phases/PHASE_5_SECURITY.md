# 🔒 FÁZE 5: Security Hardening — Technická Specifikace

**Priorita:** P1  
**Trvání:** 4 týdny  
**Owner:** Security Lead

---

## 🎯 Cíl

Zajistit základní bezpečnostní standardy pro MainNet:
1. Dokumentovaný threat model
2. Fuzzing bez kritických crashů
3. Audit scope a příprava

---

## 📋 Task Breakdown

### Task 5.1: Threat Model Documentation

**Čas:** 16h

```markdown
# docs/security/THREAT_MODEL.md

## 1. Asset Identification

### Critical Assets
| Asset | Description | Impact if Compromised |
|-------|-------------|----------------------|
| Private Keys | Miner/pool wallet keys | Total fund loss |
| Genesis Block | Immutable chain root | Chain invalidity |
| Consensus Rules | DAA, rewards | Economic attack |
| P2P Network | Node communication | Network partition |

### Important Assets
| Asset | Description | Impact |
|-------|-------------|--------|
| Mining shares | Work proof | Unfair rewards |
| Payout queue | Pending payments | Delayed payments |
| Block templates | Mining jobs | Wasted work |

## 2. Threat Actors

### External
- **Script Kiddies**: Automated scanning, known exploits
- **Competitors**: DDoS, spam attacks
- **Sophisticated Attackers**: 51% attack, exploit development
- **Nation States**: (Low probability for small chain)

### Internal
- **Malicious Developer**: Backdoor insertion
- **Compromised Maintainer**: Supply chain attack

## 3. Attack Vectors

### 3.1 Consensus Attacks
| Attack | Description | Mitigation |
|--------|-------------|------------|
| 51% Attack | Hashrate majority | Monitor hashrate distribution |
| Selfish Mining | Block withholding | DAA design |
| Time Warp | Timestamp manipulation | Timestamp validation |
| Long Range | Historical reorg | Checkpoint system |

### 3.2 Network Attacks
| Attack | Description | Mitigation |
|--------|-------------|------------|
| Eclipse | Isolate node from network | Multiple outbound connections |
| Sybil | Fake peer flooding | Peer reputation |
| DDoS | Resource exhaustion | Rate limiting |
| BGP Hijack | Route manipulation | Multiple seed DNS |

### 3.3 Pool Attacks
| Attack | Description | Mitigation |
|--------|-------------|------------|
| Share Spam | Invalid share flooding | Anti-spam module |
| Block Withholding | Find but don't submit | Statistical detection |
| Pool Hopping | Exploit PPLNS window | Proper PPLNS implementation |

### 3.4 Implementation Bugs
| Category | Examples | Mitigation |
|----------|----------|------------|
| Memory Safety | Buffer overflow, use-after-free | Rust language |
| Logic Bugs | Integer overflow, off-by-one | Code review, testing |
| Crypto Bugs | Weak RNG, side channels | Audited libraries |
| Parsing Bugs | Malformed input crashes | Fuzzing |

## 4. Risk Assessment

| Threat | Likelihood | Impact | Risk Level |
|--------|------------|--------|------------|
| 51% Attack | Medium | Critical | HIGH |
| DDoS | High | Medium | HIGH |
| Share Spam | High | Low | MEDIUM |
| Implementation Bug | Medium | High | HIGH |
| Eclipse Attack | Low | High | MEDIUM |
| Key Compromise | Low | Critical | MEDIUM |

## 5. Security Controls

### Implemented
- [x] Rust memory safety
- [x] Input validation
- [x] Rate limiting (basic)
- [x] Logging/monitoring

### Planned
- [ ] P2P encryption
- [ ] Fuzzing coverage
- [ ] Security audit
- [ ] Bug bounty program

### Not Planned (v1)
- Formal verification
- Hardware security modules
- Multi-party computation
```

### Task 5.2: Fuzzing Infrastructure

**Čas:** 24h

#### 5.2.1 Setup cargo-fuzz

```toml
# fuzz/Cargo.toml
[package]
name = "zion-fuzz"
version = "0.0.1"
edition = "2021"
publish = false

[package.metadata]
cargo-fuzz = true

[dependencies]
libfuzzer-sys = "0.4"
arbitrary = { version = "1", features = ["derive"] }
zion-core = { path = "../zion-native/core" }
zion-pool = { path = "../zion-native/pool" }

[[bin]]
name = "fuzz_json_rpc"
path = "fuzz_targets/json_rpc.rs"

[[bin]]
name = "fuzz_stratum"
path = "fuzz_targets/stratum.rs"

[[bin]]
name = "fuzz_block_deser"
path = "fuzz_targets/block_deser.rs"

[[bin]]
name = "fuzz_tx_deser"
path = "fuzz_targets/tx_deser.rs"
```

#### 5.2.2 JSON-RPC Fuzzer

```rust
// fuzz/fuzz_targets/json_rpc.rs
#![no_main]
use libfuzzer_sys::fuzz_target;
use zion_core::rpc::parse_rpc_request;

fuzz_target!(|data: &[u8]| {
    // Try to parse as JSON-RPC request
    if let Ok(s) = std::str::from_utf8(data) {
        let _ = parse_rpc_request(s);
    }
});
```

#### 5.2.3 Stratum Message Fuzzer

```rust
// fuzz/fuzz_targets/stratum.rs
#![no_main]
use libfuzzer_sys::fuzz_target;
use zion_pool::stratum::parse_stratum_message;

fuzz_target!(|data: &[u8]| {
    // Stratum is newline-delimited JSON
    if let Ok(s) = std::str::from_utf8(data) {
        for line in s.lines() {
            let _ = parse_stratum_message(line);
        }
    }
});
```

#### 5.2.4 Block Deserialization Fuzzer

```rust
// fuzz/fuzz_targets/block_deser.rs
#![no_main]
use libfuzzer_sys::fuzz_target;
use zion_core::blockchain::Block;

fuzz_target!(|data: &[u8]| {
    // Try to deserialize as block
    let _ = Block::from_bytes(data);
    
    // Try to deserialize as block header
    let _ = BlockHeader::from_bytes(data);
});
```

#### 5.2.5 Transaction Fuzzer

```rust
// fuzz/fuzz_targets/tx_deser.rs
#![no_main]
use libfuzzer_sys::fuzz_target;
use arbitrary::Arbitrary;
use zion_core::transaction::Transaction;

#[derive(Arbitrary, Debug)]
struct FuzzInput {
    raw_bytes: Vec<u8>,
    json_string: String,
}

fuzz_target!(|input: FuzzInput| {
    // Binary deserialization
    let _ = Transaction::from_bytes(&input.raw_bytes);
    
    // JSON deserialization
    let _ = serde_json::from_str::<Transaction>(&input.json_string);
});
```

#### 5.2.6 Fuzzing Scripts

```bash
#!/bin/bash
# scripts/run_fuzz.sh

set -e

FUZZ_TIME=${1:-3600}  # Default 1 hour per target

echo "=== ZION Fuzzing Campaign ==="

# Install cargo-fuzz if needed
if ! command -v cargo-fuzz &> /dev/null; then
    cargo install cargo-fuzz
fi

cd fuzz

TARGETS=(
    "fuzz_json_rpc"
    "fuzz_stratum"
    "fuzz_block_deser"
    "fuzz_tx_deser"
)

for target in "${TARGETS[@]}"; do
    echo "[*] Fuzzing $target for ${FUZZ_TIME}s..."
    
    # Run fuzzer
    timeout ${FUZZ_TIME}s cargo +nightly fuzz run $target -- \
        -max_len=65536 \
        -timeout=5 \
        2>&1 | tee "logs/${target}.log" || true
    
    # Check for crashes
    if ls artifacts/$target/crash-* 2>/dev/null; then
        echo "[!] CRASHES FOUND in $target"
        cp artifacts/$target/crash-* "../reports/crashes/"
    else
        echo "[✓] No crashes in $target"
    fi
done

echo "=== Fuzzing Complete ==="
```

### Task 5.3: Differential Fuzzing (Optional)

**Čas:** 8h

Compare implementation against reference:

```rust
// fuzz/fuzz_targets/diff_hash.rs
#![no_main]
use libfuzzer_sys::fuzz_target;

fuzz_target!(|data: &[u8]| {
    // Our implementation
    let our_hash = zion_core::hash::cosmic_harmony_hash(data);
    
    // Reference implementation (if available)
    let ref_hash = reference_cosmic_harmony(data);
    
    assert_eq!(our_hash, ref_hash, "Hash mismatch!");
});
```

### Task 5.4: Security Code Review Checklist

**Čas:** 8h

```markdown
# docs/security/CODE_REVIEW_CHECKLIST.md

## Critical Paths

### Key Management
- [ ] Private keys never logged
- [ ] Keys zeroized after use
- [ ] Secure random for key generation
- [ ] No hardcoded keys/secrets

### Cryptography
- [ ] Using audited crypto libraries
- [ ] No custom crypto implementations
- [ ] Proper nonce handling
- [ ] Signature validation complete

### Input Validation
- [ ] All external inputs validated
- [ ] Integer overflow checks
- [ ] String length limits
- [ ] UTF-8 validation

### Memory Safety (Rust-specific)
- [ ] Minimal unsafe blocks
- [ ] All unsafe documented
- [ ] No raw pointer arithmetic
- [ ] Bounds checking maintained

### Consensus Critical
- [ ] Block validation complete
- [ ] TX validation complete
- [ ] Difficulty calculation reviewed
- [ ] Reward calculation reviewed
- [ ] Timestamp validation

### Network
- [ ] Rate limiting implemented
- [ ] Connection limits enforced
- [ ] Message size limits
- [ ] Timeout handling

## Review Process

1. Two independent reviewers for critical paths
2. Security-focused review (not just functionality)
3. Document all findings
4. Verify fixes before close
```

### Task 5.5: Incident Response Plan

**Čas:** 8h

```markdown
# docs/security/INCIDENT_RESPONSE.md

## Severity Levels

| Level | Description | Example | Response Time |
|-------|-------------|---------|---------------|
| P0 | Active exploit, fund loss | Key compromise | Immediate |
| P1 | Critical vuln, not exploited | RCE in parser | <4 hours |
| P2 | Significant vuln | DoS vector | <24 hours |
| P3 | Minor issue | Info leak | <1 week |

## Response Procedures

### P0 - Active Exploit

1. **Contain** (0-15 min)
   - Shut down affected services
   - Preserve evidence (logs, memory dumps)
   - Notify core team

2. **Assess** (15-60 min)
   - Identify attack vector
   - Determine scope of damage
   - Check for lateral movement

3. **Remediate** (1-4 hours)
   - Deploy hotfix if available
   - Rotate compromised keys
   - Block attacker if possible

4. **Communicate** (as appropriate)
   - Internal stakeholders immediately
   - Community within 24h
   - Full postmortem within 1 week

### P1 - Critical Vulnerability

1. **Verify** (<30 min)
   - Reproduce the issue
   - Assess exploitability
   - Check if actively exploited

2. **Develop Fix** (<4 hours)
   - Create minimal patch
   - Test thoroughly
   - Prepare deployment

3. **Deploy** (<1 hour)
   - Coordinate deployment
   - Monitor for issues
   - Verify fix effective

4. **Disclose** (after fix deployed)
   - CVE if applicable
   - Security advisory
   - Credit reporter

## Contact Tree

| Role | Contact | Backup |
|------|---------|--------|
| Security Lead | TBD | TBD |
| Core Dev | TBD | TBD |
| Ops | TBD | TBD |

## Communication Channels

- **Internal**: Secure chat (Signal group)
- **Public**: Security advisory page
- **Reporters**: security@zionterranova.com
```

### Task 5.6: Audit Preparation

**Čas:** 16h

```markdown
# docs/security/AUDIT_SCOPE.md

## Audit Scope

### In Scope

1. **zion-native/core/**
   - Consensus logic (critical)
   - Block/TX validation (critical)
   - P2P message handling (high)
   - RPC handlers (medium)
   - Storage layer (medium)

2. **zion-native/pool/**
   - Share validation (high)
   - Payout logic (critical)
   - Stratum handlers (medium)

3. **zion-wallet/** (if exists)
   - Key generation (critical)
   - TX signing (critical)
   - Storage encryption (critical)

### Out of Scope

- Frontend/UI code
- Build scripts
- Test code (unless testing critical paths)
- Documentation
- Third-party dependencies (separate audit)

## Audit Preparation Checklist

### Documentation
- [ ] Architecture overview
- [ ] Data flow diagrams
- [ ] Trust boundaries marked
- [ ] Known issues documented

### Code Quality
- [ ] Clean compile (no warnings)
- [ ] Tests passing
- [ ] Code comments current
- [ ] Dependencies up to date

### Build Reproducibility
- [ ] Documented build steps
- [ ] Pinned dependency versions
- [ ] Deterministic builds verified

## Deliverables for Auditor

1. Source code (tagged version)
2. Build instructions
3. Architecture documentation
4. Threat model
5. Previous findings (if any)
6. Test coverage report
7. Access to test environment

## Timeline Estimate

| Phase | Duration |
|-------|----------|
| Preparation | 1-2 weeks |
| Audit | 2-4 weeks |
| Remediation | 1-2 weeks |
| Re-review | 1 week |
| **Total** | **5-9 weeks** |

## Budget Estimate

| Scope | Lines of Code | Estimated Cost |
|-------|---------------|----------------|
| Core | ~6,500 | $30-50k |
| Pool | ~6,800 | $30-50k |
| Wallet | ~2,000 | $10-20k |
| **Total** | ~15,000 | **$70-120k** |

Note: Costs vary significantly by auditor reputation and complexity.
```

### Task 5.7: P2P Encryption (Optional for v1)

**Čas:** 24h (if implemented)

```rust
// src/p2p/noise.rs
use snow::{Builder, TransportState};

pub struct EncryptedConnection {
    transport: TransportState,
    inner: TcpStream,
}

impl EncryptedConnection {
    /// Perform Noise XX handshake as initiator
    pub async fn connect(addr: SocketAddr, static_key: &snow::Keypair) -> Result<Self> {
        let tcp = TcpStream::connect(addr).await?;
        
        let builder = Builder::new("Noise_XX_25519_ChaChaPoly_BLAKE2s".parse()?);
        let mut handshake = builder
            .local_private_key(&static_key.private)
            .build_initiator()?;
        
        // -> e
        let mut buf = vec![0u8; 65535];
        let len = handshake.write_message(&[], &mut buf)?;
        tcp.write_all(&buf[..len]).await?;
        
        // <- e, ee, s, es
        let len = tcp.read(&mut buf).await?;
        handshake.read_message(&buf[..len], &mut [])?;
        
        // -> s, se
        let len = handshake.write_message(&[], &mut buf)?;
        tcp.write_all(&buf[..len]).await?;
        
        let transport = handshake.into_transport_mode()?;
        
        Ok(Self { transport, inner: tcp })
    }
    
    pub async fn send(&mut self, data: &[u8]) -> Result<()> {
        let mut buf = vec![0u8; data.len() + 16]; // AEAD overhead
        let len = self.transport.write_message(data, &mut buf)?;
        self.inner.write_all(&buf[..len]).await?;
        Ok(())
    }
    
    pub async fn recv(&mut self) -> Result<Vec<u8>> {
        let mut buf = vec![0u8; 65535];
        let len = self.inner.read(&mut buf).await?;
        
        let mut plaintext = vec![0u8; 65535];
        let len = self.transport.read_message(&buf[..len], &mut plaintext)?;
        
        Ok(plaintext[..len].to_vec())
    }
}
```

---

## 📊 Success Metrics

| Metrika | Cíl |
|---------|-----|
| Fuzzing hours | >100 hours total |
| Crashes found | 0 (critical), <5 (minor) |
| Code coverage | >70% for critical paths |
| Threat model completeness | All vectors documented |
| Audit readiness | Checklist 100% |

---

## 📦 Deliverables

| Soubor | Popis |
|--------|-------|
| `docs/security/THREAT_MODEL.md` | Threat documentation |
| `docs/security/INCIDENT_RESPONSE.md` | Response procedures |
| `docs/security/AUDIT_SCOPE.md` | Audit preparation |
| `docs/security/CODE_REVIEW_CHECKLIST.md` | Review guide |
| `fuzz/` | Fuzzing infrastructure |
| `reports/fuzzing_results.md` | Fuzzing report |

---

## ⏱️ Time Estimate

| Task | Čas |
|------|-----|
| Threat Model | 16h |
| Fuzzing Setup | 24h |
| Fuzzing Runs | 40h (automated) |
| Code Review | 8h |
| Incident Response | 8h |
| Audit Prep | 16h |
| P2P Encryption | 24h (optional) |
| **Total** | **96-120h (~4 týdny)** |

---

## ✅ Exit Criteria

1. Threat model dokumentován a reviewed
2. Fuzzing běžel 100+ hodin bez kritických crashů
3. Code review checklist aplikován na critical paths
4. Incident response plan schválen
5. Audit scope a materiály připraveny

---

*Dokument aktualizován: 2026-02-03*
