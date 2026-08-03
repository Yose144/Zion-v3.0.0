# Mining ZION

ZION mining runs on the **Cosmic Harmony Deeksha** algorithm.

> **Why mine now:** ZION is in the first decade of emission — the reward of **5,400 ZION/block** is the highest the protocol will ever pay out, and with each subsequent decade it drops by a fifth. The network is still small, so fewer machines are competing for found blocks. No one is promising a price or profit — just the honest mathematics of early entry. The full story (including Bitcoin Pizza Day) can be found in the chapter [The Hour Before the Rain](/onboard#why-now).

## The easiest way — ZION Public Miner

For most users, the easiest way to mine is through the desktop application:

1. Install **ZION Public Miner** (see the **Desktop App** category).
2. Create a wallet and get your address.
3. Set the **Pool** to `62.171.141.136:8444`.
4. Choose the number of CPU threads and optionally turn on GPU.
5. Click **Start Mining**.

The app takes care of everything else — connecting to the pool, tracking hashrate and shares.

## Network parameters

- **Block time:** 60 s
- **Block reward:** 5,400.067 ZION
- **DAA:** LWMA 60 blocks, ±25%
- **Mining horizon:** 100+ years

## Block reward distribution

| Recipient | Share |
|----------|-------|
| ⛏️ Miners | 89% |
| 🕊️ Humanitarian Tithe | 5% |
| 🔭 L5/L6 Issobella Fund | 5% |
| 🏊 Pool Fee | 1% |

## Advanced mining from the command line

```bash
./target/release/zion-miner \
  --pool seed.zionterranova.com:3333 \
  --wallet "zion1qYOUR_ADDRESS" \
  --worker my-rig \
  --algo cosmic_harmony \
  --threads 4
```

## Pool dashboard

You can find the web pool overview at:

- `https://pool.zionterranova.com`

## Tips

1. For CPU mining, set `--threads` according to the number of physical cores.
2. Monitor temperature and power consumption.
3. Make sure your wallet address is backed up.
