# Spuštění ZION nodu

ZION node ti umožní mít vlastní kopii blockchainu a nezávislý přístup k síti. Pro většinu uživatelů není potřeba provozovat vlastní uzel — veřejný pool a RPC stačí.

## Požadavky

- Linux / macOS / Windows (WSL)
- 4 GB RAM, 100 GB disk (plný archiv roste)
- Rust toolchain (pro build ze zdroje)

## Build ze zdroje

Repozitář veřejně najdeš na:

```bash
git clone https://github.com/Zion-TerraNova/v3-Mainnet.git
cd v3-Mainnet/V3
cargo build --release -p zion-core --bin node
```

## Spuštění uzlu

```bash
export ZION_NODE_ID="my-node-01"
export ZION_NODE_STATE_PATH="/var/lib/zion/state.db"
export ZION_P2P_BIND="0.0.0.0:8333"
export ZION_RPC_BIND="127.0.0.1:8443"
export ZION_METRICS_BIND="0.0.0.0:9115"
export ZION_SEED_PEERS="62.171.141.136:8333,62.171.141.136:8334"
export ZION_BLOCK_RETENTION=0

# Volitelné: fee-split peněženky musí být nastaveny všechny tři najednou, nebo žádná
export ZION_HUMANITARIAN_WALLET="zion1..."
export ZION_ISSOBELLA_WALLET="zion1..."
export ZION_POOL_FEE_WALLET="zion1..."

./target/release/node
```

> **Poznámka:** Nastav `ZION_BLOCK_RETENTION=0`, aby se neopakoval starý bug s ořezáváním historie. Veřejný RPC běží na `http://rpc.zionterranova.com:8443` (plain HTTP). Edge P2P porty jsou `8333`, `8334`; V31 test node je na `8335`.

## Systemd služba

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
Environment="ZION_SEED_PEERS=62.171.141.136:8333,62.171.141.136:8334"
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

## Veřejný RPC

Pokud node nechceš provozovat lokálně, použij veřejný RPC:

```text
http://rpc.zionterranova.com:8443
```

> Použij `http://`, nikoli `https://`. RPC je plain HTTP proxy přes nginx na interní Edge port `9443`.

## Inspekce přes CLI

```bash
zion node status
zion node sync
zion node peers
zion node blocks
zion node block 11184
```
