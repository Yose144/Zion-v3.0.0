# Frequently Asked Questions (FAQ)

---

### What is ZION?

ZION is a decentralized Layer 1 blockchain built from scratch in Rust. It uses Proof-of-Work consensus with the **Cosmic Harmony v3** algorithm and a 6-layer “On the Star” architecture. Version 2.9.6 introduced the 100+ year Decade Decay emission model and dedicated funding for planetary projects including the **ZION Issobella** space station.

---

### What consensus does it use?

Proof of Work with the **Cosmic Harmony v3** algorithm (multi-algo, CPU-friendly). Difficulty adjustment uses LWMA with a 60-block window.

---

### How much ZION do I get per block?

**5,400.067 ZION** during the first decade (2026–2036). The reward drops by 20% every 10 years (Decade Decay). After decade 10 (2126+), perpetual tail emission continues at **724.785 ZION/block**.

Distribution: 89% miner, 5% humanitarian, 5% L5/L6 Issobella fund, 1% pool fee.

---

### What is the total emission?

| Parameter | Value |
|-----------|-------|
| Total emission | 144B ZION |
| Premine | 16.78B ZION (11.65%) |
| Block reward (D1) | 5,400.067 ZION |
| Emission model | Decade Decay (-20% / 10 years) |
| Tail emission | 724.785 ZION/block (from 2126) |
| Mining horizon | 100+ years + infinite tail |

---

### How is the premine allocated?

| Fund | Amount | Share |
|------|--------|-------|
| ZION Oasis + Golden Egg | 4.95B | 30.4% |
| DAO Treasury | 4.00B | 24.6% |
| Infrastructure | 2.59B | 15.9% |
| Humanitarian Fund | 1.44B | 8.8% |

Everything is distributed at genesis. No additional minting exists outside mining.

---

### What happens to fees?

Fees are **burned**. This creates deflationary pressure and helps protect the network from spam.

---

### How do I start mining?

The fastest route is Docker, see [Quick Start →](#getting-started). You can also download binaries from [Download](https://www.zionterranova.com/download).

---

### How do I connect to a testnet node?

```bash
./zion-core --network testnet \
  --peers "seed.zionterranova.com:8334"
```

---

### Which ports do I need?

| Network | P2P | RPC | Stratum | Pool API |
|---------|-----|-----|---------|----------|
| Testnet | 8334 | 8444 | 3333 | 8080 |
| Mainnet | 8333 | 8443 | 3333 | 8080 |

---

### When is mainnet planned?

Current public status: **NO-GO until closure evidence is complete**. End-2026 remains a target window, not a guaranteed date. See the current status in [Roadmap →](#whitepaper-roadmap).

---

### Is ZION CPU-only?

Yes. Cosmic Harmony v3 is designed to be CPU-friendly, so ASICs and GPUs do not have a dramatic advantage over modern CPUs.

---

### Is there a wallet?

The desktop wallet is still in development. For now, the active interfaces are the CLI wallet and RPC API.

---

### Where is the source code?

In the [Zion-TerraNova](https://github.com/Zion-TerraNova) GitHub organisation:

- [2.9.5-NativeAwakening](https://github.com/Zion-TerraNova/2.9.5-NativeAwakening) — current historical release line
- [v3-Mainnet](https://github.com/Zion-TerraNova/v3-Mainnet) — mainnet preparation line

---

### How can I contribute?

- By mining — every node helps decentralisation
- By code — submit a PR on [GitHub](https://github.com/Zion-TerraNova)
- By community work — join [Discord](https://discord.gg/zion-terranova)

---

### Where next?

- [Quick Start →](#getting-started)
- [Mining Guide →](#mining-guide)
- [API Reference →](#api)
- [Whitepaper →](#whitepaper-full)

---

*ZION TerraNova v2.9.6*