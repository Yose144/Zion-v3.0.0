# ZION MarketPlace — L1 Native ZION Bonus Payout

This document describes the on-chain ZION L1 token bonus flow for customer orders.

## Overview

When a customer places an order that includes ZION token bonuses, the MarketPlace backend:

1. Generates a fresh BIP39 12-word seed phrase and a `zion1...` address for the customer.
2. Stores the address, seed, public key, and secret key in the `ShopOrder` row.
3. Emails the customer their seed phrase and address.
4. When an admin clicks **Distribuovat tokeny**, the backend broadcasts a signed UTXO transaction from the configured pool wallet to the customer's address.
5. Records the on-chain transaction hash and emails the customer.

## Configuration

Add these variables to the production `.env` (`/opt/zion/APP&WEB/MarketPlace/.env`):

```env
# ZION L1 RPC endpoint. The default is the local node; use the public RPC if the
# app is not co-located with the node.
ZION_L1_RPC_URL="rpc.zionterranova.com:8443"

# Path to the pool wallet file used to pay bonuses. The file is created automatically
# if it does not exist and a secret key or mnemonic is provided. Should be a secure
# path with 600 permissions, e.g. /etc/zion/MarketPlace/pool-wallet.json.
ZION_L1_POOL_WALLET_PATH="/etc/zion/MarketPlace/pool-wallet.json"

# Either the 64-char Ed25519 secret key hex or the BIP39 mnemonic of the pool wallet.
# The secret key is preferred because ZION's L1 wallet does not use standard BIP39
# derivation for the premine/canonical keys.
ZION_L1_POOL_WALLET_SECRET_KEY=""
ZION_L1_POOL_WALLET_MNEMONIC=""

# Fee in ZION for each payout transaction.
ZION_L1_PAYOUT_FEE="0.01"

# Path to the zion CLI binary (optional; default is the local V31 release build).
ZION_CLI_PATH="/home/zionserver/2.9.6-main/V31/releases/linux-x86_64/zion"
```

## Pool wallet setup

The pool wallet must contain spendable UTXOs on ZION L1. To create the wallet file from a known secret key:

```bash
mkdir -p /etc/zion/MarketPlace
chmod 700 /etc/zion/MarketPlace
cat > /etc/zion/MarketPlace/pool-wallet.json <<'EOF'
{
  "address": "zion1...",
  "public_key": "...",
  "secret_key": "...",
  "created_at": "2026-08-07T00:00:00Z"
}
EOF
chmod 600 /etc/zion/MarketPlace/pool-wallet.json
```

Alternatively, set `ZION_L1_POOL_WALLET_SECRET_KEY` in the `.env` and the backend will create the file on the first payout.

## Customer wallet derivation

Customer wallets use a BIP39 12-word seed phrase. The first 32 bytes of the BIP39 seed are used as the Ed25519 private key. The public key and `zion1` address are derived with the same algorithm as the `zion` CLI:

- SHA-256 the public key.
- RIPEMD-160 the result.
- Encode with the custom ZION base32 alphabet: `023456789acdefghjklmnpqrstuvwxyz`.
- Truncate the body to 35 characters.
- Append a 4-character SHA-256 checksum over `zion1` + body.

This matches the address format produced by `zion wallet create` and `zion_core::crypto::derive_address`.

## Database migration

The `ShopOrder` table has new columns:

```prisma
customerWalletAddress   String?
customerWalletSeed      String?  @db.Text
customerWalletPublicKey String?
customerWalletSecretKey String?  @db.Text
```

After deploying the new code, run:

```bash
cd /opt/zion/APP&WEB/MarketPlace
npx prisma db push
```

## Deploy procedure

```bash
# On the build/local machine
cd /home/zionserver/2.9.6-main/APP&WEB/MarketPlace
npm install
npm run build

# Sync to the Edge server (example)
rsync -avz --delete \
  --exclude='.env' --exclude='node_modules' --exclude='.next' \
  ./ zionserver@62.171.141.136:/opt/zion/APP&WEB/MarketPlace/

# On the Edge server
ssh zionserver@62.171.141.136
cd /opt/zion/APP&WEB/MarketPlace
npm install
npm run build
npx prisma db push
systemctl restart zion-marketplace.service
```

## Admin workflow

1. Customer places an order with ZION token bonuses.
2. Customer receives an order confirmation and a separate wallet email with the seed phrase.
3. When the order is paid, the admin opens the order in `/admin/orders`.
4. The admin clicks **Distribuovat tokeny**.
5. The backend broadcasts the payout, records the tx hash, and sends the token bonus email.

## Troubleshooting

### `no spendable UTXOs found for address ...`

The pool wallet has no spendable UTXOs. Ensure the pool wallet has been funded on ZION L1 and that the node is fully synced. The public RPC at `rpc.zionterranova.com:8443` must report a non-zero chain height.

### `Invalid ZION address`

The customer's `customerWalletAddress` is invalid or missing. New orders generate a valid address automatically; legacy orders without a wallet address fall back to manual tx hash entry.

### Payout fails with RPC error

- Verify `ZION_L1_RPC_URL` is reachable from the MarketPlace server.
- The `zion` CLI binary at `ZION_CLI_PATH` must match the V31 release and be executable.
- Ensure the pool wallet file has correct ownership and permissions (`600`).

## Security notes

- Customer seed phrases are stored in the database and emailed to the customer. This is a custodial convenience model; customers should save the seed offline.
- Pool wallet secret keys must never be committed to git. Use `.env` or a secure file with 600 permissions.
- The `zion-marketplace.service` should run as a dedicated, low-privilege user.
