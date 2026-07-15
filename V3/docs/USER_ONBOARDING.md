# ZION CLI User Onboarding Guide

This guide walks a new operator through installing the unified `zion` CLI, creating a wallet, connecting to the network, and performing the first basic operations.

## 1. Install the CLI

### From a release binary (recommended)

Download the latest release asset for your platform from the [GitHub releases page](https://github.com/Zion-TerraNova/v3-Mainnet/releases) and verify the SHA256 checksum:

```bash
tar -xzf zion-cli-linux-x86_64.tar.gz
sudo mv zion /usr/local/bin/
zion --help
```

### Build from source

From the `V3/` workspace root:

```bash
cargo build --release -p zion-cli
./target/release/zion --help
```

## 2. First-time setup

Run the interactive onboarding wizard:

```bash
zion onboard
```

The wizard will:
- create `~/.zion/zion.toml` with sensible defaults,
- ask for a topology preset (standard Core+Edge or custom),
- create `zion-wallet.json` in the current directory,
- optionally set the wallet as the default mining address.

## 3. Configuration files

After onboarding, your config lives at:

```text
~/.zion/zion.toml
```

Common overrides:

```bash
# Point the CLI at a different RPC endpoint
zion config set node.rpc_host 62.171.141.136
zion config set node.rpc_port 9443

# Use the public pool instead of the local one
zion config set pool.host 62.171.141.136
zion config set pool.port 8444

# Change the mining payout address
zion config set miner.wallet zion1...
```

For a full list of keys, run `zion config set --help`.

### Environment variable overrides

Every `zion config set` key can also be set via an environment variable using the pattern `ZION_<SECTION>_<FIELD>` in upper snake case:

```bash
export ZION_NODE_RPC_HOST=62.171.141.136
export ZION_NODE_RPC_PORT=9443
export ZION_POOL_HOST=62.171.141.136
export ZION_POOL_PORT=8444
export ZION_MINER_WALLET=zion1...
```

Environment variables take precedence over values in `~/.zion/zion.toml`.

## 4. Wallet and password conventions

Create a wallet with optional encryption:

```bash
zion wallet create --out zion-wallet.json --password-env ZION_WALLET_PASSWORD
```

If the environment variable `ZION_WALLET_PASSWORD` is set, all wallet subcommands that need a password will use it automatically. You can also pass `--password-env` explicitly for a different variable name.

**Never** store the password in shell history. Prefer:

```bash
export ZION_WALLET_PASSWORD="your-strong-password"
zion wallet reveal
```

## 5. Check network status

```bash
zion status
zion doctor
```

`doctor` runs preflight checks for config, local tools, and reachable endpoints.

## 6. Query balance

```bash
zion wallet balance
# or for a specific address
zion wallet balance --address zion1...
```

## 7. Send ZION

```bash
zion wallet send --to zion1RECIPIENT --amount 10.5 --memo "hello"
```

The CLI reads the signing key from `zion-wallet.json` and submits the transaction through the configured RPC endpoint.

## 8. Start mining

CPU example:

```bash
zion mine start --cpu --threads 4 --pool 62.171.141.136:8444 --worker my-rig
```

GPU example:

```bash
zion mine start --opencl --pool 62.171.141.136:8444 --worker my-rig
```

Use `zion mine --help` to see backend options (`cpu`, `opencl`, `cuda`).

## 9. Check pool earnings

```bash
zion pool earnings
```

This queries the pool's HTTP API directly (`api/v1/miner/{address}/stats`), not the node's RPC.

## 10. Backup

Keep a copy of:

- `zion-wallet.json` (public address + encrypted secret)
- `~/.zion/zion.toml` (connection settings)
- your wallet password, stored separately in a password manager

## 11. Security checklist

- [ ] Password is exported only for the current shell session or stored in a password manager.
- [ ] Wallet file permissions are restrictive (`chmod 600 zion-wallet.json`).
- [ ] `ZION_WALLET_PASSWORD` is not logged or committed.
- [ ] Backups are stored offline or in an encrypted location.

## 12. Getting help

- `zion --help` — top-level commands
- `zion <command> --help` — command-specific help
- `V3/docs/CLI_TROUBLESHOOTING.md` — common issues
- `V3/docs/CLI_REFERENCE.md` — full command reference
