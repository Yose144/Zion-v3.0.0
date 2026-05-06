# Security — ZION v2.9.5

---

## Security layers

### 1. Rust memory safety

The ZION core is written in Rust to eliminate:

- Buffer overflows  
- Use-after-free  
- Data races  
- Null pointer dereferences  

Rust enforces many invariants at compile time without heavy runtime overhead.

### 2. Consensus

- **Cosmic Harmony v3** — PoW with LWMA DAA  
- **Soft finality**: ~60 blocks (~60 minutes)  
- **Max reorg depth**: 10 blocks — limits deep reorgs  
- **Min difficulty**: 1000 — mitigates difficulty collapse attacks  

### 3. P2P network

- Rate limiting (~100 msg/s per peer in reference configs)  
- Ban duration: 3600 s (mainnet) for protocol abuse  
- Max peers: 128 (96 inbound / 32 outbound — illustrative operator defaults)  
- Peer scoring with automatic disconnects  

### 4. RPC

- Bind to `127.0.0.1` in production (not `0.0.0.0`) where possible  
- Connection limits  
- Never expose private keys or unsigned privileged operations over open RPC  

---

## Threat mitigations

| Threat | Mitigation |
|--------|------------|
| 51% attack | LWMA DAA; multi-algo / memory-hard design goals |
| Selfish mining | Limited reorg depth |
| Sybil / spam peers | Peer scoring + rate limits |
| P2P DDoS | Rate limiting + bans |
| RPC abuse | Localhost bind + connection caps |
| Time warp | Timestamp validation rules |

---

## Operator hardening

1. **Firewall** — expose only required ports (P2P public; RPC local/VPN)  
2. **SSH** — keys + fail2ban-style lockouts  
3. **Updates** — track [GitHub releases](https://github.com/Zion-TerraNova/2.9.6/releases)  
4. **Monitoring** — alert on anomalous peer / RPC behaviour  
5. **Isolation** — run nodes under dedicated service accounts  

---

## Audit stance

- Internal review on materially risky PRs  
- External audits prioritized before mainnet-class launches  
- Bug bounty roadmap (announce when scope + rewards are finalized)  
- Public source invites community audit  

---

## Responsible disclosure

If you discover a vulnerability:

- Prefer GitHub **Security Advisory** on the canonical repo  
- Avoid public exploits before maintainers acknowledged a coordinated fix timeline  

---

## Related

- [Governance](./governance.md)

---

*ZION TerraNova v2.9.5*
