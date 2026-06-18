# Governance — ZION v2.9.5

---

## Governance model

ZION uses a hybrid model:

1. **On-chain** — DAO Treasury (4B ZION) governed by votes  
2. **Off-chain** — community discussion (GitHub Issues, Discord)  
3. **Immutable core** — foundational parameters cannot be changed by vote alone  

---

## Immutable parameters

Hard-coded and not changeable by governance vote:

| Parameter | Value | Rationale |
|-----------|-------|-----------|
| Total supply | 144B ZION | Inflation protection |
| Block reward | 5,400.067 ZION | Predictable issuance (v2.9.5 constant model) |
| Halving | None | Stable miner incentives in that era |
| Fee policy | Burn | Deflationary pressure |
| Genesis timestamp | Jan 1, 2024 UTC | Historical integrity |
| Premine allocation | 16.28B | Transparent categories |

*(Later releases adjust reward *schedule* via protocol rules such as decade decay — follow the active version docs for current economics.)*

---

## DAO treasury

- **Pool**: ~4B ZION (premine allocation)  
- **Purpose**: development, infra, ecosystem grants  
- **Control**: community voting workflows  
- **Transparency**: allocations should be tracked on-chain where applicable  

---

## Change proposals

1. Open a GitHub Issue prefixed `[PROPOSAL]`  
2. Discuss for at least ~7 days  
3. Vote — weight typically tied to held ZION where implemented  
4. Implement when quorum / threshold criteria are met  

---

## Typically vote-eligible knobs

- DAO treasury disbursements  
- Mempool tuning parameters exposed to governance  
- P2P connection limits where configurable  
- Non-consensus RPC / operator presets  
- New non-breaking features gated behind soft forks  

---

## Not governed by ordinary vote alone

- Long-term emission curve invariant (144B cap)  
- Consensus algorithm substitutions (needs hard fork + broad social consensus)  
- Rewriting premine allocations post-genesis  

---

## Links

- [GitHub Issues](https://github.com/Zion-TerraNova/2.9.6/issues) — proposals  
- [Security overview](./security.md)  
- [Roadmap snapshot](./roadmap.md)  

---

*ZION TerraNova v2.9.5*
