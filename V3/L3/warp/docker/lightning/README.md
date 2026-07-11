# ZION WARP — Lightning Network Docker Stack

Docker setup for running **LND** (Lightning Network Daemon) + **bitcoind** (testnet) + **Redis** for the WARP Lightning adapter.

## Architecture

```
┌─────────────────────────────────────────────────────┐
│  Edge Server (62.171.141.136)                       │
│                                                     │
│  ┌──────────┐    ZMQ     ┌──────────┐               │
│  │ bitcoind │◄──────────►│   LND    │  REST :8080   │
│  │ testnet  │            │  (LN)    │◄─────────────┐│
│  │ :18332   │            │ :10009   │              ││
│  └──────────┘            └──────────┘              ││
│                               │                     ││
│                          ┌────▼────┐                ││
│                          │  Redis  │                ││
│                          │ :6379   │                ││
│                          └─────────┘                ││
│                                                     ││
│  ┌──────────────────────────────────────────────┐  ││
│  │  WARP Adapter (zion-warp-server)             │──┘│
│  │  WARP_LN_NODE_URL=https://lnd:8080           │   │
│  │  WARP_LN_MACAROON=<hex macaroon>             │   │
│  └──────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────┘
```

## Quick Start

### 1. Start the stack

```bash
cd V3/L3/warp/docker/lightning
docker compose up -d
```

### 2. Create LND wallet (first run only)

```bash
# Enter the LND container and create a wallet
docker exec -it zion-lnd lncli --network=testnet create

# You'll be prompted for:
# - Wallet password (save this!)
# - Recovery seed (write down the 24 words)
```

### 3. Wait for bitcoind + LND to sync

```bash
# Check bitcoind sync status
docker exec zion-bitcoind bitcoin-cli -testnet getblockchaininfo

# Check LND sync status
docker exec zion-lnd lncli --network=testnet getinfo

# LND needs bitcoind to be synced first. Testnet sync can take
# several hours with pruning. Monitor with:
docker logs -f zion-lnd
```

### 4. Get the admin macaroon (hex-encoded)

```bash
# Extract hex-encoded macaroon for WARP_LN_MACAROON
docker exec zion-lnd xxd -p -c 1000 \
  /root/.lnd/data/chain/bitcoin/testnet/admin.macaroon
```

Or use the helper script:

```bash
cd V3/L3/warp/scripts/lightning
./get_macaroon.sh
```

### 5. Configure WARP adapter

Set these environment variables for the WARP server:

```bash
export WARP_LN_NODE_URL=https://lnd:8080
export WARP_LN_MACAROON=<hex macaroon from step 4>
# Optional: path to TLS cert for self-signed verification
# export WARP_LN_TLS_CERT=/root/.lnd/tls.cert
```

Or add to the Edge environment file at `edge-deploy/config/edge-environment.sh`:

```bash
WARP_LN_NODE_URL=https://lnd:8080
WARP_LN_MACAROON=<hex macaroon>
```

### 6. Open a Lightning channel

```bash
cd V3/L3/warp/scripts/lightning

# Open channel to ACINQ (testnet)
./open_channel.sh

# Or list existing channels
./list_channels.sh
```

### 7. Test invoice creation / payment

```bash
# Create a test invoice
./create_invoice.sh 1000 "WARP test invoice"

# Pay an invoice
./pay_invoice.sh lntb1u1pj...
```

## Service Ports

| Service    | Port  | Purpose                     |
|------------|-------|-----------------------------|
| bitcoind   | 18332 | testnet RPC                 |
| bitcoind   | 18333 | testnet P2P                 |
| bitcoind   | 28332 | ZMQ raw tx (for LND)        |
| bitcoind   | 28333 | ZMQ raw block (for LND)     |
| LND        | 8080  | REST API (WARP uses this)   |
| LND        | 10009 | gRPC API                    |
| LND        | 9735  | Lightning P2P               |
| Redis      | 6379  | Invoice tracking cache      |

## Well-Known Lightning Nodes (testnet)

| Node       | Pubkey / Host                                        |
|------------|------------------------------------------------------|
| ACINQ      | `039dc85bb5b39e2cefd39a0d05a52f2f2dac6b07a2b8c4f6e6  |
|            | 7e0e6f3f3f3f3f3f3f3f3f3f3f3f3f3f3f3f3f3f3f3f3f3f3`  |
|            | `@acinq.co:9735`                                     |
| Lightning  | Use `1ml.com/testnet` to find testnet nodes          |
| Labs       | with good uptime and capacity.                       |

> **Note:** Testnet node pubkeys change frequently. Always verify the
> current pubkey from [1ml.com/testnet](https://1ml.com/testnet) or
> [amboss.space](https://amboss.space) (testnet) before opening a channel.

## Switching to Mainnet

1. In `docker-compose.yml`: no port changes needed (LND auto-detects network)
2. In `bitcoin.conf`: remove `testnet=1`, set `rpcport=8332`, `port=8333`
3. In `lnd.conf`: set `bitcoin.testnet=false`, `bitcoin.mainnet=true`,
   `bitcoind.rpchost=bitcoind:8332`
4. **WARNING:** Mainnet requires a full node sync (400+ GB) and real BTC.
   Use `prune=0` or a high prune value for mainnet.

## Troubleshooting

### LND can't connect to bitcoind

```bash
# Check bitcoind is running and RPC is accessible
docker exec zion-bitcoind bitcoin-cli -testnet getblockcount

# Check LND logs
docker logs zion-lnd | grep -i "bitcoind"
```

### "wallet not found" on first `lncli` command

LND needs a wallet created first:
```bash
docker exec -it zion-lnd lncli --network=testnet create
```

### Macaroon permission denied

Make sure you're using the **admin.macaroon** (not invoice.macaroon or
readonly.macaroon). The WARP adapter needs admin access for both creating
invoices and sending payments.

### WARP adapter "stub mode"

If the WARP adapter logs "No LND client configured — adapter in stub mode",
check that both `WARP_LN_NODE_URL` and `WARP_LN_MACAROON` are set in the
environment. The adapter checks these on startup via `LndClient::from_env()`.

### TLS certificate errors

LND uses self-signed TLS certificates. The WARP adapter already uses
`danger_accept_invalid_certs(true)` to handle this. If you need to verify
the cert, set `WARP_LN_TLS_CERT` to the path of `tls.cert` (inside the
LND container at `/root/.lnd/tls.cert`).

## Files

```
docker/lightning/
├── docker-compose.yml   # bitcoind + LND + Redis stack
├── lnd.conf             # LND configuration (REST 8080, gRPC 10009, keysend)
├── bitcoin.conf         # bitcoind configuration (testnet, ZMQ, pruned)
└── README.md            # This file
```

## Related Files

- `V3/L3/warp/src/adapter/lightning.rs` — WARP Lightning adapter
- `V3/L3/warp/src/lightning_signer.rs` — LND REST client
- `V3/L3/warp/src/bolt11.rs` — BOLT11 invoice parser
- `V3/L3/warp/scripts/lightning/` — Channel management scripts
- `edge-deploy/systemd/zion-edge-lnd.service` — systemd service for LND
