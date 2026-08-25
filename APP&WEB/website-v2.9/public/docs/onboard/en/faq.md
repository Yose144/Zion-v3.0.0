# FAQ — ZION TerraNova Onboard

Answers to the basics. For the full story, whitepaper, and mining motivation, see [Massive Onboarding](/onboard#massive-onboarding).

---

## 1. What is ZION?

ZION is a **proof-of-work blockchain** that wants to be a compass for a new economy — not a promise of price, but open-source code, a public chain, and a network that grows before every tavern is talking about it.

- **Hard cap:** 144,000,000,000 ZION
- **Block time:** ~60 s
- **Block reward (Decade 1, 2026–2036):** 5,400.067 ZION — the highest in the network's history
- **Genesis:** August 8, 2026 — after two hard resets, the third and final genesis; this chain is the **Mainnet Launch for December 31, 2026**
- **Code license:** MIT

---

## 2. Why mine now?

Because the block reward is the highest it will ever be today, and the network is still small. Each following decade, the reward drops by 20%. This is not investment advice — it is the emission math you can verify in code.

---

## 3. How do I start mining?

### Public Desktop App (Windows 11 / macOS)

1. Download the installer from [GitHub release v3.1.0-desktop](https://github.com/Zion-TerraNova/v3-Mainnet/releases/tag/v3.1.0-desktop).
2. Install and, if needed, allow it in system settings (Windows SmartScreen / macOS Gatekeeper).
3. Create a wallet in the **Wallet** tab and write down the seed offline.
4. Set the pool to `pool.zionterranova.com:8444` and choose a worker name.
5. Click **Start Mining**.

The app is free. In the public version, all three Trinity streams are automatically routed into **ZION Liquidity & Grow**, so the yields from secondary streams strengthen the growth of the whole network. A future VIP miner will let you configure the remaining two streams yourself.

### From the terminal (for the roots)

```bash
git clone https://github.com/Zion-TerraNova/v3-Mainnet.git
cd v3-Mainnet
cargo build --release --bin zion-miner

./target/release/zion-miner \
  --pool pool.zionterranova.com:8444 \
  --wallet zion1...your_address \
  --worker my-first-rig
```

---

## 4. How much will I earn?

**No one can promise a price or profit.** You earn ZION, whose future value is set by the market. Today the reward is the highest ever, and fewer miners share the blocks. Tomorrow may not be the same.

---

## 5. How do I create a wallet?

### In the Desktop App
- **Wallet** tab → **Create Wallet**.
- Write the seed on paper and store it offline in a safe place.
- Use the public `zion1...` address for mining.

### From CLI
```bash
export ZION_WALLET_PASSWORD="your-strong-password"
zion wallet new --out zion-wallet.json --password-env ZION_WALLET_PASSWORD
```

Never show your seed to anyone, never store it in the cloud, and never photograph it.

---

## 6. What is the Trinity Miner?

One miner can run three hashrate streams at once:

- **ZION** (Ekam Deeksha PoW) — main stream
- **GPU AuxPoW** (e.g. ZANO) — optional
- **CPU AuxPoW** (e.g. VRSC) — optional

It is a technical option, not a profit calculator. Performance depends on your hardware.

---

## 7. What are the public network endpoints?

| Service | Address |
|---|---|
| Pool (Stratum) | `pool.zionterranova.com:8444` |
| RPC | `rpc.zionterranova.com:8443` |
| Web | `https://app.zionterranova.com` |
| wZION on Base | `0x0c493763d107ab0ABb0aee1Ca3999292d8202bb6` |
| Code | `github.com/Zion-TerraNova/v3-Mainnet` |

---

## 8. I want to run my own node

Most people do not need this — the public RPC is enough. If you want your own copy of the chain:

```bash
git clone https://github.com/Zion-TerraNova/v3-Mainnet.git
cd v3-Mainnet
cargo build --release --bin zion-node
```

Start with public seed peers:

```text
zionterranova.com:8333
zionterranova.com:8334
```

If you don't want a node, use the public RPC:

```text
http://rpc.zionterranova.com:8443
```

---

## 9. What is wZION and the bridge?

**wZION** is an ERC-20 ZION token on Base. It lets you move ZION between L1 and an Ethereum L2 and back. The address is verified on Basescan. The bridge is in public beta — don't send more than you can afford to test.

---

## 10. What is OASIS?

**OASIS** is ZION's game world — a 3D galaxy of 400+ worlds, avatars, and the Tree of Life. Today it is a **public preview**, not a finished AAA game. You can explore it at [oasis.zionterranova.com](https://oasis.zionterranova.com), but you are at the first rows.

---

## 11. Is there a pre-mine, ICO, or presale?

No. No ICO. No presale. No VIP allocation. The premine is publicly auditable and goes toward network operations, development, and the founding community — not into private pockets.

---

## 12. Is ZION investment advice?

**Never.** There is no promise of price or guaranteed profit. It is a running technical network, and everyone measures their own risk. All we promise is in the code, and you can verify it.

---

> *No one will chase you. The ark is not built by shouting — it is built block by block, 60 seconds after 60 seconds, and the doors are open.*
