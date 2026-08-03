# Spuštění ZION nodu

ZION node ti umožní mít vlastní kopii blockchainu a nezávislý přístup k síti.

## Požadavky

- Linux / macOS / Windows (WSL)
- 4 GB RAM, 100 GB disk (plný archiv roste)
- Rust toolchain (pro build ze zdroje)

## Build a spuštění

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

## Systemd služba

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

## Veřejný RPC

Pokud node nechceš provozovat lokálně, použij veřejný RPC:

- `https://rpc.zionterranova.com:8443`
