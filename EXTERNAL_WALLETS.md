# Pool External Wallet Addresses

This file lists the payout wallet addresses used by the ZION Edge pool for
AuxPoW merge-mining. Each coin has its own address because most upstream pools
pay out in the native coin.

## How to update on the server

1. Edit `/etc/zion/edge-environment.sh` on `62.171.141.136`.
2. Replace the `<...>` placeholders with real addresses.
3. Save the file and restart the pool:

   ```bash
   systemctl restart zion-edge-pool.service
   ```

4. Verify the running process sees the new wallets:

   ```bash
   PID=$(systemctl show zion-edge-pool.service -p MainPID --value)
   strings /proc/$PID/environ | grep ZION_POOL_AUXPOW_WALLET
   ```

You can also update these through the dashboard at `https://dashboard.zionterranova.com`
in the **Pool / AuxPoW setup** section.

## Fallback wallet

```bash
# Default payout wallet for NiceHash-style BTC-payout pools.
ZION_POOL_AUXPOW_WALLET=3QydNRmKkdcZYnQdTRN22yVTY3hZY88gTk
```

## Per-coin wallets

| Env variable | Coin | Algo / pool family | Current value |
|---|---|---|---|
| `ZION_POOL_AUXPOW_WALLET_DCR` | DCR | blake3 / woolypooly | `DsS2xr7euL9MdPRUNK8XXatq63rKYCZ5aPz` |
| `ZION_POOL_AUXPOW_WALLET_ALPH` | ALPH | blake3 / woolypooly | `<YOUR_ALPH_WALLET>` |
| `ZION_POOL_AUXPOW_WALLET_KAS` | KAS | kHeavyHash / herominers | `<YOUR_KAS_WALLET>` |
| `ZION_POOL_AUXPOW_WALLET_ERG` | ERG | Autolykos | `<YOUR_ERG_WALLET>` |
| `ZION_POOL_AUXPOW_WALLET_RVN` | RVN | kawpow | `<YOUR_RVN_WALLET>` |
| `ZION_POOL_AUXPOW_WALLET_ETC` | ETC | ethash | `<YOUR_ETC_WALLET>` |
| `ZION_POOL_AUXPOW_WALLET_EVR` | EVR | kawpow | `<YOUR_EVR_WALLET>` |
| `ZION_POOL_AUXPOW_WALLET_MEWC` | MEWC | kawpow | `<YOUR_MEWC_WALLET>` |
| `ZION_POOL_AUXPOW_WALLET_FLUX` | FLUX | ZelHash | `<YOUR_FLUX_WALLET>` |
| `ZION_POOL_AUXPOW_WALLET_CLORE` | CLORE | kawpow | `<YOUR_CLORE_WALLET>` |
| `ZION_POOL_AUXPOW_WALLET_XMR` | XMR | RandomX | `42m86RBWf4PeuRf8P5rwA96XvmCKAfF77doWYJRv3KKAKrT8GTb5b3pbHTtaZsbJ4BERW1NHgh8WQgpAxAoEiXF82skcKsK` |
| `ZION_POOL_AUXPOW_WALLET_VRSC` | VRSC | VerusHash | `RLFQYsdd8wGGUgMgk17WrqdGNtkAVSCfDQ` |
| `ZION_POOL_AUXPOW_WALLET_EPIC` | EPIC | ProgPow | `<YOUR_EPIC_WALLET>` |
| `ZION_POOL_AUXPOW_WALLET_PRL` | PRL | PearlHash | `<YOUR_PRL_WALLET>` |
| `ZION_POOL_AUXPOW_WALLET_QUAI` | QUAI | KawPoW / 2miners | `<YOUR_QUAI_WALLET>` |
| `ZION_POOL_AUXPOW_WALLET_BEAM` | BEAM | BeamHash III | `<YOUR_BEAM_WALLET>` |
| `ZION_POOL_AUXPOW_WALLET_ZCL` | ZCL | Equihash | `<YOUR_ZCL_WALLET>` |
| `ZION_POOL_AUXPOW_WALLET_NEXA` | NEXA | NexaPow | `<YOUR_NEXA_WALLET>` |
| `ZION_POOL_AUXPOW_WALLET_IRON` | IRON | IronFish | `<YOUR_IRON_WALLET>` |
| `ZION_POOL_AUXPOW_WALLET_RTM` | RTM | GhostRider | `RBksKgzcxTWaewQQ7niX1KT4r4L5Ch8iJB` |
| `ZION_POOL_AUXPOW_WALLET_ZANO` | ZANO | ProgPoW / HeroMiners | `ZxCt59P65o1b5f4bDLKrttXY9xPrrQcy58DqCmrjZiGmNim5CYRfxZ6CK1Up55q9mGSBjaLRKtdNYFLc3LLuhzrn1d9bpBxwV` |

## Optional / extra coins

These coins are in `AUXPOW_SUPPORTED_COINS` but are not present in the default
env template yet. Add the lines below if you want to mine them.

```bash
ZION_POOL_AUXPOW_WALLET_KLS=<YOUR_KLS_WALLET>
ZION_POOL_AUXPOW_WALLET_QTC=<YOUR_QTC_WALLET>
ZION_POOL_AUXPOW_WALLET_VTC=<YOUR_VTC_WALLET>
ZION_POOL_AUXPOW_WALLET_DNX=<YOUR_DNX_WALLET>
```

## Notes

- Empty variables mean the pool will **not** start an AuxPoW bridge for that coin.
- The default `ZION_POOL_AUXPOW_WALLET` is used as a fallback when a per-coin
  wallet is not set (typically a BTC payout address for NiceHash-like pools).
- Make sure each address matches the payout currency expected by the upstream
  pool. For example, `BEAM` pools usually require a BEAM address, while `QUAI`
  on 2miners can pay to a BTC address through the fallback wallet.
