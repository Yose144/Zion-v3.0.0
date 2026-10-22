# ZION Wallet

ZION uses its own address format based on the `zion1...` structure.

## The easiest way — via ZION Public Miner

If you're using the desktop application:

1. Open the **Wallet** tab.
2. Click **Create Wallet**.
3. Write down your seed in a safe place.
4. Your public address (`zion1...`) will be automatically used for mining.

## Creating a wallet from the command line

```bash
export ZION_WALLET_PASSWORD="your-strong-password"
zion wallet new --out zion-wallet.json --password-env ZION_WALLET_PASSWORD
```

## Seed backup

- Write down your 12/24-word seed in a safe offline location.
- Never store your seed in the cloud or take a photo of it.
- Back up your address and public key for receiving funds.

## Receiving and sending

```bash
# Balance
zion wallet balance

# Send
zion wallet send --to zion1EXAMPLE_ADDRESS --amount 10.5 --memo "test"
```

## Security tips

1. Use a hardware wallet if available.
2. Never enter your seed into web forms.
3. Before a large transaction, run a test with a small amount.
