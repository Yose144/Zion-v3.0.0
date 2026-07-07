# Security Policy

## Reporting a Vulnerability

If you discover a security vulnerability in ZION, please report it responsibly.

**DO NOT open a public GitHub issue.**

### Contact

- **Email:** security@zionterranova.com
- **Response time:** We aim to acknowledge reports within 48 hours and provide an initial assessment within 7 days.

### What to include

- Description of the vulnerability
- Steps to reproduce
- Potential impact assessment
- Suggested fix (if any)

### Disclosure policy

ZION follows a **fix first, disclose second** policy:

1. Reported vulnerabilities are evaluated and cross-checked
2. Fixes are developed, tested, and deployed
3. Public disclosure within 90 days of the fix being deployed
4. For actively exploited vulnerabilities, disclosure may be immediate after fix deployment

### Scope

The following are in scope for vulnerability reports:

| Component | Path | Description |
|-----------|------|-------------|
| L1 Consensus | `V3/L1/core/src/` | Block validation, transaction processing, P2P, RPC |
| Mining / PoW | `V3/L1/cosmic-harmony/src/` | Hash algorithms, difficulty adjustment |
| Pool Server | `V3/L1/pool/src/` | Mining pool, PPLNS payouts |
| L2 Bridge | `V3/L2/bridge/src/` | L1-to-EVM bridge relay |
| L2 DAO | `V3/L2/dao/src/` | Governance daemon |
| L2 Atomic Swap | `V3/L2/atomic-swap/src/` | Cross-chain atomic swaps |
| L3 WARP | `V3/L3/warp/src/` | Multi-chain bridge (12 chain families) |
| EVM Contracts | `V3/L2/bridge/contracts/` | Solidity smart contracts |
| Website | `APP&WEB/website-v2.9/` | Next.js frontend |

### Out of scope

- Social engineering attacks
- Denial of service (unless it affects consensus)
- Issues in third-party dependencies (report upstream)
- Vulnerabilities in archived/legacy code (`archive/`, `L1/`, `L2/`, `L3/` root dirs)

## Known Vulnerabilities

A machine-readable catalogue of disclosed vulnerabilities is maintained at:

- [`docs/security/vulnerabilities.json`](./docs/security/vulnerabilities.json)
- [`docs/security/SECURITY_DISCLOSURE_2026-07.md`](./docs/security/SECURITY_DISCLOSURE_2026-07.md)

## Bug Bounty

A formal bug bounty program will be announced after mainnet launch, funded from the DAO treasury.
