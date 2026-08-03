# Running a ZION Node

A ZION node lets you have your own copy of the blockchain and independent access to the network.

## Requirements

- Linux / macOS / Windows (WSL)
- 4 GB RAM, 100 GB disk (a full archive grows over time)
- Rust toolchain (for building from source)

## Build and run

```bash
git clone https://github.com/Zion-TerraNova/2.9.6.git
cd 2.9.6

cargo build --release

./target/release/zion-core \
  --data-dir /data/zion \
  --rpc-port 8444 \
  --p2p-port 8334 \
  --network mainnet \
  --peers "seed.zionterranova.com:8334"
```

## Systemd service

```ini
[Unit]
Description=ZION Core Node
After=network-online.target

[Service]
Type=simple
User=zion
Group=zion
ExecStart=/opt/zion/zion-core --data-dir /data/zion --rpc-port 8444 --p2p-port 8334 --network mainnet
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
```

```bash
sudo cp zion-core.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now zion-core
```

## Public RPC

If you don't want to run a node locally, use the public RPC:

- `https://rpc.zionterranova.com:8443`
