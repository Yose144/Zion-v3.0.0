# ZION Infrastructure Funding Disclosure

## Purpose

This document discloses how ZION protocol infrastructure is funded and maintained.

## Funding Sources

### 1. Genesis Premine — Infrastructure & Development Allocation

From the 16,780,000,000 ZION genesis premine:

| Allocation | ZION | Percentage | Purpose |
|-----------|------|------------|---------|
| Infrastructure & Dev | 2,500,000,000 | 15.4% | Server hosting, development, operations |
| DAO Treasury | 4,000,000,000 | 24.6% | Community-governed fund |

These allocations are **immediately unlocked** at genesis and fully transparent on-chain.

### 2. External Mining Revenue (DAO Treasury)

The DAO Treasury receives **100% of revenue** from external mining operations (ETC, RVN, XMR, FLUX).  
This revenue is used for:

- Server hosting and bandwidth costs
- Development tools and services
- Security audits
- Community programs and grants

**There is NO private investor funding, venture capital, or institutional money.**

## Infrastructure Costs

### Current Infrastructure (TestNet Phase)

| Resource | Provider | Monthly Cost | Purpose |
|----------|----------|-------------|---------|
| Helsinki Server (8GB, ARM64) | Hetzner Cloud | ~€10 | Seed node, pool, website |
| Germany Server (8GB, x86_64) | Hetzner Cloud | ~€10 | Peer node, redundancy |
| Domain (zionterranova.com) | Registrar | ~€12/yr | Protocol website |
| SSL Certificate | Let's Encrypt | Free | HTTPS |

**Total monthly infrastructure cost: ~€20**

### Planned MainNet Infrastructure

| Resource | Estimated Cost | Purpose |
|----------|---------------|---------|
| 5+ Seed Nodes (3 regions) | ~€50/month | Network decentralization |
| Monitoring (Prometheus + Grafana) | Included in servers | Uptime, performance |
| Block Explorer | Included in servers | Public chain data |
| CDN/DDoS Protection | ~€20/month | Availability |

**Estimated MainNet monthly cost: ~€70–100**

## Transparency Commitments

1. **All premine addresses are public** — listed in `PREMINE_ADDRESSES_PUBLIC.txt`
2. **All infrastructure spending is trackable** on-chain via DAO Treasury address
3. **No hidden allocations** — the entire supply schedule is deterministic
4. **Community oversight** — DAO governance will control treasury after MainNet launch

## Key Principles

- **No salaries from premine** — development is community-driven and voluntary
- **Minimal infrastructure** — lean operations, no unnecessary spending
- **Revenue = DAO Treasury** — all external mining revenue goes to community fund
- **Full transparency** — any community member can verify spending on-chain

## Who Operates Infrastructure?

Infrastructure is operated by independent community contributors.  
There is **no company** behind ZION — only a decentralized protocol and its community.

The protocol maintainer(s) provide:
- Server administration
- Software development and releases
- Documentation and community support

These contributions are **voluntary** and do not create employment, partnership, or equity relationships.

## Contact

For questions about infrastructure funding:
- GitHub: [github.com/Yose144/Zion-2.9.5](https://github.com/Yose144/Zion-2.9.5)
- Discord: [discord.gg/zion-terranova](https://discord.gg/zion-terranova)

---

*Document Version: 1.0*  
*Last Updated: 2026-02-11*
