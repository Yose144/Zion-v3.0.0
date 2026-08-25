# Running a ZION Node

A ZION node lets you have your own copy of the blockchain and independent access to the network. For most users, running your own node is not necessary — the public pool and RPC are enough.

## Requirements

- Linux / macOS / Windows (WSL)
- 4 GB RAM, 100 GB disk (full archive grows)
- Rust toolchain (to build from source)

## Build from source

The public repository is at:

```bash
git clone https://github.com/Zion-TerraNova/v3-Mainnet.git
cd v3-Mainnet/V3
cargo build --release -p zion-core --bin node
```

## Run the node

```bash
export ZION_NODE_ID="my-node-01"
export ZION_NODE_STATE_PATH="/var/lib/zion/state.db"
export ZION_P2P_BIND="0.0.0.0:8333"
export ZION_RPC_BIND="127.0.0.1:8443"
export ZION_METRICS_BIND="0.0.0.0:9115"
export ZION_SEED_PEERS="zionterranova.com:8333,zionterranova.com:8334"
export ZION_BLOCK_RETENTION=0

# Optional: all three fee-split wallets must be set together, or none
export ZION_HUMANITARIAN_WALLET="zion1..."
export ZION_ISSOBELLA_WALLET="zion1..."
export ZION_POOL_FEE_WALLET="zion1..."

./target/release/node
```

> **Note:** Set `ZION_BLOCK_RETENTION=0` so the old block-pruning bug does not repeat. Public RPC runs at `http://rpc.zionterranova.com:8443` (plain HTTP). Edge P2P ports are `8333`, `8334`; the V31 test node is on `8335`.

## Systemd service

```ini
[Unit]
Description=ZION Core Node
After=network-online.target

[Service]
Type=simple
User=zion
Group=zion
Environment="ZION_NODE_STATE_PATH=/var/lib/zion/state.db"
Environment="ZION_P2P_BIND=0.0.0.0:8333"
Environment="ZION_RPC_BIND=127.0.0.1:8443"
Environment="ZION_SEED_PEERS=zionterranova.com:8333,zionterranova.com:8334"
Environment="ZION_BLOCK_RETENTION=0"
ExecStart=/opt/zion/node
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
```

```bash
sudo cp zion-node.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now zion-node
```

## Public RPC

If you do not want to run a node locally, use the public RPC:

```text
http://rpc.zionterranova.com:8443
```

> Use `http://`, not `https://`. The RPC is a plain HTTP proxy through nginx to the internal Edge port `9443`.

## Inspect via CLI

```bash
zion node status
zion node sync
zion node peers
zion node blocks
zion node block 11184
```
